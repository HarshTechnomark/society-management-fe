import { Chip } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import { PLAN_TONE } from '@/components/subscription/format';
import type { GrantStatus, SocietyStatus } from '@/types/societies';
import {
  GRANT_STATUS_LABEL,
  GRANT_STATUS_TONE,
  HEALTH_LABEL,
  PLAN_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  healthBand,
} from './format';

export function StatusChip({ status }: { status: SocietyStatus }) {
  return <Chip tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Chip>;
}

export function PlanChip({ plan }: { plan: string | null | undefined }) {
  if (!plan) return <span className="text-faint">-</span>;
  return <Chip tone={PLAN_TONE[plan] ?? 'neutral'}>{PLAN_LABEL[plan] ?? plan}</Chip>;
}

export function GrantChip({ status }: { status: GrantStatus }) {
  return <Chip tone={GRANT_STATUS_TONE[status] ?? 'neutral'}>{GRANT_STATUS_LABEL[status] ?? status}</Chip>;
}

/** Health meter with the 75 / 55 thresholds (spec 11.4). */
export function HealthMeter({ score }: { score: number | null | undefined }) {
  const band = healthBand(score);
  if (score === null || score === undefined || !band) return <span className="text-faint">-</span>;
  const tone = band === 'HEALTHY' ? 'bg-ok' : band === 'WATCH' ? 'bg-warn' : 'bg-bad';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="meter"
        aria-label={`Health ${score}, ${HEALTH_LABEL[band]}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="h-2 w-16 overflow-hidden rounded-full bg-[rgba(20,35,44,0.12)]"
      >
        <span className={cx('block h-full rounded-full', tone)} style={{ width: `${score}%` }} />
      </span>
      <span className="text-[13px] font-semibold tabular-nums">{score}</span>
    </span>
  );
}

/** A row of toggle buttons (prototype `segHTML`). */
export function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; count?: number | null }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex max-w-full flex-wrap gap-1 rounded-[18px] border border-white/80 bg-white/55 p-[3px]"
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-8 rounded-full px-3 text-[13px] font-semibold',
            value === o.value ? 'bg-navy text-[#FDF8EE]' : 'text-muted hover:bg-black/5',
          )}
        >
          {o.label}
          {o.count !== undefined && o.count !== null && (
            <span className="ml-1.5 tabular-nums opacity-75">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Tabs with `role="tablist"`; the panel is rendered by the caller with `role="tabpanel"`. */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--line)]"
    >
      {tabs.map(t => (
        <button
          key={t.value}
          type="button"
          role="tab"
          id={`tab-${t.value}`}
          aria-selected={value === t.value}
          aria-controls={`panel-${t.value}`}
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14px] font-semibold',
            value === t.value ? 'border-navy text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A coloured strip at the top of a page (trial, past due, suspended, closed). */
export function Banner({
  tone,
  children,
  action,
}: {
  tone: 'info' | 'warn' | 'bad' | 'neutral';
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const cls = {
    info: 'bg-[#d8ebf3] text-[#0a4a63]',
    warn: 'bg-[#f6e6c9] text-[#6f4200]',
    bad: 'bg-[#f6dcda] text-[#8a1d17]',
    neutral: 'bg-[rgba(20,35,44,0.08)] text-ink',
  }[tone];
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cx(
        'mb-4 flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-3 text-[14px] font-medium',
        cls,
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}
