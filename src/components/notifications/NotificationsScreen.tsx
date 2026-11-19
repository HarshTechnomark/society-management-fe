'use client';
import { useState } from 'react';
import { Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Button } from '@/components/ui/Button';
import { useLoad } from '@/hooks/useLoad';
import { notificationsService } from '@/services/notifications.service';
import type { NotificationApp } from '@/types/notifications';
import { InboxList } from './InboxList';

/** All notifications of the signed-in person (spec 11.6, 11.7), newest first, with an "Unread" filter and paging. Admin, resident and platform apps share it. */
export function NotificationsScreen({ app }: { app: NotificationApp }) {
  const scope = app === 'PLATFORM' ? 'platform' : 'society';
  const [view, setView] = useState<'ALL' | 'UNREAD'>('ALL');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const load = useLoad(
    () => notificationsService.list({ unread: view === 'UNREAD' ? true : undefined, page, limit: 20 }, scope),
    `${view}:${page}:${tick}:${scope}`,
  );
  const unread = load.data?.unreadCount ?? 0;
  return (
    <Page>
      <PageHead
        title={app === 'RESIDENT' ? 'Inbox' : 'Notifications'}
        sub={load.data ? `${unread} unread` : 'Alerts sent to you.'}
        actions={
          <Button
            variant="glass"
            disabled={load.data != null && unread === 0}
            onClick={() =>
              void notificationsService.markAllRead(undefined, scope).then(
                () => setTick(t => t + 1),
                () => undefined,
              )
            }
          >
            Mark all read
          </Button>
        }
      />
      <div className="glass p-4 sm:p-5">
        <Segments
          label="Notification views"
          options={[
            { key: 'ALL', label: 'All' },
            { key: 'UNREAD', label: 'Unread' },
          ]}
          value={view}
          onChange={k => {
            setView(k);
            setPage(1);
          }}
        />
        <InboxList
          app={app}
          scope={scope}
          items={load.data?.items ?? []}
          loading={load.loading}
          error={load.error}
          onRetry={load.reload}
          onRead={() => setTick(t => t + 1)}
        />
        {(load.data?.totalPages ?? 1) > 1 && (
          <nav aria-label="Pages of notifications" className="mt-3 flex items-center justify-between gap-2">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-[13px] text-muted">
              Page {page} of {load.data?.totalPages}
            </span>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= (load.data?.totalPages ?? 1)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </div>
    </Page>
  );
}
