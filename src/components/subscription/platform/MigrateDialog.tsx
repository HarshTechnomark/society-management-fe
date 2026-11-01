'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { PlanSummary } from '@/types/subscriptions';
import { subscriptionErrorText } from '../format';

const validNotice = (t: string) => /^\d+$/.test(t.trim()) && Number(t) >= 30 && Number(t) <= 180;

/**
 * Spec 11.1 **Migrate** confirmation: MRR now and after, the societies on older versions, notice days (default 30),
 * reason and step-up. The numbers come from a dry run of the same call.
 */
export function MigrateDialog({
  plan,
  onClose,
  onDone,
}: {
  plan: PlanSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [notice, setNotice] = useState('30');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noticeDays = validNotice(notice) ? Number(notice) : null;

  const preview = useLoad(
    () =>
      noticeDays === null
        ? Promise.resolve(null)
        : subscriptionsService.migrate(plan.id, {
            noticeDays,
            dryRun: true,
            reason: 'Migration preview',
          }),
    noticeDays,
  );
  const societies = useLoad(() =>
    subscriptionsService.platformSubscriptions({ planCode: plan.code, limit: 100 }),
  );
  const older = (societies.data?.data ?? []).filter(s => s.planVersionNo < plan.currentVersion.versionNo);

  const r = reason.trim();
  const reasonError =
    touched && (r.length < 5 || r.length > 500) ? 'Enter between 5 and 500 characters.' : null;
  const p = preview.data;
  const delta = p ? p.mrrAfterPaise - p.mrrBeforePaise : 0;

  const submit = async () => {
    setTouched(true);
    if (r.length < 5 || r.length > 500 || noticeDays === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await subscriptionsService.migrate(plan.id, { noticeDays, reason: r });
      toast.show(
        res.status === 'QUEUED'
          ? `Migration of ${res.matched} subscriptions queued.`
          : `${res.scheduled} subscriptions scheduled to move to v${plan.currentVersion.versionNo}.`,
      );
      onDone();
    } catch (e) {
      setError(subscriptionErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Migrate ${plan.onOlderVersions} subscriptions to ${plan.name} v${plan.currentVersion.versionNo}`}
      description="Residents are not affected. Society admins are told before the new price applies at their next period start after the notice."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="gold" loading={busy} disabled={!p} onClick={submit}>
            Migrate subscriptions
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-[16px] bg-white/60 p-3">
          <div className="text-[12px] font-semibold uppercase text-muted">Current MRR</div>
          <div className="text-[22px] font-bold" data-testid="mrr-before">
            {p ? inr(p.mrrBeforePaise) : '…'}
          </div>
        </div>
        <div className="rounded-[16px] bg-white/60 p-3">
          <div className="text-[12px] font-semibold uppercase text-muted">After migration</div>
          <div className="text-[22px] font-bold" data-testid="mrr-after">
            {p ? inr(p.mrrAfterPaise) : '…'}
          </div>
          {p && (
            <div className={`text-[12.5px] font-semibold ${delta >= 0 ? 'text-ok' : 'text-bad'}`}>
              {delta >= 0 ? '+' : ''}
              {inr(delta)}
            </div>
          )}
        </div>
      </div>
      {preview.error ? (
        <Alert tone="warn">{subscriptionErrorText(preview.error)}</Alert>
      ) : p ? (
        <p className="mb-3 text-[13.5px] text-muted">
          {p.matched} matched, {p.scheduled} will be scheduled
          {p.skippedPendingDowngrade ? `, ${p.skippedPendingDowngrade} skipped (downgrade pending)` : ''}
          {p.trialsSwitched ? `, ${p.trialsSwitched} trials switch now` : ''}.
          {p.earliestChangeAt ? ` Earliest change ${shortDate(p.earliestChangeAt)}.` : ''}
        </p>
      ) : null}
      {older.length > 0 && (
        <p className="mb-3 text-[13px] text-muted">
          {older.map(s => `${s.society.name} (v${s.planVersionNo})`).join(', ')}
        </p>
      )}
      <Input
        label="Notice days"
        inputMode="numeric"
        value={notice}
        onChange={e => setNotice(e.target.value)}
        error={noticeDays === null ? 'Between 30 and 180 days.' : null}
        hint="The new price applies at the first period start after this many days."
      />
      <Input
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        onBlur={() => setTouched(true)}
        error={reasonError}
        required
      />
    </Modal>
  );
}
