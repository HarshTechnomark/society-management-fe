'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';

/** Approve with an optional comment. The step-up code, when the API asks for it, is handled by the API client. */
export function ApproveDialog({
  title,
  stepUp,
  onCancel,
  onConfirm,
}: {
  title: string;
  stepUp: boolean;
  onCancel: () => void;
  onConfirm: (comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const tooLong = comment.trim().length > 500;
  const submit = async () => {
    if (tooLong) return;
    setBusy(true);
    try {
      await onConfirm(comment.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title="Approve this request"
      description={stepUp ? `${title}. You will be asked for a fresh code before it is saved.` : title}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Approve
          </Button>
        </>
      }
    >
      <Textarea
        label="Comment (optional)"
        value={comment}
        onChange={e => setComment(e.target.value)}
        error={tooLong ? 'Use at most 500 characters.' : null}
      />
    </Modal>
  );
}
