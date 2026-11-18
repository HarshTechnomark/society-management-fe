'use client';
import { useState } from 'react';
import { Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Button } from '@/components/ui/Button';
import { useLoad } from '@/hooks/useLoad';
import { notificationsService } from '@/services/notifications.service';
import { InboxList } from './InboxList';

/** All notifications of the signed-in admin (spec 11.6), newest first, with an "Unread" filter and paging. */
export function NotificationsScreen() {
  const [view, setView] = useState<'ALL' | 'UNREAD'>('ALL');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const load = useLoad(
    () => notificationsService.list({ unread: view === 'UNREAD' ? true : undefined, page, limit: 20 }),
    `${view}:${page}:${tick}`,
  );
  return (
    <Page>
      <PageHead
        title="Notifications"
        sub="Alerts sent to you in this society."
        actions={
          <Button
            variant="glass"
            onClick={() =>
              void notificationsService.markAllRead().then(
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
