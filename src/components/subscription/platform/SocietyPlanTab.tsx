'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { Card } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { featureTitle } from '@/constants/features';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { limitLabel } from '@/lib/limits';
import { inr, shortDate } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { PlanSummary, PlatformSubscription, UsageItem } from '@/types/subscriptions';
import { UsageMeter } from '../UsageMeter';
import {
  PLAN_RANK,
  PLAN_TONE,
  cycleText,
  limitValueText,
  monthlyEquivalent,
  rupeesToPaise,
  subscriptionErrorText,
} from '../format';
import { enabledKeys, limitOf } from './catalogue';

const usageItems = (s: PlatformSubscription): UsageItem[] =>
  Array.isArray(s.usage) ? s.usage : (s.usage?.items ?? []);

const monthlyOf = (s: PlatformSubscription) =>
  s.monthlyEquivalentPaise ??
  monthlyEquivalent(
    s.chargedFlats,
    s.customPricePerFlatPaise ?? s.plan.pricePerFlatPaise,
    s.billingCycle,
    s.plan.annualFreeMonths,
  );

async function loadFor(societyId: number): Promise<PlatformSubscription | null> {
  const list = await subscriptionsService.platformSubscriptions({ societyId, limit: 5 });
  const live = list.data.find(s => s.status !== 'CANCELLED') ?? list.data[0];
  return live ? subscriptionsService.platformSubscription(live.id) : null;
}

/**
 * Spec 11.3 Plan tab of Super Admin › Society detail, built as a reusable component. Module 05 owns the society page
 * and mounts this under its Plan tab; until then it lives on `/platform/societies/[id]/plan`. Apply credit and the
 * credit balance belong to module 06; Convert and Extend trial to module 05.
 */
export function SocietyPlanTab({ societyId }: { societyId: number }) {
  const canEdit = usePermission(PERMISSIONS.platform.societies.edit);
  const toast = useToast();
  const data = useLoad(() => loadFor(societyId), societyId);
  const [changing, setChanging] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);

  if (data.error)
    return (
      <Card>
        <ErrorState
          error={data.error}
          title="The subscription could not be loaded"
          action={
            <Button size="sm" onClick={data.reload}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  if (data.loading && !data.data) return <div className="skeleton h-64" data-testid="plan-tab-loading" />;
  const s = data.data;
  if (!s)
    return (
      <Card>
        <EmptyState title="No subscription" text="This society has no subscription yet." />
      </Card>
    );

  const p = s.plan;
  const minFlats = s.customMinFlats ?? p.minBillableFlats;
  const price = s.customPricePerFlatPaise ?? p.pricePerFlatPaise;
  const other = s.billingCycle === 'MONTHLY' ? 'ANNUAL' : 'MONTHLY';
  const open = s.status !== 'CANCELLED';
  const usage = usageItems(s);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[17px] font-bold">Plan</h2>
          <Chip tone={PLAN_TONE[p.code]}>{p.name}</Chip>
          <Chip tone={s.status === 'ACTIVE' ? 'ok' : s.status === 'TRIALING' ? 'info' : 'neutral'}>
            {s.status === 'TRIALING' ? 'Trial' : s.status === 'ACTIVE' ? 'Active' : 'Cancelled'}
          </Chip>
        </div>
        {s.pendingChange && (
          <Alert tone="info">
            {s.pendingChange.type === 'VERSION_MIGRATION' ? 'Price migration' : 'Plan change'} to{' '}
            {s.pendingChange.planCode ?? p.code} on {shortDate(s.pendingChange.at)}.
          </Alert>
        )}
        {s.pendingBillingCycle && (
          <Alert tone="info">
            Billing switches to {s.pendingBillingCycle.toLowerCase()} at the next period.
          </Alert>
        )}
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px] sm:grid-cols-[200px_1fr]">
          <dt className="text-muted">Price per flat</dt>
          <dd className="text-right font-semibold sm:text-left">
            {inr(price)} / month{s.customPricePerFlatPaise ? ' (custom)' : ''}
          </dd>
          <dt className="text-muted">Billable flats</dt>
          <dd className="text-right font-semibold sm:text-left">
            {s.billableFlats} (minimum {minFlats})
          </dd>
          <dt className="text-muted">Billing cycle</dt>
          <dd className="text-right font-semibold sm:text-left">
            {cycleText(s.billingCycle, p.annualFreeMonths)}
          </dd>
          <dt className="text-muted">MRR</dt>
          <dd className="text-right font-semibold sm:text-left">
            {s.status === 'TRIALING' ? '-' : inr(monthlyOf(s))}
          </dd>
          <dt className="text-muted">{s.status === 'TRIALING' ? 'Trial ends' : 'Next invoice'}</dt>
          <dd className="text-right font-semibold sm:text-left">
            {s.status === 'TRIALING' ? shortDate(s.trialEndsAt) : shortDate(nextDay(s.currentPeriodEnd))}
          </dd>
          {s.autopay && (
            <>
              <dt className="text-muted">Payment method</dt>
              <dd className="text-right font-semibold sm:text-left">
                {s.autopay.method ?? 'None'} · autopay {s.autopay.status.toLowerCase()}
              </dd>
            </>
          )}
          <dt className="text-muted">Plan version</dt>
          <dd className="text-right font-semibold sm:text-left">v{p.versionNo}</dd>
        </dl>
        {canEdit && open && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setChanging(true)}>
              Change plan
            </Button>
            {s.status === 'ACTIVE' && !s.pendingBillingCycle && (
              <Button size="sm" variant="glass" onClick={() => setCycleOpen(true)}>
                Switch to {other === 'ANNUAL' ? 'annual' : 'monthly'}
              </Button>
            )}
          </div>
        )}
      </Card>
      {usage.length > 0 && (
        <Card title="Usage vs plan">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {usage.map(u => (
              <UsageMeter key={u.limitKey} item={u} />
            ))}
          </div>
        </Card>
      )}
      {changing && (
        <ChangePlanDialog
          sub={s}
          onClose={() => setChanging(false)}
          onDone={msg => {
            setChanging(false);
            toast.show(msg);
            data.reload();
          }}
        />
      )}
      {cycleOpen && (
        <ConfirmReason
          open
          title={`Switch to ${other === 'ANNUAL' ? 'annual' : 'monthly'} billing?`}
          description="Applies from the next period."
          confirmLabel="Switch"
          variant="primary"
          onCancel={() => setCycleOpen(false)}
          onConfirm={async reason => {
            try {
              await subscriptionsService.platformUpdateSubscription(s.id, {
                pendingBillingCycle: other,
                reason,
                version: s.version,
              });
              toast.show('Billing cycle change scheduled.');
              setCycleOpen(false);
              data.reload();
            } catch (e) {
              toast.show(subscriptionErrorText(e), 'error');
            }
          }}
        />
      )}
    </div>
  );
}

function nextDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Change plan for a society (8.4.3): radio cards, MRR before and after, a downgrade impact preview computed from the
 * target plan's current version and the society's usage, timing, a custom price for Enterprise, reason and step-up.
 */
function ChangePlanDialog({
  sub,
  onClose,
  onDone,
}: {
  sub: PlatformSubscription;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const plans = useLoad(() => subscriptionsService.plans());
  const [code, setCode] = useState<string | null>(null);
  const target = plans.data?.find(p => p.code === code) ?? null;
  const currentRank = PLAN_RANK[sub.plan.code] ?? 0;
  const isDowngrade = !!target && target.tierRank < currentRank;
  const [timing, setTiming] = useState<'IMMEDIATE' | 'PERIOD_END' | null>(null);
  const effectiveTiming = timing ?? (isDowngrade ? 'PERIOD_END' : 'IMMEDIATE');
  const [customPrice, setCustomPrice] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enterprise = target?.code === 'ENTERPRISE';
  const customPaise = enterprise ? rupeesToPaise(customPrice) : null;
  const before = monthlyOf(sub);
  const after = target
    ? monthlyEquivalent(
        Math.max(sub.billableFlats, target.currentVersion.minBillableFlats),
        enterprise ? (customPaise ?? 0) : target.currentVersion.pricePerFlatPaise,
        sub.billingCycle,
        target.currentVersion.annualFreeMonths,
      )
    : null;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!target) e.plan = 'Pick a plan.';
    if (enterprise && (customPaise === null || customPaise < 100 || customPaise > 50_000))
      e.customPrice = 'Enter a price from ₹1 to ₹500 per flat.';
    const r = reason.trim();
    if (r.length < 5 || r.length > 500) e.reason = 'Enter between 5 and 500 characters.';
    setErrors(e);
    setError(null);
    if (Object.keys(e).length || !target) return;
    setBusy(true);
    try {
      const res = await subscriptionsService.platformChangePlan(sub.id, {
        planCode: target.code,
        timing: effectiveTiming,
        ...(enterprise && customPaise !== null ? { customPricePerFlatPaise: customPaise } : {}),
        reason: r,
        version: sub.version,
      });
      onDone(
        res.effect === 'IMMEDIATE'
          ? `Moved to ${target.name}.`
          : `Move to ${target.name} scheduled for ${shortDate(res.effectiveDate)}.`,
      );
    } catch (x) {
      setError(subscriptionErrorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Change plan"
      description={`Currently ${sub.plan.name}, ${sub.billableFlats} flats.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Change plan
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {plans.error ? (
        <Alert tone="bad">{subscriptionErrorText(plans.error)}</Alert>
      ) : !plans.data ? (
        <div className="skeleton h-40 w-full" />
      ) : (
        <>
          <fieldset className="mb-3">
            <legend className="mb-1.5 text-[13px] font-semibold">New plan</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {plans.data
                .filter(p => p.isActive && p.code !== sub.plan.code)
                .sort((a, b) => a.tierRank - b.tierRank)
                .map(p => (
                  <label
                    key={p.code}
                    className={cx(
                      'flex cursor-pointer items-start gap-2 rounded-[16px] border p-3',
                      code === p.code ? 'border-navy bg-white/80' : 'border-[var(--line)] bg-white/50',
                    )}
                  >
                    <input
                      type="radio"
                      name="plan"
                      className="mt-1 accent-[#143041]"
                      checked={code === p.code}
                      onChange={() => {
                        setCode(p.code);
                        setTiming(null);
                      }}
                    />
                    <span>
                      <b>{p.name}</b>
                      <span className="block text-[12.5px] text-muted">
                        {p.code === 'ENTERPRISE'
                          ? 'Custom price'
                          : `${inr(p.currentVersion.pricePerFlatPaise)} / flat`}
                      </span>
                    </span>
                  </label>
                ))}
            </div>
            {errors.plan && <p className="mt-1 text-[12.5px] font-medium text-bad">{errors.plan}</p>}
          </fieldset>
          {enterprise && (
            <Input
              label="Custom price per flat per month (₹)"
              inputMode="decimal"
              value={customPrice}
              onChange={e => setCustomPrice(e.target.value)}
              error={errors.customPrice}
              required
            />
          )}
          {target && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div className="rounded-[16px] bg-white/60 p-3">
                  <div className="text-[12px] font-semibold uppercase text-muted">MRR now</div>
                  <div className="text-[20px] font-bold">{inr(before)}</div>
                </div>
                <div className="rounded-[16px] bg-white/60 p-3">
                  <div className="text-[12px] font-semibold uppercase text-muted">MRR after</div>
                  <div className="text-[20px] font-bold" data-testid="mrr-after">
                    {after === null ? '-' : inr(after)}
                  </div>
                </div>
              </div>
              <fieldset className="mb-3">
                <legend className="mb-1.5 text-[13px] font-semibold">When</legend>
                {(['IMMEDIATE', 'PERIOD_END'] as const).map(t => (
                  <label key={t} className="mb-1 flex items-center gap-2 text-[14px]">
                    <input
                      type="radio"
                      name="timing"
                      className="accent-[#143041]"
                      checked={effectiveTiming === t}
                      onChange={() => setTiming(t)}
                    />
                    {t === 'IMMEDIATE' ? 'Takes effect now, prorated' : 'At the end of the billing cycle'}
                  </label>
                ))}
              </fieldset>
              {isDowngrade && <DowngradeImpact sub={sub} target={target} />}
            </>
          )}
          <Input
            label="Reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            error={errors.reason}
            required
          />
        </>
      )}
    </Modal>
  );
}

function DowngradeImpact({ sub, target }: { sub: PlatformSubscription; target: PlanSummary }) {
  const version = useLoad(() => subscriptionsService.planVersion(target.currentVersion.id), target.id);
  if (version.error) return <Alert tone="warn">The impact preview could not be loaded.</Alert>;
  if (!version.data) return <div className="skeleton mb-3 h-20 w-full" />;
  const rows = version.data.entitlements;
  const conflicts = usageItems(sub).filter(u => {
    if (u.enforcement !== 'HARD') return false;
    const limit = limitOf(rows, u.limitKey);
    return limit !== null && u.used > limit;
  });
  const targetOn = enabledKeys(rows);
  const lost = (sub.entitlements ?? [])
    .filter(e => (e.on ?? e.isEnabled) && e.source === 'PLAN' && !targetOn.has(e.key))
    .map(e => featureTitle(e.key));
  return (
    <div className="mb-3 text-[13.5px]" data-testid="impact-preview">
      <h3 className="mb-1 font-semibold">Downgrade impact preview</h3>
      {conflicts.length > 0 && (
        <Alert tone="bad">
          Usage above {target.name} limits:{' '}
          {conflicts
            .map(
              u =>
                `${limitLabel(u.limitKey)} ${u.used} in use, limit ${limitValueText(limitOf(rows, u.limitKey), u.limitKey)}`,
            )
            .join('; ')}
          .
        </Alert>
      )}
      {lost.length > 0 ? (
        <p>
          Features lost ({lost.length}): {lost.slice(0, 12).join(', ')}
          {lost.length > 12 ? ', …' : ''}
        </p>
      ) : (
        <p className="text-muted">
          No plan features are lost. Overrides and add-ons are reviewed by the API.
        </p>
      )}
    </div>
  );
}
