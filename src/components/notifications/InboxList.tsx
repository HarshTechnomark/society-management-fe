'use client';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { notificationsService } from '@/services/notifications.service';
import type { NotificationItem } from '@/types/notifications';
import { TONE_DOT, adminLink, ago } from './format';

/** The inbox rows: tone dot, title, text, time. A click marks the item read and opens its deep link. */
export function InboxList({
  items,
  loading,
  error,
  onRetry,
  onRead,
  onNavigate,
}: {
  items: NotificationItem[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onRead: (id: number) => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  if (error != null)
    return (
      <ErrorState
        error={error}
        action={
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  if (loading)
    return (
      <div aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton mb-2 h-16 w-full" data-testid="skeleton-row" />
        ))}
      </div>
    );
  if (items.length === 0) return <EmptyState title="All caught up" text="New alerts will show up here." />;
  const open = (n: NotificationItem) => {
    if (!n.readAt) {
      void notificationsService.markRead(n.id).then(
        () => onRead(n.id),
        () => undefined,
      );
    }
    const link = adminLink(n.deepLink);
    if (link) {
      onNavigate?.();
      router.push(link);
    }
  };
  return (
    <ul aria-label="Notifications" className="grid gap-1.5">
      {items.map(n => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => open(n)}
            className={cx(
              'flex w-full items-start gap-3 rounded-2xl p-3 text-left hover:bg-white/80',
              n.readAt ? 'bg-white/30' : 'bg-white/70',
            )}
          >
            <span
              aria-hidden="true"
              className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[n.tone])}
            />
            <span className="min-w-0 flex-1">
              <span className={cx('block text-[14px]', n.readAt ? 'font-medium' : 'font-bold')}>
                {n.title}
                {!n.readAt && <span className="sr-only"> (unread)</span>}
              </span>
              {n.body && <span className="block text-[13px] text-muted">{n.body}</span>}
              <span className="block text-[12px] text-faint">{ago(n.createdAt)} ago</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
