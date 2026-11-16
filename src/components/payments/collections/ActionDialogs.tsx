'use client';
import { useState } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { collectionError } from './format';

/**
 * A modal asking for a reason before an audited action. `min` 0 makes the reason optional (publish).
 * `notice` shows the "send a notice" setting of the collection (read only: it is fixed before approval).
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  variant = 'primary',
  min = 5,
  max = 300,
  notice,
  onCancel,
  onSubmit,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  variant?: ButtonVariant;
  min?: number;
  max?: number;
  notice?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = reason.trim();
    if (t.length > max || t.length < min) {
      setError(`Enter a reason of ${min} to ${max} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(t);
    } catch (e) {
      setError(collectionError(e));
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
        label={min === 0 ? 'Reason (optional)' : 'Reason'}
        value={reason}
        maxLength={max}
        error={error}
        hint="Kept in the audit trail."
        onChange={e => setReason(e.target.value)}
        required={min > 0}
      />
      {notice !== undefined && (
        <Checkbox
          label="Also send a notice with a Pay button"
          checked={notice}
          disabled
          onChange={() => {}}
        />
      )}
    </Modal>
  );
}

/** Confirmation without a reason (delete a draft). */
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title={title}
      description={text}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={() => {
              setBusy(true);
              onConfirm().catch(e => {
                setError(collectionError(e));
                setBusy(false);
              });
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-[13.5px] font-medium text-bad">
          {error}
        </p>
      )}
    </Modal>
  );
}
