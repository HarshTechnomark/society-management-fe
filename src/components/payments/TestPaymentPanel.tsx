'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import { payError } from './resident/format';

/** True outside production: the fake gateway has no real checkout, so a small test panel stands in for it. */
export const testPanelAllowed = (env: string | undefined = process.env.NODE_ENV) => env !== 'production';

/**
 * Development checkout step. The fake gateway keeps its payments in memory; "Pay (success)" and "Fail" do what the
 * customer would do at the gateway (`POST /dev/payments/:gatewayOrderId/pay`) and then hand the gateway payment id
 * to the caller, which asks the server to verify it (the browser never decides a payment worked).
 */
export function TestPaymentPanel({
  gatewayOrderId,
  onPaid,
  onFailed,
  disabled,
}: {
  gatewayOrderId: string;
  onPaid: (gatewayPaymentId: string) => void | Promise<void>;
  onFailed: (gatewayPaymentId: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<'ok' | 'fail' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (status: 'captured' | 'failed') => {
    setBusy(status === 'captured' ? 'ok' : 'fail');
    setProblem(null);
    try {
      const r = await svc.devPay(gatewayOrderId, status);
      await (status === 'captured' ? onPaid(r.gatewayPaymentId) : onFailed(r.gatewayPaymentId));
    } catch (e) {
      setProblem(payError(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <section
      aria-label="Test payment"
      className="rounded-[16px] border border-dashed border-[rgba(20,35,44,0.3)] bg-white/50 p-3"
    >
      <h3 className="text-[14px] font-bold">Test payment</h3>
      <p className="mb-2 text-[12.5px] text-muted">
        Development only: this society uses a practice payment gateway. Choose what the bank should answer.
      </p>
      {problem && <Alert tone="bad">{problem}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={busy === 'ok'}
          disabled={disabled || busy !== null}
          onClick={() => run('captured')}
        >
          Pay (success)
        </Button>
        <Button
          size="sm"
          variant="danger-soft"
          loading={busy === 'fail'}
          disabled={disabled || busy !== null}
          onClick={() => run('failed')}
        >
          Fail
        </Button>
      </div>
    </section>
  );
}
