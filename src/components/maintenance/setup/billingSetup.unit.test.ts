import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { normaliseRule, normaliseVersion } from '@/services/billingSetupMappers';
import { ruleRaw, versionRaw } from '@/test/billingSetupFixtures';
import type { ChargeHead } from '@/types/billingSetup';
import { createHeadBody, simulateBody } from '@/services/billingSetup.service';
import {
  KNOWN_ERROR_CODES,
  fieldErrors,
  billingSetupError,
  describeRate,
  isFirstOfMonth,
  nextMonthStart,
  paiseToRupees,
  rupeesToPaise,
  validPercent,
} from './format';
import { buildLateFee, lateFeeFormFrom, policyInForce } from './lateFee';
import { splitShares } from './splitMath';
import { allowedRateTypes, buildVersion, emptyVersionForm } from './versionForm';

/** Every code of spec section 12 that the module 11.1 routes can return. */
const SPEC_CODES = [
  'VALIDATION_FAILED',
  'REAUTH_REQUIRED',
  'FEATURE_NOT_IN_PLAN',
  'PERMISSION_DENIED',
  'CHARGE_HEAD_NOT_FOUND',
  'RULE_NOT_FOUND',
  'SPLIT_RULE_NOT_FOUND',
  'UNIT_NOT_FOUND',
  'STALE_VERSION',
  'INVALID_STATE',
  'IDEMPOTENCY_KEY_REUSED',
  'CHARGE_HEAD_KEY_TAKEN',
  'CHARGE_HEAD_IN_USE',
  'RULE_NAME_TAKEN',
  'RULE_SCOPE_OVERLAP',
  'RULE_IN_USE',
  'RULE_VERSION_PENDING',
  'RULE_VERSION_DATE_TAKEN',
  'SPLIT_RULE_NAME_TAKEN',
  'SPLIT_RULE_IN_USE',
  'LATE_FEE_POLICY_PENDING',
  'LATE_FEE_DATE_TAKEN',
  'APPROVAL_ALREADY_PENDING',
  'CHARGE_HEAD_ROUTING_INVALID',
  'CHARGE_HEAD_SYSTEM',
  'CHARGE_HEAD_ARCHIVED',
  'CHARGE_HEAD_NOT_ALLOWED',
  'LEDGER_ACCOUNT_NOT_FOUND',
  'RATE_TYPE_NOT_ALLOWED',
  'NOC_CAP_EXCEEDED',
  'METER_SOURCE_NOT_AVAILABLE',
  'RULE_EFFECTIVE_DATE_INVALID',
  'RULE_EFFECTIVE_IN_BILLED_PERIOD',
  'SOCIETY_SUSPENDED',
  'SOCIETY_CLOSED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'LATE_FEE_POLICY_NOT_FOUND',
  'RUN_PERIOD_INVALID',
];

describe('billingSetupError', () => {
  it.each(SPEC_CODES)('has plain words for %s, not the raw API message', code => {
    const text = billingSetupError(new ApiError(422, code, 'raw server text'));
    expect(text).not.toBe('raw server text');
    expect(text.length).toBeGreaterThan(10);
    expect(KNOWN_ERROR_CODES).toContain(code);
  });
  it('falls back to the API message for an unknown code and handles plain errors', () => {
    expect(billingSetupError(new ApiError(400, 'SOMETHING_NEW', 'Server words'))).toBe('Server words');
    expect(billingSetupError(new Error('boom'))).toBe('boom');
  });
});

describe('money and dates', () => {
  it('turns rupees into paise only for valid amounts', () => {
    expect(rupeesToPaise('3.2')).toBe(320);
    expect(rupeesToPaise('600')).toBe(60000);
    expect(rupeesToPaise('1.234')).toBeNull();
    expect(rupeesToPaise('-5')).toBeNull();
    expect(rupeesToPaise('')).toBeNull();
  });
  it('shows paise as a plain rupee amount', () => {
    expect(paiseToRupees(320)).toBe('3.2');
    expect(paiseToRupees(60000)).toBe('600');
    expect(paiseToRupees(null)).toBe('');
  });
  it('checks percent and first-of-month', () => {
    expect(validPercent('7.5', 0.0001, 10)).toBe(true);
    expect(validPercent('10.5', 0.0001, 10)).toBe(false);
    expect(validPercent('1.23456', 0.0001, 100)).toBe(false);
    expect(isFirstOfMonth('2027-04-01')).toBe(true);
    expect(isFirstOfMonth('2027-04-15')).toBe(false);
    expect(nextMonthStart(new Date(2026, 10, 4))).toBe('2026-12-01');
  });
});

