'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Segment } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { PaymentItem, PaymentKind } from '@/types/platformBilling';
import { KIND_LABEL, PaymentStatusChip, methodText } from '../format';
import { Pager, useServerList } from '../useServerList';
import { CompleteRefundModal, RecordPaymentModal, TdsDecisionModal } from './dialogs';

/** Spec 11.1 Payments tab: payments, TDS claims and refunds. */
export function PaymentsTab({ societyId }: { societyId?: number }) {
  const canEdit = usePermission(PERMISSIONS.platform.billing.edit);
  const [kind, setKind] = useState<PaymentKind | 'ALL'>('ALL');
  const [dlg, setDlg] = useState<{ kind: 'tds' | 'refund'; item: PaymentItem } | null>(null);
  const [recording, setRecording] = useState(false);
  const list = useServerList(
    page => svc.platformPayments({ kind: kind === 'ALL' ? undefined : kind, societyId, page, limit: 20 }),
    `${kind}|${societyId ?? ''}`,
  );
  const columns: Column<PaymentItem>[] = [
    { key: 'kind', label: 'Type', render: r => KIND_LABEL[r.kind] ?? r.kind },
    ...(societyId
      ? []
      : [{ key: 'soc', label: 'Society', render: (r: PaymentItem) => r.societyName ?? '-' }]),
    { key: 'inv', label: 'Invoice', render: r => r.invoiceNo ?? '-' },
    {
      key: 'method',
      label: 'Method',
      render: r => (r.kind === 'TDS' ? `TDS ${r.tdsSection ?? ''}` : methodText(r.method)),
    },
    { key: 'ref', label: 'Reference', render: r => r.bankReference ?? '-' },
    {
      key: 'amt',
      label: 'Amount',
      className: 'text-right tabular-nums',
      render: r => inr(r.amountPaise),
      sortValue: r => r.amountPaise,
    },
    { key: 'date', label: 'Date', render: r => shortDate(r.receivedOn ?? r.capturedAt ?? r.createdAt) },
    { key: 'st', label: 'Status', render: r => <PaymentStatusChip status={r.status} /> },
    ...(canEdit
      ? [
          {
            key: 'act',
            label: 'Actions',
            hideLabel: true,
            render: (r: PaymentItem) =>
              r.kind === 'TDS' && r.status === 'CLAIMED' ? (
                <Button size="xs" variant="glass" onClick={() => setDlg({ kind: 'tds', item: r })}>
                  Decide
                </Button>
              ) : r.kind === 'REFUND' && r.status === 'PROCESSING' && r.method === 'BANK_TRANSFER' ? (
                <Button size="xs" variant="glass" onClick={() => setDlg({ kind: 'refund', item: r })}>
                  Complete refund
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segment<PaymentKind | 'ALL'>
          label="Type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'PAYMENT', label: 'Payments' },
            { value: 'TDS', label: 'TDS claims' },
            { value: 'REFUND', label: 'Refunds' },
          ]}
        />
        {canEdit && (
          <Button size="sm" className="ml-auto" onClick={() => setRecording(true)}>
            Record payment
          </Button>
        )}
      </div>
      <DataTable
        caption="Platform payments"
        columns={columns}
        rows={list.rows}
        rowKey={r => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pageSize={20}
        empty={{ title: 'No payments yet' }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {dlg?.kind === 'tds' && (
        <TdsDecisionModal
          payment={dlg.item}
          onClose={() => setDlg(null)}
          onDone={() => {
            setDlg(null);
            list.reload();
          }}
        />
      )}
      {dlg?.kind === 'refund' && (
        <CompleteRefundModal
          payment={dlg.item}
          onClose={() => setDlg(null)}
          onDone={() => {
            setDlg(null);
            list.reload();
          }}
        />
      )}
      {recording && (
        <RecordPaymentModal
          societyId={societyId}
          onClose={() => setRecording(false)}
          onDone={() => {
            setRecording(false);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
