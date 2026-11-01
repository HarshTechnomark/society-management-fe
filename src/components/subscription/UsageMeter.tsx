import { limitLabel, usagePercent, usageText } from '@/lib/limits';
import type { UsageItem } from '@/types/subscriptions';

/** One limit as a meter with 80 % and 100 % markers; "Unlimited" text when the limit is null (spec 11.4). */
export function UsageMeter({ item }: { item: UsageItem }) {
  const pct = usagePercent(item);
  const { used, limit } = usageText(item);
  const label = limitLabel(item.limitKey);
  const tone = pct === null ? 'bg-navy' : pct >= 100 ? 'bg-bad' : pct >= 80 ? 'bg-warn' : 'bg-navy';
  return (
    <div className="flex flex-col gap-1" data-testid={`meter-${item.limitKey}`}>
      <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">
          {limit === null ? `${used} used, Unlimited` : `${used} of ${limit}`}
        </span>
      </div>
      {limit === null ? (
        <p className="text-[12.5px] text-muted">Unlimited</p>
      ) : (
        <div
          role="progressbar"
          aria-label={`${label} used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct ?? 0)}
          aria-valuetext={`${used} of ${limit}`}
          className="relative h-2.5 overflow-visible rounded-full bg-[rgba(20,35,44,0.12)]"
        >
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
          <span
            aria-hidden="true"
            className="absolute -top-0.5 h-3.5 w-px bg-ink/40"
            style={{ left: '80%' }}
          />
        </div>
      )}
      {item.overageUnits > 0 && (
        <p className="text-[12px] text-muted">
          {item.overageUnits.toLocaleString('en-IN')} above the plan limit, billed as overage.
        </p>
      )}
      {item.addonIncrement > 0 && (
        <p className="text-[12px] text-muted">
          Includes +{item.addonIncrement.toLocaleString('en-IN')} from add-ons.
        </p>
      )}
    </div>
  );
}
