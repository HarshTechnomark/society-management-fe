'use client';
import { useState, type ReactNode } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/** A plain yes or no dialog for actions that need no reason. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  variant = 'danger',
  onCancel,
  onConfirm,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  variant?: ButtonVariant;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={variant}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children && <p className="text-[14px]">{children}</p>}
    </Modal>
  );
}
