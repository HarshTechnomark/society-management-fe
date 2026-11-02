'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pager } from '@/components/billing/useServerList';
import { Segment } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { Announcement } from '@/types/platformOps';
import { AnnouncementChip, istTime, roleLabel } from '../format';
import { AnnouncementDrawer } from './AnnouncementDrawer';

type Filter = 'ALL' | 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'CANCELLED';

export function audienceSummary(a: Announcement): string {
  switch (a.audienceType) {
    case 'ALL':
      return 'All societies';
    case 'PLANS':
      return `Plans: ${(a.audiencePlanKeys ?? []).join(', ')}`;
    case 'SOCIETY_STATUSES':
      return `Status: ${(a.audienceSocietyStatuses ?? []).map(roleLabel).join(', ')}`;
    default:
      return `${a.audienceSocietyIds?.length ?? 0} societies`;
  }
}

/** Spec 11.5 Announcements list. */
export function AnnouncementsScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.announcements.view);
  const canCreate = usePermission(PERMISSIONS.platform.announcements.create);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<{ a: Announcement | null } | null>(null);
  const load = useLoad(
    () => svc.announcements({ status: filter === 'ALL' ? undefined : filter, page, limit: 20 }),
    `${filter}|${page}`,
  );
  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Announcements" />
        <EmptyState title="You do not have access to announcements" />
      </Page>
    );
  const rows = load.data?.items ?? [];
  return (
    <Page>
      <PageHead
        title="Announcements"
        sub="Banners and messages to society admins, by plan, status or society."
        actions={canCreate && <Button onClick={() => setDrawer({ a: null })}>New announcement</Button>}
      />
      <Card>
        <div className="mb-3">
          <Segment<Filter>
            label="Announcement status"
            value={filter}
            onChange={v => {
              setFilter(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SCHEDULED', label: 'Scheduled' },
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'EXPIRED', label: 'Expired' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
          />
        </div>
        {load.error ? (
          <ErrorState
            error={load.error}
            action={
              <button className="underline" onClick={load.reload}>
                Try again
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[760px] border-collapse text-left text-[14px]"
              aria-busy={load.loading || undefined}
            >
              <caption className="sr-only">Announcements</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {[
                    'Title',
                    'Status',
                    'Kind',
                    'Severity',
                    'Audience',
                    'Publishes',
                    'Expires',
                    'Recipients',
                  ].map(h => (
                    <th key={h} scope="col" className="px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {load.loading
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr key={i} data-testid="skeleton-row">
                        <td colSpan={8} className="px-3 py-3.5">
                          <div className="skeleton h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  : rows.map(a => (
                      <tr
                        key={a.id}
                        className="cursor-pointer border-b border-[var(--line)] hover:bg-white/50"
                        onClick={() => setDrawer({ a })}
                      >
                        <td className="px-3 py-3 font-semibold">
                          <button
                            type="button"
                            className="text-left underline"
                            aria-label={`Open ${a.title}`}
                            onClick={e => {
                              e.stopPropagation();
                              setDrawer({ a });
                            }}
                          >
                            {a.title}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <AnnouncementChip status={a.status} />
                        </td>
                        <td className="px-3 py-3">{roleLabel(a.kind)}</td>
                        <td className="px-3 py-3">
                          <Chip
                            tone={
                              a.severity === 'CRITICAL' ? 'bad' : a.severity === 'WARNING' ? 'warn' : 'info'
                            }
                          >
                            {roleLabel(a.severity)}
                          </Chip>
                        </td>
                        <td className="px-3 py-3">{audienceSummary(a)}</td>
                        <td className="px-3 py-3 text-muted">
                          {a.publishAt
                            ? istTime(a.publishAt)
                            : a.publishedAt
                              ? istTime(a.publishedAt)
                              : 'On publish'}
                        </td>
                        <td className="px-3 py-3 text-muted">{istTime(a.expiresAt)}</td>
                        <td className="px-3 py-3 tabular-nums">{a.recipientCount ?? '-'}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!load.loading && rows.length === 0 && (
              <EmptyState title="No announcements" text="Create one to show a banner to society admins." />
            )}
          </div>
        )}
        <Pager pagination={load.data?.pagination ?? null} page={page} onPage={setPage} />
      </Card>
      {drawer && (
        <AnnouncementDrawer
          key={drawer.a?.id ?? 'new'}
          announcement={drawer.a}
          onClose={() => setDrawer(null)}
          onChanged={load.reload}
        />
      )}
    </Page>
  );
}
