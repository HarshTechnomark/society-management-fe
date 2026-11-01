'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { inr, shortDate } from '@/lib/money';
import { societiesService } from '@/services/societies.service';
import type { SocietyListItem, SocietyListQuery, SocietyStatus } from '@/types/societies';
import { HealthMeter, PlanChip, Segment, StatusChip } from '../bits';
import { PLAN_LABEL, STATUSES, STATUS_LABEL, societyErrorText } from '../format';
import { AddSocietyWizard } from './AddSocietyWizard';

type StatusFilter = SocietyStatus | 'ALL';
type SortKey =
  | 'name'
  | 'city'
  | 'planKey'
  | 'status'
  | 'units'
  | 'activeUsers30'
  | 'mrrPaise'
  | 'healthScore'
  | 'createdAt';

/** Columns the API sorts (8.2 whitelist); Plan and MRR sort only within the current page. */
const SERVER_SORT: Partial<Record<SortKey, string>> = {
  name: 'name',
  city: 'city',
  status: 'status',
  units: 'unitsSnapshot',
  activeUsers30: 'activeUsers30',
  healthScore: 'healthScore',
  createdAt: 'createdAt',
};
const LOCAL_SORT: Partial<Record<SortKey, (r: SocietyListItem) => number | string>> = {
  planKey: r => r.planKey ?? '',
  mrrPaise: r => r.mrrPaise ?? 0,
};

