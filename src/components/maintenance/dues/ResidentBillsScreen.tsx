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
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { billingResidentService } from '@/services/billingResident.service';
import type { MyDuesUnit } from '@/types/billingDues';
import { invoiceStatus, payHref, plainError } from './format';

const PAGE = 20;
type StatusFilter = 'ALL' | 'OPEN' | 'PAID';

/** My bills (spec 11.10): what I owe per flat, then the list of bills with status in words. */
export function ResidentBillsScreen() {
  return (
    <Gate view={PERMISSIONS.resident.dues.view} title="your bills">
      <Inner />
    </Gate>
  );
}

function isOwner(u: MyDuesUnit) {
  return u.relation === 'OWNER' || u.relation === 'CO_OWNER';
}

function Inner() {
  const statementOn = useFeature('billing.statement_of_account');
  const dues = useLoad(() => billingResidentService.dues(), 'dues');
  const [unit, setUnit] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const list = useLoad(
    () =>
      billingResidentService.invoices({
        unitId: unit ? Number(unit) : undefined,
        status,
        page,
        limit: PAGE,
      }),
    `${unit}|${status}|${page}`,
  );
  const units = dues.data ?? [];
  const items = list.data?.items ?? [];
  const pages = list.data?.totalPages ?? 1;

  return (
    <Page>
      <PageHead title="My bills" sub="Maintenance bills of your flats, what is due and what you have paid." />
      {dues.error != null ? (
        <Card className="mb-4">
          <ErrorState
            error={plainError(dues.error)}
            action={
              <Button size="sm" onClick={dues.reload}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : dues.loading ? (
        <div aria-busy="true" aria-label="Loading dues" className="mb-4">
          <div className="skeleton h-24 w-full" data-testid="skeleton-row" />
        </div>
      ) : (
        <ul aria-label="Dues by flat" className="mb-4 grid gap-3 min-[700px]:grid-cols-2">
          {units.map(u => (
            <li key={u.unitId} className="glass p-4" data-testid="dues-card">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[18px] font-bold">{u.unitLabel}</h2>
                {u.overduePaise > 0 && <Chip tone="bad">Overdue {inr(u.overduePaise)}</Chip>}
              </div>
              {u.outstandingPaise > 0 ? (
                <p className="mt-1 text-[15px]">
                  <strong>{inr(u.outstandingPaise)}</strong> due
                  {u.nextDueDate ? ` by ${shortDate(u.nextDueDate)}` : ''}
                  <span className="block text-[13px] text-muted">
                    {u.openInvoiceCount} open {u.openInvoiceCount === 1 ? 'bill' : 'bills'}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-[15px]">
                  <Chip tone="ok">Paid up</Chip> Nothing is due.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {u.outstandingPaise > 0 && (
                  <Link
                    href={payHref(u.unitId)}
                    aria-label={`Pay dues of ${u.unitLabel}`}
                    className={buttonClasses('primary', 'sm')}
                  >
                    Pay dues
                  </Link>
                )}
                {statementOn && isOwner(u) && (
                  <Link
                    href={`/resident/bills/statement/${u.unitId}`}
                    aria-label={`Statement of ${u.unitLabel}`}
                    className={buttonClasses('glass', 'sm')}
                  >
                    Statement
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card title="Bills">
        <div className="mb-2 flex flex-wrap items-end gap-3">
          {units.length > 1 && (
            <Select
              label="Flat"
              value={unit}
              onChange={e => {
                setUnit(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All my flats' },
                ...units.map(u => ({ value: String(u.unitId), label: u.unitLabel })),
              ]}
            />
          )}
        </div>
        <Segments
          label="Show bills"
          value={status}
          onChange={s => {
            setStatus(s);
            setPage(1);
          }}
          options={[
            { key: 'ALL', label: 'All' },
            { key: 'OPEN', label: 'To pay' },
            { key: 'PAID', label: 'Paid' },
          ]}
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
        ) : list.loading ? (
          <div aria-busy="true" aria-label="Loading bills">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton mb-2 h-16 w-full" data-testid="skeleton-row" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No bills yet"
            text={
              status === 'ALL' && !unit
                ? 'Bills appear here once your society issues them.'
                : 'No bill matches this filter.'
            }
          />
        ) : (
          <ul aria-label="Bills" className="divide-y divide-[var(--line)]">
            {items.map(b => {
              const st = invoiceStatus(b);
              return (
                <li key={b.id} data-testid="bill-row">
                  <Link
                    href={`/resident/bills/${b.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-3 hover:bg-black/[0.03]"
                  >
                    <span className="text-[15px] font-bold">{b.periodLabel || b.invoiceNo}</span>
                    <span className="text-right text-[15px] font-semibold tabular-nums">
                      {inr(b.totalPaise)}
                    </span>
                    <span className="text-[13px] text-muted">
                      {b.invoiceNo} · {b.unitLabel}
                      {b.status !== 'PAID' && b.status !== 'CANCELLED' && ` · due ${shortDate(b.dueDate)}`}
                    </span>
                    <span className="justify-self-end">
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Pages of bills" className="mt-3 flex items-center justify-between text-[13.5px]">
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
