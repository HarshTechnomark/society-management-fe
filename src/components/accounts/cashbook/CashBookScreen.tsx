'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ExpenseModal } from '@/components/accounts/expenses/ExpenseModal';
import {
  daysAgo,
  downloadBlob,
  expenseError,
  plainError,
  today,
} from '@/components/accounts/expenses/format';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Gate } from '@/components/setup/Gate';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsExpensesService as svc } from '@/services/accountsExpenses.service';
import type { CashBook, CashBookRow } from '@/types/accountsExpenses';

const E = PERMISSIONS.finance.expenses;
const LIMIT = 100;

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
/** The cash book rows as CSV text (amounts in rupees). */
export function cashBookCsv(rows: CashBookRow[]): string {
  const head = ['Date', 'Voucher', 'Type', 'Narration', 'Account', 'In', 'Out', 'Balance'];
  const lines = rows.map(r =>
    [
      r.date,
      r.voucherNo,
      r.voucherType,
      r.narration,
      r.account,
      r.inPaise / 100,
      r.outPaise / 100,
      r.runningPaise / 100,
    ]
      .map(csvCell)
      .join(','),
  );
  return [head.map(csvCell).join(','), ...lines].join('\n');
}

/** Accounts > Cash book (spec 8.4, 11.2): running ledger of bank and cash with opening and closing balance. */
export function CashBookScreen() {
  return (
    <Gate view={E.view} title="the cash book">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(E.create);
  const canExport = usePermission(E.export);
  const toast = useToast();
  const [account, setAccount] = useState('ALL');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [direction, setDirection] = useState<'ANY' | 'IN' | 'OUT'>('ANY');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const banks = useLoad(() => svc.bankAccounts(), 'banks');
  const query = {
    account,
    from,
    to,
    ...(direction !== 'ANY' ? { direction } : {}),
    page,
    limit: LIMIT,
  };
  const validRange = !!from && !!to && from <= to;
  const book = useLoad<CashBook | null>(
    () => (validRange ? svc.cashBook(query) : Promise.resolve(null)),
    JSON.stringify(query),
  );
  const data = book.data;

  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const exportIt = async () => {
    setExporting(true);
    try {
      const rows: CashBookRow[] = [];
      for (let p = 1; p <= 50; p++) {
        const r = await svc.cashBook({ ...query, page: p, limit: LIMIT });
        rows.push(...r.rows);
        if (p >= r.totalPages) break;
      }
      downloadBlob(new Blob([cashBookCsv(rows)], { type: 'text/csv' }), `cash-book-${from}-to-${to}.csv`);
    } catch (e) {
      toast.show(expenseError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const accountOptions = [
    { value: 'ALL', label: 'All cash and bank' },
    { value: 'CASH', label: 'Cash in hand' },
    { value: 'PETTY_CASH', label: 'Petty cash' },
    ...(banks.data ?? []).map(b => ({ value: `BANK:${b.id}`, label: b.label })),
  ];

  return (
    <Page>
      <PageHead
        title="Cash book"
        sub="Every rupee in and out of the bank and cash, with the balance after each entry."
        actions={
          <>
            <Link href="/admin/accounts/expenses" className={buttonClasses('glass', 'md')}>
              Expenses
            </Link>
            {canExport && (
              <Button
                variant="glass"
                loading={exporting}
                disabled={!validRange}
                onClick={() => void exportIt()}
              >
                Export CSV
              </Button>
            )}
            {canCreate && <Button onClick={() => setAdding(true)}>Add expense</Button>}
          </>
        }
      />
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <Select
            label="Account"
            value={account}
            onChange={e => reset(setAccount)(e.target.value)}
            options={accountOptions}
          />
          <Input
            label="From"
            type="date"
            value={from}
            max={to || undefined}
            onChange={e => reset(setFrom)(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={to}
            min={from || undefined}
            onChange={e => reset(setTo)(e.target.value)}
          />
        </div>
        <Segments
          label="Direction"
          options={[
            { key: 'ANY', label: 'All' },
            { key: 'IN', label: 'Money in' },
            { key: 'OUT', label: 'Money out' },
          ]}
          value={direction}
          onChange={reset(setDirection)}
        />
        {!validRange ? (
          <EmptyState title="Choose a date range" text="The start date must be on or before the end date." />
        ) : book.error != null ? (
          <ErrorState
            error={plainError(book.error)}
            action={
              <Button size="sm" onClick={book.reload}>
                Try again
              </Button>
            }
          />
        ) : (
          <>
            {data && (
              <div className="mb-3 grid grid-cols-2 gap-3 text-[14px]" data-testid="balances">
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                    Opening balance
                  </div>
                  <div className="text-[20px] font-bold tabular-nums">{inr(data.openingPaise)}</div>
                </div>
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                    Closing balance
                  </div>
                  <div className="text-[20px] font-bold tabular-nums">{inr(data.closingPaise)}</div>
                </div>
              </div>
            )}
            <div className="overflow-x-auto" data-testid="table-scroll">
              <table
                className="w-full min-w-[760px] border-collapse text-left text-[14px]"
                aria-busy={book.loading || undefined}
              >
                <caption className="sr-only">Cash book</caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                    {['Date', 'Details', 'Account', 'In', 'Out', 'Balance'].map(h => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-3 py-2.5 ${['In', 'Out', 'Balance'].includes(h) ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {book.loading || !data
                    ? Array.from({ length: 5 }, (_, i) => (
                        <tr key={i} data-testid="skeleton-row" className="border-b border-[var(--line)]">
                          {Array.from({ length: 6 }, (_, c) => (
                            <td key={c} className="px-3 py-3.5">
                              <div className="skeleton h-4 w-full max-w-[120px]" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : data.rows.map((r, i) => (
                        <tr
                          key={`${r.voucherNo}-${i}`}
                          data-testid="cash-row"
                          className="border-b border-[var(--line)] last:border-0"
                        >
                          <td className="px-3 py-3">{shortDate(r.date)}</td>
                          <td className="px-3 py-3">
                            <div className="font-semibold">{r.narration || r.voucherType}</div>
                            <div className="text-[12.5px] text-muted">{r.voucherNo}</div>
                          </td>
                          <td className="px-3 py-3">{r.account}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-ok">
                            {r.inPaise ? inr(r.inPaise) : ''}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-bad">
                            {r.outPaise ? inr(r.outPaise) : ''}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">
                            {inr(r.runningPaise)}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {!book.loading && data && data.rows.length === 0 && (
              <EmptyState title="No entries" text="Nothing was paid or received in this period." />
            )}
            {data && data.totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-between gap-3 px-1 pt-3 text-[13px] text-muted"
              >
                <span>{data.total} entries</span>
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <span aria-current="page">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </span>
              </nav>
            )}
          </>
        )}
      </Card>
      {adding && (
        <ExpenseModal
          onClose={() => setAdding(false)}
          onSaved={(r, submitted) => {
            setAdding(false);
            toast.show(
              r.status === 'POSTED'
                ? 'Expense posted.'
                : submitted
                  ? 'Expense sent for approval.'
                  : 'Draft saved.',
            );
            book.reload();
          }}
        />
      )}
    </Page>
  );
}
