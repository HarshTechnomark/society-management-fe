'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { billingInvoicesService } from '@/services/billingInvoices.service';
import type { InvoiceQuery, UnitOption } from '@/types/billingInvoices';
import { AdHocInvoiceDrawer } from './AdHocInvoiceDrawer';
import { InvoiceDrawer } from './InvoiceDrawer';
import { InvoiceStatusChip, OverdueChip, UnitPicker } from './InvoiceBits';
import {
  RELATION_LABEL,
  SORT_OPTIONS,
  STATUS_FILTERS,
  TYPE_LABEL,
  billingInvoiceError,
  downloadBlob,
  periodOptions,
  plainError,
} from './format';

const B = PERMISSIONS.finance.billing;
const PAGE = 20;
const COLS = 'min-[900px]:grid-cols-[11rem_1fr_8rem_7rem_7rem_7rem_8.5rem]';

/** Invoice list (spec 8.11, 11.1): filters, sort, pages, CSV export, status chips in words, drawer on row click. */
export function InvoicesScreen() {
  return (
    <Gate view={B.view} title="Invoices">
      <Inner />
    </Gate>
  );
}

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

function Inner() {
  const params = useSearchParams();
  const canCreate = usePermission(B.create);
  const canExport = usePermission(B.export);
  const adHocOn = useFeature('billing.supplementary_and_ad_hoc_invoices');
  const toast = useToast();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [unit, setUnit] = useState<UnitOption | null>(() => {
    const id = num(params.get('unitId'));
    return id ? { id, label: `Flat ${id}` } : null;
  });
  const [payer, setPayer] = useState<number | undefined>(num(params.get('billToResidentId')));
  const [period, setPeriod] = useState('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('invoiceDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const query: InvoiceQuery = {
    status: status || undefined,
    unitId: unit?.id,
    billToResidentId: payer,
    periodStart: period || undefined,
    q: q || undefined,
    sortBy,
    sortOrder,
  };
  const list = useLoad(
    () => billingInvoicesService.list({ ...query, page, limit: PAGE }),
    JSON.stringify([query, page]),
  );
  const items = list.data?.items ?? [];
  const pages = list.data?.pagination.totalPages ?? 1;
  const filtered = !!(status || unit || payer || period || q);
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(await billingInvoicesService.exportCsv(query), 'invoices.csv');
      toast.show('Invoices exported');
    } catch (e) {
      toast.show(billingInvoiceError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const newInvoice = canCreate && adHocOn && <Button onClick={() => setCreating(true)}>New invoice</Button>;
  const actions = (
    <>
      {canExport && (
        <Button variant="glass" loading={exporting} onClick={() => void exportCsv()}>
          Export CSV
        </Button>
      )}
      {newInvoice}
    </>
  );

  return (
    <Page>
      <PageHead
        title="Invoices"
        sub="Every maintenance bill and one-off invoice. Open a bill to see its lines, payments and notes."
        actions={actions}
      />
      <Card>
        <form
          role="search"
          className="mb-3 grid grid-cols-1 items-end gap-x-3 min-[560px]:grid-cols-2 min-[900px]:grid-cols-4"
          onSubmit={e => {
            e.preventDefault();
            setQ(text.trim());
            setPage(1);
          }}
        >
          <Input
            label="Search"
            placeholder="Invoice number, flat or name"
            value={text}
            maxLength={60}
            onChange={e => setText(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={e => reset(setStatus)(e.target.value)}
            options={STATUS_FILTERS}
          />
          <Select
            label="Period"
            value={period}
            onChange={e => reset(setPeriod)(e.target.value)}
            options={[
              { value: '', label: 'All periods' },
              ...periodOptions('MONTHLY', new Date(), 12)
                .reverse()
                .map(o => ({ value: o.value, label: o.label })),
            ]}
          />
          <div className="flex items-end gap-2">
            <Select
              label="Sort by"
              value={sortBy}
              onChange={e => reset(setSortBy)(e.target.value)}
              options={SORT_OPTIONS}
            />
            <Button
              type="button"
              variant="glass"
              size="sm"
              className="mb-1"
              aria-label={sortOrder === 'desc' ? 'Sorted high to low, switch' : 'Sorted low to high, switch'}
              onClick={() => reset(setSortOrder)(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              {sortOrder === 'desc' ? 'High to low' : 'Low to high'}
            </Button>
          </div>
          <div className="min-[560px]:col-span-2">
            <UnitPicker label="Flat" value={unit} onChange={reset(setUnit)} />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 min-[560px]:col-span-2">
            <Button type="submit" size="sm">
              Search
            </Button>
            {payer && (
              <Chip tone="info">
                Payer filter on
                <button
                  type="button"
                  className="ml-2 font-bold underline"
                  aria-label="Clear the payer filter"
                  onClick={() => reset(setPayer)(undefined)}
                >
                  Clear
                </button>
              </Chip>
            )}
          </div>
        </form>

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
        ) : items.length === 0 ? (
          <EmptyState
            title={filtered ? 'No invoices match' : 'No invoices yet'}
            text={filtered ? 'Change the filters.' : 'Run billing to create the bills of a period.'}
          />
        ) : (
          <ul aria-label="Invoices" className="divide-y divide-[var(--line)]">
            <li
              aria-hidden="true"
              className={`hidden gap-x-3 pb-2 text-[12.5px] font-semibold text-muted min-[900px]:grid ${COLS}`}
            >
              <span>Invoice</span>
              <span>Flat</span>
              <span>Period</span>
              <span>Due</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Paid</span>
              <span>Status</span>
            </li>
            {items.map(r => (
              <li key={r.id} data-testid="invoice-row">
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  aria-label={`Open ${r.invoiceNo}`}
                  className={`grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 py-3 text-left hover:bg-black/[0.03] ${COLS}`}
                >
                  <span className="text-[14.5px] font-bold">
                    {r.invoiceNo}
                    <span className="block text-[12.5px] font-normal text-muted">
                      {TYPE_LABEL[r.invoiceType] ?? r.invoiceType}
                    </span>
                  </span>
                  <span className="text-[14px]">
                    {r.unitLabel}
                    <span className="block text-[12.5px] text-muted">
                      {r.billToName}
                      {r.billToRelation && ` (${RELATION_LABEL[r.billToRelation] ?? r.billToRelation})`}
                    </span>
                  </span>
                  <span className="text-[13.5px] text-muted">{r.periodLabel || '-'}</span>
                  <span className="text-[13.5px]">Due {shortDate(r.dueDate)}</span>
                  <span className="text-[14px] font-semibold tabular-nums min-[900px]:text-right">
                    {inr(r.totalPaise)}
                  </span>
                  <span className="text-[13.5px] tabular-nums text-muted min-[900px]:text-right">
                    Paid {inr(r.paidPaise)}
                  </span>
                  <span className="col-span-2 flex flex-wrap gap-1 min-[900px]:col-span-1">
                    <InvoiceStatusChip status={r.status} />
                    {r.isOverdue && r.status !== 'CANCELLED' && <OverdueChip />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav
            aria-label="Pages of invoices"
            className="mt-3 flex items-center justify-between text-[13.5px]"
          >
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
      {openId !== null && (
        <InvoiceDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
      )}
      {creating && (
        <AdHocInvoiceDrawer
          onClose={() => setCreating(false)}
          onCreated={inv => {
            setCreating(false);
            toast.show(`Invoice ${inv.invoiceNo} created`);
            list.reload();
            setOpenId(inv.id);
          }}
        />
      )}
    </Page>
  );
}
