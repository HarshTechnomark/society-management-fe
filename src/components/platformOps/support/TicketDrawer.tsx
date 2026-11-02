'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { Avatar } from '@/components/access/Avatar';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { PlatformTicket, TicketPriority, TicketStatus } from '@/types/platformOps';
import { AttachmentChips, Attachments } from '../Attachments';
import {
  CATEGORY_LABEL,
  PriorityChip,
  TICKET_STATUS,
  TicketStatusChip,
  hoursMinutes,
  opsError,
  timeAgo,
} from '../format';

const STATUS_OPTIONS = (Object.keys(TICKET_STATUS) as TicketStatus[]).map(v => ({
  value: v,
  label: TICKET_STATUS[v][0],
}));
const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

/** SLA line: "First response due in 1 h 20 m", red when breached (spec 11.2). */
export function slaLine(t: PlatformTicket, now = Date.now()): { text: string; breached: boolean } | null {
  if (t.status === 'RESOLVED' || t.status === 'CLOSED') return null;
  const s = t.sla;
  const phase = s.firstRespondedAt
    ? { name: 'Resolution', due: s.resolutionDueAt, breached: !!s.resolutionBreachedAt }
    : { name: 'First response', due: s.firstResponseDueAt, breached: !!s.firstResponseBreachedAt };
  if (!phase.due) return null;
  const mins = (Date.parse(phase.due) - now) / 60000;
  if (phase.breached || mins < 0)
    return { text: `${phase.name} overdue by ${hoursMinutes(Math.abs(mins))}`, breached: true };
  return { text: `${phase.name} due in ${hoursMinutes(mins)}`, breached: false };
}

