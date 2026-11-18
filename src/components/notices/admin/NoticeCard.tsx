'use client';
import { Chip } from '@/components/ui/Chip';
import type { NoticeListItem } from '@/types/notices';
import { plural } from '@/lib/plural';
import { ACTION_LABEL, CATEGORY_LABEL, STATUS_LABEL, dateTime, readPct, statusTone } from './format';

/** One notice card of the list (spec 11.1): chips, excerpt, action chips and the read meter. */
export function NoticeCard({ item, onOpen }: { item: NoticeListItem; onOpen: () => void }) {
  const live = item.status === 'PUBLISHED' || item.status === 'EXPIRED';
  const p = readPct(item);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${item.title}`}
        className="glass block h-full w-full p-4 text-left hover:bg-white/80"
      >
        <span className="mb-2 flex flex-wrap items-center gap-1.5">
          <Chip tone={statusTone(item.status)}>{STATUS_LABEL[item.status]}</Chip>
          {item.isPinned && <Chip tone="gold">Pinned</Chip>}
          <Chip>{CATEGORY_LABEL[item.category] ?? item.category}</Chip>
          {item.priority === 'HIGH' && <Chip tone="bad">High priority</Chip>}
          {item.kind === 'UTILITY_SHUTDOWN' && <Chip tone="warn">Utility</Chip>}
        </span>
        <span className="block text-[15.5px] font-bold">{item.title}</span>
        <span className="mt-1 block text-[13.5px] text-muted">{item.excerpt.slice(0, 100)}</span>
        {(item.actions.length > 0 || item.requiresAck) && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {item.actions.map(a => (
              <Chip key={a.type} tone="info">
                {a.label || ACTION_LABEL[a.type] || a.type}
              </Chip>
            ))}
            {item.requiresAck && <Chip tone="warn">Ack required</Chip>}
          </span>
        )}
        {live ? (
          <span className="mt-3 block" data-testid="read-meter">
            <span className="mb-1 flex justify-between text-[12.5px] text-muted">
              <span>{p}% read</span>
              <span>
                {item.requiresAck
                  ? `${item.ackCount} acknowledged`
                  : `${plural(item.recipientCount, 'person', 'people')} reached`}
              </span>
            </span>
            <span
              role="progressbar"
              aria-label="Read"
              aria-valuenow={p}
              aria-valuemin={0}
              aria-valuemax={100}
              className="block h-1.5 overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
            >
              <span className="block h-full rounded-full bg-navy" style={{ width: `${p}%` }} />
            </span>
          </span>
        ) : (
          <span className="mt-3 block text-[12.5px] text-muted">
            {item.audienceLabel}
            {item.author && ` · ${item.author.name}`}
            {item.scheduledAt && ` · sends ${dateTime(item.scheduledAt)}`}
          </span>
        )}
      </button>
    </li>
  );
}
