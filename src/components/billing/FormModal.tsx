'use client';
import { useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { billingError } from './format';

/**
 * A modal with a form: `onSubmit` returns an error text to show (a validation problem) or runs the call and
 * returns the success message. API errors are shown inside the modal in plain words. The step-up dialog opens on
 * its own through the API client when the API asks for it.
 */
export function FormModal({
  title,
  description,
  submitLabel,
  variant = 'primary',
  children,
  onClose,
  onSubmit,
  onDone,
  wide,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  variant?: ButtonVariant;
  children: ReactNode;
  onClose: () => void;
  /** Return `{ error }` to stop before any call, or `{ message }` after the call worked. */
  onSubmit: () => Promise<{ error?: string; message?: string }>;
  onDone: () => void;
  wide?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await onSubmit();
      if (r.error) {
        setError(r.error);
        return;
      }
      if (r.message) toast.show(r.message);
      onDone();
    } catch (e) {
      setError(billingError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      wide={wide}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} loading={busy} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {children}
    </Modal>
  );
}
