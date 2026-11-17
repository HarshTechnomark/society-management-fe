'use client';
import { useState } from 'react';
import { ReasonModal, StatusChip } from '@/components/payments/ops/Bits';
import { KV } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { accountsSettlementsService } from '@/services/accountsSettlements.service';
import type { Settlement, SettlementItem } from '@/types/accountsSettlements';
import { SETTLEMENT_STATUS_LABEL, SETTLEMENT_STATUS_TONE, bankError, plainError } from '../statements/format';
import { ErrorState } from '@/components/common/ErrorState';

/** One settlement: totals, the payments it covers (unmatched ones in red), Retry and Accept difference. */
export function SettlementDrawer({
  id,
  canImport,
  canApprove,
  onClose,
  onChanged,
}: {
  id: number;
  canImport: boolean;
  canApprove: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const load = useLoad(() => accountsSettlementsService.get(id), `s-${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const s = load.data;

  const retry = async (cur: Settlement) => {
    setBusy(true);
    setError(null);
    try {
      const r = await accountsSettlementsService.reconcile(cur.id);
      toast.show(r.status === 'POSTED' ? 'Settlement posted.' : 'Still not matching. See the red items.');
      load.reload();
      onChanged();
    } catch (e) {
      setError(bankError(e));
      load.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={s ? `Settlement ${s.gatewaySettlementId}` : 'Settlement'}
      size={640}
    >
      {load.error != null ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : !s ? (
        <div className="skeleton h-40 w-full" aria-busy="true" />
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[26px] font-bold tabular-nums">{inr(s.netPaise)}</p>
            <StatusChip tone={SETTLEMENT_STATUS_TONE[s.status] ?? 'neutral'}>
              {SETTLEMENT_STATUS_LABEL[s.status] ?? s.status}
            </StatusChip>
          </div>
          {error && <Alert tone="bad">{error}</Alert>}
          {s.status === 'MISMATCH' && (
            <Alert tone="warn">
              {s.unmatchedItems.length} payments do not match your records. Retry once the payments are
              recorded, or accept the difference (the amount goes to Suspense).
            </Alert>
          )}
          {s.differenceAcceptedReason && (
            <Alert tone="info">Difference accepted: {s.differenceAcceptedReason}</Alert>
          )}
          <dl>
            <KV label="Paid out on">{shortDate(s.settlementDate)}</KV>
            <KV label="Gateway">{s.gatewayProvider}</KV>
            <KV label="Bank reference (UTR)">{s.utr ?? '-'}</KV>
            <KV label="Payments">{String(s.paymentCount)}</KV>
            <KV label="Gross">{inr(s.grossPaise)}</KV>
            {s.refundsPaise !== 0 && <KV label="Refunds">{inr(-s.refundsPaise)}</KV>}
            <KV label="Gateway fee">{inr(s.feePaise)}</KV>
            <KV label="GST on the fee">{inr(s.feeGstPaise)}</KV>
            {s.adjustmentPaise !== 0 && <KV label="Adjustments">{inr(s.adjustmentPaise)}</KV>}
            <KV label="Net credited to the bank">{inr(s.netPaise)}</KV>
            <KV label="Difference">{inr(unmatchedDifference(s))}</KV>
          </dl>
          <div>
            <h3 className="mb-1 text-[15px] font-bold">Payments in this settlement</h3>
            {s.items.length === 0 ? (
              <p className="text-[13.5px] text-muted">No items were listed.</p>
            ) : (
              <ul aria-label="Settlement items" className="divide-y divide-[var(--line)]">
                {s.items.map((i, n) => (
                  <ItemRow key={n} item={i} bad={unmatched(s, i) ?? null} />
                ))}
              </ul>
            )}
          </div>
          {(canImport || canApprove) && s.status !== 'POSTED' && (
            <div className="flex flex-wrap gap-2">
              {canImport && (
                <Button variant="glass" loading={busy} onClick={() => void retry(s)}>
                  Reconcile
                </Button>
              )}
              {canApprove && s.status === 'MISMATCH' && (
                <Button variant="danger" onClick={() => setAccepting(true)}>
                  Accept difference
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {accepting && s && (
        <ReasonModal
          title="Accept the difference"
          description="The unmatched amount is posted to Suspense so the bank credit is recorded. You may be asked to confirm it is you."
          confirmLabel="Accept difference"
          max={500}
          onCancel={() => setAccepting(false)}
          onSubmit={async reason => {
            await accountsSettlementsService.acceptDifference(s.id, { reason, version: s.version });
            setError(null);
            toast.show('Settlement posted with the difference.');
            setAccepting(false);
            load.reload();
            onChanged();
          }}
        />
      )}
    </Drawer>
  );
}

const REASON_TEXT: Record<string, string> = {
  UNKNOWN_PAYMENT: 'Not found in your payments',
  NOT_CAPTURED: 'The payment was not captured in your records',
  ALREADY_SETTLED: 'Already paid out in another settlement',
  DUPLICATE_ITEM: 'Listed twice in this report',
  REFUNDS_EXCEED_GROSS: 'The refunds are more than the payments',
};
/** Words for the reason code the API sends on an unmatched item. */
export function reasonText(reason: string | null, item: SettlementItem): string {
  if (reason === 'AMOUNT_DIFFERS')
    return item.expectedPaise === null
      ? 'Amount differs from your payment'
      : `Amount differs: reported ${inr(item.amountPaise)}, captured ${inr(item.expectedPaise)}`;
  return (reason && REASON_TEXT[reason]) || reason || 'Not found in your payments';
}
/** What the settlement is off by: the gap on a wrong amount, the whole amount on any other unmatched payment. */
export function unmatchedDifference(s: Settlement): number {
  return s.unmatchedItems
    .filter(i => i.type === 'payment')
    .reduce(
      (t, i) => t + (i.expectedPaise !== null ? Math.abs(i.amountPaise - i.expectedPaise) : i.amountPaise),
      0,
    );
}

const unmatched = (s: Settlement, i: SettlementItem) =>
  s.unmatchedItems.find(u => u.gatewayPaymentId === i.gatewayPaymentId && u.type === i.type);

function ItemRow({ item: i, bad }: { item: SettlementItem; bad: SettlementItem | null }) {
  return (
    <li
      data-testid="settlement-item"
      data-unmatched={bad ? true : undefined}
      className={`flex items-start justify-between gap-3 py-2 text-[13.5px] ${bad ? 'text-bad' : ''}`}
    >
      <span className="min-w-0">
        <span className="block font-semibold">
          {i.type === 'refund' ? 'Refund ' : ''}
          {i.gatewayPaymentId}
        </span>
        <span className={bad ? '' : 'text-muted'}>
          {bad
            ? reasonText(bad.reason ?? i.reason, bad)
            : i.receiptNo
              ? `Receipt ${i.receiptNo}`
              : i.type === 'refund'
                ? 'Refund'
                : 'Not linked yet'}
          {` . fee ${inr(i.feePaise)} + GST ${inr(i.taxPaise)}`}
        </span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">
        {inr(i.type === 'refund' ? -i.amountPaise : i.amountPaise)}
      </span>
    </li>
  );
}
