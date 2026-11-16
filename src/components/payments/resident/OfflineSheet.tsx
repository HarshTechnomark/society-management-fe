'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { fileUploadAvailable, uploadFile } from '@/lib/fileUpload';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import type { DeclareInput } from '@/types/paymentsResident';
import { payError, rupeesToPaise } from './format';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** "Pay offline": the society's bank details, then "I paid by bank transfer" (spec 8.6, with proof). */
export function OfflineSheet({
  unitId,
  unitLabel,
  instructions,
  initialAmountPaise,
  onClose,
}: {
  unitId: number;
  unitLabel: string;
  instructions: string | null;
  initialAmountPaise: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [declaring, setDeclaring] = useState(false);
  const [method, setMethod] = useState<DeclareInput['method']>('NEFT');
  const [amount, setAmount] = useState(initialAmountPaise > 0 ? String(initialAmountPaise / 100) : '');
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const paise = rupeesToPaise(amount);
    const e: Record<string, string> = {};
    if (paise === null || paise < 100) e.amount = 'Enter the amount you transferred.';
    if (!date) e.date = 'Enter the date of the transfer.';
    if (!reference.trim()) e.reference = 'Enter the UTR or reference number from your bank.';
    if (!file) e.file = 'Add a screenshot or photo of the transfer.';
    setErrors(e);
    if (Object.keys(e).length > 0 || paise === null || !file) return;
    setBusy(true);
    setProblem(null);
    try {
      const up = await uploadFile(file, 'PAYMENT_PROOF');
      await svc.declare({
        unitId,
        method,
        amountPaise: paise,
        paymentDate: date,
        referenceNo: reference.trim(),
        fileIds: [up.fileId],
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.show('Sent. The committee will check your transfer and add it to your account.');
      onClose();
    } catch (err) {
      setProblem(payError(err));
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
      title="Pay offline"
      description={unitLabel}
      footer={
        declaring ? (
          <>
            <Button variant="ghost" onClick={() => setDeclaring(false)} disabled={busy}>
              Back
            </Button>
            <Button loading={busy} onClick={submit}>
              Send for approval
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {!declaring ? (
        <div className="grid gap-3">
          <section aria-label="Bank details" className="rounded-[14px] bg-white/60 p-3 text-[14px]">
            {instructions ? (
              <p className="whitespace-pre-line">{instructions}</p>
            ) : (
              <p className="text-muted">
                The society has not added bank details yet. Ask the committee how to pay.
              </p>
            )}
          </section>
          <p className="text-[13.5px] text-muted">
            After you pay by bank transfer, tell the society so it can add the money to your account.
          </p>
          <Button onClick={() => setDeclaring(true)}>I paid by bank transfer</Button>
        </div>
      ) : (
        <div className="grid gap-1">
          {problem && (
            <Alert tone="bad" className="mb-2">
              {problem}
            </Alert>
          )}
          <Select
            label="How did you pay?"
            value={method}
            onChange={ev => setMethod(ev.target.value as DeclareInput['method'])}
            options={[
              { value: 'NEFT', label: 'NEFT' },
              { value: 'IMPS', label: 'IMPS' },
              { value: 'RTGS', label: 'RTGS' },
              { value: 'UPI_TO_BANK', label: 'UPI to the society’s bank QR' },
            ]}
          />
          <Input
            label="Amount (₹)"
            inputMode="decimal"
            value={amount}
            onChange={ev => setAmount(ev.target.value)}
            error={errors.amount}
          />
          <Input
            label="Date of transfer"
            type="date"
            max={todayIso()}
            value={date}
            onChange={ev => setDate(ev.target.value)}
            error={errors.date}
          />
          <Input
            label="UTR or reference number"
            value={reference}
            onChange={ev => setReference(ev.target.value)}
            error={errors.reference}
          />
          <div className="mb-3">
            <label className="mb-1 block text-[13.5px] font-semibold" htmlFor="proof-file">
              Proof of transfer
            </label>
            <input
              id="proof-file"
              type="file"
              accept="image/*,application/pdf"
              onChange={ev => setFile(ev.target.files?.[0] ?? null)}
              className="block w-full text-[14px]"
            />
            {!fileUploadAvailable() && (
              <p className="mt-1 text-[12.5px] text-muted">File upload is not available yet.</p>
            )}
            {errors.file && (
              <p role="alert" className="mt-1 text-[12.5px] text-bad">
                {errors.file}
              </p>
            )}
          </div>
          <Input
            label="Note (optional)"
            maxLength={300}
            value={note}
            onChange={ev => setNote(ev.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
