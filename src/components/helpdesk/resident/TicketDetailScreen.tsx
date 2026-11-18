'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { helpdeskResidentService as svc } from '@/services/helpdeskResident.service';
import type { ResidentTicket, TicketComment } from '@/types/helpdeskResident';
import { PhotoPicker, uploadPhotos } from './PhotoPicker';
import {
  PRIORITY_LABEL,
  STEPS,
  canDo,
  commentAuthor,
  rupeeText,
  estimateOpen,
  etaText,
  helpError,
  isTerminal,
  plainHelpError,
  statusLabel,
  statusTone,
  stepIndex,
  whenText,
} from './format';

/** One complaint or building issue (spec 11.6 ticket detail). */
export function TicketDetailScreen({ id }: { id: number }) {
  return (
    <Gate view={PERMISSIONS.resident.helpdesk.view} title="Help">
      <Inner id={id} />
    </Gate>
  );
}

export function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className={cx(
            'text-[30px] leading-none',
            n <= value ? 'text-gold-ink' : 'text-[rgba(20,35,44,0.25)]',
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

type Dialog = null | 'confirm' | 'rate' | 'reopen' | 'cancel' | 'escalate' | 'reject';

function Inner({ id }: { id: number }) {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.resident.helpdesk.edit);
  const t = useLoad(() => svc.ticket(id), `ticket-${id}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<ResidentTicket | null>(null);

  /** Runs an action, shows its result, keeps the ticket the action returned and reloads it: every action changes the version, and the buttons follow the newest ticket. */
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await fn();
      if (r && typeof r === 'object' && Array.isArray((r as ResidentTicket).allowedActions))
        setFresh(r as ResidentTicket);
      toast.show(done);
      setDialog(null);
      t.reload();
    } catch (e) {
      setProblem(helpError(e));
      setDialog(null);
      t.reload();
    } finally {
      setBusy(false);
    }
  };

  if (t.loading && !t.data)
    return (
      <Page>
        <div className="skeleton h-48 w-full" />
      </Page>
    );
  if (t.error || !t.data)
    return (
      <Page>
        <ErrorState
          error={plainHelpError(t.error)}
          action={<button onClick={t.reload}>Try again</button>}
          notFoundAction={
            <Link href="/resident/help" className="underline">
              Back to Help
            </Link>
          }
        />
      </Page>
    );
  const d = fresh && fresh.id === t.data.id && fresh.version > t.data.version ? fresh : t.data;
  const eta = etaText(d);
  const step = stepIndex(d.status);
  const upvoteOk = d.kind === 'BUILDING' && d.myRelation !== 'REQUESTER' && !isTerminal(d.status);

  return (
    <Page>
      <PageHead
        title={d.title || d.ticketNo}
        sub={[d.ticketNo, d.categoryName, d.kind === 'BUILDING' ? d.locationLabel : d.unitLabel]
          .filter(Boolean)
          .join(' · ')}
        actions={<Chip tone={statusTone(d.status)}>{statusLabel(d.status)}</Chip>}
      />
      {problem && <Alert tone="bad">{problem}</Alert>}

      <Card>
        {d.status !== 'CANCELLED' && (
          <ol aria-label="Progress" className="mb-3 flex items-center gap-1">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === step ? 'step' : undefined}
                className={cx(
                  'h-1.5 flex-1 rounded-full',
                  i <= step ? 'bg-navy' : 'bg-[rgba(20,35,44,0.12)]',
                )}
                title={statusLabel(s)}
              />
            ))}
          </ol>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
          {d.assigneeLabel && (
            <>
              <dt className="text-muted">Looked after by</dt>
              <dd className="font-semibold">{d.assigneeLabel}</dd>
            </>
          )}
          {eta && (
            <>
              <dt className="text-muted">Timing</dt>
              <dd className="font-semibold">{eta}</dd>
            </>
          )}
          <dt className="text-muted">Priority</dt>
          <dd className="font-semibold">{PRIORITY_LABEL[d.priority] ?? d.priority}</dd>
          {d.kind === 'BUILDING' && (
            <>
              <dt className="text-muted">Me too</dt>
              <dd className="font-semibold">
                {d.upvoteCount}
                {d.affectedUnitCount > 0 ? ` · ${d.affectedUnitCount} flats affected` : ''}
              </dd>
            </>
          )}
          {d.myRating != null && (
            <>
              <dt className="text-muted">Your rating</dt>
              <dd className="font-semibold">{'★'.repeat(d.myRating)}</dd>
            </>
          )}
        </dl>
        {d.description && <p className="mt-3 whitespace-pre-line text-[14px]">{d.description}</p>}
        <Files ticketId={d.id} ids={d.fileIds} />
        {d.escalationRequestedAt && (
          <p className="mt-2 text-[13px] text-muted">
            You asked the committee to look at this on {whenText(d.escalationRequestedAt)}.
          </p>
        )}
      </Card>

      {d.charge && estimateOpen(d) && canEdit && d.canDecideEstimate !== false && (
        <Card title="Estimate for approval" className="mt-4">
          <p className="text-[14px]">
            The cost of this work is <b>{inr(d.charge.estimatePaise)}</b>.
            {d.charge.estimateNote ? ` ${d.charge.estimateNote}` : ''} Work starts after you approve.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              loading={busy}
              disabled={t.loading}
              onClick={() =>
                void run(
                  () => svc.decideEstimate(d.id, { decision: 'APPROVE', version: d.version }),
                  'Estimate approved. Work will start.',
                )
              }
            >
              Approve {inr(d.charge.estimatePaise)}
            </Button>
            <Button variant="glass" disabled={busy || t.loading} onClick={() => setDialog('reject')}>
              Decline
            </Button>
          </div>
        </Card>
      )}

      {canEdit && (
        <fieldset disabled={t.loading} className="mt-4 flex flex-wrap gap-2 border-0 p-0">
          {upvoteOk && (
            <Button
              variant={d.iUpvoted ? 'glass' : 'gold'}
              loading={busy}
              onClick={() =>
                void run(
                  () => (d.iUpvoted ? svc.removeUpvote(d.id) : svc.upvote(d.id)),
                  d.iUpvoted ? 'Me too removed.' : 'Thanks. We added your Me too.',
                )
              }
            >
              {d.iUpvoted ? 'Undo Me too' : 'Me too'}
            </Button>
          )}
          {canDo(d, 'CONFIRM') && (
            <Button
              loading={busy && !canDo(d, 'RATE')}
              onClick={() =>
                canDo(d, 'RATE')
                  ? setDialog('confirm')
                  : void run(() => svc.confirm(d.id, { version: d.version }), 'Thanks. Marked as fixed.')
              }
            >
              Confirm fixed
            </Button>
          )}
          {canDo(d, 'RATE') && !canDo(d, 'CONFIRM') && (
            <Button variant="glass" onClick={() => setDialog('rate')}>
              Rate
            </Button>
          )}
          {canDo(d, 'REOPEN') && (
            <Button variant="glass" onClick={() => setDialog('reopen')}>
              Reopen
            </Button>
          )}
          {canDo(d, 'ESCALATE') && (
            <Button variant="glass" onClick={() => setDialog('escalate')}>
              Ask the committee to look
            </Button>
          )}
          {canDo(d, 'CANCEL') && (
            <Button variant="danger-soft" onClick={() => setDialog('cancel')}>
              Cancel
            </Button>
          )}
        </fieldset>
      )}

      <Card title="Updates" className="mt-4">
        <Timeline comments={d.comments} ticketId={d.id} kind={d.kind} />
        {canEdit && canDo(d, 'COMMENT') && (
          <CommentBox
            ticket={d}
            onSent={() => {
              t.reload();
            }}
          />
        )}
      </Card>

      <RateDialog
        open={dialog === 'confirm' || dialog === 'rate'}
        confirming={dialog === 'confirm'}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={(score, comment) =>
          dialog === 'confirm'
            ? run(
                () =>
                  svc.confirm(d.id, {
                    version: d.version,
                    ...(score ? { score } : {}),
                    ...(comment ? { comment } : {}),
                  }),
                'Thanks. Marked as fixed.',
              )
            : run(() => svc.rate(d.id, { score, ...(comment ? { comment } : {}) }), 'Thanks for your rating.')
        }
      />
      <ConfirmReason
        open={dialog === 'reopen'}
        title="Reopen this complaint"
        description="Tell us what is still wrong."
        confirmLabel="Reopen"
        variant="primary"
        onCancel={() => setDialog(null)}
        onConfirm={reason => run(() => svc.reopen(d.id, { version: d.version, reason }), 'Reopened.')}
      />
      <ConfirmReason
        open={dialog === 'cancel'}
        title="Cancel this complaint"
        description="Tell us why you do not need it any more."
        confirmLabel="Cancel complaint"
        onCancel={() => setDialog(null)}
        onConfirm={reason => run(() => svc.cancel(d.id, { version: d.version, reason }), 'Cancelled.')}
      />
      <ConfirmReason
        open={dialog === 'escalate'}
        title="Ask the committee to look at this"
        description="Say why it needs their attention (at least 10 characters)."
        confirmLabel="Send to committee"
        variant="primary"
        minLength={10}
        onCancel={() => setDialog(null)}
        onConfirm={reason => run(() => svc.escalate(d.id, { reason }), 'Sent to the committee.')}
      />
      <ConfirmReason
        open={dialog === 'reject'}
        title="Decline the estimate"
        description="Tell us why, so the team can respond."
        confirmLabel="Decline"
        minLength={1}
        onCancel={() => setDialog(null)}
        onConfirm={comment =>
          run(
            () => svc.decideEstimate(d.id, { decision: 'REJECT', version: d.version, comment }),
            'Estimate declined.',
          )
        }
      />
    </Page>
  );
}

function RateDialog({
  open,
  confirming,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  confirming: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (score: number, comment: string) => void;
}) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={confirming ? 'Confirm it is fixed' : 'Rate this'}
      footer={
        <>
          <Button variant="glass" onClick={onClose}>
            Close
          </Button>
          <Button
            loading={busy}
            disabled={!confirming && score === 0}
            onClick={() => onSubmit(score, comment.trim())}
          >
            {confirming ? 'Confirm fixed' : 'Send rating'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <p className="text-[14px]">{confirming ? 'How did we do? (optional)' : 'How did we do?'}</p>
        <Stars value={score} onChange={setScore} />
        <Textarea
          label="Comment (optional)"
          value={comment}
          maxLength={500}
          onChange={e => setComment(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function Files({ ticketId, ids }: { ticketId: number; ids: number[] }) {
  const toast = useToast();
  if (ids.length === 0) return null;
  const open = async (fileId: number) => {
    try {
      const r = await svc.fileUrl(ticketId, fileId);
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      toast.show(helpError(e), 'error');
    }
  };
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {ids.map((f, i) => (
        <Button key={f} size="xs" variant="glass" onClick={() => void open(f)}>
          Photo {i + 1}
        </Button>
      ))}
    </div>
  );
}

function Timeline({
  comments,
  ticketId,
  kind,
}: {
  comments: TicketComment[];
  ticketId: number;
  kind: string;
}) {
  if (comments.length === 0) return <p className="text-[14px] text-muted">No updates yet.</p>;
  const ordered = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <ol className="grid gap-3">
      {ordered.map(c => (
        <li key={c.id} className="rounded-[14px] bg-white/60 p-3">
          <div className="flex items-baseline justify-between gap-2 text-[12.5px] text-muted">
            <span className="font-semibold text-ink">{commentAuthor(c.authorLabel, c.authorRole, kind)}</span>
            <time dateTime={c.createdAt}>{whenText(c.createdAt)}</time>
          </div>
          {c.kind === 'STATUS_CHANGE' && c.toStatus && (
            <div className="mt-1 text-[13px] font-semibold">Status: {statusLabel(c.toStatus)}</div>
          )}
          {c.body && <p className="mt-1 whitespace-pre-line text-[14px]">{rupeeText(c.body)}</p>}
          <Files ticketId={ticketId} ids={c.fileIds} />
        </li>
      ))}
    </ol>
  );
}

function CommentBox({ ticket, onSent }: { ticket: ResidentTicket; onSent: () => void }) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    if (!body.trim()) {
      setProblem('Write your message first.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const fileIds = files.length > 0 ? await uploadPhotos(files) : [];
      await svc.addComment(ticket.id, { body: body.trim(), ...(fileIds.length > 0 ? { fileIds } : {}) });
      setBody('');
      setFiles([]);
      toast.show('Message sent.');
      onSent();
    } catch (e) {
      setProblem(helpError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="mt-4 grid gap-3"
      noValidate
      onSubmit={ev => {
        ev.preventDefault();
        void send();
      }}
    >
      {problem && <Alert tone="bad">{problem}</Alert>}
      <Textarea label="Add a message" value={body} maxLength={2000} onChange={e => setBody(e.target.value)} />
      <PhotoPicker files={files} onChange={setFiles} disabled={busy} />
      <Button type="submit" loading={busy}>
        Send message
      </Button>
    </form>
  );
}
