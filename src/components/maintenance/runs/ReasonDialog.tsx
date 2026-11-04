'use client';
import { useState } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { billingRunError } from './format';

/** A modal that asks for a reason of `min` to `max` characters before an audited action runs. Errors show inside it. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  variant = 'primary',
  min = 5,
  max,
  onCancel,
  onSubmit,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  variant?: ButtonVariant;
  min?: number;
  max: number;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = reason.trim();
    if (t.length < min || t.length > max) {
      setError(`Enter a reason of ${min} to ${max} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(t);
    } catch (e) {
      setError(billingRunError(e));
    } finally {
      setBusy(false);
    }
  };
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
          <Button variant={variant} loading={busy} onClick={() => void submit()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        value={reason}
        error={error ?? undefined}
        hint="Kept in the audit trail."
        onChange={e => setReason(e.target.value)}
        required
      />
    </Modal>
  );
}
