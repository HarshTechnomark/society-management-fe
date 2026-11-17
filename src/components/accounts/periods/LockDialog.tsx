'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { shortDate } from '@/lib/money';
import { accountsPeriodsService } from '@/services/accountsPeriods.service';
import { monthEnd, periodsError, todayIso } from './format';

/** "Lock books up to" a month end (spec 8.18, BR-13-48). Asks for step-up through the API client. */
export function LockDialog({
  lockedThrough,
  version,
  onClose,
  onDone,
}: {
  lockedThrough: string | null;
  version: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [month, setMonth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const end = monthEnd(month);

  const submit = async () => {
    setError(null);
    if (!end) return setError('Choose the month to lock up to.');
    if (end >= `${todayIso().slice(0, 7)}-01`) return setError('Only a month that has ended can be locked.');
    if (lockedThrough && end <= lockedThrough)
      return setError('Choose a month after the one already locked.');
    setBusy(true);
    try {
      await accountsPeriodsService.lock({ lockThrough: end, version });
      toast.show(`Books locked through ${shortDate(end)}.`);
      onDone();
    } catch (e) {
      setError(periodsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Lock books up to"
      description="Nobody can post or change entries dated on or before the last day of this month. Pending items in these months must be finished first."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Lock books
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {error && (
          <p role="alert" className="rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] text-[#8a1d17]">
            {error}
          </p>
        )}
        {lockedThrough && (
          <p className="text-[13.5px] text-muted">Now locked through {shortDate(lockedThrough)}.</p>
        )}
        <Input
          label="Lock through the end of"
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          hint={end ? `Books will be locked through ${shortDate(end)}.` : undefined}
          required
        />
      </div>
    </Modal>
  );
}
