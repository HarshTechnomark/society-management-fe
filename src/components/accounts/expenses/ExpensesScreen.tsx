'use client';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Gate } from '@/components/setup/Gate';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsExpensesService as svc } from '@/services/accountsExpenses.service';
import type { ExpenseItem, ExpenseQuery } from '@/types/accountsExpenses';
import { ExpenseDrawer } from './ExpenseDrawer';
import { ExpenseModal } from './ExpenseModal';
import {
  STATUS_FILTERS,
  downloadBlob,
  expenseError,
  plainError,
  statusInfo,
  type StatusFilterKey,
} from './format';

const E = PERMISSIONS.finance.expenses;
const LIMIT = 20;

export function buildExpenseQuery(
  status: StatusFilterKey,
  q: string,
  from: string,
  to: string,
  mine: boolean,
  page: number,
): ExpenseQuery {
  const query: ExpenseQuery = { page, limit: LIMIT };
  const text = q.trim();
  if (text.length >= 2) query.q = text;
  const s = STATUS_FILTERS.find(f => f.key === status)?.status;
  if (s) query.status = s;
  if (from) query.from = from;
  if (to) query.to = to;
  if (mine) query.createdByMe = true;
  return query;
}

/** Accounts > Expenses (spec 11.2): list with status chips, filters, export, drawer and the add form. */
export function ExpensesScreen() {
  return (
    <Gate view={E.view} title="Expenses">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(E.create);
  const canExport = usePermission(E.export);
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilterKey>('ANY');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const query = buildExpenseQuery(status, q, from, to, mine, page);
  const list = useLoad(() => svc.list(query), JSON.stringify(query));
  const data = list.data;

  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const exportIt = async () => {
    setExporting(true);
    try {
      downloadBlob(await svc.exportCsv(query), 'expenses.csv');
    } catch (e) {
      toast.show(expenseError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Page>
      <PageHead
        title="Expenses"
        sub="Money the society spends, with bills and approvals."
        actions={
          <>
            <Link href="/admin/accounts/cash-book" className={buttonClasses('glass', 'md')}>
              Cash book
            </Link>
            {canExport && (
              <Button variant="glass" loading={exporting} onClick={() => void exportIt()}>
                Export CSV
              </Button>
            )}
            {canCreate && <Button onClick={() => setAdding(true)}>Add expense</Button>}
          </>
        }
      />
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            label="Search payee, category or person"
            type="search"
            value={q}
            onChange={e => change(setQ)(e.target.value)}
          />
          <Input label="From" type="date" value={from} onChange={e => change(setFrom)(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={e => change(setTo)(e.target.value)} />
        </div>
        <Segments
          label="Status"
          options={STATUS_FILTERS.map(f => ({ key: f.key, label: f.label }))}
          value={status}
          onChange={change(setStatus)}
        />
        <Segments
          label="Entered by"
          options={[
            { key: 'ALL', label: 'Everyone' },
            { key: 'ME', label: 'Me' },
          ]}
          value={mine ? 'ME' : 'ALL'}
          onChange={k => change(setMine)(k === 'ME')}
        />
        {list.error != null ? (
          <ErrorState
            error={plainError(list.error)}
            action={
              <Button size="sm" onClick={list.reload}>
                Try again
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto" data-testid="table-scroll">
            <table
              className="w-full min-w-[720px] border-collapse text-left text-[14px]"
              aria-busy={list.loading || undefined}
            >
              <caption className="sr-only">Expenses</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {['Date', 'Payee', 'Paid from', 'Amount', 'By', 'Status'].map(h => (
                    <th key={h} scope="col" className="px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.loading || !data
                  ? Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} data-testid="skeleton-row" className="border-b border-[var(--line)]">
                        {Array.from({ length: 6 }, (_, c) => (
                          <td key={c} className="px-3 py-3.5">
                            <div className="skeleton h-4 w-full max-w-[120px]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : data.items.map(x => <Row key={x.id} x={x} onOpen={() => setOpenId(x.id)} />)}
              </tbody>
            </table>
          </div>
        )}
        {!list.loading && !list.error && data && data.items.length === 0 && (
          <EmptyState
            title="No expenses here"
            text="Nothing matches these filters. Add an expense or change the filters."
          />
        )}
        {data && data.totalPages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between gap-3 px-1 pt-3 text-[13px] text-muted"
          >
            <span>{data.total} expenses</span>
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
      </Card>
      {openId !== null && (
        <ExpenseDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
      )}
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
            list.reload();
          }}
        />
      )}
    </Page>
  );
}

function Row({ x, onOpen }: { x: ExpenseItem; onOpen: () => void }) {
  const st = statusInfo(x.status);
  return (
    <tr
      className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-white/50"
      data-testid="expense-row"
      onClick={onOpen}
    >
      <td className="px-3 py-3">{shortDate(x.expenseDate)}</td>
      <td className="px-3 py-3">
        <button
          type="button"
          className="text-left font-semibold"
          aria-label={`Open ${x.displayId}`}
          onClick={e => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {x.payee}
        </button>
        <div className="text-[12.5px] text-muted">
          {x.ledgerAccount?.name ?? ''}
          {x.collectionTitle ? ` · ${x.collectionTitle}` : x.fundName ? ` · ${x.fundName}` : ''}
        </div>
      </td>
      <td className="px-3 py-3">{x.paidFrom?.name ?? '-'}</td>
      <td className="px-3 py-3 font-semibold tabular-nums">{inr(x.grossAmountPaise)}</td>
      <td className="px-3 py-3">{x.createdByName ?? '-'}</td>
      <td className="px-3 py-3">
        <Chip tone={st.tone}>{st.label}</Chip>
      </td>
    </tr>
  );
}
