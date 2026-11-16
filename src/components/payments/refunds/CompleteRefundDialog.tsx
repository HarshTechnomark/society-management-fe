'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { inr } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import type { Refund } from '@/types/paymentsOps';
import { opsError, todayIso } from '../ops/format';

/** Record the payout of an offline refund (spec 8.19 complete): date paid, bank reference for transfers and cheques. */
export function CompleteRefundDialog({
  refund,
  onClose,
  onDone,
}: {
  refund: Refund;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const needsRef = refund.mode === 'BANK_TRANSFER' || refund.mode === 'CHEQUE';
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = 'Choose the date you paid.';
    else if (date > todayIso()) e.date = 'The date cannot be in the future.';
    const ref = reference.trim();
    if (needsRef && (ref.length < 4 || ref.length > 40))
      e.reference = 'Enter the UTR or cheque number (4 to 40 characters).';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await paymentsOpsService.completeRefund(refund.id, {
        paidOutOn: date,
        ...(ref ? { bankReference: ref } : {}),
        version: refund.version,
      });
      toast.show('Refund recorded as paid.');
      onDone();
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
      title="Record the payout"
      description={`${inr(refund.amountPaise)} to ${refund.payeeName ?? 'the payer'} by ${refund.mode === 'CASH' ? 'cash' : refund.mode === 'CHEQUE' ? 'cheque' : 'bank transfer'}.`}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Record payout
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
        <Input
          label="Paid on"
          type="date"
          max={todayIso()}
          value={date}
          error={errors.date}
          onChange={e => setDate(e.target.value)}
          required
        />
        <Input
          label={refund.mode === 'CHEQUE' ? 'Cheque number' : 'Bank reference (UTR)'}
          value={reference}
          error={errors.reference}
          onChange={e => setReference(e.target.value)}
          required={needsRef}
        />
      </div>
    </Modal>
  );
}