export function TicketDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.platform.tickets.edit);
  const canAccess = usePermission(PERMISSIONS.platform.supportAccess.create);
  const [ticket, setTicket] = useState<PlatformTicket | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [team, setTeam] = useState<{ userId: number; name: string }[]>([]);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<number[]>([]);
  const [status, setStatus] = useState<TicketStatus>('OPEN');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [assignee, setAssignee] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const apply = (t: PlatformTicket) => {
    setTicket(t);
    setStatus(t.status);
    setPriority(t.priority);
    setAssignee(t.assignee ? String(t.assignee.id) : '');
  };
  const load = () =>
    svc.ticket(id).then(
      t => {
        apply(t);
        setError(null);
      },
      e => setError(e),
    );

  useEffect(() => {
    let live = true;
    svc.ticket(id).then(
      t => live && apply(t),
      e => live && setError(e),
    );
    svc.assignees().then(
      t => live && setTeam(t),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [id]);

  const save = async () => {
    if (!ticket) return;
    setProblem(null);
    const text = reply.trim();
    const needsClose = status === 'CLOSED' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED';
    if (needsClose && closeReason.trim().length < 5) {
      setProblem('Give a reason (at least 5 characters) for closing this ticket.');
      return;
    }
    const patch: Record<string, unknown> = {};
    if (status !== ticket.status) patch.status = status;
    if (priority !== ticket.priority) patch.priority = priority;
    const wanted = assignee === '' ? null : Number(assignee);
    if (wanted !== (ticket.assignee?.id ?? null)) patch.assigneeUserId = wanted;
    if (needsClose) patch.closeReason = closeReason.trim();
    if (!text && Object.keys(patch).length === 0) {
      setProblem('Nothing to save. Write a reply or change a field.');
      return;
    }
    setBusy(true);
    let version = ticket.version;
    try {
      if (text) {
        const r = await svc.replyTicket(ticket.id, {
          body: text,
          visibility: internal ? 'INTERNAL' : 'PUBLIC',
          ...(files.length ? { fileIds: files } : {}),
        });
        version = r.ticket.version;
        setReply('');
        setFiles([]);
      }
      if (Object.keys(patch).length > 0) {
        const t = await svc.updateTicket(ticket.id, { version, ...patch });
        apply(t);
      } else await load();
      toast.show('Ticket saved.');
      onChanged();
    } catch (e) {
      setProblem(opsError(e));
      // The typed reply stays; the drawer shows the latest ticket.
      if (e instanceof ApiError && e.code === 'STALE_VERSION') await load();
      else if (text) await load();
    } finally {
      setBusy(false);
    }
  };

  const sla = ticket ? slaLine(ticket) : null;
  return (
    <Drawer
      open
      onClose={onClose}
      size={640}
      title={ticket ? `${ticket.ticketNo} · ${ticket.subject}` : 'Ticket'}
      footer={
        ticket && canEdit ? (
          <>
            {canAccess && (
              <Link
                href={`/platform/societies/${ticket.society.id}`}
                className={buttonClasses('glass', 'md')}
              >
                Request access
              </Link>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button loading={busy} onClick={save} disabled={ticket.status === 'CLOSED'}>
              Save
            </Button>
          </>
        ) : undefined
      }
    >
      {error ? (
        <ErrorState error={error} />
      ) : !ticket ? (
        <div className="skeleton h-40 w-full" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
            <TicketStatusChip status={ticket.status} />
            <PriorityChip priority={ticket.priority} />
            <Chip>{CATEGORY_LABEL[ticket.category] ?? ticket.category}</Chip>
            <span className="text-muted">
              {ticket.society.name} · opened {timeAgo(ticket.createdAt)}
            </span>
          </div>
          {sla && (
            <p
              role={sla.breached ? 'alert' : undefined}
              className={`mb-3 text-[13.5px] font-semibold ${sla.breached ? 'text-bad' : 'text-muted'}`}
            >
              {sla.text}
            </p>
          )}
          {problem && <Alert tone="bad">{problem}</Alert>}
          <ol aria-label="Messages" className="mb-4 space-y-3">
            {(ticket.messages ?? []).map(m => {
              const system = m.authorSide === 'SYSTEM' || m.kind !== 'MESSAGE';
              if (system)
                return (
                  <li key={m.id} className="text-center text-[12.5px] text-muted">
                    {m.body} · {timeAgo(m.createdAt)}
                    {m.visibility === 'INTERNAL' && ' · internal'}
                  </li>
                );
              const note = m.visibility === 'INTERNAL';
              return (
                <li
                  key={m.id}
                  className={`flex gap-3 rounded-[16px] p-3 ${note ? 'bg-[rgba(201,169,97,0.18)]' : 'bg-white/60'}`}
                >
                  <Avatar name={m.authorName} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13px]">
                      <b>{m.authorName}</b>
                      {note && <Chip tone="gold">Internal note</Chip>}
                      <span className="text-muted">{timeAgo(m.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{m.body}</p>
                    <AttachmentChips files={m.attachments} />
                  </div>
                </li>
              );
            })}
          </ol>
          {canEdit && ticket.status !== 'CLOSED' && (
            <div>
              <Textarea
                label={internal ? 'Internal note' : 'Reply'}
                value={reply}
                onChange={e => setReply(e.target.value)}
                rows={4}
                maxLength={5000}
              />
              <div
                role="group"
                aria-label="Reply type"
                className="mb-3 mt-2 flex gap-1 rounded-full border border-white/80 bg-white/55 p-[3px] text-[13px] font-semibold"
              >
                {[
                  [false, 'Public reply'],
                  [true, 'Internal note'],
                ].map(([v, l]) => (
                  <button
                    key={String(l)}
                    type="button"
                    aria-pressed={internal === v}
                    onClick={() => setInternal(v as boolean)}
                    className={`h-8 flex-1 rounded-full px-3 ${internal === v ? 'bg-navy text-[#FDF8EE]' : 'text-muted'}`}
                  >
                    {l as string}
                  </button>
                ))}
              </div>
              <Attachments onChange={setFiles} />
              <div className="grid gap-3 min-[600px]:grid-cols-3">
                <Select
                  label="Status"
                  value={status}
                  onChange={e => setStatus(e.target.value as TicketStatus)}
                  options={STATUS_OPTIONS}
                />
                <Select
                  label="Assignee"
                  value={assignee}
                  onChange={e => setAssignee(e.target.value)}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...team.map(t => ({ value: String(t.userId), label: t.name })),
                  ]}
                />
                <Select
                  label="Priority"
                  value={priority}
                  onChange={e => setPriority(e.target.value as TicketPriority)}
                  options={PRIORITY_OPTIONS}
                />
              </div>
              {status === 'CLOSED' && ticket.status !== 'RESOLVED' && (
                <Input
                  label="Reason for closing"
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                />
              )}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
