'use client';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { ChargeHead, RateType, SplitRule } from '@/types/billingSetup';
import { CYCLE_LABEL, CYCLE_MONTHS, RATE_LABEL, UNIT_TYPE_VALUES, opts } from './format';
import { allowedRateTypes, type VersionErrors, type VersionForm } from './versionForm';
import type { CycleKey } from '@/types/billingSetup';

/** The fields of a rate version (spec 8.2): rate type and its value, effective date, reason, resolution reference. */
export function VersionFields({
  form,
  onChange,
  errors,
  head,
  heads,
  splitRules,
  cycle,
  onCycle,
  showReason = true,
}: {
  form: VersionForm;
  onChange: (f: VersionForm) => void;
  errors: VersionErrors;
  head: ChargeHead | undefined;
  heads: ChargeHead[];
  splitRules: SplitRule[];
  cycle: CycleKey;
  onCycle: (c: CycleKey) => void;
  showReason?: boolean;
}) {
  const set = <K extends keyof VersionForm>(k: K, v: VersionForm[K]) => onChange({ ...form, [k]: v });
  const types = allowedRateTypes(head);
  const baseCandidates = heads.filter(
    h => h.status === 'ACTIVE' && !h.isSystem && h.id !== head?.id && h.headType === 'MAINTENANCE',
  );
  const months = CYCLE_MONTHS[cycle];
  return (
    <>
      <Select
        label="Rate type"
        value={form.rateType}
        onChange={e => set('rateType', e.target.value as RateType)}
        options={opts(Object.fromEntries(types.map(t => [t, RATE_LABEL[t]])) as Record<RateType, string>)}
        hint={
          head?.headType === 'NON_OCCUPANCY'
            ? 'Non-occupancy charges are a percent of the maintenance charge, at most 10 percent.'
            : undefined
        }
      />
      {form.rateType === 'FLAT_PER_UNIT' && (
        <Input
          label="Amount per flat per month (₹)"
          inputMode="decimal"
          value={form.amount}
          onChange={e => set('amount', e.target.value)}
          error={errors.amount}
          required
        />
      )}
      {form.rateType === 'PER_SQFT' && (
        <Input
          label="Rate per sq ft per month (₹)"
          inputMode="decimal"
          value={form.sqft}
          onChange={e => set('sqft', e.target.value)}
          error={errors.sqft}
          hint="For example 3.20. The flat area used is set in society settings."
          required
        />
      )}
      {form.rateType === 'PER_UNIT_TYPE' && (
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-[13px] font-semibold">Amount per month by flat type (₹)</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {UNIT_TYPE_VALUES.map(t => (
              <Input
                key={t}
                label={t}
                inputMode="decimal"
                value={form.typeRates[t] ?? ''}
                onChange={e => set('typeRates', { ...form.typeRates, [t]: e.target.value })}
              />
            ))}
          </div>
          {errors.typeRates && <p className="text-[12.5px] font-medium text-bad">{errors.typeRates}</p>}
        </fieldset>
      )}
      {form.rateType === 'SPLIT_TOTAL' && (
        <Select
          label="Split rule"
          value={form.splitRuleId}
          onChange={e => set('splitRuleId', e.target.value)}
          error={errors.splitRuleId}
          options={[
            { value: '', label: splitRules.length ? 'Pick a split rule' : 'No split rules yet' },
            ...splitRules.map(s => ({ value: String(s.id), label: s.name })),
          ]}
          required
        />
      )}
      {form.rateType === 'PERCENT_OF_HEADS' && (
        <>
          <Input
            label="Percent"
            inputMode="decimal"
            value={form.percent}
            onChange={e => set('percent', e.target.value)}
            error={errors.percent}
            hint="Up to four decimals, for example 7.5."
            required
          />
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-[13px] font-semibold">Take the percent of</legend>
            {baseCandidates.map(h => (
              <Checkbox
                key={h.id}
                className="!mb-2"
                label={h.name}
                checked={form.baseIds.includes(h.id)}
                onChange={e =>
                  set(
                    'baseIds',
                    e.target.checked ? [...form.baseIds, h.id] : form.baseIds.filter(x => x !== h.id),
                  )
                }
              />
            ))}
            {baseCandidates.length === 0 && (
              <p className="text-[13px] text-muted">There is no maintenance head to take a percent of.</p>
            )}
            {errors.baseIds && <p className="text-[12.5px] font-medium text-bad">{errors.baseIds}</p>}
          </fieldset>
        </>
      )}
      <Input
        label="Effective from"
        type="date"
        value={form.effectiveFrom}
        onChange={e => set('effectiveFrom', e.target.value)}
        error={errors.effectiveFrom}
        hint="The first day of a billing period. Months already billed cannot change."
        required
      />
      <Select
        label="Show amounts for"
        value={cycle}
        onChange={e => onCycle(e.target.value as CycleKey)}
        options={opts(CYCLE_LABEL)}
        hint={`Rates are always stated per month. ${months > 1 ? `A ${CYCLE_LABEL[cycle].toLowerCase()} bill charges ${months} times the monthly rate.` : 'A monthly bill charges the rate once.'}`}
      />
      {showReason && (
        <>
          <Textarea
            label="Reason"
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            error={errors.reason}
            hint="For example: AGM resolution 4 of 2026."
            required
          />
          <Input
            label="Resolution reference (optional)"
            value={form.resolutionRef}
            onChange={e => set('resolutionRef', e.target.value)}
            error={errors.resolutionRef}
          />
        </>
      )}
    </>
  );
}
