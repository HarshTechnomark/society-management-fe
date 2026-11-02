'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Segment } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { InvoiceListItem, InvoiceQuery } from '@/types/platformBilling';
import { InvoiceStatusChip, billingError, isOpen, periodText, saveBlob } from '../format';
import { Pager, useServerList } from '../useServerList';
import { InvoiceDrawer } from './InvoiceDrawer';
import { ManualInvoiceModal, RecordPaymentModal, RemindModal } from './dialogs';

type Seg = 'ALL' | 'PENDING' | 'OVERDUE' | 'PAID';
const SEG: Record<Seg, InvoiceQuery> = {
  ALL: {},
  PENDING: { status: 'ISSUED,PARTIALLY_PAID' },
  OVERDUE: { status: 'OVERDUE' },
  PAID: { status: 'PAID' },
};
const MORE: Record<string, InvoiceQuery> = {
  VOID: { status: 'VOID' },
  WRITTEN_OFF: { status: 'WRITTEN_OFF' },
  CREDIT_NOTES: { documentType: 'CREDIT_NOTE' },
};

/** Spec 11.1 Invoices tab. */
export function InvoicesTab({ societyId }: { societyId?: number }) {
  const canEdit = usePermission(PERMISSIONS.platform.billing.edit);
  const canExport = usePermission(PERMISSIONS.platform.billing.export);
  const toast = useToast();
  const [seg, setSeg] = useState<Seg>('ALL');
  const [more, setMore] = useState('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [openRow, setOpenRow] = useState<InvoiceListItem | null>(null);
  const [remind, setRemind] = useState<InvoiceListItem | null>(null);
  const [pay, setPay] = useState<InvoiceListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const query: InvoiceQuery = { ...(more ? MORE[more] : SEG[seg]), q: q || undefined, societyId };
  const key = JSON.stringify(query);
  const list = useServerList(page => svc.platformInvoices({ ...query, page, limit: 20 }), key);

  const columns: Column<InvoiceListItem>[] = [
    {
      key: 'no',
      label: 'Invoice',
      render: r => <b>{r.invoiceNo ?? 'Draft'}</b>,
      sortValue: r => r.invoiceNo ?? '',
    },
    ...(societyId
      ? []
      : [{ key: 'soc', label: 'Society', render: (r: InvoiceListItem) => r.societyName ?? '-' }]),
    { key: 'period', label: 'Period', render: r => periodText(r.periodStart, r.periodEnd) },
    { key: 'due', label: 'Due', render: r => shortDate(r.dueDate), sortValue: r => r.dueDate ?? '' },
    {
      key: 'amt',
      label: 'Amount',
      className: 'text-right tabular-nums',
      render: r => inr(r.totalPaise),
      sortValue: r => r.totalPaise,
    },
    {
      key: 'owed',
      label: 'Due amount',
      className: 'text-right tabular-nums',
      render: r => inr(r.amountDuePaise),
      sortValue: r => r.amountDuePaise,
    },
    { key: 'st', label: 'Status', render: r => <InvoiceStatusChip status={r.status} /> },
    ...(canEdit
      ? [
          {
            key: 'act',
            label: 'Actions',
            hideLabel: true,
            render: (r: InvoiceListItem) =>
              r.documentType === 'INVOICE' && isOpen(r.status) ? (
                <span className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                  <Button
                    size="xs"
                    variant="glass"
                    onClick={() => setRemind(r)}
                    aria-label={`Remind ${r.invoiceNo}`}
                  >
                    Remind
                  </Button>
                  <Button
                    size="xs"
                    variant="glass"
                    onClick={() => setPay(r)}
                    aria-label={`Record payment for ${r.invoiceNo}`}
                  >
                    Record payment
                  </Button>
                </span>
              ) : null,
          },
        ]
      : []),
  ];

  const exportCsv = async () => {
    setExporting(true);
    try {
      saveBlob(await svc.exportInvoices(query), 'platform-invoices.csv');
    } catch (e) {
      toast.show(billingError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <input
          type="search"
          aria-label="Search invoice number or society"
          placeholder="Search invoice number or society"
          value={text}
          onChange={e => setText(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none sm:max-w-xs"
        />
        <Segment<Seg>
          label="Status"
          value={more ? ('' as Seg) : seg}
          onChange={v => {
            setMore('');
            setSeg(v);
          }}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'OVERDUE', label: 'Overdue' },
            { value: 'PAID', label: 'Paid' },
          ]}
        />
        <div className="w-40 [&>div]:mb-0">
          <Select
            label="More"
            value={more}
            onChange={e => setMore(e.target.value)}
            options={[
              { value: '', label: 'More' },
              { value: 'VOID', label: 'Void' },
              { value: 'WRITTEN_OFF', label: 'Written off' },
              { value: 'CREDIT_NOTES', label: 'Credit notes' },
            ]}
          />
        </div>
        <span className="ml-auto flex gap-2">
          {canExport && (
            <Button size="sm" variant="glass" loading={exporting} onClick={exportCsv}>
              Export CSV
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setCreating(true)}>
              New invoice
            </Button>
          )}
        </span>
      </div>
      <DataTable
        caption="Platform invoices"
        columns={columns}
        rows={list.rows}
        rowKey={r => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pageSize={20}
        onRowClick={setOpenRow}
        rowLabel={r => r.invoiceNo ?? 'draft invoice'}
        empty={{ title: 'No invoices yet', text: 'The first invoice is issued when a trial converts.' }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {openRow && (
        <InvoiceDrawer summary={openRow} onClose={() => setOpenRow(null)} onChanged={list.reload} />
      )}
      {remind && (
        <RemindModal invoice={remind} onClose={() => setRemind(null)} onDone={() => setRemind(null)} />
      )}
      {pay && (
        <RecordPaymentModal
          invoice={pay}
          onClose={() => setPay(null)}
          onDone={() => {
            setPay(null);
            list.reload();
          }}
        />
      )}
      {creating && (
        <ManualInvoiceModal
          societyId={societyId}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
