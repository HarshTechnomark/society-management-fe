'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckoutOptions, isPhone } from '@/components/payments/CheckoutOptions';
import { TestPaymentPanel, testPanelAllowed } from '@/components/payments/TestPaymentPanel';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import type { FeeMethod, OrderCreated, OrderItemInput, Payables } from '@/types/paymentsResident';
import { METHOD_LABEL, feeFor, payError } from './format';

export interface Selection {
  items: OrderItemInput[];
  advancePaise: number;
  totalPaise: number;
}

const METHODS: FeeMethod[] = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];

/** Fee line text for one method: "No fee" or "Fee ₹18 plus GST". */
export function feeText(totalPaise: number, bps: number): string {
  return bps > 0 ? `Fee ${inr(feeFor(totalPaise, bps))} plus GST` : 'No fee';
}

/**
 * Confirm and pay. Before confirming the person sees the convenience fee for each method (when the society passes it
 * on); confirming creates the order, then the checkout: the gateway options, or the test panel on the fake gateway.
 */
export function CheckoutSheet({
  payables,
  selection,
  onClose,
  onChanged,
}: {
  payables: Payables;
  selection: Selection;
  onClose: () => void;
  /** The pay list is out of date (PAYABLE_CHANGED): the screen reloads it. */
  onChanged: () => void;
}) {
  const router = useRouter();
  const passFee = payables.fee.mode === 'PASS_TO_PAYER';
  const [method, setMethod] = useState<FeeMethod>('UPI');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; orderId?: number } | null>(null);
  const [order, setOrder] = useState<OrderCreated | null>(null);

  const goStatus = (id: number) => router.push(`/resident/pay/status/${id}`);

  const confirm = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const o = await svc.createOrder({
        unitId: payables.unit.id,
        allocationMode: 'SELECTED',
        items: selection.items,
        ...(selection.advancePaise > 0 ? { advancePaise: selection.advancePaise } : {}),
        ...(passFee ? { methodHint: method } : {}),
        payListVersion: payables.payListVersion,
        device: isPhone() ? 'PHONE' : 'DESKTOP',
      });
      setOrder(o);
    } catch (e) {
      const first = e instanceof ApiError ? e.errors?.[0] : undefined;
      setProblem({
        text: payError(e),
        orderId:
          e instanceof ApiError && e.code === 'PAYMENT_IN_PROGRESS'
            ? Number(first?.orderId) || undefined
            : undefined,
      });
      if (e instanceof ApiError && e.code === 'PAYABLE_CHANGED') onChanged();
    } finally {
      setBusy(false);
    }
  };

  const settle = async (gatewayPaymentId: string) => {
    if (!order) return;
    try {
      await svc.verify(order.orderId, gatewayPaymentId);
    } catch {
      /* the status page keeps checking; the server settles from the gateway as well */
    }
    goStatus(order.orderId);
  };

  const cancel = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await svc.cancelOrder(order.orderId);
      onClose();
    } catch (e) {
      setProblem({ text: payError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={order ? 'Complete your payment' : 'Confirm payment'}
      description={`${payables.unit.label}`}
      footer={
        order ? (
          <>
            <Button variant="ghost" onClick={cancel} disabled={busy}>
              Cancel this payment
            </Button>
            <Button onClick={() => goStatus(order.orderId)}>I have paid, check status</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Back
            </Button>
            <Button loading={busy} onClick={confirm}>
              Pay {inr(selection.totalPaise)}
            </Button>
          </>
        )
      }
    >
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem.text}
          {problem.orderId && (
            <>
              {' '}
              <button
                type="button"
                className="font-bold underline"
                onClick={() => goStatus(problem.orderId!)}
              >
                See that payment
              </button>
            </>
          )}
        </Alert>
      )}
      {!order ? (
        <div className="grid gap-3">
          <ul aria-label="Paying for" className="divide-y divide-[var(--line)] text-[14px]">
            {selection.items.map(i => (
              <li key={`${i.type}-${i.id}`} className="flex justify-between py-1.5">
                <span>{payables.items.find(p => p.type === i.type && p.id === i.id)?.label ?? 'Item'}</span>
                <span className="tabular-nums">{inr(i.amountPaise)}</span>
              </li>
            ))}
            {selection.advancePaise > 0 && (
              <li className="flex justify-between py-1.5">
                <span>Advance balance</span>
                <span className="tabular-nums">{inr(selection.advancePaise)}</span>
              </li>
            )}
          </ul>
          {passFee ? (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-[13.5px] font-semibold">Pay by</legend>
              {METHODS.filter(m => m in payables.fee.methods).map(m => (
                <label
                  key={m}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-[14px] bg-white/60 px-3 py-2 text-[14px]"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="method"
                      checked={method === m}
                      onChange={() => setMethod(m)}
                      className="accent-[#143041]"
                    />
                    {METHOD_LABEL[m]}
                  </span>
                  <span className="text-[13px] text-muted">
                    {feeText(selection.totalPaise, payables.fee.methods[m])}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-[13.5px] text-muted">
              No convenience fee. Choose UPI, card or net banking at the next step.
            </p>
          )}
          <p className="flex justify-between border-t border-[var(--line)] pt-2 text-[15px] font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {inr(
                selection.totalPaise +
                  (passFee ? feeFor(selection.totalPaise, payables.fee.methods[method] ?? 0) : 0),
              )}
              {passFee && (payables.fee.methods[method] ?? 0) > 0 ? ' + GST on fee' : ''}
            </span>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          <ul aria-label="Order lines" className="divide-y divide-[var(--line)] text-[14px]">
            {order.lines.map((l, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span>{l.label}</span>
                <span className="tabular-nums">{inr(l.amountPaise)}</span>
              </li>
            ))}
            {order.convenienceFeePaise > 0 && (
              <li className="flex justify-between py-1.5">
                <span>Convenience fee (with GST)</span>
                <span className="tabular-nums">
                  {inr(order.convenienceFeePaise + order.convenienceFeeGstPaise)}
                </span>
              </li>
            )}
          </ul>
          <p className="flex justify-between text-[15px] font-bold">
            <span>To pay</span>
            <span className="tabular-nums">{inr(order.grossAmountPaise)}</span>
          </p>
          {order.checkout.isFake && testPanelAllowed() ? (
            <TestPaymentPanel
              gatewayOrderId={order.checkout.gatewayOrderId}
              onPaid={settle}
              onFailed={settle}
            />
          ) : (
            <CheckoutOptions checkout={order.checkout} expiresAt={order.expiresAt} />
          )}
        </div>
      )}
    </Modal>
  );
}
