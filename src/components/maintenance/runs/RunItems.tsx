'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { billingRunsService } from '@/services/billingRuns.service';
import type { ItemQuery, Run, RunItem } from '@/types/billingRuns';
import {
  EXCEPTION_FIX,
  RELATION_LABEL,
  SYSTEM_EXCLUDE_LABEL,
  WARNING_LABEL,
  billingRunError,
  exceptionLabel,
  excludeReasonText,
  pctText,
  plainError,
  warningLabel,
} from './format';
import { ReasonDialog } from './ReasonDialog';
import { ItemStatusChip } from './RunBits';

type Filter = 'ALL' | 'EXCEPTIONS' | 'WARNINGS' | 'EXCLUDED';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All flats' },
  { key: 'EXCEPTIONS', label: 'Exceptions' },
  { key: 'WARNINGS', label: 'Warnings' },
  { key: 'EXCLUDED', label: 'Excluded' },
];
const SORTS = [
  { value: 'unitLabel:asc', label: 'Flat A to Z' },
  { value: 'totalPaise:desc', label: 'Highest total first' },
  { value: 'totalPaise:asc', label: 'Lowest total first' },
  { value: 'variancePct:desc', label: 'Biggest rise first' },
  { value: 'variancePct:asc', label: 'Biggest fall first' },
];
const PAGE = 20;

/** An excluded flat can be included again only when it was ready and the user (not the system) excluded it. */
export const canInclude = (i: RunItem) =>
  i.status === 'EXCLUDED' &&
  !i.exceptionCode &&
  !(i.excludedReason && i.excludedReason in SYSTEM_EXCLUDE_LABEL);

/**
 * The items of a run (spec 8.6, 11.2): filters Exceptions / Warnings / Excluded, search by flat or name, sorting,
 * the lines of each flat, and Exclude / Include with a reason while the run is in preview.
 */
export function RunItems(props: {
  run: Run;
  /** The person may exclude and include (finance.billing.create). */
  canEdit: boolean;
  /** Called after an exclusion or inclusion changed the totals, so the run is read again. */
  onChanged: () => void;
}) {
  const itemsOn = useFeature('billing.exceptions_report');
  if (!itemsOn)
    return <Alert tone="info">Flat-by-flat details and exceptions are not part of your plan.</Alert>;
  return <Items {...props} />;
}

