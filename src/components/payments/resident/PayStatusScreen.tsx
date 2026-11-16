'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { PERMISSIONS } from '@/constants/permissions';
import { ApiError } from '@/lib/apiClient';
import { inr, shortDate } from '@/lib/money';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import type { OrderState } from '@/types/paymentsResident';
import { PayTabs } from './PayTabs';
import { payError, plainPayError } from './format';

const WAITING = new Set(['CREATED', 'ATTEMPTED']);

/** Status page (spec 11.3): Confirming while pending (never "failed"), Success with the receipt, Failed with retry. */
export function PayStatusScreen({
  orderId,
  pollMs = 3000,
  maxPollMs = 120_000,
}: {
  orderId: number;
  pollMs?: number;
  maxPollMs?: number;
}) {
  return (
    <Gate view={PERMISSIONS.resident.payments.view} title="payments">
      <Inner orderId={orderId} pollMs={pollMs} maxPollMs={maxPollMs} />
    </Gate>
  );
}

function Inner({ orderId, pollMs, maxPollMs }: { orderId: number; pollMs: number; maxPollMs: number }) {
  const [order, setOrder] = useState<OrderState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [slow, setSlow] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptProblem, setReceiptProblem] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const started = useRef(0);

  const load = useCallback(
    async (background: boolean) => {
      try {
        const o = await svc.order(orderId, background);
        setOrder(o);
        setError(null);
        return o;
      } catch (e) {
        // A poll that fails once is not an answer: keep the last state, the next poll tries again.
        if (!background) setError(e);
        return null;
      }
    },
    [orderId],
  );

  const waiting = order !== null && WAITING.has(order.status);
  useEffect(() => {
    started.current = Date.now();
    let live = true;
    svc.order(orderId).then(
      o => live && setOrder(o),
      e => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [orderId]);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => {
      if (Date.now() - started.current > maxPollMs) {
        setSlow(true);
        clearInterval(id);
        return;
      }
      void load(true);
    }, pollMs);
    return () => clearInterval(id);
  }, [waiting, load, pollMs, maxPollMs]);

  const download = async () => {
    if (!order?.payment) return;
    setReceiptBusy(true);
    setReceiptProblem(null);
    try {
      const r = await svc.receiptUrl(order.payment.id);
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      setReceiptProblem(payError(e));
    } finally {
      setReceiptBusy(false);
    }
  };

  const cancel = async () => {
    setCancelBusy(true);
    try {
      setOrder(await svc.cancelOrder(orderId));
    } catch (e) {
      // INVALID_STATE here means the money arrived meanwhile: show what the server says now.
      if (e instanceof ApiError && e.code === 'INVALID_STATE') await load(false);
      else setError(e);
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <Page>
      <PayTabs />
      <Card>
        {error != null && !order ? (
          <ErrorState
            error={plainPayError(error)}
            action={
              <Button size="sm" onClick={() => void load(false)}>
                Try again
              </Button>
            }
          />
        ) : !order ? (
          <div
            aria-busy="true"
            aria-label="Loading"
            className="skeleton h-32 w-full"
            data-testid="skeleton-row"
          />
        ) : order.status === 'PAID' ? (
          <div role="status">
            <h1 className="text-[22px] font-bold">Payment received</h1>
            <p className="mt-1 text-[15px]">
              {order.message ??
                (order.payment ? `${inr(order.payment.amountPaise)} received.` : 'Thank you.')}
            </p>
            {order.payment && (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
                <div>
                  <dt className="text-muted">Receipt number</dt>
                  <dd className="font-semibold">{order.payment.receiptNo ?? 'Being prepared'}</dd>
                </div>
                <div>
                  <dt className="text-muted">Date</dt>
                  <dd className="font-semibold">{shortDate(order.payment.paymentDate)}</dd>
                </div>
              </dl>
            )}
            {order.lines.length > 0 && (
              <ul aria-label="Paid for" className="mt-3 divide-y divide-[var(--line)] text-[14px]">
                {order.lines.map((l, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span>{l.label}</span>
                    <span className="tabular-nums">{inr(l.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            )}
            {receiptProblem && (
              <Alert tone="warn" className="mt-3">
                {receiptProblem}
              </Alert>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {order.payment && (
                <Button loading={receiptBusy} onClick={download}>
                  Download receipt
                </Button>
              )}
              <Link href="/resident/pay/receipts" className={buttonClasses('glass')}>
                All receipts
              </Link>
              <Link href="/resident/pay" className={buttonClasses('glass')}>
                Back to Pay
              </Link>
            </div>
          </div>
        ) : WAITING.has(order.status) ? (
          <div role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <Spinner />
              <h1 className="text-[22px] font-bold">Confirming your payment</h1>
            </div>
            <p className="mt-2 text-[14.5px]">
              Waiting for your bank to confirm. This usually takes a minute. You do not need to pay again.
            </p>
            {slow && (
              <Alert tone="info" className="mt-3">
                This is taking longer than usual. We keep checking in the background. Your receipt appears
                under Receipts once the bank confirms.
              </Alert>
            )}
            {error != null && (
              <Alert tone="warn" className="mt-3">
                {payError(error)}
              </Alert>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="glass" onClick={() => void load(false)}>
                Check again
              </Button>
              <Button variant="ghost" loading={cancelBusy} onClick={cancel}>
                Cancel this payment
              </Button>
            </div>
          </div>
        ) : (
          <div role="alert">
            <h1 className="text-[22px] font-bold">
              {order.status === 'CANCELLED'
                ? 'Payment cancelled'
                : order.status === 'EXPIRED'
                  ? 'Payment expired'
                  : 'Payment did not go through'}
            </h1>
            <p className="mt-1 text-[14.5px]">
              Nothing was added to your account. If the bank took money, it is returned to you automatically.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/resident/pay" className={buttonClasses('primary')}>
                Try again
              </Link>
              <Link href="/resident/pay" className={buttonClasses('glass')}>
                Use another method
              </Link>
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
