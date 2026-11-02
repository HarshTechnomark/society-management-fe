'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { inr } from '@/lib/money';
import { openCheckout } from '@/lib/gatewayCheckout';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { PaymentOrder, VerifyResult } from '@/types/platformBilling';
import { billingError, paiseText, rupeesToPaise } from '../format';

type Phase = 'form' | 'creating' | 'checkout' | 'verifying' | 'paid' | 'failed' | 'pending';

/** Pay online: create the order, open the gateway checkout, then ask the server to verify. */
export function PayDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: { id: number; invoiceNo: string | null; amountDuePaise: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(paiseText(invoice.amountDuePaise));
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [gatewayId, setGatewayId] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const paise = rupeesToPaise(amount);
  const amountError =
    paise === null || paise < 1
      ? 'Enter an amount.'
      : paise > invoice.amountDuePaise
        ? `At most ${inr(invoice.amountDuePaise)}, the amount due.`
        : paise < 100 && paise !== invoice.amountDuePaise
          ? 'The smallest part payment is ₹1.'
          : null;
  const busy = phase === 'creating' || phase === 'verifying';

  const verify = async (paymentId: number, pay: string) => {
    setPhase('verifying');
    setError(null);
    try {
      const r = await svc.verify(paymentId, pay);
      setResult(r);
      setPhase(r.status === 'CAPTURED' ? 'paid' : r.status === 'FAILED' ? 'failed' : 'pending');
    } catch (e) {
      setError(billingError(e));
      setPhase('pending');
    }
  };

  const start = async () => {
    if (amountError) {
      setError(amountError);
      return;
    }
    setError(null);
    setPhase('creating');
    try {
      const o = await svc.createOrder(invoice.id, paise === invoice.amountDuePaise ? undefined : paise!);
      setOrder(o);
      setPhase('checkout');
      await openCheckout(o.checkout, {
        onPaid: id => {
          setGatewayId(id);
          void verify(o.paymentId, id);
        },
        onFailed: () => setPhase('failed'),
        onDismiss: () => setPhase(p => (p === 'checkout' ? 'form' : p)),
      });
    } catch (e) {
      setError(billingError(e));
      setPhase('form');
    }
  };

  const finished = phase === 'paid' || phase === 'failed';
  return (
    <Modal
      open
      onClose={() => {
        if (busy) return;
        if (phase === 'paid') onDone();
        else onClose();
      }}
      title={`Pay ${invoice.invoiceNo ?? 'invoice'}`}
      description={`Amount due ${inr(invoice.amountDuePaise)}`}
      footer={
        phase === 'paid' ? (
          <Button onClick={onDone}>Done</Button>
        ) : phase === 'failed' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                setPhase('form');
                setError(null);
              }}
            >
              Try again
            </Button>
          </>
        ) : phase === 'pending' && order && gatewayId ? (
          <>
            <Button variant="ghost" onClick={onDone}>
              Close
            </Button>
            <Button onClick={() => verify(order.paymentId, gatewayId)}>Check again</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} disabled={phase === 'checkout'} onClick={start}>
              {paise && !amountError ? `Pay ${inr(paise)}` : 'Pay'}
            </Button>
          </>
        )
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {phase === 'paid' && (
        <Alert tone="ok">
          Payment received. {result ? `Amount still due: ${inr(result.invoice.amountDuePaise)}.` : ''}
        </Alert>
      )}
      {phase === 'failed' && (
        <Alert tone="bad">
          The payment did not go through. Nothing was charged to you, or the bank will reverse it.
        </Alert>
      )}
      {phase === 'pending' && (
        <Alert tone="info">
          Waiting for your bank to confirm. This usually takes a minute. You can close this; the invoice
          updates by itself.
        </Alert>
      )}
      {phase === 'verifying' && <p className="text-[14px] text-muted">Confirming your payment...</p>}
      {phase === 'checkout' && (
        <p className="text-[14px] text-muted">Complete the payment in the payment window.</p>
      )}
      {!finished && (phase === 'form' || phase === 'creating') && (
        <Input
          label="Amount to pay (₹)"
          inputMode="decimal"
          hint="Pay the full amount or part of it."
          value={amount}
          onChange={e => setAmount(e.target.value)}
          error={error && amountError ? amountError : null}
        />
      )}
    </Modal>
  );
}
