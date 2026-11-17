'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { accountsPeriodsService } from '@/services/accountsPeriods.service';
import { periodsError } from './format';

/** Request a temporary unlock (spec 8.18, BR-13-49). It goes to the committee as a `PERIOD_UNLOCK` approval. */
export function UnlockRequestDialog({
  maxHours,
  onClose,
  onDone,
}: {
  maxHours: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [month, setMonth] = useState('');
  const [hours, setHours] = useState('24');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!/^\d{4}-\d{2}$/.test(month)) e.month = 'Choose the month to open from.';
    const h = Number(hours);
    if (!Number.isInteger(h) || h < 1 || h > maxHours) e.hours = `Enter whole hours from 1 to ${maxHours}.`;
    const r = reason.trim();
    if (r.length < 10 || r.length > 500) e.reason = 'Explain why in 10 to 500 characters.';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await accountsPeriodsService.requestUnlock({ fromDate: `${month}-01`, hours: h, reason: r });
      toast.show('Unlock request sent for approval.');
      onDone();
    } catch (err) {
      setFailed(periodsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Request unlock"
      description="Other committee members must approve before the books open. The window closes by itself when the hours end."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Send request
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {failed && (
          <p role="alert" className="rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] text-[#8a1d17]">
            {failed}
          </p>
        )}
        <Input
          label="Open from the start of"
          type="month"
          value={month}
          error={errors.month}
          onChange={e => setMonth(e.target.value)}
          required
        />
        <Input
          label="Open for (hours)"
          inputMode="numeric"
          value={hours}
          error={errors.hours}
          hint={`At most ${maxHours} hours.`}
          onChange={e => setHours(e.target.value)}
          required
        />
        <Textarea
          label="Reason"
          value={reason}
          error={errors.reason}
          onChange={e => setReason(e.target.value)}
          required
        />
      </div>
    </Modal>
  );
}
