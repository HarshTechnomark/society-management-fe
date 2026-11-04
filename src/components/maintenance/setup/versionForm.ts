import type { BillingRule, ChargeHead, RateType, RuleVersion, VersionInput } from '@/types/billingSetup';
import { isFirstOfMonth, paiseToRupees, rupeesToPaise, UNIT_TYPE_VALUES, validPercent } from './format';

/** The state of the "change rate" form: all fields as text so the user can type freely. */
export interface VersionForm {
  rateType: RateType;
  amount: string;
  sqft: string;
  typeRates: Record<string, string>;
  splitRuleId: string;
  percent: string;
  baseIds: number[];
  effectiveFrom: string;
  reason: string;
  resolutionRef: string;
}

export const emptyVersionForm = (effectiveFrom: string): VersionForm => ({
  rateType: 'FLAT_PER_UNIT',
  amount: '',
  sqft: '',
  typeRates: {},
  splitRuleId: '',
  percent: '',
  baseIds: [],
  effectiveFrom,
  reason: '',
  resolutionRef: '',
});

/** Starts a change from the rate in force, so the user only edits what changes. */
export function formFrom(v: RuleVersion | null, effectiveFrom: string): VersionForm {
  const f = emptyVersionForm(effectiveFrom);
  if (!v || v.rateType === 'METERED') return f;
  return {
    ...f,
    rateType: v.rateType,
    amount: paiseToRupees(v.amountPaise),
    sqft: paiseToRupees(v.ratePerSqftPaise),
    typeRates: Object.fromEntries(
      Object.entries(v.unitTypeRates ?? {}).map(([k, p]) => [k, paiseToRupees(p)]),
    ),
    splitRuleId: v.billSplitRuleId ? String(v.billSplitRuleId) : '',
    percent: v.percent ? String(Number(v.percent)) : '',
    baseIds: v.baseChargeHeadIds ?? [],
  };
}

/** Rate types a head may use: a non-occupancy head only takes a percent or "no charge" (BR-11-18). */
export function allowedRateTypes(head: ChargeHead | undefined): RateType[] {
  if (head?.headType === 'NON_OCCUPANCY') return ['PERCENT_OF_HEADS', 'NONE'];
  return ['FLAT_PER_UNIT', 'PER_SQFT', 'PER_UNIT_TYPE', 'PERCENT_OF_HEADS', 'SPLIT_TOTAL', 'NONE'];
}

export type VersionErrors = Partial<Record<keyof VersionForm, string>>;

/** Builds the request body, or the field errors. `withReason` is false for the simulation. */
export function buildVersion(
  f: VersionForm,
  head: ChargeHead | undefined,
  withReason = true,
): { input: VersionInput | null; errors: VersionErrors } {
  const errors: VersionErrors = {};
  const out: VersionInput = { rateType: f.rateType, effectiveFrom: f.effectiveFrom, reason: f.reason.trim() };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.effectiveFrom)) errors.effectiveFrom = 'Pick the date the rate starts.';
  else if (!isFirstOfMonth(f.effectiveFrom)) errors.effectiveFrom = 'Pick the first day of a billing period.';
  if (withReason && (out.reason.length < 5 || out.reason.length > 500))
    errors.reason = 'Give the reason in 5 to 500 characters.';
  if (f.resolutionRef.trim().length > 100) errors.resolutionRef = 'At most 100 characters.';
  else if (f.resolutionRef.trim()) out.resolutionRef = f.resolutionRef.trim();

  switch (f.rateType) {
    case 'FLAT_PER_UNIT': {
      const p = rupeesToPaise(f.amount);
      if (p === null || p > 100_000_000) errors.amount = 'Enter an amount from ₹0 to ₹10,00,000 per month.';
      else out.amountPaise = p;
      break;
    }
    case 'PER_SQFT': {
      const p = rupeesToPaise(f.sqft);
      if (p === null || p < 1 || p > 100_000) errors.sqft = 'Enter a rate from ₹0.01 to ₹1,000 per sq ft.';
      else out.ratePerSqftPaise = p;
      break;
    }
    case 'PER_UNIT_TYPE': {
      const rates: Record<string, number> = {};
      for (const [k, t] of Object.entries(f.typeRates)) {
        if (t.trim() === '') continue;
        const p = rupeesToPaise(t);
        if (p === null || p > 100_000_000) errors.typeRates = `Enter a valid amount for ${k}.`;
        else rates[k] = p;
      }
      if (!errors.typeRates && Object.keys(rates).length === 0)
        errors.typeRates = 'Enter an amount for at least one flat type.';
      out.unitTypeRates = rates;
      break;
    }
    case 'SPLIT_TOTAL':
      if (!f.splitRuleId) errors.splitRuleId = 'Pick a split rule.';
      else out.billSplitRuleId = Number(f.splitRuleId);
      break;
    case 'PERCENT_OF_HEADS': {
      const max = head?.headType === 'NON_OCCUPANCY' ? 10 : 100;
      if (!validPercent(f.percent, 0.0001, max))
        errors.percent =
          max === 10
            ? 'Enter a percent from 0.0001 to 10. Non-occupancy charges are capped at 10 percent.'
            : 'Enter a percent from 0.0001 to 100 (up to four decimals).';
      else out.percent = f.percent.trim();
      if (f.baseIds.length < 1 || f.baseIds.length > 10)
        errors.baseIds = 'Pick 1 to 10 heads to take the percent of.';
      else out.baseChargeHeadIds = f.baseIds;
      break;
    }
    default:
      break;
  }
  if (!withReason) delete (out as Partial<VersionInput>).reason;
  return { input: Object.keys(errors).length ? null : out, errors };
}

export const unitTypeKeys = UNIT_TYPE_VALUES;

/** Rule fields for a list of flats, building ids or types: a short text. */
export function scopeText(
  r: Pick<BillingRule, 'scopeType' | 'scopeValues'>,
  building?: (id: number) => string,
): string {
  switch (r.scopeType) {
    case 'ALL_UNITS':
      return 'All flats';
    case 'BUILDINGS':
      return `Buildings: ${r.scopeValues.map(v => building?.(Number(v)) ?? v).join(', ')}`;
    case 'UNIT_TYPES':
      return `Flat types: ${r.scopeValues.join(', ')}`;
    default:
      return `${r.scopeValues.length} selected ${r.scopeValues.length === 1 ? 'flat' : 'flats'}`;
  }
}

/** A version shape from a request body, so the same wording (`describeRate`) can preview it. */
export function previewVersion(i: VersionInput): RuleVersion {
  return {
    id: 0,
    billingRuleId: 0,
    versionNo: 0,
    rateType: i.rateType,
    amountPaise: i.amountPaise ?? null,
    ratePerSqftPaise: i.ratePerSqftPaise ?? null,
    unitTypeRates: i.unitTypeRates ?? null,
    meterType: null,
    slabs: null,
    minimumChargePaise: null,
    missingReadingPolicy: null,
    billSplitRuleId: i.billSplitRuleId ?? null,
    percent: i.percent ?? null,
    baseChargeHeadIds: i.baseChargeHeadIds ?? null,
    effectiveFrom: i.effectiveFrom,
    effectiveTo: null,
    status: 'PENDING_APPROVAL',
    reason: i.reason ?? '',
    resolutionRef: i.resolutionRef ?? null,
    approvalRequestId: null,
    approvedAt: null,
    rejectedReason: null,
  };
}