const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: 'name', label: 'Society' },
  { key: 'city', label: 'City' },
  { key: 'planKey', label: 'Plan' },
  { key: 'status', label: 'Status' },
  { key: 'units', label: 'Units', right: true },
  { key: 'activeUsers30', label: 'Active 30d', right: true },
  { key: 'mrrPaise', label: 'MRR', right: true },
  { key: 'healthScore', label: 'Health' },
  { key: 'createdAt', label: 'Created' },
];

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** P-01 Societies list (prototype `Pages.societies`). */
export function SocietiesScreen() {
  useMe();
  const router = useRouter();
  const toast = useToast();
  const canCreate = usePermission(PERMISSIONS.platform.societies.create);
  const canExport = usePermission(PERMISSIONS.platform.societies.export);
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 300);
  const [plan, setPlan] = useState('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);

  const base: SocietyListQuery = useMemo(
    () => ({
      q: q.length >= 2 ? q : undefined,
      planKey: plan === 'ALL' ? undefined : plan,
    }),
    [q, plan],
  );
  const serverSort = SERVER_SORT[sort.key];
  const query: SocietyListQuery = {
    ...base,
    status: status === 'ALL' ? undefined : status,
    sortBy: serverSort,
    sortOrder: serverSort ? sort.dir : undefined,
    page,
    limit: PAGE_SIZE,
  };
  const key = JSON.stringify(query);
  const list = useLoad(() => societiesService.list(query), key);

  // Counts for the status segment: one cheap `limit=1` call per status with the same search and plan.
  const countKey = JSON.stringify(base);
  const counts = useLoad(async () => {
    const all = await Promise.all(
      STATUSES.map(s =>
        societiesService.list({ ...base, status: s, limit: 1 }).then(r => r.pagination.total),
      ),
    );
    return Object.fromEntries(STATUSES.map((s, i) => [s, all[i]])) as Record<SocietyStatus, number>;
  }, countKey);
  const total = counts.data ? STATUSES.reduce((a, s) => a + (counts.data?.[s] ?? 0), 0) : null;

  const rows = useMemo(() => {
    const data = list.data?.data ?? [];
    const local = LOCAL_SORT[sort.key];
    if (!local) return data;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const x = local(a);
      const y = local(b);
      return (
        (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign
      );
    });
  }, [list.data, sort]);
  const pagination = list.data?.pagination;

  const toggleSort = (k: SortKey) => {
    setPage(1);
    setSort(s => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }));
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await societiesService.exportCsv({
        ...base,
        status: status === 'ALL' ? undefined : status,
        sortBy: serverSort,
        sortOrder: serverSort ? sort.dir : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'societies.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.show('Societies exported');
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const filtered = !!base.q || !!base.planKey || status !== 'ALL';

  return (
    <Page>
      <PageHead
        title="Societies"
        sub={total !== null ? `${total.toLocaleString('en-IN')} tenants` : undefined}
        actions={
          <>
            {canExport && (
              <Button variant="glass" size="sm" loading={exporting} onClick={exportCsv}>
                Export CSV
              </Button>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => setAdding(true)}>
                Add society
              </Button>
            )}
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center">
          <input
            type="search"
            aria-label="Search societies"
            placeholder="Search by name, city or slug"
            value={text}
            onChange={e => {
              setText(e.target.value);
              setPage(1);
            }}
            className="h-10 min-w-0 flex-1 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none"
          />
          <select
            aria-label="Filter by plan"
            value={plan}
            onChange={e => {
              setPlan(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none"
          >
            <option value="ALL">All plans</option>
            {Object.entries(PLAN_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="pb-3">
          <Segment<StatusFilter>
            label="Filter by status"
            value={status}
            onChange={s => {
              setStatus(s);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All', count: total },
              ...STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s], count: counts.data?.[s] ?? null })),
            ]}
          />
        </div>
        {list.error ? (
          <ErrorState
            error={list.error}
            action={
              <button className="underline" onClick={list.reload}>
                Try again
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto" data-testid="table-scroll">
              <table
                className="w-full min-w-[900px] border-collapse text-left text-[14px]"
                aria-busy={list.loading || undefined}
              >
                <caption className="sr-only">Societies</caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                    {COLUMNS.map(c => {
                      const sorted = sort.key === c.key ? sort.dir : null;
                      return (
                        <th
                          key={c.key}
                          scope="col"
                          aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
                          className={cx('px-3 py-2.5', c.right && 'text-right')}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className="inline-flex items-center gap-1 uppercase"
                          >
                            {c.label}
                            <span aria-hidden="true">
                              {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {list.loading
                    ? Array.from({ length: 10 }, (_, i) => (
                        <tr key={i} data-testid="skeleton-row" className="border-b border-[var(--line)]">
                          {COLUMNS.map(c => (
                            <td key={c.key} className="px-3 py-3.5">
                              <div className="skeleton h-4 w-full max-w-[120px]" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : rows.map(s => (
                        <tr
                          key={s.id}
                          className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-white/50"
                          onClick={() => router.push(`/platform/societies/${s.id}`)}
                        >
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              className="text-left"
                              aria-label={`Open ${s.name}`}
                              onClick={e => {
                                e.stopPropagation();
                                router.push(`/platform/societies/${s.id}`);
                              }}
                            >
                              <span className="block font-semibold">{s.name}</span>
                              <span className="block text-[12.5px] text-muted">{s.slug}</span>
                            </button>
                          </td>
                          <td className="px-3 py-3">{s.city}</td>
                          <td className="px-3 py-3">
                            <PlanChip plan={s.planKey} />
                          </td>
                          <td className="px-3 py-3">
                            <StatusChip status={s.status} />
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {s.units.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {s.activeUsers30.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {s.mrrPaise ? inr(s.mrrPaise) : <span className="text-faint">-</span>}
                          </td>
                          <td className="px-3 py-3">
                            <HealthMeter score={s.healthScore} />
                          </td>
                          <td className="px-3 py-3 text-muted">{shortDate(s.createdAt)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {!list.loading && rows.length === 0 && (
              <EmptyState
                title="No societies match"
                text={filtered ? 'Clear a filter or add a society.' : 'Add the first society.'}
                action={
                  canCreate && (
                    <Button size="sm" onClick={() => setAdding(true)}>
                      Add society
                    </Button>
                  )
                }
              />
            )}
            {pagination && pagination.totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-between gap-3 px-1 pt-3 text-[13px] text-muted"
              >
                <span>
                  {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <span className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span aria-current="page">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </span>
              </nav>
            )}
          </>
        )}
      </Card>
      <AddSocietyWizard
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={s => {
          setAdding(false);
          router.push(`/platform/societies/${s.id}`);
        }}
      />
    </Page>
  );
}
