'use client';
import { useState } from 'react';
import { CheckoutOptions } from '@/components/payments/CheckoutOptions';
import { TestPaymentPanel, testPanelAllowed } from '@/components/payments/TestPaymentPanel';
import { payError } from '@/components/payments/resident/format';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { inr, shortDate } from '@/lib/money';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import type { Checkout, OrderState } from '@/types/paymentsResident';

/**
 * The public payment link page `/pay/:code` (spec 11.4): society, flat, masked name, amount and "Pay securely".
 * No navigation and no sign-in. The token comes in the address as `?t=` and is sent in the `X-Pay-Token` header.
 */
export function PublicPayScreen({ code, token }: { code: string; token: string }) {
  const link = useLoad(() => svc.publicLink(code, token), `${code}|${token}`);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<OrderState | null>(null);

  const start = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setCheckout(await svc.publicCheckout(code, token));
    } catch (e) {
      setProblem(payError(e));
      if (e instanceof ApiError && (e.code === 'INVALID_STATE' || e.code === 'PAYMENT_LINK_EXPIRED'))
        link.reload();
    } finally {
      setBusy(false);
    }
  };

  const verify = async (gatewayPaymentId: string) => {
    const r = await svc.publicVerify(code, token, gatewayPaymentId);
    if (r.status === 'PAID') setDone(r);
    else setProblem('Waiting for your bank to confirm. This page updates when you refresh it.');
  };

  const d = link.data;
  const err = link.error instanceof ApiError ? link.error : null;
  const expired = err?.code === 'PAYMENT_LINK_EXPIRED' || d?.status === 'EXPIRED';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-4 py-8">
      <div className="glass p-5">
        {link.loading ? (
          <div aria-busy="true" aria-label="Loading payment link" className="skeleton h-40 w-full" />
        ) : link.error != null && !expired ? (
          <div role="alert">
            <h1 className="text-[20px] font-bold">This link cannot be used</h1>
            <p className="mt-1 text-[14.5px]">{payError(link.error)}</p>
          </div>
        ) : expired ? (
          <div role="status">
            <h1 className="text-[20px] font-bold">This link has expired</h1>
            <p className="mt-1 text-[14.5px]">Ask your society for a new payment link.</p>
          </div>
        ) : d && (done || d.status === 'PAID') ? (
          <div role="status">
            <h1 className="text-[20px] font-bold">Payment received</h1>
            <p className="mt-1 text-[14.5px]">
              {done?.message ?? `Thank you. ${d.societyName} has received this payment.`}
            </p>
            {done?.payment?.receiptNo && (
              <p className="mt-2 text-[14px]">
                Receipt number: <strong>{done.payment.receiptNo}</strong>
              </p>
            )}
          </div>
        ) : d && d.status === 'CANCELLED' ? (
          <div role="status">
            <h1 className="text-[20px] font-bold">This link was cancelled</h1>
            <p className="mt-1 text-[14.5px]">
              Ask your society for a new payment link if you still need to pay.
            </p>
          </div>
        ) : d ? (
          <div>
            <p className="text-[13px] font-semibold uppercase text-muted">{d.societyName}</p>
            <h1 className="text-[22px] font-bold">{d.unitLabel}</h1>
            <p className="text-[14px] text-muted">For {d.payerNameMasked}</p>
            <p className="mt-3 text-[32px] font-bold tabular-nums" data-testid="link-amount">
              {inr(d.amountPaise)}
            </p>
            {d.expiresAt && <p className="text-[13px] text-muted">Pay by {shortDate(d.expiresAt)}</p>}
            {problem && (
              <Alert tone="bad" className="mt-3">
                {problem}
              </Alert>
            )}
            <div className="mt-4 grid gap-3">
              {!checkout ? (
                <Button size="md" block loading={busy} onClick={start}>
                  Pay securely
                </Button>
              ) : checkout.isFake && testPanelAllowed() ? (
                <TestPaymentPanel
                  gatewayOrderId={checkout.gatewayOrderId}
                  onPaid={verify}
                  onFailed={() =>
                    setProblem('The payment did not go through. Nothing was charged. You can try again.')
                  }
                />
              ) : (
                <CheckoutOptions checkout={checkout} expiresAt={d.expiresAt} />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
