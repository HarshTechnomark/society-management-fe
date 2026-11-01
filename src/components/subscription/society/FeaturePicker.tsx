'use client';
import { useId, useMemo, useState } from 'react';
import { FEATURES, MODULE_NAMES, type FeatureMeta } from '@/constants/features';
import { PLAN_RANK } from '../format';
import { planName } from '../planLock';

/**
 * Features a society may unlock or trial (BR-04-24, 8.6.6): LIVE, not always on, minimum plan above the current
 * plan and not Enterprise-only, and not already enabled. The API checks the same rules.
 */
export function eligibleFeatures(planCode: string, enabled: readonly string[]): FeatureMeta[] {
  const rank = PLAN_RANK[planCode] ?? 0;
  const on = new Set(enabled);
  return FEATURES.filter(
    f =>
      f.minPlan !== 'ALWAYS' &&
      f.minPlan !== 'PLANNED' &&
      f.minPlan !== 'ENTERPRISE' &&
      (PLAN_RANK[f.minPlan] ?? 0) > rank &&
      !on.has(f.key),
  );
}

const SHOW = 40;

/** A search box over the eligible features and a radio list of the matches (first 40). */
export function FeaturePicker({
  features,
  value,
  onChange,
  label = 'Feature',
  error,
}: {
  features: FeatureMeta[];
  value: string | null;
  onChange: (key: string) => void;
  label?: string;
  error?: string | null;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t
      ? features.filter(
          f =>
            f.title.toLowerCase().includes(t) ||
            f.key.includes(t) ||
            (MODULE_NAMES[f.moduleNo] ?? '').toLowerCase().includes(t),
        )
      : features;
    return list.slice(0, SHOW);
  }, [features, q]);
  const total = q.trim() ? matches.length : features.length;
  return (
    <fieldset className="mb-4" aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="mb-1.5 text-[13px] font-semibold">{label}</legend>
      <input
        type="search"
        aria-label={`Search ${label.toLowerCase()}`}
        placeholder="Search features"
        value={q}
        onChange={e => setQ(e.target.value)}
        className="mb-2 h-11 w-full rounded-[14px] border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-3.5 text-[14.5px] focus:border-navy focus:outline-none"
      />
      {matches.length === 0 ? (
        <p className="text-[13.5px] text-muted">No features match.</p>
      ) : (
        <ul className="max-h-60 overflow-y-auto rounded-[14px] border border-[var(--line)] bg-white/60">
          {matches.map(f => (
            <li key={f.key} className="border-b border-[var(--line)] last:border-0">
              <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-[14px]">
                <input
                  type="radio"
                  name={id}
                  className="mt-1 accent-[#143041]"
                  checked={value === f.key}
                  onChange={() => onChange(f.key)}
                />
                <span>
                  {f.title}
                  <span className="block text-[12px] text-muted">
                    {MODULE_NAMES[f.moduleNo] ?? `Module ${f.moduleNo}`} · {planName(f.minPlan)} plan
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {total > SHOW && !q.trim() && (
        <p className="mt-1 text-[12px] text-muted">
          Showing {SHOW} of {total}. Search to narrow the list.
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-[12.5px] font-medium text-bad">
          {error}
        </p>
      )}
    </fieldset>
  );
}
