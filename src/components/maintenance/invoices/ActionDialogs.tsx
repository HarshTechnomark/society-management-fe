'use client';
import { useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { inr } from '@/lib/money';
import { billingInvoicesService } from '@/services/billingInvoices.service';
import type { CancelResult, InvoiceDetail, NoteSummary } from '@/types/billingInvoices';
import { billingInvoiceError, rupeesToPaise } from './format';

function ReasonModal({
  title,
  description,
  confirmLabel,
  note,
  extra,
  busy,
  error,
  reason,
  onReason,
  onCancel,
  onSubmit,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  note: string;
  extra?: ReactNode;
  busy: boolean;
  error: string | null;
  reason: string;
  onReason: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Keep as it is
          </Button>
          <Button variant="danger" loading={busy} onClick={onSubmit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="bad" className="mb-3">
          {error}
        </Alert>
      )}
      {extra}
      <Textarea
        label="Reason"
        value={reason}
        hint="Kept in the audit trail. 10 to 500 characters."
        onChange={e => onReason(e.target.value)}
        required
      />
      <p className="text-[13px] text-muted">{note}</p>
    </Modal>
  );
}

/** Cancel invoice (spec 8.17): reason of 10 to 500 characters; another committee member approves. */
export function CancelInvoiceDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: InvoiceDetail;
  onClose: () => void;
  onDone: (r: CancelResult) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = reason.trim();
    if (t.length < 10 || t.length > 500) return setError('Enter a reason of 10 to 500 characters.');
    setBusy(true);
    setError(null);
    try {
      onDone(await billingInvoicesService.cancel(invoice.id, t));
    } catch (e) {
      setError(billingInvoiceError(e));
      setBusy(false);
    }
  };
  return (
    <ReasonModal
      title={`Cancel ${invoice.invoiceNo}`}
      description="The whole bill is withdrawn. This cannot be undone."
      confirmLabel="Request cancellation"
      note="A different committee member must approve the cancellation. Until then the bill stays as it is."
      busy={busy}
      error={error}
      reason={reason}
      onReason={setReason}
      onCancel={onClose}
      onSubmit={() => void submit()}
    />
  );
}

/** Write-off (spec 8.17): amount up to the amount due and a reason. The API asks for a fresh sign-in (step-up). */
export function WriteOffDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: InvoiceDetail;
  onClose: () => void;
  onDone: (n: NoteSummary) => void;
}) {
  const [amount, setAmount] = useState(String(invoice.outstandingPaise / 100));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const paise = rupeesToPaise(amount);
    const t = reason.trim();
    if (paise === null || paise < 1 || paise > invoice.outstandingPaise)
      return setError(`Enter an amount from ₹0.01 to ${inr(invoice.outstandingPaise)}.`);
    if (t.length < 10 || t.length > 500) return setError('Enter a reason of 10 to 500 characters.');
    setBusy(true);
    setError(null);
    try {
      onDone(await billingInvoicesService.writeOff(invoice.id, paise, t));
    } catch (e) {
      setError(billingInvoiceError(e));
      setBusy(false);
    }
  };
  return (
    <ReasonModal
      title={`Write off on ${invoice.invoiceNo}`}
      description={`Treats part of the ${inr(invoice.outstandingPaise)} still due as a bad debt.`}
      confirmLabel="Request write-off"
      note="You may be asked to confirm it is you. A different committee member must approve the write-off. GST already paid is not reduced."
      busy={busy}
      error={error}
      reason={reason}
      onReason={setReason}
      onCancel={onClose}
      onSubmit={() => void submit()}
      extra={
        <Input
          label="Amount to write off in rupees"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          hint={`At most ${inr(invoice.outstandingPaise)}.`}
          required
        />
      }
    />
  );
}
