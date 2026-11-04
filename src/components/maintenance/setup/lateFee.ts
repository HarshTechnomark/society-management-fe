import type { InterestFrom, LateFeeInput, LateFeePolicy, PolicyType } from '@/types/billingSetup';
import { inr } from '@/lib/money';
import { isFirstOfMonth, rupeesToPaise } from './format';

export const MAX_INTEREST = 21;

export interface LateFeeForm {
  policyType: PolicyType;
  rate: string;
  interestFrom: InterestFrom;
  flat: string;
  grace: string;
  minCharge: string;
  effectiveFrom: string;
  reason: string;
  resolutionRef: string;
}

export const lateFeeFormFrom = (p: LateFeePolicy | null, effectiveFrom: string): LateFeeForm => ({
  policyType: p?.policyType ?? 'SIMPLE_INTEREST',
  rate: p?.interestRatePct ? String(Number(p.interestRatePct)) : '',
  interestFrom: p?.interestFrom ?? 'DUE_DATE',
  flat: p?.flatFeePaise ? String(p.flatFeePaise / 100) : '',
  grace: String(p?.graceDays ?? 0),
  minCharge: String((p?.minChargePaise ?? 100) / 100),
  effectiveFrom,
  reason: '',
  resolutionRef: '',
});

export type LateFeeErrors = Partial<Record<keyof LateFeeForm, string>>;

/** Builds the body of `POST /billing/late-fee-policies` (spec 8.4), or the field errors. */
export function buildLateFee(
  f: LateFeeForm,
  currentMonthStart: string,
): { input: LateFeeInput | null; errors: LateFeeErrors } {
  const errors: LateFeeErrors = {};
  const grace = Number(f.grace);
  if (f.grace.trim() === '' || !Number.isInteger(grace) || grace < 0 || grace > 30)
    errors.grace = 'Enter whole days from 0 to 30.';
  const minPaise = rupeesToPaise(f.minCharge || '0');
  if (minPaise === null || minPaise > 100_000) errors.minCharge = 'Enter an amount from ₹0 to ₹1,000.';
  if (!isFirstOfMonth(f.effectiveFrom)) errors.effectiveFrom = 'Pick the first day of a month.';
  else if (f.effectiveFrom < currentMonthStart)
    errors.effectiveFrom = 'The date cannot be before this month.';
  const reason = f.reason.trim();
  if (reason.length < 5 || reason.length > 500) errors.reason = 'Give the reason in 5 to 500 characters.';
  if (f.resolutionRef.trim().length > 100) errors.resolutionRef = 'At most 100 characters.';

  const input: LateFeeInput = {
    policyType: f.policyType,
    graceDays: grace,
    effectiveFrom: f.effectiveFrom,
    reason,
  };
  if (minPaise !== null) input.minChargePaise = minPaise;
  if (f.resolutionRef.trim()) input.resolutionRef = f.resolutionRef.trim();
  if (f.policyType === 'SIMPLE_INTEREST') {
    const t = f.rate.trim();
    const n = Number(t);
    if (!/^\d{1,2}(\.\d{1,4})?$/.test(t) || n < 0.0001 || n > MAX_INTEREST)
      errors.rate = 'Enter a rate from 0.0001 to 21 percent a year. The bye-laws allow at most 21 percent.';
    else input.interestRatePct = n.toFixed(4);
    input.interestFrom = f.interestFrom;
  }
  if (f.policyType === 'FLAT') {
    const p = rupeesToPaise(f.flat);
    if (p === null || p < 100 || p > 1_000_000) errors.flat = 'Enter a fee from ₹1 to ₹10,000.';
    else input.flatFeePaise = p;
  }
  return { input: Object.keys(errors).length ? null : input, errors };
}

/** "18% a year simple interest after 5 grace days" for a policy. */
export function describePolicy(p: LateFeePolicy): string {
  const grace = `${p.graceDays} grace ${p.graceDays === 1 ? 'day' : 'days'}`;
  if (p.policyType === 'NONE') return 'No late fee';
  if (p.policyType === 'FLAT') return `${inr(p.flatFeePaise)} once per late bill, ${grace}`;
  const from =
    p.interestFrom === 'GRACE_END' ? 'counted from the end of the grace days' : 'counted from the due date';
  return `${Number(p.interestRatePct)}% a year simple interest, ${from}, ${grace}`;
}

/** The policy in force on `date`: the active one with the latest start on or before it. */
export function policyInForce(policies: LateFeePolicy[], date: string): LateFeePolicy | null {
  return (
    policies
      .filter(p => p.status === 'ACTIVE' && p.effectiveFrom <= date)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0] ?? null
  );
}
