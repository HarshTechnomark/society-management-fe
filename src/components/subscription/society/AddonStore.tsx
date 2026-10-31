'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { featureTitle } from '@/constants/features';
import { useLoad } from '@/hooks/useLoad';
import { useEntitlements } from '@/lib/entitlements';
import { inr, shortDate } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { OwnedAddon, StoreAddon, SubscriptionSummary } from '@/types/subscriptions';
import { subscriptionErrorText } from '../format';
import { FeaturePicker, eligibleFeatures } from './FeaturePicker';

const unit = (a: Pick<StoreAddon, 'billingType'>) =>
  a.billingType === 'RECURRING' ? 'per month' : 'per pack';
const isFeatureAddon = (a: StoreAddon) =>
  a.grants.some(g => g.type === 'FEATURE' || g.type === 'FEATURE_CHOICE');
const isChoice = (a: StoreAddon) => a.grants.some(g => g.type === 'FEATURE_CHOICE');

const STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Active', tone: 'ok' },
  PENDING_PAYMENT: { label: 'Waiting for payment', tone: 'warn' },
  CANCEL_SCHEDULED: { label: 'Ends at period end', tone: 'warn' },
  ENDED: { label: 'Ended', tone: 'neutral' },
};

/** Spec 11.4 **Add-on store**: cards with price and quantity, owned add-ons with cancel and resume. */
export function AddonStore({
  sub,
  canEdit,
  onChanged,
}: {
  sub: SubscriptionSummary;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const data = useLoad(() => subscriptionsService.addons());
  const [buying, setBuying] = useState<StoreAddon | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const trial = sub.status === 'TRIALING' || sub.societyStatus === 'TRIAL';
  const reload = () => {
    data.reload();
    onChanged();
  };

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.show(msg);
      reload();
    } catch (e) {
      toast.show(subscriptionErrorText(e), 'error');
    }
  };

  const nameOf = (o: OwnedAddon) => data.data?.store.find(s => s.code === o.code)?.name ?? o.code;
  const recurring = (o: OwnedAddon) =>
    (data.data?.store.find(s => s.code === o.code)?.billingType ?? 'RECURRING') === 'RECURRING';

  return (
    <Card title="Add-on store" sub="Extra capacity and single features on top of your plan.">
      {trial && canEdit && (
        <Alert tone="info">Add-ons can be bought after the trial, once your paid plan has started.</Alert>
      )}
      {data.error ? (
        <ErrorState error={data.error} title="Add-ons could not be loaded" />
      ) : !data.data ? (
        <div className="skeleton h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.store.map(a => {
              const q = qty[a.code] ?? 1;
              const max = Math.max(1, a.remainingQuantity);
              const stepper = !isFeatureAddon(a) && a.remainingQuantity > 1;
              return (
                <article
                  key={a.code}
                  aria-label={a.name}
                  className="flex flex-col gap-2 rounded-[20px] border border-[var(--line)] bg-white/55 p-4"
                >
                  <h3 className="text-[15px] font-bold">{a.name}</h3>
                  {a.description && <p className="text-[13px] text-muted">{a.description}</p>}
                  <p>
                    <b className="text-[18px]">{inr(a.pricePaise)}</b>{' '}
                    <span className="text-[13px] text-muted">{unit(a)}</span>
                  </p>
                  {!a.availableForPlan ? (
                    <p className="text-[12.5px] text-muted">Not available on your plan.</p>
                  ) : a.remainingQuantity <= 0 ? (
                    <p className="text-[12.5px] text-muted">You have the maximum quantity.</p>
                  ) : canEdit ? (
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                      {stepper && (
                        <div
                          className="flex items-center gap-1"
                          role="group"
                          aria-label={`Quantity of ${a.name}`}
                        >
                          <Button
                            size="xs"
                            variant="glass"
                            aria-label="Fewer"
                            disabled={q <= 1}
                            onClick={() => setQty(s => ({ ...s, [a.code]: q - 1 }))}
                          >
                            −
                          </Button>
                          <span className="w-8 text-center font-semibold" aria-live="polite">
                            {q}
                          </span>
                          <Button
                            size="xs"
                            variant="glass"
                            aria-label="More"
                            disabled={q >= max}
                            onClick={() => setQty(s => ({ ...s, [a.code]: q + 1 }))}
                          >
                            +
                          </Button>
                        </div>
                      )}
                      <Button
                        size="sm"
                        disabled={trial}
                        aria-label={`Buy ${a.name}`}
                        onClick={() => setBuying(a)}
                      >
                        Buy
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          {data.data.owned.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-[15px] font-bold">Your add-ons</h3>
              <ul className="flex flex-col divide-y divide-[var(--line)]">
                {data.data.owned.map(o => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <b>{nameOf(o)}</b>
                      {o.quantity > 1 ? ` × ${o.quantity}` : ''}
                      {o.featureKey && (
                        <span className="block text-[13px]">{featureTitle(o.featureKey)}</span>
                      )}
                      <span className="block text-[12.5px] text-muted">
                        {inr(o.unitPricePaise)} {recurring(o) ? 'per month' : 'per pack'}
                        {o.endsAt ? ` · ends ${shortDate(o.endsAt)}` : ''}
                      </span>
                    </span>
                    <Chip tone={STATUS[o.status]?.tone ?? 'neutral'}>
                      {STATUS[o.status]?.label ?? o.status}
                    </Chip>
                    {canEdit && o.status === 'ACTIVE' && recurring(o) && (
                      <Button
                        size="xs"
                        variant="glass"
                        aria-label={`Cancel ${nameOf(o)} at period end`}
                        onClick={() =>
                          act(
                            () => subscriptionsService.cancelAddon(o.id, o.version),
                            `${nameOf(o)} ends at the end of this period.`,
                          )
                        }
                      >
                        Cancel at period end
                      </Button>
                    )}
                    {canEdit && o.status === 'CANCEL_SCHEDULED' && (
                      <Button
                        size="xs"
                        variant="glass"
                        aria-label={`Resume ${nameOf(o)}`}
                        onClick={() =>
                          act(
                            () => subscriptionsService.resumeAddon(o.id, o.version),
                            `${nameOf(o)} continues.`,
                          )
                        }
                      >
                        Resume
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {buying && (
        <BuyDialog
          addon={buying}
          quantity={isFeatureAddon(buying) ? 1 : (qty[buying.code] ?? 1)}
          planCode={sub.plan.code}
          onClose={() => setBuying(null)}
          onBought={msg => {
            setBuying(null);
            toast.show(msg);
            reload();
          }}
        />
      )}
    </Card>
  );
}

function BuyDialog({
  addon,
  quantity,
  planCode,
  onClose,
  onBought,
}: {
  addon: StoreAddon;
  quantity: number;
  planCode: string;
  onClose: () => void;
  onBought: (message: string) => void;
}) {
  const ent = useEntitlements();
  const [featureKey, setFeatureKey] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choice = isChoice(addon);
  const features = choice ? eligibleFeatures(planCode, ent?.features ?? []) : [];

  const buy = async () => {
    if (choice && !featureKey) {
      setPickError('Pick the feature to unlock.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await subscriptionsService.buyAddon({
        addonCode: addon.code,
        ...(choice ? { featureKey: featureKey! } : { quantity }),
      });
      onBought(
        r.subscriptionAddon.status === 'PENDING_PAYMENT'
          ? `${addon.name} ordered. It applies when the invoice is paid.`
          : `${addon.name} is active.`,
      );
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
      title={`Buy ${addon.name}`}
      description={
        addon.billingType === 'RECURRING'
          ? 'Billed every month with your plan, starting with a part-period invoice now. Cancel any time; it ends at the period end.'
          : 'A one-time pack for the current usage month. It applies when its invoice is paid.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={buy}>
            Buy for {inr(addon.pricePaise * quantity)}
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {choice && (
        <FeaturePicker
          label="Feature to unlock"
          features={features}
          value={featureKey}
          onChange={k => {
            setFeatureKey(k);
            setPickError(null);
          }}
          error={pickError}
        />
      )}
      <p className="text-[14px]">
        {quantity > 1 ? `${quantity} × ${inr(addon.pricePaise)} = ` : ''}
        <b>{inr(addon.pricePaise * quantity)}</b> {unit(addon)}, plus GST.
      </p>
    </Modal>
  );
}
