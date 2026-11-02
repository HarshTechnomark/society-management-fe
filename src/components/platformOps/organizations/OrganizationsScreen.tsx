'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pager } from '@/components/billing/useServerList';
import { Segment } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { shortDate } from '@/lib/money';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { OrgStatus } from '@/types/platformOps';
import { OrganizationDrawer } from './OrganizationDrawer';
import { OrgStatusChip } from '../format';

type Filter = 'ALL' | OrgStatus;

/** Spec 11.9 Organizations (new screen under Tenants). */
export function OrganizationsScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.societies.view);
  const canCreate = usePermission(PERMISSIONS.platform.societies.create);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<{ id: number | null } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim().length >= 2 ? text.trim() : '');
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);
  const load = useLoad(
    () =>
      svc.organizations({
        q: q || undefined,
        status: status === 'ALL' ? undefined : status,
        page,
        limit: 20,
      }),
    `${q}|${status}|${page}`,
  );
  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Organizations" />
        <EmptyState title="You do not have access to organizations" />
      </Page>
    );
  const rows = load.data?.items ?? [];
  return (
    <Page>
      <PageHead
        title="Organizations"
        sub="Groups that own one or more societies."
        actions={canCreate && <Button onClick={() => setDrawer({ id: null })}>Add organization</Button>}
      />
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="search"
            aria-label="Search organizations"
            placeholder="Search organizations"
            value={text}
            onChange={e => setText(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none sm:max-w-xs"
          />
          <Segment<Filter>
            label="Organization status"
            value={status}
            onChange={v => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'CLOSED', label: 'Closed' },
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
              className="w-full min-w-[640px] border-collapse text-left text-[14px]"
              aria-busy={load.loading || undefined}
            >
              <caption className="sr-only">Organizations</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {['Name', 'Slug', 'Status', 'Societies', 'GSTIN', 'Created'].map(h => (
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
                        <td colSpan={6} className="px-3 py-3.5">
                          <div className="skeleton h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  : rows.map(o => (
                      <tr
                        key={o.id}
                        className="cursor-pointer border-b border-[var(--line)] hover:bg-white/50"
                        onClick={() => setDrawer({ id: o.id })}
                      >
                        <td className="px-3 py-3 font-semibold">
                          <button
                            type="button"
                            className="text-left underline"
                            aria-label={`Open ${o.name}`}
                            onClick={e => {
                              e.stopPropagation();
                              setDrawer({ id: o.id });
                            }}
                          >
                            {o.name}
                          </button>
                        </td>
                        <td className="px-3 py-3 font-mono text-[12.5px]">{o.slug}</td>
                        <td className="px-3 py-3">
                          <OrgStatusChip status={o.status} />
                        </td>
                        <td className="px-3 py-3 tabular-nums">{o.societyCount}</td>
                        <td className="px-3 py-3 font-mono text-[12.5px]">{o.gstin ?? '-'}</td>
                        <td className="px-3 py-3 text-muted">{shortDate(o.createdAt)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!load.loading && rows.length === 0 && (
              <EmptyState title="No organizations" text="Nothing matches these filters." />
            )}
          </div>
        )}
        <Pager pagination={load.data?.pagination ?? null} page={page} onPage={setPage} />
      </Card>
      {drawer && (
        <OrganizationDrawer
          key={drawer.id ?? 'new'}
          id={drawer.id}
          onClose={() => setDrawer(null)}
          onChanged={load.reload}
        />
      )}
    </Page>
  );
}
