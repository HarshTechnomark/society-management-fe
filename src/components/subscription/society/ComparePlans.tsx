'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { Card } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { featureTitle } from '@/constants/features';
import { useLoad } from '@/hooks/useLoad';
import { limitLabel } from '@/lib/limits';
import { inr, shortDate } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type {
  BillingCycle,
  PlanAdvisor,
  PlanOption,
  PlansForSociety,
  Quote,
  SubscriptionSummary,
} from '@/types/subscriptions';
import { PLAN_RANK, PLAN_TONE, limitValueText, subscriptionErrorText } from '../format';

export const SALES_EMAIL = 'sales@societyapp.in';

const REASONS: Record<string, string> = {
  USING_PREMIUM_TRIAL: 'You are trying a feature from this plan',
  NEAR_FLAT_LIMIT: 'You are close to your flat limit',
  ANNUAL_SAVES: 'Paying yearly saves money',
};

function normalise(r: PlansForSociety | PlansForSociety['items']): {
  items: PlanOption[];
  recommendation?: PlanAdvisor;
} {
  return Array.isArray(r) ? { items: r } : r;
}

type Action = { kind: 'UPGRADE' | 'DOWNGRADE' | 'CHOOSE'; plan: PlanOption } | null;

/** Spec 11.4 **Compare plans**: priced for this society, with the plan advisor badge and the change dialogs. */
export function ComparePlans({
  sub,
  canEdit,
  onChanged,
}: {
  sub: SubscriptionSummary;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>(sub.billingCycle);
  const plans = useLoad(() => subscriptionsService.societyPlans(cycle).then(normalise), cycle);
  const [action, setAction] = useState<Action>(null);
  const trial = sub.status === 'TRIALING';
  const blocked = sub.status === 'CANCELLED' || sub.cancelAtPeriodEnd;
  const currentRank = PLAN_RANK[sub.plan.code] ?? 0;
  const rec = plans.data?.recommendation;

  return (
    <Card title="Compare plans" sub="Prices are for your society's flats. GST is added on the invoice.">
      <div role="group" aria-label="Billing cycle" className="mb-4 inline-flex rounded-full bg-white/60 p-1">
        {(['MONTHLY', 'ANNUAL'] as const).map(c => (
          <button
            key={c}
            type="button"
            aria-pressed={cycle === c}
            onClick={() => setCycle(c)}
            className={cx(
              'h-8 rounded-full px-4 text-[13px] font-semibold',
              cycle === c ? 'bg-navy text-[#FDF8EE]' : 'text-ink',
            )}
          >
            {c === 'MONTHLY' ? 'Monthly' : 'Annual'}
          </button>
        ))}
      </div>
      {plans.error ? (
        <ErrorState error={plans.error} title="Plans could not be loaded" />
      ) : !plans.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skeleton h-56" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {plans.data.items.map(p => {
            const rank = PLAN_RANK[p.code] ?? 0;
            const recommended = rec?.planCode === p.code && !p.isCurrent;
            return (
              <article
                key={p.code}
                aria-label={`${p.name} plan`}
                className={cx(
                  'flex flex-col gap-2 rounded-[22px] border bg-white/55 p-4',
                  p.isCurrent ? 'border-navy' : 'border-[var(--line)]',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={PLAN_TONE[p.code]}>{p.name}</Chip>
                  {p.isCurrent && <Chip tone="ok">Current</Chip>}
                  {recommended && <Chip tone="gold">Recommended</Chip>}
                </div>
                {p.isSelfServe && p.pricePerFlatPaise !== undefined ? (
                  <div>
                    <span className="text-[24px] font-bold">{inr(p.pricePerFlatPaise)}</span>
                    <span className="text-[13px] text-muted"> / flat / month</span>
                    <p className="text-[13px] text-muted">
                      {inr(p.periodPricePaise)} {cycle === 'ANNUAL' ? 'a year' : 'a month'} for{' '}
                      {p.chargedFlats} flats
                      {p.minBillableFlats && (p.chargedFlats ?? 0) <= p.minBillableFlats
                        ? ` (minimum ${p.minBillableFlats})`
                        : ''}
                    </p>
                  </div>
                ) : (
                  <p className="text-[15px] font-semibold">Custom pricing</p>
                )}
                {p.description && <p className="text-[13px] text-muted">{p.description}</p>}
                <ul className="text-[12.5px] text-muted">
                  <li>{p.highlights.featureCount} features</li>
                  {Object.entries(p.highlights.limits)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <li key={k}>
                        {limitLabel(k)}: {limitValueText(v, k)}
                      </li>
                    ))}
                </ul>
                {recommended && rec?.reasonCodes.length ? (
                  <p className="text-[12.5px] text-gold-ink">
                    {rec.reasonCodes.map(c => REASONS[c] ?? c).join('. ')}
                    {rec.annualSavingPaise ? `. Save ${inr(rec.annualSavingPaise)} a year.` : '.'}
                  </p>
                ) : null}
                <div className="mt-auto pt-1">
                  {!p.isSelfServe ? (
                    <a
                      href={`mailto:${SALES_EMAIL}?subject=Enterprise plan`}
                      className={buttonClasses('glass', 'sm')}
                    >
                      Contact sales
                    </a>
                  ) : p.isCurrent || !canEdit || blocked ? null : trial ? (
                    <Button size="sm" onClick={() => setAction({ kind: 'CHOOSE', plan: p })}>
                      Choose
                    </Button>
                  ) : rank > currentRank ? (
                    <Button size="sm" onClick={() => setAction({ kind: 'UPGRADE', plan: p })}>
                      Upgrade
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="glass"
                      onClick={() => setAction({ kind: 'DOWNGRADE', plan: p })}
                    >
                      Downgrade
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {action?.kind === 'UPGRADE' && (
        <UpgradeDialog sub={sub} plan={action.plan} onClose={() => setAction(null)} onDone={onChanged} />
      )}
      {action?.kind === 'DOWNGRADE' && (
        <DowngradeDialog sub={sub} plan={action.plan} onClose={() => setAction(null)} onDone={onChanged} />
      )}
      {action?.kind === 'CHOOSE' && (
        <ChooseDialog
          sub={sub}
          plan={action.plan}
          cycle={cycle}
          onClose={() => setAction(null)}
          onDone={onChanged}
        />
      )}
    </Card>
  );
}

/** The quote lines, GST and total of 8.5.5. */
export function QuoteView({ quote, title = 'Full period' }: { quote: Quote; title?: string }) {
  return (
    <div className="mb-3">
      <h3 className="mb-1 text-[13px] font-semibold uppercase text-muted">
        {title}: {shortDate(quote.periodStart)} to {shortDate(quote.periodEnd)}
      </h3>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13.5px]">
        {quote.lines.map((l, i) => (
          <div key={i} className="contents">
            <dt>{l.description}</dt>
            <dd className="text-right">{inr(l.amountPaise)}</dd>
          </div>
        ))}
        <dt className="font-semibold">Subtotal</dt>
        <dd className="text-right font-semibold">{inr(quote.subtotalPaise)}</dd>
        {quote.tax ? (
          quote.tax.igstPaise > 0 ? (
            <>
              <dt>IGST 18 %</dt>
              <dd className="text-right">{inr(quote.tax.igstPaise)}</dd>
            </>
          ) : (
            <>
              <dt>CGST 9 %</dt>
              <dd className="text-right">{inr(quote.tax.cgstPaise)}</dd>
              <dt>SGST 9 %</dt>
              <dd className="text-right">{inr(quote.tax.sgstPaise)}</dd>
            </>
          )
        ) : (
          <>
            <dt className="text-muted">GST</dt>
            <dd className="text-right text-muted">Added on the invoice</dd>
          </>
        )}
        <dt className="font-bold">Total</dt>
        <dd className="text-right font-bold">{inr(quote.totalPaise)}</dd>
      </dl>
    </div>
  );
}

function useChange(onDone: () => void, onClose: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      const msg = await fn();
      toast.show(msg);
      onClose();
      onDone();
    } catch (e) {
      setError(subscriptionErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function UpgradeDialog({
  sub,
  plan,
  onClose,
  onDone,
}: {
  sub: SubscriptionSummary;
  plan: PlanOption;
  onClose: () => void;
  onDone: () => void;
}) {
  const quote = useLoad(() =>
    subscriptionsService.quote({ planCode: plan.code, billingCycle: sub.billingCycle }),
  );
  const { busy, error, run } = useChange(onDone, onClose);
  const q = quote.data;
  const p = q?.proration;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Upgrade to ${plan.name}`}
      description="The new plan starts today. You pay the difference for the rest of this period."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!q}
            onClick={() =>
              run(async () => {
                const r = await subscriptionsService.changePlan({
                  planCode: plan.code,
                  version: sub.version,
                });
                return r.proration
                  ? `Upgraded to ${plan.name}. ${inr(r.proration.netPaise)} plus GST is invoiced now.`
                  : `Upgraded to ${plan.name}.`;
              })
            }
          >
            Upgrade now
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {quote.error ? (
        <Alert tone="bad">{subscriptionErrorText(quote.error)}</Alert>
      ) : !q ? (
        <div className="skeleton h-32 w-full" data-testid="quote-loading" />
      ) : (
        <>
          {p && (
            <div className="mb-3 rounded-[16px] bg-white/60 p-3" data-testid="proration">
              <h3 className="mb-1 text-[13px] font-semibold uppercase text-muted">Charged now</h3>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13.5px]">
                <dt>
                  {plan.name} for {p.daysRemaining} of {p.periodDays} days
                </dt>
                <dd className="text-right">{inr(p.chargePaise)}</dd>
                <dt>Credit for {sub.plan.name}</dt>
                <dd className="text-right">-{inr(p.creditPaise)}</dd>
                <dt className="font-bold">Due now (plus GST)</dt>
                <dd className="text-right font-bold">{inr(p.netPaise)}</dd>
              </dl>
            </div>
          )}
          <QuoteView quote={q} title="From the next period" />
          <p className="text-[12.5px] text-muted">You will be asked to confirm it is you.</p>
        </>
      )}
    </Modal>
  );
}

function DowngradeDialog({
  sub,
  plan,
  onClose,
  onDone,
}: {
  sub: SubscriptionSummary;
  plan: PlanOption;
  onClose: () => void;
  onDone: () => void;
}) {
  const preview = useLoad(() => subscriptionsService.downgradePreview(plan.code));
  const { busy, error, run } = useChange(onDone, onClose);
  const d = preview.data;
  const conflicts = d?.limitConflicts ?? [];
  const canSchedule = d ? d.canSchedule && conflicts.length === 0 : !!preview.error;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Downgrade to ${plan.name}`}
      description={`Takes effect at the end of the billing cycle${
        sub.currentPeriodEnd ? `, after ${shortDate(sub.currentPeriodEnd)}` : ''
      }. No refund for this period.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep {sub.plan.name}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!canSchedule}
            onClick={() =>
              run(async () => {
                const r = await subscriptionsService.changePlan({
                  planCode: plan.code,
                  version: sub.version,
                });
                return `Downgrade to ${plan.name} scheduled for ${shortDate(r.effectiveDate)}.`;
              })
            }
          >
            Schedule downgrade
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {preview.error ? (
        <Alert tone="info">The impact preview is not available. Limits are checked when you confirm.</Alert>
      ) : !d ? (
        <div className="skeleton h-32 w-full" />
      ) : (
        <div className="flex flex-col gap-3 text-[13.5px]" data-testid="downgrade-preview">
          {conflicts.length > 0 && (
            <Alert tone="bad" className="mb-0">
              You use more than {plan.name} allows. Reduce these first:
              <ul className="mt-1 list-disc pl-5">
                {conflicts.map(c => (
                  <li key={c.limitKey}>
                    {limitLabel(c.limitKey)}: {c.used.toLocaleString('en-IN')} in use, {plan.name} allows{' '}
                    {c.targetLimit.toLocaleString('en-IN')}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          {d.featuresLost.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold">Features you lose</h3>
              <ul className="list-disc pl-5">
                {d.featuresLost.map(f => (
                  <li key={f.key}>
                    {f.title || featureTitle(f.key)}
                    {f.recordsInUse ? ` (${f.recordsInUse} in use)` : ''}
                    {f.stopsJobs ? ', its scheduled jobs stop' : ''}
                  </li>
                ))}
              </ul>
              {d.readOnlyUntil && (
                <p className="mt-1 text-muted">
                  Their records stay readable and exportable until {shortDate(d.readOnlyUntil)}.
                </p>
              )}
            </section>
          )}
          {d.limitChanges.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold">Limits that change</h3>
              <ul className="list-disc pl-5">
                {d.limitChanges.map(c => (
                  <li key={c.limitKey}>
                    {limitLabel(c.limitKey)}: {limitValueText(c.current, c.limitKey)} to{' '}
                    {limitValueText(c.target, c.limitKey)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.addonsEnding.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold">Add-ons that end</h3>
              <p>{d.addonsEnding.map(a => a.code).join(', ')}</p>
            </section>
          )}
          <p className="text-muted">Starts on {shortDate(d.effectiveDate)}.</p>
        </div>
      )}
    </Modal>
  );
}

/** Trial: pick the paid plan and cycle; the first invoice is raised at once (8.6.1). */
function ChooseDialog({
  sub,
  plan,
  cycle,
  onClose,
  onDone,
}: {
  sub: SubscriptionSummary;
  plan: PlanOption;
  cycle: BillingCycle;
  onClose: () => void;
  onDone: () => void;
}) {
  const quote = useLoad(() => subscriptionsService.quote({ planCode: plan.code, billingCycle: cycle }));
  const { busy, error, run } = useChange(onDone, onClose);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Start ${plan.name}, ${cycle === 'ANNUAL' ? 'annual' : 'monthly'}`}
      description="Your paid plan starts today and the first invoice is raised now. The society becomes active when it is paid."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            onClick={() =>
              run(async () => {
                const r = await subscriptionsService.activate({
                  planCode: plan.code,
                  billingCycle: cycle,
                  version: sub.version,
                });
                return `${plan.name} started. Invoice ${r.invoice.invoiceNo} for ${inr(r.invoice.totalPaise)} is due on ${shortDate(r.invoice.dueDate)}.`;
              })
            }
          >
            Start {plan.name}
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {quote.error ? (
        <Alert tone="warn">{subscriptionErrorText(quote.error)}</Alert>
      ) : !quote.data ? (
        <div className="skeleton h-32 w-full" />
      ) : (
        <QuoteView quote={quote.data} title="First period" />
      )}
    </Modal>
  );
}
