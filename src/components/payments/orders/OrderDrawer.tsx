'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import { ReasonModal, StatusChip } from '../ops/Bits';
import {
  ORDER_SOURCE_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  opsError,
  plainError,
} from '../ops/format';
import { ErrorState } from '@/components/common/ErrorState';

const P = PERMISSIONS.finance.payments;

/** One payment order (spec 8.16): amounts, items, cancel an unpaid order and ask the gateway now. */
export function OrderDrawer({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canEdit = usePermission(P.edit);
  const toast = useToast();
  const load = useLoad(() => paymentsOpsService.order(orderId), orderId);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const o = load.data;
  const open = o?.status === 'CREATED' || o?.status === 'ATTEMPTED';

  const check = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const next = await paymentsOpsService.checkOrder(orderId);
      toast.show(
        next.status === 'PAID' ? 'The gateway shows this order as paid.' : 'Checked with the gateway.',
      );
      load.reload();
      onChanged();
    } catch (e) {
      setFailed(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open onClose={onClose} title={`Payment order PO-${orderId}`} size={520}>
      {load.error != null ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : !o ? (
        <div aria-busy="true" aria-label="Loading" className="skeleton h-40 w-full" />
      ) : (
        <div className="grid gap-4">
          {failed && <Alert tone="bad">{failed}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[26px] font-bold tabular-nums">{inr(o.grossAmountPaise)}</p>
            <StatusChip tone={ORDER_STATUS_TONE[o.status] ?? 'neutral'}>
              {ORDER_STATUS_LABEL[o.status] ?? o.status}
            </StatusChip>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[14px]">
            <dt className="text-muted">Flat</dt>
            <dd>{o.unitLabel}</dd>
            <dt className="text-muted">Started from</dt>
            <dd>{ORDER_SOURCE_LABEL[o.sourceType] ?? o.sourceType}</dd>
            <dt className="text-muted">Created</dt>
            <dd>{shortDate(o.createdAt)}</dd>
            <dt className="text-muted">Expires</dt>
            <dd>{shortDate(o.expiresAt)}</dd>
            {o.paidAt && (
              <>
                <dt className="text-muted">Paid</dt>
                <dd>{shortDate(o.paidAt)}</dd>
              </>
            )}
            <dt className="text-muted">Attempts</dt>
            <dd>{o.attemptCount}</dd>
            {o.convenienceFeePaise ? (
              <>
                <dt className="text-muted">Convenience fee</dt>
                <dd>{inr(o.convenienceFeePaise)}</dd>
              </>
            ) : null}
          </dl>
          {o.failureReason && <Alert tone="bad">{o.failureReason}</Alert>}
          {o.items.length > 0 && (
            <ul aria-label="Items" className="divide-y divide-[var(--line)] text-[14px]">
              {o.items.map((i, n) => (
                <li key={n} className="flex justify-between gap-2 py-2">
                  <span>{i.label || i.itemType}</span>
                  <span className="tabular-nums">{inr(i.amountPaise)}</span>
                </li>
              ))}
            </ul>
          )}
          {canEdit && open && (
            <div className="flex flex-wrap gap-2">
              <Button variant="glass" loading={busy} onClick={() => void check()}>
                Check with the gateway
              </Button>
              <Button variant="danger-soft" onClick={() => setCancelling(true)}>
                Cancel this order
              </Button>
            </div>
          )}
        </div>
      )}
      {cancelling && (
        <ReasonModal
          title="Cancel this payment order"
          description="The gateway is checked first. If the money was already paid, the order is settled instead."
          confirmLabel="Cancel order"
          onCancel={() => setCancelling(false)}
          onSubmit={async reason => {
            await paymentsOpsService.cancelOrder(orderId, reason);
            toast.show('The order was cancelled.');
            setCancelling(false);
            load.reload();
            onChanged();
          }}
        />
      )}
    </Drawer>
  );
}
