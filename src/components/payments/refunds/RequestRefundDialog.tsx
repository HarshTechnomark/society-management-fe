'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { inr } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import type { Refund, RefundMode } from '@/types/paymentsOps';
import { REFUND_MODE_LABEL, opsError, rupeesToPaise } from '../ops/format';

const MASK = /^[A-Za-z ]{2,20} x{4}\d{4}$/;
const MODES = (Object.keys(REFUND_MODE_LABEL) as RefundMode[]).map(value => ({
  value,
  label: REFUND_MODE_LABEL[value],
}));

/**
 * Request a refund (spec 8.19). Open it from a payment with `paymentId`, or without one to ask for the payment id.
 * `refundablePaise`, when known, is shown as a hint. The refund waits for approval by a different person.
 */
export function RequestRefundDialog({
  paymentId,
  refundablePaise,
  onClose,
  onDone,
}: {
  paymentId?: number;
  refundablePaise?: number;
  onClose: () => void;
  onDone?: (refund: Refund) => void;
}) {
  const toast = useToast();
  const [pid, setPid] = useState(paymentId ? String(paymentId) : '');
  const [amount, setAmount] = useState(refundablePaise ? String(refundablePaise / 100) : '');
  const [mode, setMode] = useState<RefundMode>('BANK_TRANSFER');
  const [reason, setReason] = useState('');
  const [reallocate, setReallocate] = useState(false);
  const [payee, setPayee] = useState('');
  const [account, setAccount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const offline = mode !== 'GATEWAY';

  const submit = async () => {
    const e: Record<string, string> = {};
    const id = Number(pid);
    if (!Number.isInteger(id) || id < 1) e.paymentId = 'Enter the payment number.';
    const paise = rupeesToPaise(amount);
    if (paise === null || paise < 100) e.amount = 'Enter an amount of at least ₹1, up to two decimals.';
    else if (refundablePaise !== undefined && paise > refundablePaise)
      e.amount = `At most ${inr(refundablePaise)} can be refunded.`;
    const r = reason.trim();
    if (r.length < 10 || r.length > 500) e.reason = 'Enter a reason of 10 to 500 characters.';
    if (offline && (payee.trim().length < 2 || payee.trim().length > 120))
      e.payee = 'Enter the name of the person to pay (2 to 120 characters).';
    if (mode === 'BANK_TRANSFER' && !MASK.test(account.trim()))
      e.account = 'Use the form "HDFC xxxx4521": bank name, then xxxx and the last 4 digits.';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const refund = await paymentsOpsService.requestRefund({
        paymentId: id,
        amountPaise: paise!,
        mode,
        reason: r,
        ...(reallocate ? { reallocate: true } : {}),
        ...(offline ? { payeeName: payee.trim() } : {}),
        ...(mode === 'BANK_TRANSFER' ? { payeeAccountMasked: account.trim() } : {}),
      });
      toast.show('Refund sent for approval.');
      onDone?.(refund);
      onClose();
    } catch (err) {
      setFailed(opsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Request a refund"
      description="A different committee member must approve the refund before money is paid out."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Send for approval
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {failed && (
          <p role="alert" className="rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] text-[#8a1d17]">
            {failed}
          </p>
        )}
        {!paymentId && (
          <Input
            label="Payment number"
            inputMode="numeric"
            value={pid}
            error={errors.paymentId}
            onChange={e => setPid(e.target.value)}
            required
          />
        )}
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={amount}
          error={errors.amount}
          hint={
            refundablePaise !== undefined
              ? `Up to ${inr(refundablePaise)}. The convenience fee is not refunded.`
              : 'The convenience fee is not refunded.'
          }
          onChange={e => setAmount(e.target.value)}
          required
        />
        <Select
          label="Pay back by"
          value={mode}
          onChange={e => setMode(e.target.value as RefundMode)}
          options={MODES}
        />
        {offline && (
          <Input
            label="Pay to (name)"
            value={payee}
            error={errors.payee}
            onChange={e => setPayee(e.target.value)}
            required
          />
        )}
        {mode === 'BANK_TRANSFER' && (
          <Input
            label="Account (masked)"
            value={account}
            error={errors.account}
            hint="Never type a full account number."
            onChange={e => setAccount(e.target.value)}
            required
          />
        )}
        <Textarea
          label="Reason"
          value={reason}
          error={errors.reason}
          onChange={e => setReason(e.target.value)}
          required
        />
        <Checkbox
          label="Free the amount from the bills it paid if the flat advance is not enough"
          checked={reallocate}
          onChange={e => setReallocate(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