describe('describeRate', () => {
  const v = (o: Record<string, unknown>) => normaliseVersion(versionRaw(o))!;
  it('states rates per month and multiplies for a longer cycle (BR-11-16)', () => {
    expect(describeRate(v({}))).toBe('₹3.20 per sq ft per month');
    expect(describeRate(v({}), { months: 3 })).toBe('₹9.60 per sq ft for 3 months');
    expect(describeRate(v({ rateType: 'FLAT_PER_UNIT', amountPaise: 60000, ratePerSqftPaise: null }))).toBe(
      '₹600 per flat per month',
    );
    expect(describeRate(v({ rateType: 'NONE', ratePerSqftPaise: null }))).toBe('No charge');
  });
  it('names the base heads of a percent rate', () => {
    const t = describeRate(
      v({ rateType: 'PERCENT_OF_HEADS', percent: 7.5, baseChargeHeadIds: [1], ratePerSqftPaise: null }),
      {
        headName: () => 'Maintenance',
      },
    );
    expect(t).toBe('7.5% of Maintenance');
  });
});

describe('splitShares (BR-11-22)', () => {
  it('always adds up to the total and gives leftover paise to the largest remainders', () => {
    expect(splitShares(1000000, [1, 1, 1])).toEqual([333334, 333333, 333333]);
    const s = splitShares(100001, [650, 800, 1000]);
    expect(s.reduce((a, b) => a + b, 0)).toBe(100001);
  });
  it('gives nothing to a zero weight and handles an empty total weight', () => {
    expect(splitShares(1000, [0, 1, 1])).toEqual([0, 500, 500]);
    expect(splitShares(1000, [0, 0])).toEqual([0, 0]);
  });
});

describe('buildVersion', () => {
  const head = (over: Partial<ChargeHead> = {}) =>
    ({ headType: 'MAINTENANCE', id: 1, ...over }) as ChargeHead;
  const base = { ...emptyVersionForm('2027-04-01'), reason: 'AGM resolution 4' };
  it('builds a per sq ft body in paise', () => {
    const r = buildVersion({ ...base, rateType: 'PER_SQFT', sqft: '3.50' }, head());
    expect(r.input).toEqual({
      rateType: 'PER_SQFT',
      effectiveFrom: '2027-04-01',
      ratePerSqftPaise: 350,
      reason: 'AGM resolution 4',
    });
  });
  it('rejects a date that is not a period start, a short reason and an empty amount', () => {
    const r = buildVersion({ ...base, effectiveFrom: '2027-04-15', reason: 'no' }, head());
    expect(r.input).toBeNull();
    expect(Object.keys(r.errors).sort()).toEqual(['amount', 'effectiveFrom', 'reason']);
  });
  it('caps a non-occupancy percent at 10 and limits its rate types (BR-11-18)', () => {
    const noc = head({ headType: 'NON_OCCUPANCY' });
    expect(allowedRateTypes(noc)).toEqual(['PERCENT_OF_HEADS', 'NONE']);
    const r = buildVersion({ ...base, rateType: 'PERCENT_OF_HEADS', percent: '12', baseIds: [1] }, noc);
    expect(r.errors.percent).toMatch(/10 percent/);
  });
  it('needs a split rule for SPLIT_TOTAL and at least one flat type amount', () => {
    expect(buildVersion({ ...base, rateType: 'SPLIT_TOTAL' }, head()).errors.splitRuleId).toBeTruthy();
    expect(buildVersion({ ...base, rateType: 'PER_UNIT_TYPE' }, head()).errors.typeRates).toBeTruthy();
    const ok = buildVersion(
      { ...base, rateType: 'PER_UNIT_TYPE', typeRates: { '2BHK': '2500', '3BHK': '' } },
      head(),
    );
    expect(ok.input?.unitTypeRates).toEqual({ '2BHK': 250000 });
  });
  it('leaves the reason out for a simulation', () => {
    const r = buildVersion({ ...base, reason: '', rateType: 'FLAT_PER_UNIT', amount: '600' }, head(), false);
    expect(r.input).toEqual({ rateType: 'FLAT_PER_UNIT', effectiveFrom: '2027-04-01', amountPaise: 60000 });
  });
});

