'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { featureTitle } from '@/constants/features';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { useMe } from '@/lib/auth';
import { loadEntitlements, useEntitlements } from '@/lib/entitlements';
import { daysUntil, inr, shortDate } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { SubscriptionSummary } from '@/types/subscriptions';
import { UsageWarnings } from '../UsageBanners';
import { UsageMeter } from '../UsageMeter';
import { PLAN_TONE, cycleText, subscriptionErrorText } from '../format';
import { planName } from '../planLock';
import { BillingSection } from '@/components/billing/society/BillingSection';
import { AddonStore } from './AddonStore';
import { ComparePlans } from './ComparePlans';
import { FeaturePicker, eligibleFeatures } from './FeaturePicker';

/** Society status chip (module 05 status, BR-04-15). */
export function statusChip(sub: SubscriptionSummary, now = Date.now()): { label: string; tone: Tone } {
  if (sub.status === 'CANCELLED') return { label: 'Cancelled', tone: 'neutral' };
  switch (sub.societyStatus) {
    case 'TRIAL': {
      const d = daysUntil(sub.trialEndsAt, now);
      return { label: d === null ? 'Trial' : `Trial – ${d} day${d === 1 ? '' : 's'} left`, tone: 'info' };
    }
    case 'PAST_DUE':
      return { label: 'Past due', tone: 'warn' };
    case 'SUSPENDED':
      return { label: 'Suspended', tone: 'bad' };
    default:
      return { label: 'Active', tone: 'ok' };
  }
}

/** Spec 11.4: Society admin › Settings › Subscription. */
export function SubscriptionScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.settings.subscription.view);
  const canEdit = usePermission(PERMISSIONS.settings.subscription.edit);
  const addonStore = useFeature('platform.add_on_store');
  const sub = useLoad(() => subscriptionsService.subscription());
  const usage = useLoad(() => subscriptionsService.usage());
  const [epoch, setEpoch] = useState(0);

  const changed = () => {
    sub.reload();
    usage.reload();
    setEpoch(e => e + 1);
    void loadEntitlements(true);
  };

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Subscription" />
        <Card>
          <EmptyState title="You do not have access to this page" />
        </Card>
      </Page>
    );

  const head = <PageHead title="Subscription" sub="Your plan, usage, add-ons, invoices and payments." />;
  if (sub.error)
    return (
      <Page>
        {head}
        <Card>
          {sub.error instanceof ApiError && sub.error.code === 'SUBSCRIPTION_NOT_FOUND' ? (
            <EmptyState
              title="No active subscription"
              text="This society has no live subscription. Contact SocietyApp support to restart it."
            />
          ) : (
            <ErrorState
              error={sub.error}
              title="The subscription could not be loaded"
              action={
                <Button size="sm" onClick={sub.reload}>
                  Try again
                </Button>
              }
            />
          )}
        </Card>
      </Page>
    );
  if (!sub.data)
    return (
      <Page>
        {head}
        <div className="flex flex-col gap-4" data-testid="subscription-loading">
          <div className="skeleton h-48" />
          <div className="skeleton h-40" />
        </div>
      </Page>
    );

  const s = sub.data;
  return (
    <Page>
      {head}
      {usage.data && <UsageWarnings items={usage.data.items} link={false} />}
      <div className="flex flex-col gap-4">
        <CurrentPlanCard sub={s} canEdit={canEdit} onChanged={changed} />
        <BillingSection nextInvoiceDate={s.status === 'TRIALING' ? null : nextDay(s.currentPeriodEnd)} />
        <Card
          title="Usage"
          sub="Markers at 80 % and 100 % of your plan. Monthly limits reset each usage month."
        >
          {usage.error ? (
            <Alert tone="warn">Usage could not be loaded.</Alert>
          ) : !usage.data ? (
            <div className="skeleton h-32 w-full" />
          ) : (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {usage.data.items.map(u => (
                <UsageMeter key={u.limitKey} item={u} />
              ))}
            </div>
          )}
        </Card>
        <ComparePlans key={`plans-${epoch}`} sub={s} canEdit={canEdit} onChanged={changed} />
        {addonStore && <AddonStore key={`addons-${epoch}`} sub={s} canEdit={canEdit} onChanged={changed} />}
        <FeatureTrialCard sub={s} canEdit={canEdit} onChanged={changed} />
        {canEdit && s.status !== 'CANCELLED' && !s.cancelAtPeriodEnd && (
          <CancelCard sub={s} onChanged={changed} />
        )}
      </div>
    </Page>
  );
}

