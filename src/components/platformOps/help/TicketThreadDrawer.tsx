'use client';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { FormModal } from '@/components/billing/FormModal';
import { Avatar } from '@/components/access/Avatar';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { SocietyTicket } from '@/types/platformOps';
import { AttachmentChips, Attachments } from '../Attachments';
import { TicketStatusChip, isFuture, opsError, timeAgo } from '../format';

/** Spec 11.10 ticket thread: oldest first, platform replies labelled, reply, close, reopen and rate. */
export function TicketThreadDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canWrite = usePermission(PERMISSIONS.settings.support.create);
  const [t, setT] = useState<SocietyTicket | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState<number[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [why, setWhy] = useState('');
  const [stars, setStars] = useState(0);

  const reload = () =>
    svc.societyTicket(id).then(
      x => {
        setT(x);
        setError(null);
      },
      e => setError(e),
    );
  useEffect(() => {
    let live = true;
    svc.societyTicket(id).then(
      x => live && setT(x),
      e => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [id]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setProblem(null);
    setBusy(true);
    try {
      await fn();
      toast.show(done);
      await reload();
      onChanged();
    } catch (e) {
      setProblem(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    if (!reply.trim()) return setProblem('Write a reply first.');
    return act(async () => {
      await svc.replySocietyTicket(id, { body: reply.trim(), ...(files.length ? { fileIds: files } : {}) });
      setReply('');
      setFiles([]);
    }, 'Reply sent.');
  };

  const closed = t?.status === 'CLOSED';
  const resolved = t?.status === 'RESOLVED';
  const canReopen = resolved && isFuture(t?.reopenAllowedUntil);
  return (
    <Drawer open onClose={onClose} size={640} title={t ? `${t.ticketNo} · ${t.subject}` : 'Ticket'}>
      {error ? (
        <ErrorState error={error} />
      ) : !t ? (
        <div className="skeleton h-40 w-full" />
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
            <TicketStatusChip status={t.status} />
            {t.assignee && <span className="text-muted">With {t.assignee.name}</span>}
          </p>
          {problem && <Alert tone="bad">{problem}</Alert>}
          <ol aria-label="Messages" className="mb-4 space-y-3">
            {(t.messages ?? []).map(m => {
              if (m.authorSide === 'SYSTEM' || m.kind !== 'MESSAGE')
                return (
                  <li key={m.id} className="text-center text-[12.5px] text-muted">
                    {m.body} · {timeAgo(m.createdAt)}
                  </li>
                );
              const support = m.authorSide === 'PLATFORM';
              const who = support ? `SocietyApp Support · ${m.authorName}` : m.authorName;
              return (
                <li
                  key={m.id}
                  className={`flex gap-3 rounded-[16px] p-3 ${support ? 'bg-[rgba(20,48,65,0.07)]' : 'bg-white/60'}`}
                >
                  <Avatar name={who} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px]">
                      <b>{who}</b> <span className="text-muted">{timeAgo(m.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{m.body}</p>
                    <AttachmentChips files={m.attachments} />
                  </div>
                </li>
              );
            })}
          </ol>
          {canWrite && !closed && !resolved && (
            <div>
              <Textarea
                label="Reply"
                rows={4}
                maxLength={5000}
                value={reply}
                onChange={e => setReply(e.target.value)}
              />
              <Attachments label="Attach screenshots" camera onChange={setFiles} />
              <div className="flex flex-wrap gap-2">
                <Button loading={busy} onClick={send}>
                  Send reply
                </Button>
                <Button
                  variant="glass"
                  disabled={busy}
                  onClick={() => act(() => svc.closeTicket(id), 'Ticket closed.')}
                >
                  Close ticket
                </Button>
              </div>
            </div>
          )}
          {canWrite && resolved && (
            <div className="rounded-[16px] bg-white/60 p-4">
              <p className="mb-2 text-[14px] font-semibold">This ticket is resolved.</p>
              <div className="flex flex-wrap gap-2">
                {canReopen ? (
                  <Button variant="glass" onClick={() => setReopening(true)}>
                    Reopen
                  </Button>
                ) : null}
                <Button
                  variant="glass"
                  disabled={busy}
                  onClick={() => act(() => svc.closeTicket(id), 'Ticket closed.')}
                >
                  Close ticket
                </Button>
              </div>
              {canReopen && t.reopenAllowedUntil && (
                <p className="mt-2 text-[12.5px] text-muted">
                  You can reopen until {shortDate(t.reopenAllowedUntil)}
                </p>
              )}
            </div>
          )}
          {canWrite && (resolved || closed) && t.satisfactionRating === null && (
            <fieldset className="mt-4">
              <legend className="mb-1 text-[13px] font-semibold">Rate this support</legend>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    aria-pressed={stars === n}
                    onClick={() => setStars(n)}
                    className={`text-[26px] leading-none ${n <= stars ? 'text-[#b8954a]' : 'text-[rgba(20,35,44,0.25)]'}`}
                  >
                    ★
                  </button>
                ))}
                <Button
                  size="sm"
                  className="ml-2"
                  disabled={stars === 0 || busy}
                  onClick={() => act(() => svc.rateTicket(id, stars), 'Thank you for rating.')}
                >
                  Send rating
                </Button>
              </div>
            </fieldset>
          )}
          {t.satisfactionRating !== null && (
            <p className="mt-4 text-[13px] text-muted">You rated this {t.satisfactionRating} out of 5.</p>
          )}
        </>
      )}
      {reopening && (
        <FormModal
          title="Reopen this ticket"
          description="Tell us why it is not fixed."
          submitLabel="Reopen"
          onClose={() => setReopening(false)}
          onDone={() => {
            setReopening(false);
            setWhy('');
            void reload();
            onChanged();
          }}
          onSubmit={async () => {
            if (why.trim().length < 10) return { error: 'Write at least 10 characters.' };
            await svc.reopenTicket(id, why.trim());
            return { message: 'Ticket reopened.' };
          }}
        >
          <Textarea label="Why it is not fixed" value={why} onChange={e => setWhy(e.target.value)} />
        </FormModal>
      )}
    </Drawer>
  );
}
