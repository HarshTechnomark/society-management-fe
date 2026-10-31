'use client';
import { Alert } from '@/components/ui/Alert';
import { buttonClasses } from '@/components/ui/Button';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { limitLabel, usagePercent } from '@/lib/limits';
import { shortDate } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { UsageItem } from '@/types/subscriptions';
import { SUBSCRIPTION_PATH } from './planLock';

/** One line per limit at 80 % or more (spec 10, `subscription.usage_threshold`). */
export function UsageWarnings({ items, link = true }: { items: UsageItem[]; link?: boolean }) {
  const hot = items
    .map(u => ({ u, pct: usagePercent(u) }))
    .filter((x): x is { u: UsageItem; pct: number } => x.pct !== null && x.pct >= 80);
  if (hot.length === 0) return null;
  return (
    <div data-testid="usage-banners">
      {hot.map(({ u, pct }) => (
        <Alert key={u.limitKey} tone={pct >= 100 ? 'bad' : 'warn'}>
          <span>
            {pct >= 100
              ? `${limitLabel(u.limitKey)} has reached 100 % of your plan.`
              : `${limitLabel(u.limitKey)} is at ${pct} % of your plan.`}{' '}
            {link && (
              <a href={SUBSCRIPTION_PATH} className={`${buttonClasses('glass', 'xs')} ml-1`}>
                See plans
              </a>
            )}
          </span>
        </Alert>
      ))}
    </div>
  );
}

/** The usage warning banners for users who may view the subscription; renders nothing otherwise or on error. */
export function UsageBanners() {
  const canView = usePermission(PERMISSIONS.settings.subscription.view);
  return canView ? <Loaded /> : null;
}

function Loaded() {
  const usage = useLoad(() => subscriptionsService.usage());
  const sub = useLoad(() => subscriptionsService.subscription());
  const s = sub.data;
  return (
    <>
      {usage.data && <UsageWarnings items={usage.data.items} />}
      {s && s.readOnlyFeatures.length > 0 && (
        <Alert tone="warn">
          Some features are read-only after your plan change
          {s.readOnlyUntil ? ` until ${shortDate(s.readOnlyUntil)}` : ''}. Exports still work.
        </Alert>
      )}
    </>
  );
}
