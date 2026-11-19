'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { commError } from '../format';

/** A modal with one required text (update message, all-clear message, false-alarm reason). */
export function TextActionModal({
  title,
  description,
  label,
  min,
  max,
  submitLabel,
  variant = 'primary',
  onClose,
  onSubmit,
}: {
  title: string;
  description?: string;
  label: string;
  min: number;
  max: number;
  submitLabel: string;
  variant?: ButtonVariant;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const len = text.trim().length;
  const valid = len >= min && len <= max;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text.trim());
    } catch (e) {
      setError(commError(e));
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={variant} loading={busy} disabled={!valid} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      <Textarea
        label={label}
        required
        rows={3}
        maxLength={max}
        value={text}
        onChange={e => setText(e.target.value)}
        hint={`${min} to ${max} characters`}
        error={len > 0 && !valid ? `Write between ${min} and ${max} characters.` : null}
      />
    </Modal>
  );
}
