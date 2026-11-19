import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import type { NoticeItem } from '@/types/residentNotices';
import { ago } from '../format';
import { categoryLabel } from './format';

/** One notice row: unread dot, Ack required badge, pinned and expired states. */
export function NoticeCard({ n }: { n: NoticeItem }) {
  const unread = !n.readAt;
  const expired = n.status === 'EXPIRED';
  return (
    <li>
      <Link
        href={`/resident/notices/${n.id}`}
        className={cx(
          'block rounded-2xl bg-white/60 p-3.5 hover:bg-white/90',
          expired && 'opacity-60',
          n.priority === 'HIGH' && 'border-l-4 border-bad',
        )}
      >
        <div className="flex items-start gap-2">
          {unread && (
            <span role="img" aria-label="Unread" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-navy" />
          )}
          <div className="min-w-0 flex-1">
            <p className={cx('text-[15px]', unread ? 'font-bold' : 'font-semibold')}>{n.title}</p>
            {n.excerpt && <p className="mt-0.5 line-clamp-2 text-[13.5px] text-muted">{n.excerpt}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip>{categoryLabel(n.category)}</Chip>
              {n.isPinned && <Chip tone="gold">Pinned</Chip>}
              {n.priority === 'HIGH' && <Chip tone="bad">Important</Chip>}
              {n.requiresAck && !n.acknowledgedAt && <Chip tone="warn">Ack required</Chip>}
              {n.requiresAck && n.acknowledgedAt && <Chip tone="ok">Acknowledged</Chip>}
              {expired && <Chip>Expired</Chip>}
              {n.attachmentCount > 0 && (
                <Chip tone="neutral">
                  {n.attachmentCount} file{n.attachmentCount === 1 ? '' : 's'}
                </Chip>
              )}
              <span className="text-[12px] text-muted">{ago(n.publishedAt)}</span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
