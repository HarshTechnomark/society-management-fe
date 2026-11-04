'use client';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { billingRunsService } from '@/services/billingRuns.service';
import { RUN_STATUS_LABEL, pctText, periodLabel, plainError } from './format';
import { RunStatusChip } from './RunBits';

const B = PERMISSIONS.finance.billing;
const PAGE = 20;
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(RUN_STATUS_LABEL).map(([value, label]) => ({ value, label })),
];
const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'SUPPLEMENTARY', label: 'Extra (supplementary)' },
];

/** Billing runs list (spec 8.6, 11.1 "Billing runs"): one row per run with status in words, flats, total and change. */
export function RunsScreen() {
  return (
    <Gate view={B.view} feature="billing.billing_run_pipeline" title="Billing runs">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(B.create);
  const [status, setStatus] = useState('');
  const [runType, setRunType] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad(
    () =>
      billingRunsService.runs({
        status: status || undefined,
        runType: runType || undefined,
        page,
        limit: PAGE,
      }),
    `${status}|${runType}|${page}`,
  );
  const runs = list.data?.items ?? [];
  const pages = list.data?.pagination.totalPages ?? 1;
  const newRun = canCreate && (
    <Link href="/admin/billing/runs/new" className={buttonClasses('primary', 'md')}>
      New billing run
    </Link>
  );

  return (
    <Page>
      <PageHead
        title="Billing runs"
        sub="Compute, review and issue the maintenance bills of a period. A different committee member approves each run."
        actions={newRun}
      />
      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Select
            label="Status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Type"
            value={runType}
            onChange={e => {
              setRunType(e.target.value);
              setPage(1);
            }}
            options={TYPE_OPTIONS}
          />
        </div>
        {list.error != null ? (
          <ErrorState
            error={plainError(list.error)}
            action={
              <Button size="sm" onClick={list.reload}>
                Try again
              </Button>
            }
          />
        ) : list.loading ? (
          <div aria-busy="true" aria-label="Loading">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton mb-2 h-16 w-full" data-testid="skeleton-row" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <EmptyState
            title={status || runType ? 'No runs match' : 'No billing runs yet'}
            text={
              status || runType
                ? 'Change the filters.'
                : canCreate
                  ? 'Create a billing run to prepare the next bills.'
                  : undefined
            }
            action={!status && !runType ? newRun || undefined : undefined}
          />
        ) : (
          <ul aria-label="Billing runs" className="divide-y divide-[var(--line)]">
            {runs.map(r => (
              <li key={r.id} data-testid="run-row">
                <Link
                  href={`/admin/billing/runs/${r.id}`}
                  className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-3 hover:bg-black/[0.03] min-[900px]:grid-cols-[9rem_1fr_11rem_6rem_8rem_5rem]"
                >
                  <span className="text-[15px] font-bold">{r.runLabel}</span>
                  <span className="text-[14px]">
                    {periodLabel(r.periodStart, r.cycle)}
                    {r.runType === 'SUPPLEMENTARY' && <span className="text-muted"> (extra run)</span>}
                  </span>
                  <span className="col-span-2 min-[900px]:col-span-1">
                    <RunStatusChip status={r.status} />
                  </span>
                  <span className="text-[13.5px] text-muted">
                    {r.counts.ready} {r.counts.ready === 1 ? 'flat' : 'flats'}
                  </span>
                  <span className="text-right text-[14px] font-semibold tabular-nums">
                    {inr(r.totalPaise)}
                  </span>
                  <span className="text-right text-[13px] text-muted">
                    {r.changePct === null ? '' : pctText(r.changePct)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Pages of runs" className="mt-3 flex items-center justify-between text-[13.5px]">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button size="sm" variant="glass" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </nav>
        )}
      </Card>
    </Page>
  );
}
