'use client';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { monthlyEquivalent, rupeesToPaise } from '@/components/subscription/format';
import { ApiError } from '@/lib/apiClient';
import { inr, shortDate } from '@/lib/money';
import { societiesService } from '@/services/societies.service';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { PlanSummary } from '@/types/subscriptions';
import type { SocietyDetail } from '@/types/societies';
import { CLOSURE_REASONS, PLAN_LABEL, SUSPEND_REASONS, societyErrorText } from '../format';

export type DialogKind =
  | 'CONVERT'
  | 'EXTEND_TRIAL'
  | 'SUSPEND'
  | 'REACTIVATE'
  | 'CLOSE'
  | 'REOPEN'
  | 'PURGE_HOLD_SET'
  | 'PURGE_HOLD_CLEAR';

interface Props {
  kind: DialogKind | null;
  society: SocietyDetail;
  onClose: () => void;
  /** Called after the API accepted the action. */
  onDone: () => void;
}

const PLANS = ['STARTER', 'STANDARD', 'PREMIUM', 'ENTERPRISE'];

/** `YYYY-MM-DD` n days from today, in local time, for date input bounds. */
function dayFromNow(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** P-04 lifecycle dialogs (prototype `UI.reason` with step-up). Step-up runs in the API client on 401. */
export function LifecycleDialog({ kind, society: s, onClose, onDone }: Props) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const [category, setCategory] = useState<string>('POLICY_VIOLATION');
  const [planKey, setPlanKey] = useState<string>(s.subscription?.planKey ?? 'STANDARD');
  const [cycle, setCycle] = useState<string>(s.subscription?.billingCycle ?? 'MONTHLY');
  const [customPrice, setCustomPrice] = useState('');
  const [graceNeeded, setGraceNeeded] = useState(false);
  const [graceUntil, setGraceUntil] = useState('');
  const [closure, setClosure] = useState<string>('CUSTOMER_REQUEST');
  const [notify, setNotify] = useState(true);
  const [confirmName, setConfirmName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);

  const needsPlan = kind === 'CONVERT' || kind === 'REOPEN';
  useEffect(() => {
    if (needsPlan && !plans) subscriptionsService.plans().then(setPlans, () => setPlans([]));
  }, [needsPlan, plans]);

  // A fresh form each time a dialog opens.
  const [openKind, setOpenKind] = useState<DialogKind | null>(null);
  if (kind !== openKind) {
    setOpenKind(kind);
    setReason('');
    setErrors({});
    setAlert(null);
    setGraceNeeded(false);
    setGraceUntil('');
    setConfirmName('');
    setNotify(true);
    setCustomPrice('');
  }

  if (!kind) return null;

  const l = s.lifecycle;
  const purgeKind = kind === 'PURGE_HOLD_SET' || kind === 'PURGE_HOLD_CLEAR';
  const maxReason = purgeKind ? 300 : 500;
  const plan = plans?.find(p => p.code === planKey);
  const custom = planKey === 'ENTERPRISE' ? rupeesToPaise(customPrice) : null;
  const flats = Math.max(s.stats.units || s.approxFlats, plan?.currentVersion.minBillableFlats ?? 0);
  const monthly = plan
    ? monthlyEquivalent(
        flats,
        custom ?? plan.currentVersion.pricePerFlatPaise,
        cycle as 'MONTHLY' | 'ANNUAL',
        plan.currentVersion.annualFreeMonths,
      )
    : null;
  const notifyLocked = closure !== 'DUPLICATE' && closure !== 'FRAUD';

  const copy: Record<DialogKind, { title: string; text: string; confirm: string; danger?: boolean }> = {
    CONVERT: {
      title: 'Convert to paid',
      text: `${s.name} will start billing ${monthly !== null ? inr(monthly) : 'the plan price'} per month. The first invoice is issued now.`,
      confirm: 'Convert',
    },
    EXTEND_TRIAL: {
      title: 'Extend trial',
      text: `Currently ends ${shortDate(l.trialEndsAt)}.`,
      confirm: 'Extend trial',
    },
    SUSPEND: {
      title: `Suspend ${s.name}?`,
      text: 'Residents can still sign in, pay dues and export data. Writes are blocked and non-essential notifications pause. SOS and emergency alerts keep working.',
      confirm: 'Suspend society',
      danger: true,
    },
    REACTIVATE: {
      title: `Reactivate ${s.name}?`,
      text: 'Writes and notifications resume immediately.',
      confirm: 'Reactivate',
    },
    CLOSE: {
      title: `Close ${s.name}?`,
      text: 'A closure export is prepared for the society. Personal data is purged 90 days after closure unless a purge hold is set. Open support access ends now.',
      confirm: 'Close society',
      danger: true,
    },
    REOPEN: {
      title: `Reopen ${s.name}?`,
      text: 'The society becomes active again on a new paid subscription. Guard devices must be paired again.',
      confirm: 'Reopen',
    },
    PURGE_HOLD_SET: {
      title: `Hold the purge for ${s.name}?`,
      text: 'Data is kept past the retention window until you release the hold.',
      confirm: 'Hold purge',
    },
    PURGE_HOLD_CLEAR: {
      title: 'Release the purge hold?',
      text: l.purgeAfter
        ? `Personal data will be purged on the next run on or after ${shortDate(l.purgeAfter)}.`
        : 'Personal data will be purged on schedule.',
      confirm: 'Release hold',
      danger: true,
    },
  };
  const c = copy[kind];

  const validate = () => {
    const e: Record<string, string> = {};
    const r = reason.trim();
    if (r.length < 10) e.reason = 'Enter at least 10 characters.';
    else if (r.length > maxReason) e.reason = `Keep it under ${maxReason} characters.`;
    if (kind === 'CLOSE' && confirmName.trim() !== s.name)
      e.confirmName = 'Type the society name exactly as shown.';
    if (kind === 'REACTIVATE' && graceNeeded && !graceUntil)
      e.graceUntil = 'Choose a date 1 to 30 days from today.';
    if (needsPlan && planKey === 'ENTERPRISE' && customPrice) {
      if (custom === null || custom < 100 || custom > 100000)
        e.customPrice = 'Enter a price between ₹1 and ₹1,000 per flat.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const run = async () => {
    const r = reason.trim();
    const v = s.version;
    switch (kind) {
      case 'CONVERT':
        await societiesService.convert(s.id, {
          planKey,
          billingCycle: cycle,
          customPricePerFlatPaise: custom ?? undefined,
          reason: r,
          version: v,
        });
        return `${s.name} is now a paid tenant`;
      case 'EXTEND_TRIAL': {
        const res = await societiesService.extendTrial(s.id, { days: Number(days), reason: r, version: v });
        return `Trial extended to ${shortDate(res?.trialEndsAt)}`;
      }
      case 'SUSPEND':
        await societiesService.suspend(s.id, { reasonCategory: category, reason: r, version: v });
        return `${s.name} suspended`;
      case 'REACTIVATE':
        await societiesService.reactivate(s.id, {
          reason: r,
          graceUntil:
            graceNeeded && graceUntil ? new Date(`${graceUntil}T23:59:59+05:30`).toISOString() : undefined,
          version: v,
        });
        return `${s.name} reactivated`;
      case 'CLOSE':
        await societiesService.close(s.id, {
          closureReason: closure,
          reason: r,
          confirmName: confirmName.trim(),
          notifyResidents: notifyLocked ? true : notify,
          version: v,
        });
        return `${s.name} closed`;
      case 'REOPEN':
        await societiesService.reopen(s.id, {
          planKey,
          billingCycle: cycle,
          customPricePerFlatPaise: custom ?? undefined,
          reason: r,
          version: v,
        });
        return `${s.name} reopened`;
      case 'PURGE_HOLD_SET':
        await societiesService.setPurgeHold(s.id, { reason: r, version: v });
        return 'Purge is on hold.';
      case 'PURGE_HOLD_CLEAR':
        await societiesService.clearPurgeHold(s.id, { reason: r, version: v });
        return 'Purge hold released.';
    }
  };

  const submit = async () => {
    setAlert(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const message = await run();
      toast.show(message, kind === 'SUSPEND' || kind === 'CLOSE' ? 'warning' : 'success');
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'GRACE_DATE_REQUIRED') {
        setGraceNeeded(true);
        setErrors({ graceUntil: 'This society has overdue invoices. Choose a grace date.' });
      } else if (e instanceof ApiError && e.code === 'CONFIRM_NAME_MISMATCH') {
        setErrors({ confirmName: societyErrorText(e) });
      } else if (e instanceof ApiError && e.code === 'VALIDATION_FAILED' && e.errors?.length) {
        setErrors(Object.fromEntries(e.errors.map(x => [x.field, x.message])));
        setAlert(e.message);
      } else if (!(e instanceof ApiError && e.code === 'REAUTH_REQUIRED')) {
        setAlert(societyErrorText(e));
      } else {
        setAlert('Confirm it is you to continue.');
      }
    } finally {
      setBusy(false);
    }
  };

  const planOptions = PLANS.map(p => ({
    value: p,
    label: plans?.find(x => x.code === p)?.name ?? PLAN_LABEL[p],
  }));

  return (
    <Modal
      open
      onClose={onClose}
      title={c.title}
      description={c.text}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={c.danger ? 'danger' : kind === 'CONVERT' ? 'gold' : 'primary'}
            loading={busy}
            onClick={submit}
          >
            {c.confirm}
          </Button>
        </>
      }
    >
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
      {needsPlan && (
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Select
            label="Plan"
            value={planKey}
            onChange={e => setPlanKey(e.target.value)}
            options={planOptions}
          />
          <Select
            label="Billing cycle"
            value={cycle}
            onChange={e => setCycle(e.target.value)}
            options={[
              { value: 'MONTHLY', label: 'Monthly' },
              { value: 'ANNUAL', label: 'Annual' },
            ]}
          />
          {planKey === 'ENTERPRISE' && (
            <Input
              label="Custom price per flat (₹ per month)"
              inputMode="decimal"
              value={customPrice}
              onChange={e => setCustomPrice(e.target.value)}
              error={errors.customPrice}
              hint="Optional."
            />
          )}
        </div>
      )}
      {kind === 'EXTEND_TRIAL' && (
        <>
          <Select
            label="Extend by"
            value={days}
            onChange={e => setDays(e.target.value)}
            options={[
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
            ]}
          />
          <p className="-mt-2 mb-4 text-[13px] text-muted">Extensions left: {l.trialExtensionsLeft}</p>
        </>
      )}
      {kind === 'SUSPEND' && (
        <Select
          label="Reason category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          options={SUSPEND_REASONS.map(([v, t]) => ({ value: v, label: t }))}
        />
      )}
      {kind === 'REACTIVATE' && graceNeeded && (
        <Input
          label="Grace until"
          type="date"
          min={dayFromNow(1)}
          max={dayFromNow(30)}
          value={graceUntil}
          onChange={e => setGraceUntil(e.target.value)}
          error={errors.graceUntil}
          hint="Dunning does not suspend the society again before this date."
          required
        />
      )}
      {kind === 'CLOSE' && (
        <>
          <Select
            label="Closure reason"
            value={closure}
            onChange={e => setClosure(e.target.value)}
            options={CLOSURE_REASONS.map(([v, t]) => ({ value: v, label: t }))}
          />
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold">Notify residents</p>
              <p className="text-[12.5px] text-muted">
                {notifyLocked
                  ? 'Residents are always told, except for duplicate or fraud closures.'
                  : 'You may skip the notice.'}
              </p>
            </div>
            <Switch
              label="Notify residents"
              checked={notifyLocked || notify}
              disabled={notifyLocked}
              onChange={setNotify}
            />
          </div>
        </>
      )}
      <Textarea
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        error={errors.reason}
        hint={`At least 10 characters. Recorded in the audit trail.`}
        maxLength={maxReason}
        required
      />
      {kind === 'CLOSE' && (
        <Input
          label="Type the society name to confirm"
          value={confirmName}
          onChange={e => setConfirmName(e.target.value)}
          error={errors.confirmName}
          placeholder={s.name}
          autoComplete="off"
          required
        />
      )}
    </Modal>
  );
}
