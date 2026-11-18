import { Chip } from '@/components/ui/Chip';
import { plural } from '@/lib/plural';
import type { TicketListItem } from '@/types/helpdesk';
import { ago, priorityTone, slaChip } from './format';

/** One issue card (spec 11.1): priority, SLA, title, place, assignee, age, and for building issues the reach. */
export function IssueRow({ item, onOpen }: { item: TicketListItem; onOpen: () => void }) {
  const sla = slaChip(item.slaState, item.resolutionDueAt, item.status);
  const building = item.kind === 'BUILDING';
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col gap-1.5 rounded-2xl bg-white/50 p-3.5 text-left hover:bg-white/80"
        aria-label={`Open ${item.title}`}
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <Chip tone={priorityTone(item.priority)}>{item.priority}</Chip>
          {sla && <Chip tone={sla.tone}>{sla.text}</Chip>}
          {item.assigneeInactive && <Chip tone="warn">Assignee left</Chip>}
          {building && item.affectedUnitCount > 0 && <Chip>{plural(item.affectedUnitCount, 'flat')}</Chip>}
          {building && item.upvoteCount > 0 && <Chip>{item.upvoteCount} me too</Chip>}
          <span className="ml-auto text-[12px] text-muted">{item.ticketNo}</span>
        </span>
        <span className="text-[15px] font-bold">{item.title}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
          <span>
            <span aria-hidden="true">{building ? '\u{1F3E2}' : '\u{1F3E0}'}</span>{' '}
            <span className="sr-only">{building ? 'Building issue: ' : 'Flat: '}</span>
            {item.locationLabel || item.categoryName}
          </span>
          {item.assigneeLabel ? (
            <span>{item.assigneeLabel}</span>
          ) : (
            <strong className="text-ink">Unassigned</strong>
          )}
          <span>{ago(item.createdAt)}</span>
        </span>
      </button>
    </li>
  );
}
