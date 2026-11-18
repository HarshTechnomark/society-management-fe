'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useLoad } from '@/hooks/useLoad';
import { residentNoticesService as svc, type InboxScope } from '@/services/residentNotices.service';
import type { InboxItem } from '@/types/residentNotices';
import { ago, commError, plainCommError } from '../format';
import { TONE, residentLink } from './format';

/** Spec 11.7 inbox: all notifications, unread badge, mark all read. */
export function InboxScreen({ scope = 'society' }: { scope?: InboxScope }) {
  const router = useRouter();
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const q = useLoad(
    () => svc.inbox({ unread: unread || undefined, page, limit: 20 }, scope),
    `${unread}|${page}|${scope}`,
  );
  const open = async (n: InboxItem) => {
    if (!n.readAt) await svc.markRead(n.id, scope).catch(() => undefined);
    const to = scope === 'platform' ? n.deepLink : residentLink(n.deepLink);
    if (to) {
      if (/^https?:/i.test(to)) window.location.assign(to);
      else router.push(to);
    } else q.reload();
  };
  const readAll = async () => {
    setError(null);
    try {
      await svc.markAllRead(undefined, scope);
      q.reload();
    } catch (e) {
      setError(commError(e));
    }
  };
  const d = q.data;
  return (
    <Page>
      <PageHead
        title="Inbox"
        sub={d ? `${d.unreadCount} unread` : undefined}
        actions={
          <>
            <Button
              size="sm"
              variant={unread ? 'primary' : 'glass'}
              aria-pressed={unread}
              onClick={() => {
                setUnread(!unread);
                setPage(1);
              }}
            >
              Unread only
            </Button>
            <Button
              size="sm"
              variant="glass"
              disabled={!d || d.unreadCount === 0}
              onClick={() => void readAll()}
            >
              Mark all read
            </Button>
          </>
        }
      />
      <Card>
        {error && (
          <p role="alert" className="mb-2 text-[13px] font-medium text-bad">
            {error}
          </p>
        )}
        {q.loading ? (
          <div className="skeleton h-28 w-full" />
        ) : !d ? (
          <ErrorState
            error={plainCommError(q.error)}
            action={<Button onClick={q.reload}>Try again</Button>}
          />
        ) : d.items.length === 0 ? (
          <EmptyState title="You are all caught up" text="New messages from your society will appear here." />
        ) : (
          <ul className="grid gap-2">
            {d.items.map(n => (
              <li key={n.id}>
                <button
                  onClick={() => void open(n)}
                  className="flex w-full items-start gap-2 rounded-2xl bg-white/60 p-3 text-left hover:bg-white/90"
                >
                  {!n.readAt && (
                    <span
                      role="img"
                      aria-label="Unread"
                      className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-navy"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={n.readAt ? 'block text-[15px] font-semibold' : 'block text-[15px] font-bold'}
                    >
                      {n.title}
                    </span>
                    <span className="block text-[13.5px] text-muted">{n.body}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <Chip tone={TONE[n.tone] ?? 'info'}>
                        {n.category.charAt(0) + n.category.slice(1).toLowerCase()}
                      </Chip>
                      <span className="text-[12px] text-muted">{ago(n.createdAt)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {d && d.pages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-[13px] text-muted">
              Page {page} of {d.pages}
            </span>
            <Button size="sm" variant="glass" disabled={page >= d.pages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </Page>
  );
}
