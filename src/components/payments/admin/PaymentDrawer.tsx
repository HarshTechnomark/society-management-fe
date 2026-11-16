'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { KV, Section } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsService } from '@/services/payments.service';
import {
  BounceDialog,
  ClearDialog,
  ReallocateDialog,
  ResendDialog,
  ReturnDialog,
  ReverseDialog,
  ReviewDialog,
} from './PaymentDialogs';
import {
  eventLabel,
  isEffective,
  landsIn,
  methodLabel,
  paymentError,
  plainError,
  statusInfo,
} from './format';

const P = PERMISSIONS.finance.payments;
type Dialog = 'clear' | 'bounce' | 'return' | 'reverse' | 'reallocate' | 'resend' | 'review';

/** Payment drawer (spec 11.1): every field and the actions the permission and the state allow. */
export function PaymentDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  /** Called after an action so the list reloads. */
  onChanged: () => void;
}) {
  const load = useLoad(() => paymentsService.get(id), id);
  const toast = useToast();
  const canEdit = usePermission(P.edit);
  const canCreate = usePermission(P.create);
  const canApprove = usePermission(P.approve);
  const receiptsOn = useFeature('payments.receipts');
  const chequesOn = useFeature('payments.cheque_lifecycle');
  const reverseOn = useFeature('payments.refunds_and_reversals');
  const reallocOn = useFeature('payments.allocation_engine');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const p = load.data;

  const download = async () => {
    if (!p) return;
    setBusy(true);
    try {
      const { url } = await paymentsService.receiptUrl(p.id);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
    } catch (e) {
      toast.show(paymentError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const done = (message: string) => {
    setDialog(null);
    toast.show(message);
    onChanged();
    load.reload();
  };

  const isCheque = p?.method === 'CHEQUE';
  const hasReceipt = !!p && p.receiptStatus === 'ISSUED';
  const actions = p && (
    <>
      {receiptsOn && hasReceipt && (
        <Button size="sm" variant="glass" loading={busy} onClick={() => void download()}>
          Download receipt
        </Button>
      )}
      {canEdit && receiptsOn && hasReceipt && (
        <Button size="sm" variant="glass" onClick={() => setDialog('resend')}>
          Resend receipt
        </Button>
      )}
      {canEdit && chequesOn && isCheque && p.status === 'DEPOSITED' && (
        <Button size="sm" onClick={() => setDialog('clear')}>
          Mark cleared
        </Button>
      )}
      {canEdit && chequesOn && isCheque && ['DEPOSITED', 'CLEARED'].includes(p.status) && (
        <Button size="sm" variant="danger-soft" onClick={() => setDialog('bounce')}>
          Bounced
        </Button>
      )}
      {canEdit && chequesOn && isCheque && p.status === 'RECEIVED' && (
        <Button size="sm" variant="glass" onClick={() => setDialog('return')}>
          Return to payer
        </Button>
      )}
      {canEdit && reallocOn && isEffective(p) && (
        <Button size="sm" variant="glass" onClick={() => setDialog('reallocate')}>
          Reallocate
        </Button>
      )}
      {canEdit && (p.needsReview || p.isDuplicateSuspect) && (
        <Button size="sm" variant="glass" onClick={() => setDialog('review')}>
          Mark reviewed
        </Button>
      )}
      {canCreate && isEffective(p) && p.refundedPaise < p.amountPaise && (
        <Link
          href={`/admin/payments/refunds?paymentId=${p.id}`}
          className="inline-flex h-9 items-center justify-center rounded-full border border-white/80 bg-white/60 px-4 text-[13.5px] font-semibold hover:bg-white/80"
        >
          Request refund
        </Link>
      )}
      {canApprove && reverseOn && isEffective(p) && p.refundedPaise === 0 && (
        <Button size="sm" variant="danger-soft" onClick={() => setDialog('reverse')}>
          Reverse
        </Button>
      )}
    </>
  );

  const st = p ? statusInfo(p.status, p.refundedPaise, p.amountPaise) : null;
  const cq = p?.cheque;
  return (
    <>
      <Drawer
        open
        onClose={onClose}
        size={640}
        title={p?.receiptNo ? `Receipt ${p.receiptNo}` : p ? `Payment ${p.id}` : 'Payment'}
        footer={actions || undefined}
      >
        {load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            notFoundAction={
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            }
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : load.loading || !p ? (
          <div aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton mb-3 h-10 w-full" data-testid="skeleton-row" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="text-[28px] font-bold tabular-nums">{inr(p.amountPaise)}</div>
              {st && <Chip tone={st.tone}>{st.label}</Chip>}
              {p.receiptStatus === 'CANCELLED' && <Chip tone="bad">Receipt cancelled</Chip>}
              {p.needsReview && <Chip tone="warn">Needs review</Chip>}
              {p.isDuplicateSuspect && <Chip tone="warn">Possible duplicate</Chip>}
            </div>
            {p.status === 'PENDING_APPROVAL' && (
              <Alert tone="info">
                Sent for approval. The receipt is issued when a second committee member approves.
              </Alert>
            )}
            {cq && p.status === 'DEPOSITED' && (
              <Alert tone="warn">
                Deposited on {shortDate(cq.depositedOn)}. The cheque counts in the bank balance only after it
                clears.
              </Alert>
            )}
            {cq && p.status === 'BOUNCED' && (
              <Alert tone="bad">
                Bounced on {shortDate(cq.bouncedOn)}: {cq.bounceReason ?? 'no reason given'}.
              </Alert>
            )}
            {(p.needsReview || p.isDuplicateSuspect) && p.reviewReason && (
              <Alert tone="warn">{p.reviewReason}</Alert>
            )}
            <dl className="mb-5">
              <KV label="Received from">
                {!p.payerName || p.payerName.includes(p.unitLabel) || p.unitLabel.includes(p.payerName)
                  ? p.payerName || p.unitLabel || '-'
                  : `${p.payerName} (${p.unitLabel})`}
              </KV>
              <KV label="Method">{methodLabel(p.method)}</KV>
              <KV label="Reference">{p.referenceNo ?? '-'}</KV>
              <KV label="Date">{shortDate(p.paymentDate)}</KV>
              {(p.recordedBy || p.source === 'ONLINE') && (
                <KV label="Recorded by">{p.recordedBy ?? 'Online payment'}</KV>
              )}
              <KV label="Lands in">{landsIn(p)}</KV>
              {p.convenienceFeePaise > 0 && <KV label="Convenience fee">{inr(p.convenienceFeePaise)}</KV>}
              {p.refundedPaise > 0 && <KV label="Refunded">{inr(p.refundedPaise)}</KV>}
              {p.notes && <KV label="Note">{p.notes}</KV>}
              {p.reversalReason && <KV label="Reversal reason">{p.reversalReason}</KV>}
            </dl>
            <Section title="For">
              {p.allocations.length === 0 ? (
                <p className="text-[14px] text-muted">Nothing is allocated yet.</p>
              ) : (
                <ul className="grid gap-1 text-[14px]">
                  {p.allocations.map(a => (
                    <li key={a.id} className="flex justify-between gap-3" data-testid="allocation">
                      <span>
                        {a.invoiceNo
                          ? `Invoice ${a.invoiceNo}`
                          : a.collectionTitle
                            ? `Collection ${a.collectionTitle}`
                            : a.targetType === 'ADVANCE'
                              ? 'Advance'
                              : a.targetType}
                        {a.reasonCode ? ` (${a.reasonCode.toLowerCase().replace(/_/g, ' ')})` : ''}
                      </span>
                      <strong className="tabular-nums">{inr(a.amountPaise)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            {cq && (
              <Section title="Cheque">
                <dl>
                  <KV label="Bank">{cq.bankName}</KV>
                  <KV label="Cheque number">{cq.chequeNo}</KV>
                  <KV label="Cheque date">{shortDate(cq.chequeDate)}</KV>
                  <KV label="Deposited on">{shortDate(cq.depositedOn)}</KV>
                  <KV label="Cleared on">{shortDate(cq.clearedOn)}</KV>
                </dl>
              </Section>
            )}
            {p.proofFiles.length > 0 && (
              <Section title="Proof">
                <p className="text-[14px]">{p.proofFiles.map(f => f.name).join(', ')}</p>
              </Section>
            )}
            {p.timeline.length > 0 && (
              <Section title="History">
                <ol className="grid gap-1.5 text-[13.5px]">
                  {p.timeline.map((t, i) => (
                    <li key={i}>
                      <span className="text-muted">{shortDate(t.at)}</span> {eventLabel(t.event)}
                      {t.by ? ` by ${t.by}` : ''}
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </>
        )}
      </Drawer>
      {p && dialog === 'clear' && <ClearDialog payment={p} onClose={() => setDialog(null)} onDone={done} />}
      {p && dialog === 'bounce' && <BounceDialog payment={p} onClose={() => setDialog(null)} onDone={done} />}
      {p && dialog === 'return' && <ReturnDialog payment={p} onClose={() => setDialog(null)} onDone={done} />}
      {p && dialog === 'reverse' && (
        <ReverseDialog payment={p} onClose={() => setDialog(null)} onDone={done} />
      )}
      {p && dialog === 'reallocate' && (
        <ReallocateDialog payment={p} onClose={() => setDialog(null)} onDone={done} />
      )}
      {p && dialog === 'resend' && <ResendDialog payment={p} onClose={() => setDialog(null)} onDone={done} />}
      {p && dialog === 'review' && <ReviewDialog payment={p} onClose={() => setDialog(null)} onDone={done} />}
    </>
  );
}