function CurrentPlanCard({
  sub,
  canEdit,
  onChanged,
}: {
  sub: SubscriptionSummary;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [cycleOpen, setCycleOpen] = useState(false);
  const chip = statusChip(sub);
  const p = sub.plan;
  const trial = sub.status === 'TRIALING';
  const other = sub.billingCycle === 'MONTHLY' ? 'ANNUAL' : 'MONTHLY';
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.show(msg);
      onChanged();
    } catch (e) {
      toast.show(subscriptionErrorText(e), 'error');
    }
  };
  const pending = sub.pendingChange;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[17px] font-bold">Current plan</h2>
        <Chip tone={PLAN_TONE[p.code]}>{p.name}</Chip>
        <Chip tone={chip.tone}>{chip.label}</Chip>
      </div>
      {pending && (
        <Alert tone="info">
          <span>
            {pending.type === 'DOWNGRADE'
              ? `Moving to ${planName(pending.planCode ?? '')} on ${shortDate(pending.at)}.`
              : pending.type === 'VERSION_MIGRATION'
                ? `New ${p.name} price applies from ${shortDate(pending.at)}.`
                : `Plan change on ${shortDate(pending.at)}.`}{' '}
            {canEdit && pending.type === 'DOWNGRADE' && (
              <Button
                size="xs"
                variant="glass"
                className="ml-1"
                onClick={() =>
                  run(
                    () => subscriptionsService.cancelPending('PLAN', sub.version),
                    'Scheduled change cancelled.',
                  )
                }
              >
                Cancel change
              </Button>
            )}
          </span>
        </Alert>
      )}
      {sub.pendingBillingCycle && (
        <Alert tone="info">
          <span>
            Billing switches to {sub.pendingBillingCycle === 'ANNUAL' ? 'annual' : 'monthly'} from the next
            period.{' '}
            {canEdit && (
              <Button
                size="xs"
                variant="glass"
                className="ml-1"
                onClick={() =>
                  run(
                    () => subscriptionsService.cancelPending('CYCLE', sub.version),
                    'Billing cycle change cancelled.',
                  )
                }
              >
                Cancel change
              </Button>
            )}
          </span>
        </Alert>
      )}
      {sub.cancelAtPeriodEnd && (
        <Alert tone="warn">
          <span>
            The subscription ends on {shortDate(sub.currentPeriodEnd)}.{' '}
            {canEdit && (
              <Button
                size="xs"
                variant="glass"
                className="ml-1"
                onClick={() =>
                  run(() => subscriptionsService.withdrawCancel(sub.version), 'Cancellation withdrawn.')
                }
              >
                Withdraw
              </Button>
            )}
          </span>
        </Alert>
      )}
      {sub.readOnlyFeatures.length > 0 && (
        <Alert tone="warn">
          Read-only after your plan change{sub.readOnlyUntil ? ` until ${shortDate(sub.readOnlyUntil)}` : ''}:{' '}
          {sub.readOnlyFeatures.map(featureTitle).join(', ')}. Exports still work.
        </Alert>
      )}
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px] sm:grid-cols-[200px_1fr]">
        <dt className="text-muted">Price per flat</dt>
        <dd className="text-right font-semibold sm:text-left">{inr(p.pricePerFlatPaise)} / month</dd>
        <dt className="text-muted">Charged flats</dt>
        <dd className="text-right font-semibold sm:text-left">
          {sub.chargedFlats}
          {sub.chargedFlats > sub.billableFlats
            ? ` (minimum ${p.minBillableFlats}; you have ${sub.billableFlats})`
            : ''}
        </dd>
        <dt className="text-muted">Billing cycle</dt>
        <dd className="text-right font-semibold sm:text-left">
          {cycleText(sub.billingCycle, p.annualFreeMonths)}
        </dd>
        {trial ? (
          <>
            <dt className="text-muted">Trial ends</dt>
            <dd className="text-right font-semibold sm:text-left">{shortDate(sub.trialEndsAt)}</dd>
          </>
        ) : (
          <>
            <dt className="text-muted">Current period</dt>
            <dd className="text-right font-semibold sm:text-left">
              {shortDate(sub.currentPeriodStart)} to {shortDate(sub.currentPeriodEnd)}
            </dd>
            <dt className="text-muted">Period value</dt>
            <dd className="text-right font-semibold sm:text-left">{inr(sub.periodValuePaise)} plus GST</dd>
            <dt className="text-muted">Next renewal</dt>
            <dd className="text-right font-semibold sm:text-left">
              {sub.cancelAtPeriodEnd ? 'None (cancelling)' : shortDate(nextDay(sub.currentPeriodEnd))}
            </dd>
          </>
        )}
      </dl>
      {canEdit && !trial && sub.status === 'ACTIVE' && !sub.pendingBillingCycle && (
        <div className="mt-3">
          <Button size="sm" variant="glass" onClick={() => setCycleOpen(true)}>
            Switch to {other === 'ANNUAL' ? 'annual' : 'monthly'}
          </Button>
        </div>
      )}
      {cycleOpen && (
        <Modal
          open
          onClose={() => setCycleOpen(false)}
          title={`Switch to ${other === 'ANNUAL' ? 'annual' : 'monthly'} billing?`}
          description={
            other === 'ANNUAL'
              ? `From the next period you pay for a year at a time with ${p.annualFreeMonths} months free.`
              : 'From the next period you pay month by month.'
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setCycleOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setCycleOpen(false);
                  await run(
                    () => subscriptionsService.changeCycle({ billingCycle: other, version: sub.version }),
                    `Billing switches to ${other === 'ANNUAL' ? 'annual' : 'monthly'} from the next period.`,
                  );
                }}
              >
                Switch
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </Card>
  );
}

function nextDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Spec 11.4 **Try a premium feature** (Standard and higher, BR-04-24). */
function FeatureTrialCard({
  sub,
  canEdit,
  onChanged,
}: {
  sub: SubscriptionSummary;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const allowed = useFeature('platform.premium_feature_trial');
  const ent = useEntitlements();
  const toast = useToast();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = sub.activeFeatureTrial;

  const start = async () => {
    if (!key) {
      setError('Pick a feature to try.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await subscriptionsService.startFeatureTrial(key);
      toast.show(`${featureTitle(r.featureKey)} is on until ${shortDate(r.expiresAt)}.`);
      setKey(null);
      onChanged();
    } catch (e) {
      setError(subscriptionErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Try a premium feature"
      sub="Turn on one higher-plan feature for 14 days. Each feature can be tried once."
    >
      {!allowed ? (
        <p className="text-[14px] text-muted">Feature trials come with the Standard plan and higher.</p>
      ) : active ? (
        <Alert tone="info" className="mb-0">
          Trying {featureTitle(active.featureKey)} until {shortDate(active.expiresAt)}.
        </Alert>
      ) : !canEdit ? (
        <p className="text-[14px] text-muted">Ask a member who manages the subscription to start a trial.</p>
      ) : sub.status !== 'ACTIVE' ? (
        <p className="text-[14px] text-muted">Feature trials start once your paid plan is active.</p>
      ) : (
        <>
          <FeaturePicker
            label="Feature to try"
            features={eligibleFeatures(sub.plan.code, ent?.features ?? [])}
            value={key}
            onChange={k => {
              setKey(k);
              setError(null);
            }}
            error={error}
          />
          <Button size="sm" loading={busy} onClick={start}>
            Start 14-day trial
          </Button>
        </>
      )}
    </Card>
  );
}

/** Spec 11.4 danger zone: the request goes to a second committee member (module 14). */
function CancelCard({ sub, onChanged }: { sub: SubscriptionSummary; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = reason.trim();
  const reasonError =
    touched && (r.length < 5 || r.length > 500) ? 'Enter between 5 and 500 characters.' : null;
  const submit = async () => {
    setTouched(true);
    if (r.length < 5 || r.length > 500) return;
    setBusy(true);
    setError(null);
    try {
      await subscriptionsService.cancelSubscription({ reason: r, version: sub.version });
      toast.show('Cancellation requested. A second committee member must approve.');
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(subscriptionErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="glass border border-[#f1c9c6] p-4 sm:p-5" aria-labelledby="cancel-sub">
      <h2 id="cancel-sub" className="text-[17px] font-bold text-bad">
        Cancel subscription
      </h2>
      <p className="mb-3 text-[13.5px] text-muted">
        {sub.status === 'TRIALING'
          ? 'The trial ends as soon as the request is approved.'
          : 'Service continues until the end of the current period. A second committee member must approve.'}
      </p>
      <Button variant="danger-soft" size="sm" onClick={() => setOpen(true)}>
        Cancel subscription
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Cancel the subscription?"
          description="A second committee member must approve. You will be asked to confirm it is you."
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Keep subscription
              </Button>
              <Button variant="danger" loading={busy} onClick={submit}>
                Request cancellation
              </Button>
            </>
          }
        >
          {error && <Alert tone="bad">{error}</Alert>}
          <Input
            label="Reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            error={reasonError}
            required
          />
        </Modal>
      )}
    </section>
  );
}
