'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: ButtonVariant;
  minLength?: number;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

/** A modal that needs a reason (at least 5 characters) before an audited action runs. */
export function ConfirmReason({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
  minLength = 5,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const error = touched && trimmed.length < minLength ? `Enter at least ${minLength} characters.` : null;

  const submit = async () => {
    setTouched(true);
    if (trimmed.length < minLength) return;
    setBusy(true);
    try {
      await onConfirm(trimmed);
      setReason('');
      setTouched(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={variant} loading={busy} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Input
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        onBlur={() => setTouched(true)}
        error={error}
        required
      />
    </Modal>
  );
}
