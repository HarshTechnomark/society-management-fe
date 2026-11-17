'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useLoad } from '@/hooks/useLoad';
import { committeeService } from '@/services/committee.service';
import type { ApprovalStep } from '@/types/approvals';

async function members(): Promise<{ userId: number; name: string; designation: string }[]> {
  const overview = await committeeService.overview();
  if (!overview.current) return [];
  const term = await committeeService.term(overview.current.id);
  const seen = new Set<number>();
  return term.seats.flatMap(s => {
    if (s.userId == null || seen.has(s.userId)) return [];
    seen.add(s.userId);
    return [{ userId: s.userId, name: s.name, designation: s.designation }];
  });
}

/** Add a named committee member to a stuck step (spec 8.10). A fresh code is asked for by the API client. */
export function ReassignDialog({
  step,
  onCancel,
  onConfirm,
}: {
  step: ApprovalStep | undefined;
  onCancel: () => void;
  onConfirm: (input: { userId: number; reason: string; slotIndex?: number }) => Promise<void>;
}) {
  const load = useLoad(members);
  const [userId, setUserId] = useState('');
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const needsSlot = step?.mode === 'ALL_OF';
  const r = reason.trim();
  const errors = {
    userId: !userId ? 'Choose a committee member.' : null,
    slot: needsSlot && slot === '' ? 'Choose the seat to fill.' : null,
    reason: r.length < 5 || r.length > 500 ? 'Enter 5 to 500 characters.' : null,
  };
  const submit = async () => {
    setTouched(true);
    if (errors.userId || errors.slot || errors.reason) return;
    setBusy(true);
    try {
      await onConfirm({
        userId: Number(userId),
        reason: r,
        ...(needsSlot ? { slotIndex: Number(slot) } : {}),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title="Hand this to another approver"
      description="Use this when nobody who can approve is available. The member you choose is told."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Reassign
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Select
          label="Committee member"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          error={touched ? errors.userId : null}
          options={[
            { value: '', label: load.loading ? 'Loading members' : 'Choose a member' },
            ...(load.data ?? []).map(m => ({
              value: String(m.userId),
              label: `${m.name} (${m.designation})`,
            })),
          ]}
        />
        {needsSlot && step && (
          <Select
            label="Seat to fill"
            value={slot}
            onChange={e => setSlot(e.target.value)}
            error={touched ? errors.slot : null}
            options={[
              { value: '', label: 'Choose a seat' },
              ...step.slots.map((s, i) => ({ value: String(i), label: s.label })),
            ]}
          />
        )}
        <Textarea
          label="Reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          error={touched ? errors.reason : null}
          required
        />
      </div>
    </Modal>
  );
}