function Items({
  run,
  canEdit,
  onChanged,
}: {
  run: Run;
  /** The person may exclude and include (finance.billing.create). */
  canEdit: boolean;
  /** Called after an exclusion or inclusion changed the totals, so the run is read again. */
  onChanged: () => void;
}) {
  const toast = useToast();
  const diffOn = useFeature('billing.bill_change_diff');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [warning, setWarning] = useState('LARGE_VARIANCE');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('unitLabel:asc');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [excluding, setExcluding] = useState<RunItem | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const [sortBy, sortOrder] = sort.split(':') as [NonNullable<ItemQuery['sortBy']>, 'asc' | 'desc'];
  const query: ItemQuery = {
    status: filter === 'EXCEPTIONS' ? 'EXCEPTION' : filter === 'EXCLUDED' ? 'EXCLUDED' : undefined,
    warningCode: filter === 'WARNINGS' ? warning : undefined,
    q: q.trim() || undefined,
    sortBy,
    sortOrder,
    page,
    limit: PAGE,
  };
  const key = JSON.stringify([run.id, run.version, run.status, run.computedAt, run.counts, query]);
  const list = useLoad(() => billingRunsService.items(run.id, query), key);
  const items = list.data?.items ?? [];
  const pages = list.data?.pagination.totalPages ?? 1;
  const editable = canEdit && run.status === 'PREVIEW';

  const include = async (i: RunItem) => {
    setBusy(i.id);
    setProblem(null);
    try {
      await billingRunsService.include(run.id, i.id, i.version);
      toast.show(`${i.unitLabel} is included again.`);
      onChanged();
    } catch (e) {
      setProblem(billingRunError(e));
      list.reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Filter flats" className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'primary' : 'glass'}
              aria-pressed={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {filter === 'WARNINGS' && (
          <Select
            label="Warning"
            value={warning}
            onChange={e => {
              setWarning(e.target.value);
              setPage(1);
            }}
            options={Object.entries(WARNING_LABEL).map(([value, label]) => ({ value, label }))}
          />
        )}
        <label className="flex min-w-[10rem] flex-1 flex-col text-[12px] font-semibold text-muted sm:max-w-xs">
          Search
          <input
            type="search"
            placeholder="Flat or name"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] font-normal text-ink focus:border-navy focus:outline-none"
          />
        </label>
        <Select
          label="Sort by"
          value={sort}
          onChange={e => {
            setSort(e.target.value);
            setPage(1);
          }}
          options={SORTS.filter(s => diffOn || !s.value.startsWith('variancePct'))}
        />
      </div>
      {problem && <Alert tone="bad">{problem}</Alert>}
      {list.error != null ? (
        <ErrorState
          error={plainError(list.error)}
          action={
            <Button size="sm" onClick={list.reload}>
              Try again
            </Button>
          }
        />
      ) : list.loading && !list.data ? (
        <div aria-busy="true" aria-label="Loading flats">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-2 h-14 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === 'ALL' && !q ? 'No flats in this run' : 'No flats match'}
          text={filter === 'ALL' && !q ? undefined : 'Change the filter or the search.'}
        />
      ) : (
        <ul aria-label="Flats in this run" className="divide-y divide-[var(--line)]">
          <li
            aria-hidden="true"
            className="hidden grid-cols-[6rem_1fr_7rem_6rem_11rem_9rem] gap-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted min-[900px]:grid"
          >
            <span>Flat</span>
            <span>Bill to</span>
            <span className="text-right">Total</span>
            <span className="text-right">{diffOn ? 'Change' : ''}</span>
            <span>Status</span>
            <span />
          </li>
          {items.map(i => (
            <li key={i.id} data-testid="run-item" className="py-3">
              <div className="grid grid-cols-2 items-center gap-x-3 gap-y-1 min-[900px]:grid-cols-[6rem_1fr_7rem_6rem_11rem_9rem]">
                <span className="text-[15px] font-bold">{i.unitLabel}</span>
                <span className="col-span-2 text-[14px] min-[900px]:col-span-1">
                  {i.billToName ?? 'No one to bill'}
                  {i.billToRelation && (
                    <span className="text-muted">
                      {' '}
                      ({RELATION_LABEL[i.billToRelation] ?? i.billToRelation})
                    </span>
                  )}
                </span>
                <span className="text-right text-[14px] font-semibold tabular-nums min-[900px]:text-right">
                  {i.status === 'EXCEPTION' ? '-' : inr(i.totalPaise)}
                </span>
                <span
                  className="text-[13px] text-muted min-[900px]:text-right"
                  aria-label="Change from last bill"
                >
                  {diffOn && i.variancePct !== null ? pctText(i.variancePct) : ''}
                </span>
                <span>
                  <ItemStatusChip status={i.status} />
                </span>
                <span className="flex justify-end gap-2">
                  {i.lines.length > 0 && (
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-expanded={open === i.id}
                      aria-label={`${open === i.id ? 'Hide' : 'Show'} amounts for ${i.unitLabel}`}
                      onClick={() => setOpen(o => (o === i.id ? null : i.id))}
                    >
                      {open === i.id ? 'Hide amounts' : 'Amounts'}
                    </Button>
                  )}
                  {editable && (i.status === 'READY' || i.status === 'EXCEPTION') && (
                    <Button
                      size="xs"
                      variant="glass"
                      aria-label={`Exclude ${i.unitLabel}`}
                      onClick={() => setExcluding(i)}
                    >
                      Exclude
                    </Button>
                  )}
                  {editable && canInclude(i) && (
                    <Button
                      size="xs"
                      variant="glass"
                      loading={busy === i.id}
                      aria-label={`Include ${i.unitLabel}`}
                      onClick={() => void include(i)}
                    >
                      Include
                    </Button>
                  )}
                </span>
              </div>
              {i.status === 'EXCEPTION' && (
                <p className="mt-1.5 text-[13px] text-[#8a1d17]">
                  <b>{exceptionLabel(i.exceptionCode)}.</b> {i.exceptionMessage ?? ''}{' '}
                  {i.exceptionCode && EXCEPTION_FIX[i.exceptionCode]}
                </p>
              )}
              {i.status === 'EXCLUDED' && i.excludedReason && (
                <p className="mt-1.5 text-[13px] text-muted">
                  Excluded: {excludeReasonText(i.excludedReason)}
                </p>
              )}
              {i.warningCodes.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`Warnings for ${i.unitLabel}`}>
                  {i.warningCodes.map(w => (
                    <li key={w}>
                      <Chip tone="warn">
                        <span aria-hidden="true" className="mr-1">
                          !
                        </span>
                        {warningLabel(w)}
                      </Chip>
                    </li>
                  ))}
                </ul>
              )}
              {open === i.id && (
                <table className="mt-2 w-full max-w-lg text-[13.5px]">
                  <caption className="sr-only">Amounts for {i.unitLabel}</caption>
                  <tbody>
                    {i.lines.map((l, n) => (
                      <tr key={`${l.headKey}-${n}`} className="border-t border-[var(--line)]">
                        <td className="py-1">
                          {l.description}
                          {l.prorationDays !== null && l.periodDays !== null && (
                            <span className="text-muted">
                              {' '}
                              ({l.prorationDays} of {l.periodDays} days)
                            </span>
                          )}
                        </td>
                        <td className="py-1 text-right tabular-nums">{inr(l.amountPaise)}</td>
                      </tr>
                    ))}
                    {i.taxPaise !== 0 && (
                      <tr className="border-t border-[var(--line)]">
                        <td className="py-1">Tax</td>
                        <td className="py-1 text-right tabular-nums">{inr(i.taxPaise)}</td>
                      </tr>
                    )}
                    {i.roundOffPaise !== 0 && (
                      <tr className="border-t border-[var(--line)]">
                        <td className="py-1">Round-off</td>
                        <td className="py-1 text-right tabular-nums">{inr(i.roundOffPaise)}</td>
                      </tr>
                    )}
                    <tr className="border-t border-[var(--line)] font-bold">
                      <td className="py-1">Total</td>
                      <td className="py-1 text-right tabular-nums">{inr(i.totalPaise)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pages of flats" className="mt-3 flex items-center justify-between text-[13.5px]">
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
      {excluding && (
        <ReasonDialog
          title={`Exclude ${excluding.unitLabel}?`}
          description="The flat is left out of this run and gets no bill. You can include a ready flat again before you submit."
          confirmLabel="Exclude flat"
          max={300}
          onCancel={() => setExcluding(null)}
          onSubmit={async reason => {
            await billingRunsService.exclude(run.id, excluding.id, { reason, version: excluding.version });
            toast.show(`${excluding.unitLabel} is excluded.`);
            setExcluding(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
