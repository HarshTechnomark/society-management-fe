'use client';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { billingDuesService } from '@/services/billingDues.service';
import type { Defaulter, DefaulterQuery, DefaulterSort } from '@/types/billingDues';
import { StatementDrawer } from '../ledger/StatementDrawer';
import { downloadBlob, rupeesToPaise } from '../ledger/format';
import { DUES_TEXT, billingDuesError, plainError } from './format';

const B = PERMISSIONS.finance.billing;
const SORTS: { value: DefaulterSort; label: string }[] = [
  { value: 'overduePaise', label: 'Overdue amount' },
  { value: 'daysOverdue', label: 'Days overdue' },
  { value: 'unitLabel', label: 'Flat' },
];
const PAGE = 50;
const COLS = 'min-[900px]:grid-cols-[5.5rem_1fr_1fr_7rem_6.5rem_4.5rem_4rem_12rem] min-[900px]:items-center';

/** Defaulters (spec 11.8, BR-11-64): thresholds, the list, reminders and the CSV export. */
export function DefaultersTab() {
  const canRemind = usePermission(B.edit);
  const canExport = usePermission(B.export);
  const statementOn = useFeature('billing.statement_of_account');
  const toast = useToast();
  const [days, setDays] = useState('90');
  const [rupees, setRupees] = useState('5000');
  const [sortBy, setSortBy] = useState<DefaulterSort>('overduePaise');
  const [applied, setApplied] = useState<DefaulterQuery>({
    minDaysOverdue: 90,
    minAmountPaise: 500000,
    sortBy: 'overduePaise',
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busyUnit, setBusyUnit] = useState<number | null>(null);
  /** Flats reminded from this screen, so the row keeps a "Reminder sent" note after the toast is gone. */
  const [reminded, setReminded] = useState<Set<number>>(() => new Set());
  const [statement, setStatement] = useState<Defaulter | null>(null);
  const [page, setPage] = useState(1);
  const q = `${applied.minDaysOverdue}|${applied.minAmountPaise}|${applied.sortBy}|${page}`;
  const load = useLoad(() => billingDuesService.defaulters({ ...applied, page, limit: PAGE }), q);

  const apply = () => {
    const d = /^\d+$/.test(days.trim()) ? Number(days) : NaN;
    const p = rupeesToPaise(rupees);
    if (!(d >= 1 && d <= 3650)) return setProblem('Days overdue must be a whole number from 1 to 3650.');
    if (p === null || p < 0 || p > 1_000_000_000)
      return setProblem('Enter the amount in rupees, for example 5000 or 5000.50.');
    setProblem(null);
    setPage(1);
    setApplied({ minDaysOverdue: d, minAmountPaise: p, sortBy });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(await billingDuesService.defaultersCsv(applied), 'defaulters.csv');
      toast.show('Defaulter list exported');
    } catch (e) {
      toast.show(billingDuesError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const remind = async (d: Defaulter) => {
    setBusyUnit(d.unitId);
    try {
      const r = await billingDuesService.remindFlat(d.unitId);
      if (r.sent > 0) {
        setReminded(prev => new Set(prev).add(d.unitId));
        toast.show(
          `Reminder sent for ${r.sent} ${r.sent === 1 ? 'bill' : 'bills'} of ${d.unitLabel}` +
            (r.tooSoon ? `, ${r.tooSoon} skipped (reminded in the last 24 hours)` : ''),
        );
      } else if (r.failed > 0) {
        toast.show(billingDuesError(r.firstError), 'error');
      } else if (r.tooSoon > 0) {
        toast.show(DUES_TEXT.REMINDER_TOO_SOON, 'error');
      } else {
        toast.show(`${d.unitLabel} has no open overdue bill to remind.`);
      }
    } catch (e) {
      toast.show(billingDuesError(e), 'error');
    } finally {
      setBusyUnit(null);
    }
  };

  const rows = load.data?.items ?? [];
  const totals = load.data?.totals ?? { flats: 0, overduePaise: 0 };
  const pages = load.data?.totalPages ?? 1;
  return (
    <Card
      title="Defaulters"
      sub="Flats overdue for the days and amount below. Visible to the committee only."
    >
      <div className="mb-3 grid grid-cols-1 gap-x-3 min-[560px]:grid-cols-3">
        <Input
          label="Overdue for at least (days)"
          inputMode="numeric"
          value={days}
          onChange={e => setDays(e.target.value)}
        />
        <Input
          label="Amount at least (₹)"
          inputMode="decimal"
          value={rupees}
          onChange={e => setRupees(e.target.value)}
        />
        <Select
          label="Sort by"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as DefaulterSort)}
          options={SORTS}
        />
      </div>
      {problem && <Alert tone="bad">{problem}</Alert>}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={apply}>
          Show defaulters
        </Button>
        {canExport && (
          <Button size="sm" variant="glass" loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        )}
      </div>

      {load.error != null ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : load.loading ? (
        <div aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-2 h-16 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No defaulters"
          text="No flat is overdue for that long and above that amount. Lower the thresholds to see more."
        />
      ) : (
        <>
          <p className="mb-2 text-[13.5px] text-muted" aria-live="polite">
            {totals.flats} {totals.flats === 1 ? 'flat' : 'flats'} owe {inr(totals.overduePaise)} in all.
          </p>
          <div
            aria-hidden="true"
            className={`hidden gap-x-3 border-b border-[var(--line)] pb-1 text-[12px] font-semibold uppercase text-muted min-[900px]:grid ${COLS}`}
          >
            <span>Flat</span>
            <span>Owner</span>
            <span>Bill to</span>
            <span className="text-right">Overdue</span>
            <span>Oldest due</span>
            <span className="text-right">Days</span>
            <span className="text-right">Bills</span>
            <span />
          </div>
          <ul aria-label="Defaulters" className="divide-y divide-[var(--line)]">
            {rows.map(d => (
              <li
                key={d.unitId}
                data-testid="defaulter-row"
                className={`grid grid-cols-2 gap-x-3 gap-y-1 py-3 text-[14px] ${COLS}`}
              >
                <strong className="text-[15px]">{d.unitLabel}</strong>
                <span className="text-right font-semibold tabular-nums min-[900px]:hidden">
                  {inr(d.overduePaise)}
                </span>
                <span>
                  <span className="text-muted min-[900px]:hidden">Owner: </span>
                  {d.ownerName || '-'}
                </span>
                <span>
                  <span className="text-muted min-[900px]:hidden">Bill to: </span>
                  {d.billToNames.join(', ') || '-'}
                </span>
                <span className="hidden text-right font-semibold tabular-nums min-[900px]:block">
                  {inr(d.overduePaise)}
                </span>
                <span>
                  <span className="text-muted min-[900px]:hidden">Oldest due: </span>
                  {shortDate(d.oldestDueDate)}
                </span>
                <span className="min-[900px]:text-right">
                  {d.daysOverdue}
                  <span className="text-muted min-[900px]:hidden"> days overdue</span>
                </span>
                <span className="min-[900px]:text-right">
                  {d.invoiceCount}
                  <span className="text-muted min-[900px]:hidden">
                    {d.invoiceCount === 1 ? ' bill' : ' bills'}
                  </span>
                </span>
                <span className="col-span-2 flex flex-wrap gap-1.5 min-[900px]:col-span-1 min-[900px]:justify-end">
                  {canRemind && (
                    <Button
                      size="xs"
                      variant="glass"
                      loading={busyUnit === d.unitId}
                      aria-label={`Remind ${d.unitLabel}`}
                      onClick={() => remind(d)}
                    >
                      Remind
                    </Button>
                  )}
                  {reminded.has(d.unitId) && (
                    <span className="self-center text-[12.5px] font-semibold text-ok">Reminder sent</span>
                  )}
                  {statementOn && (
                    <Button
                      size="xs"
                      variant="glass"
                      aria-label={`Statement of ${d.unitLabel}`}
                      onClick={() => setStatement(d)}
                    >
                      Statement
                    </Button>
                  )}
                  <Link
                    href={`/admin/billing/invoices?unitId=${d.unitId}&status=OVERDUE`}
                    aria-label={`Overdue invoices of ${d.unitLabel}`}
                    className="inline-flex h-[30px] items-center rounded-full bg-white/60 px-3 text-[12.5px] font-semibold"
                  >
                    Invoices
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pages of defaulters" className="mt-3 flex items-center justify-center gap-3">
              <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(x => x - 1)}>
                Previous
              </Button>
              <span className="text-[13.5px]">
                Page {page} of {pages}
              </span>
              <Button size="sm" variant="glass" disabled={page >= pages} onClick={() => setPage(x => x + 1)}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}
      {statement && (
        <StatementDrawer
          unitId={statement.unitId}
          unitLabel={statement.unitLabel}
          onClose={() => setStatement(null)}
        />
      )}
    </Card>
  );
}
