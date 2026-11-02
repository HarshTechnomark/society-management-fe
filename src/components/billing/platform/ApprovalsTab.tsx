'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { ApprovalItem, ApprovalType } from '@/types/platformBilling';
import { Pager, useServerList } from '../useServerList';
import { ApproveDialog, ReasonDialog } from './dialogs';

export const APPROVAL_LABEL: Record<ApprovalType, string> = {
  MANUAL_PAYMENT: 'Manual payment',
  REFUND: 'Refund',
  MANUAL_INVOICE: 'Manual invoice',
  CREDIT_NOTE: 'Credit note',
  GOODWILL_CREDIT: 'Goodwill credit',
  WRITE_OFF: 'Write-off',
  PAYMENT_MISMATCH: 'Payment mismatch',
};

/** The current version of the item behind a row; the approvals list may not carry it. */
async function versionOf(a: ApprovalItem): Promise<number> {
  if (a.version !== undefined) return a.version;
  switch (a.type) {
    case 'MANUAL_INVOICE':
    case 'CREDIT_NOTE':
    case 'WRITE_OFF':
      return (await svc.platformInvoice(a.id)).version;
    case 'MANUAL_PAYMENT':
    case 'REFUND': {
      const r = await svc.platformPayments({
        societyId: a.societyId,
        status: 'PENDING_APPROVAL',
        limit: 100,
      });
      return r.items.find(p => p.id === a.id)?.version ?? 1;
    }
    default:
      return 1;
  }
}

const approve = async (a: ApprovalItem) => {
  const v = await versionOf(a);
  if (a.type === 'MANUAL_INVOICE' || a.type === 'CREDIT_NOTE') return svc.approveInvoice(a.id, v);
  if (a.type === 'WRITE_OFF') return svc.approveWriteOff(a.id, v);
  if (a.type === 'GOODWILL_CREDIT') return svc.approveCredit(a.id, v);
  return svc.approvePayment(a.id, v);
};
const reject = async (a: ApprovalItem, reason: string) => {
  const v = await versionOf(a);
  if (a.type === 'MANUAL_INVOICE' || a.type === 'CREDIT_NOTE') return svc.rejectInvoice(a.id, v, reason);
  if (a.type === 'WRITE_OFF') return svc.rejectWriteOff(a.id, v, reason);
  if (a.type === 'GOODWILL_CREDIT') return svc.rejectCredit(a.id, v, reason);
  return svc.rejectPayment(a.id, v, reason);
};

/** Spec 11.1 Approvals: items waiting for a second approver. */
export function ApprovalsTab() {
  const canApprove = usePermission(PERMISSIONS.platform.billing.approve);
  const [type, setType] = useState('');
  const [act, setAct] = useState<{ kind: 'approve' | 'reject'; item: ApprovalItem } | null>(null);
  const list = useServerList(page => svc.approvals({ type: type || undefined, page, limit: 20 }), type);

  const columns: Column<ApprovalItem>[] = [
    { key: 'type', label: 'Request', render: r => <b>{APPROVAL_LABEL[r.type] ?? r.type}</b> },
    { key: 'soc', label: 'Society', render: r => r.societyName },
    { key: 'amt', label: 'Amount', className: 'text-right tabular-nums', render: r => inr(r.amountPaise) },
    { key: 'by', label: 'Asked by', render: r => `${r.createdBy.name}, ${shortDate(r.createdAt)}` },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      render: r =>
        r.type === 'PAYMENT_MISMATCH' ? (
          <Chip tone="warn">Needs review</Chip>
        ) : !canApprove ? null : r.canApprove ? (
          <span className="flex gap-1.5">
            <Button
              size="xs"
              onClick={() => setAct({ kind: 'approve', item: r })}
              aria-label={`Approve ${APPROVAL_LABEL[r.type]} for ${r.societyName}`}
            >
              Approve
            </Button>
            <Button
              size="xs"
              variant="danger-soft"
              onClick={() => setAct({ kind: 'reject', item: r })}
              aria-label={`Reject ${APPROVAL_LABEL[r.type]} for ${r.societyName}`}
            >
              Reject
            </Button>
          </span>
        ) : (
          <span className="text-[13px] text-muted">Waiting for another approver</span>
        ),
    },
  ];
  return (
    <div>
      <p className="mb-3 text-[14px] text-muted">
        Recording a payment, issuing a credit note or giving a credit needs a second person. The person who
        asked cannot approve.
      </p>
      <div className="mb-3 w-56 [&>div]:mb-0">
        <Select
          label="Type"
          value={type}
          onChange={e => setType(e.target.value)}
          options={[
            { value: '', label: 'All types' },
            ...Object.entries(APPROVAL_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>
      <DataTable
        caption="Waiting for approval"
        columns={columns}
        rows={list.rows}
        rowKey={r => `${r.type}-${r.id}`}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pageSize={20}
        empty={{ title: 'Nothing is waiting', text: 'Requests that need a second approver show up here.' }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {act?.kind === 'approve' && (
        <ApproveDialog
          title={`Approve ${APPROVAL_LABEL[act.item.type].toLowerCase()}`}
          description={`${act.item.societyName}, ${inr(act.item.amountPaise)}, asked by ${act.item.createdBy.name}.`}
          run={() => approve(act.item)}
          success="Approved."
          onClose={() => setAct(null)}
          onDone={() => {
            setAct(null);
            list.reload();
          }}
        />
      )}
      {act?.kind === 'reject' && (
        <ReasonDialog
          title={`Reject ${APPROVAL_LABEL[act.item.type].toLowerCase()}`}
          description={`${act.item.societyName}, ${inr(act.item.amountPaise)}.`}
          confirmLabel="Reject"
          run={reason => reject(act.item, reason)}
          success="Rejected."
          onClose={() => setAct(null)}
          onDone={() => {
            setAct(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