describe('buildLateFee', () => {
  const f = { ...lateFeeFormFrom(null, '2026-12-01'), rate: '18', reason: 'Committee decision' };
  it('formats the rate with four decimals and keeps it within 21 percent', () => {
    expect(buildLateFee(f, '2026-11-01').input).toMatchObject({
      policyType: 'SIMPLE_INTEREST',
      interestRatePct: '18.0000',
      interestFrom: 'DUE_DATE',
      graceDays: 0,
      minChargePaise: 100,
    });
    expect(buildLateFee({ ...f, rate: '21.0001' }, '2026-11-01').errors.rate).toMatch(/21 percent/);
    expect(buildLateFee({ ...f, rate: '36' }, '2026-11-01').input).toBeNull();
  });
  it('checks grace days, the start month and the flat fee', () => {
    expect(buildLateFee({ ...f, grace: '31' }, '2026-11-01').errors.grace).toBeTruthy();
    expect(
      buildLateFee({ ...f, effectiveFrom: '2026-12-10' }, '2026-11-01').errors.effectiveFrom,
    ).toBeTruthy();
    expect(
      buildLateFee({ ...f, effectiveFrom: '2026-10-01' }, '2026-11-01').errors.effectiveFrom,
    ).toBeTruthy();
    const flat = buildLateFee({ ...f, policyType: 'FLAT', flat: '250' }, '2026-11-01');
    expect(flat.input).toMatchObject({ policyType: 'FLAT', flatFeePaise: 25000 });
    expect(flat.input).not.toHaveProperty('interestRatePct');
  });
  it('picks the active policy with the latest start on or before a date', () => {
    const p = (id: number, d: string, status: string) =>
      ({ id, effectiveFrom: d, status }) as Parameters<typeof policyInForce>[0][number];
    const list = [
      p(1, '2026-04-01', 'ACTIVE'),
      p(2, '2026-09-01', 'ACTIVE'),
      p(3, '2027-04-01', 'ACTIVE'),
      p(4, '2026-10-01', 'PENDING_APPROVAL'),
    ];
    expect(policyInForce(list, '2026-11-04')?.id).toBe(2);
  });
});

describe('mappers', () => {
  it('reads a rule with its versions and tolerates missing fields', () => {
    const r = normaliseRule(
      ruleRaw({
        pendingVersion: versionRaw({
          id: 32,
          versionNo: 4,
          status: 'PENDING_APPROVAL',
          ratePerSqftPaise: '350',
        }),
      }),
    );
    expect(r.scopeValues).toEqual([]);
    expect(r.currentVersion?.ratePerSqftPaise).toBe(320);
    expect(r.pendingVersion?.ratePerSqftPaise).toBe(350);
    expect(r.nextVersion).toBeNull();
    expect(normaliseRule({}).versions).toEqual([]);
  });
  it('reads JSON columns sent as text and decimals as four-decimal text', () => {
    const v = normaliseVersion(
      versionRaw({ rateType: 'PERCENT_OF_HEADS', percent: 7.5, baseChargeHeadIds: '[1,2]' }),
    )!;
    expect(v.percent).toBe('7.5000');
    expect(v.baseChargeHeadIds).toEqual([1, 2]);
  });
});

describe('real backend shapes', () => {
  it('reads the rule head from the nested chargeHead object', () => {
    const r = normaliseRule(ruleRaw());
    expect(r.chargeHeadId).toBe(1);
    expect(r.chargeHeadKey).toBe('MAINTENANCE');
    expect(r.chargeHeadName).toBe('Maintenance (service charges)');
  });
  it('leaves a null SAC code out of the strict create-head body', () => {
    const b = createHeadBody({
      key: 'X',
      name: 'Xx',
      headType: 'OTHER',
      payerRouting: 'BILL_TO',
      gstTreatment: 'NONE',
      sacCode: null,
      prorate: true,
      interestBearing: true,
      ledgerAccountCode: '4100',
    });
    expect('sacCode' in b).toBe(false);
  });
  it('sends no reason or resolutionRef to the strict simulate call and at most 20 flats', () => {
    const b = simulateBody({
      chargeHeadId: 1,
      version: { rateType: 'NONE', effectiveFrom: '2027-04-01', reason: 'x', resolutionRef: 'AGM' },
      unitIds: Array.from({ length: 25 }, (_, i) => i + 1),
      periodStart: '2027-04-01',
    });
    expect(b.version).toEqual({ rateType: 'NONE', effectiveFrom: '2027-04-01' });
    expect(b.unitIds).toHaveLength(20);
  });
  it('maps API field names of errors[] to the form keys', () => {
    const e = new ApiError(400, 'VALIDATION_FAILED', 'bad', [
      { field: 'firstVersion.amountPaise', message: 'Too big' },
      { field: 'unitTypeRates.2BHK', message: 'Not a unit type' },
      { field: 'interestRatePct', message: 'Between 0.0001 and 21.0000' },
      { field: 'name', message: 'Too short' },
    ]);
    expect(fieldErrors(e)).toEqual({
      amount: 'Too big',
      typeRates: 'Not a unit type',
      rate: 'Between 0.0001 and 21.0000',
      name: 'Too short',
    });
  });
});
