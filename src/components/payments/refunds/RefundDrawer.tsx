'use client';
import { KV } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Drawer } from '@/components/ui/Drawer';
import { inr, shortDate } from '@/lib/money';
import type { Refund } from '@/types/paymentsOps';
import { StatusChip } from '../ops/Bits';
import { REFUND_MODE_LABEL, REFUND_STATUS_LABEL, REFUND_STATUS_TONE } from '../ops/format';

/** A small detail view of one refund: status, mode, amount, reference, approval and the payout form. */
export function RefundDrawer({ refund: r, onClose }: { refund: Refund; onClose: () => void }) {
  const offline = r.mode !== 'GATEWAY';
  return (
    <Drawer open onClose={onClose} title={r.refundNo ?? `Refund request ${r.id}`} size={520}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[26px] font-bold tabular-nums">{inr(r.amountPaise)}</p>
          <StatusChip tone={REFUND_STATUS_TONE[r.status] ?? 'neutral'}>
            {REFUND_STATUS_LABEL[r.status] ?? r.status}
          </StatusChip>
        </div>
        {r.status === 'REJECTED' && r.rejectedReason && <Alert tone="bad">{r.rejectedReason}</Alert>}
        {r.status === 'FAILED' && r.failureReason && <Alert tone="bad">{r.failureReason}</Alert>}
        <dl>
          <KV label="Flat">{r.unitLabel || '-'}</KV>
          <KV label="For payment">{r.receiptNo ?? `Payment ${r.paymentId}`}</KV>
          <KV label="Paid back by">{REFUND_MODE_LABEL[r.mode] ?? r.mode}</KV>
          <KV label="Reason">{r.reason || '-'}</KV>
          <KV label="Approval">
            {r.status === 'PENDING_APPROVAL'
              ? 'Waiting for a different committee member'
              : r.status === 'REJECTED'
                ? 'Rejected'
                : 'Approved'}
          </KV>
          {offline && <KV label="Pay to">{r.payeeName ?? '-'}</KV>}
          {offline && r.payeeAccountMasked && <KV label="Account">{r.payeeAccountMasked}</KV>}
          {r.bankReference && <KV label="Reference">{r.bankReference}</KV>}
          {r.paidOutOn && <KV label="Paid out on">{shortDate(r.paidOutOn)}</KV>}
          <KV label="Requested on">{shortDate(r.createdAt)}</KV>
          {r.processedAt && <KV label="Finished on">{shortDate(r.processedAt)}</KV>}
        </dl>
      </div>
    </Drawer>
  );
}
