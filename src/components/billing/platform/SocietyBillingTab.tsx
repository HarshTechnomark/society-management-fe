'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/common/PageHead';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { CreditItem } from '@/types/platformBilling';
import { PaymentStatusChip } from '../format';
import { useServerList } from '../useServerList';
import { GoodwillCreditModal, RefundModal } from './dialogs';
import { InvoicesTab } from './InvoicesTab';

/**
 * Spec 11.2: the billing parts of the platform society Subscription tab: credit balance with Apply credit and
 * Refund credit, and the Invoices table. Module 04 owns the plan card above it.
 */
export function SocietyBillingTab({ societyId }: { societyId: number }) {
  const canView = usePermission(PERMISSIONS.platform.billing.view);
  const canEdit = usePermission(PERMISSIONS.platform.billing.edit);
  const [dlg, setDlg] = useState<'credit' | 'refund' | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const credits = useServerList(async page => {
    const r = await svc.societyCredits(societyId, { page, limit: 10 });
    setBalance(r.balancePaise);
    return r;
  }, String(societyId));
  if (!canView) return null;
  const columns: Column<CreditItem>[] = [
    { key: 'type', label: 'Entry', render: r => r.entryType.toLowerCase().replace(/_/g, ' ') },
    { key: 'amt', label: 'Amount', className: 'text-right tabular-nums', render: r => inr(r.amountPaise) },
    { key: 'st', label: 'Status', render: r => <PaymentStatusChip status={r.status} /> },
    { key: 'date', label: 'Date', render: r => shortDate(r.postedAt) },
    { key: 'why', label: 'Reason', render: r => r.reason ?? '-' },
  ];
  const done = () => {
    setDlg(null);
    credits.reload();
  };
  return (
    <div className="mt-4 flex flex-col gap-4">
      <Card title="Credit balance" sub="Applied to the next invoice automatically.">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <b className="text-[24px] tabular-nums" aria-label="Credit balance">
            {balance === null ? '-' : inr(balance)}
          </b>
          {canEdit && (
            <>
              <Button size="sm" onClick={() => setDlg('credit')}>
                Apply credit
              </Button>
              <Button size="sm" variant="glass" disabled={!balance} onClick={() => setDlg('refund')}>
                Refund credit
              </Button>
            </>
          )}
        </div>
        <DataTable
          caption="Credit ledger"
          columns={columns}
          rows={credits.rows}
          rowKey={r => r.id}
          loading={credits.loading}
          error={credits.error}
          onRetry={credits.reload}
          empty={{ title: 'No credits yet' }}
        />
      </Card>
      <Card title="Invoices">
        <InvoicesTab societyId={societyId} />
      </Card>
      {dlg === 'credit' && (
        <GoodwillCreditModal societyId={societyId} onClose={() => setDlg(null)} onDone={done} />
      )}
      {dlg === 'refund' && (
        <RefundModal
          societyId={societyId}
          balancePaise={balance ?? 0}
          onClose={() => setDlg(null)}
          onDone={done}
        />
      )}
    </div>
  );
}
