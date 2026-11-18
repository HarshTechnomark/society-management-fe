'use client';
import { Chip } from '@/components/ui/Chip';
import type { TicketComment } from '@/types/helpdesk';
import { rupeeText } from '../resident/format';
import { AttachmentStrip } from './AttachmentStrip';
import { COMMENT_KIND_LABEL, STATUS_LABEL, dateTime } from './format';

function recipients(meta: Record<string, unknown>): string {
  const r = meta.recipients;
  return Array.isArray(r)
    ? r
        .map(x => (typeof x === 'string' ? x : String((x as { name?: unknown })?.name ?? '')))
        .filter(Boolean)
        .join(', ')
    : '';
}

/** Newest first. Internal entries carry the amber "Internal" chip; escalations show level and recipients. */
export function Timeline({
  entries,
  onRemove,
  ticketId,
}: {
  entries: TicketComment[];
  ticketId?: number;
  onRemove?: (c: TicketComment) => void;
}) {
  if (entries.length === 0) return <p className="text-[14px] text-muted">No updates yet.</p>;
  return (
    <ol aria-label="Timeline" className="grid gap-2">
      {entries.map(c => {
        const status =
          c.toStatus != null
            ? `${STATUS_LABEL[(c.fromStatus ?? '') as keyof typeof STATUS_LABEL] ?? c.fromStatus ?? ''} to ${STATUS_LABEL[c.toStatus as keyof typeof STATUS_LABEL] ?? c.toStatus}`
            : '';
        const level = c.kind === 'ESCALATION' ? Number(c.metadata.level) : NaN;
        return (
          <li key={c.id} className="rounded-xl bg-white/50 p-3 text-[14px]">
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
              <strong className="text-ink">{c.authorLabel || 'System'}</strong>
              <span>{dateTime(c.createdAt)}</span>
              {c.kind !== 'COMMENT' && <Chip>{COMMENT_KIND_LABEL[c.kind] ?? c.kind}</Chip>}
              {c.visibility === 'INTERNAL' && <Chip tone="warn">Internal note</Chip>}
              {c.visibility === 'PUBLIC' && c.kind === 'COMMENT' && <Chip tone="ok">Public</Chip>}
              {c.notifyAffected && <Chip tone="info">Sent to affected flats</Chip>}
              {onRemove && c.canDelete && (
                <button type="button" className="ml-auto font-semibold underline" onClick={() => onRemove(c)}>
                  Remove
                </button>
              )}
            </div>
            {status && <p className="mt-1 font-semibold">{status}</p>}
            {c.kind === 'ESCALATION' && (
              <p className="mt-1 font-semibold">
                {Number.isFinite(level) ? `Escalated to level ${level}` : 'Escalated'}
                {recipients(c.metadata) ? `: ${recipients(c.metadata)}` : ''}
              </p>
            )}
            {c.body && <p className="mt-1 whitespace-pre-wrap">{rupeeText(c.body)}</p>}
            {ticketId != null && c.fileIds.length > 0 && (
              <div className="mt-2">
                <AttachmentStrip ticketId={ticketId} fileIds={c.fileIds} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
