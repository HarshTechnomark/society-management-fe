'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/common/PageHead';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { GstRow, PaymentItem, TdsRow } from '@/types/platformBilling';
import { PaymentStatusChip, billingError, saveBlob } from '../format';
import { TdsDecisionModal } from './dialogs';

/** "2026-27" for the financial year that today falls in. */
export function currentFy(now = new Date()): string {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}
const prevFy = (fy: string) => {
  const y = Number(fy.slice(0, 4)) - 1;
  return `${y}-${String(y + 1).slice(2)}`;
};

/** Spec 11.1 GST and TDS tab. */
export function GstTdsTab() {
  const canExport = usePermission(PERMISSIONS.platform.billing.export);
  const canEdit = usePermission(PERMISSIONS.platform.billing.edit);
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const fy = currentFy();
  const [year, setYear] = useState(fy);
  const [quarter, setQuarter] = useState('');
  const [deciding, setDeciding] = useState<PaymentItem | null>(null);
  const gst = useLoad(() => svc.gstSummary(month), month);
  const tds = useLoad(
    () => svc.tdsReceivable({ financialYear: year, quarter: quarter ? Number(quarter) : undefined }),
    `${year}|${quarter}`,
  );
  const claims = useLoad(() =>
    svc.platformPayments({ kind: 'TDS', status: 'CLAIMED', limit: 50 }).then(r => r.items),
  );

  const download = async (fn: () => Promise<Blob>, name: string) => {
    try {
      saveBlob(await fn(), name);
    } catch (e) {
      toast.show(billingError(e), 'error');
    }
  };

  const gstCols: Column<GstRow>[] = [
    {
      key: 'sup',
      label: 'Supply',
      render: r =>
        `${r.supplyType ?? ''} ${r.placeOfSupplyStateCode ? '· state ' + r.placeOfSupplyStateCode : ''}`,
    },
    {
      key: 'doc',
      label: 'Document',
      render: r => (r.documentType === 'CREDIT_NOTE' ? 'Credit notes' : 'Invoices'),
    },
    { key: 'n', label: 'Count', className: 'text-right tabular-nums', render: r => r.count },
    { key: 'tax', label: 'Taxable', className: 'text-right tabular-nums', render: r => inr(r.taxablePaise) },
    { key: 'cgst', label: 'CGST', className: 'text-right tabular-nums', render: r => inr(r.cgstPaise) },
    { key: 'sgst', label: 'SGST', className: 'text-right tabular-nums', render: r => inr(r.sgstPaise) },
    { key: 'igst', label: 'IGST', className: 'text-right tabular-nums', render: r => inr(r.igstPaise) },
  ];
  const tdsCols: Column<TdsRow>[] = [
    { key: 'soc', label: 'Society', render: r => <b>{r.societyName}</b> },
    { key: 'sec', label: 'Section', render: r => r.tdsSection },
    { key: 'c', label: 'Claimed', className: 'text-right tabular-nums', render: r => inr(r.claimedPaise) },
    { key: 'v', label: 'Verified', className: 'text-right tabular-nums', render: r => inr(r.verifiedPaise) },
    { key: 'r', label: 'Rejected', className: 'text-right tabular-nums', render: r => inr(r.rejectedPaise) },
    {
      key: 'm',
      label: 'Missing certificates',
      className: 'text-right tabular-nums',
      render: r => r.missingCertificates,
    },
  ];
  const claimCols: Column<PaymentItem>[] = [
    { key: 'soc', label: 'Society', render: r => r.societyName ?? '-' },
    { key: 'inv', label: 'Invoice', render: r => r.invoiceNo ?? '-' },
    { key: 'sec', label: 'Section', render: r => r.tdsSection ?? '-' },
    { key: 'amt', label: 'Amount', className: 'text-right tabular-nums', render: r => inr(r.amountPaise) },
    { key: 'on', label: 'Deducted on', render: r => shortDate(r.deductedOn) },
    { key: 'cert', label: 'Certificate', render: r => (r.hasCertificate ? 'Attached' : 'Missing') },
    { key: 'st', label: 'Status', render: r => <PaymentStatusChip status={r.status} /> },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      render: r =>
        canEdit ? (
          <span className="flex gap-1.5">
            <Button
              size="xs"
              variant="glass"
              onClick={() => setDeciding(r)}
              aria-label={`Verify or reject TDS of ${r.societyName}`}
            >
              Verify or reject
            </Button>
          </span>
        ) : null,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Card
        title="GST on platform invoices"
        sub="Output tax by supply type. Credit notes are shown as their own group."
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="w-44 [&>div]:mb-0">
            <Input label="Month" type="month" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          {canExport && (
            <Button
              size="sm"
              variant="glass"
              onClick={() => download(() => svc.gstCsv(month), `gst-${month}.csv`)}
            >
              Export CSV
            </Button>
          )}
        </div>
        <DataTable
          caption="GST summary"
          columns={gstCols}
          rows={gst.data ?? []}
          rowKey={r => `${r.documentType}-${r.supplyType}-${r.placeOfSupplyStateCode}`}
          loading={gst.loading}
          error={gst.error}
          onRetry={gst.reload}
          empty={{ title: 'No invoices in this month' }}
        />
      </Card>
      <Card title="TDS receivable" sub="TDS the societies deducted, by status.">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="w-40 [&>div]:mb-0">
            <Select
              label="Financial year"
              value={year}
              onChange={e => setYear(e.target.value)}
              options={[fy, prevFy(fy)].map(v => ({ value: v, label: v }))}
            />
          </div>
          <div className="w-36 [&>div]:mb-0">
            <Select
              label="Quarter"
              value={quarter}
              onChange={e => setQuarter(e.target.value)}
              options={[
                { value: '', label: 'All' },
                ...[1, 2, 3, 4].map(q => ({ value: String(q), label: `Q${q}` })),
              ]}
            />
          </div>
          {canExport && (
            <Button
              size="sm"
              variant="glass"
              onClick={() =>
                download(() => svc.tdsCsv(year, quarter ? Number(quarter) : undefined), `tds-${year}.csv`)
              }
            >
              Export CSV
            </Button>
          )}
        </div>
        <DataTable
          caption="TDS receivable"
          columns={tdsCols}
          rows={tds.data ?? []}
          rowKey={r => `${r.societyId}-${r.tdsSection}`}
          loading={tds.loading}
          error={tds.error}
          onRetry={tds.reload}
          empty={{ title: 'No TDS claims in this period' }}
        />
      </Card>
      <Card title="Claims waiting for a decision">
        <DataTable
          caption="TDS claims to verify"
          columns={claimCols}
          rows={claims.data ?? []}
          rowKey={r => r.id}
          loading={claims.loading}
          error={claims.error}
          onRetry={claims.reload}
          empty={{ title: 'No claims waiting' }}
        />
      </Card>
      {deciding && (
        <TdsDecisionModal
          payment={deciding}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            claims.reload();
            tds.reload();
          }}
        />
      )}
    </div>
  );
}
