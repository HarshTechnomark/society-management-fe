import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import {
  KNOWN_ERROR_CODES,
  billingRunError,
  nextPeriod,
  pctText,
  periodLabel,
  periodOptions,
  runPeriodChoices,
  billCount,
  billsText,
  plainError,
  rupeesToPaise,
} from './format';

const SECTION_12_RUN_CODES = [
  'VALIDATION_FAILED',
  'REAUTH_REQUIRED',
  'FEATURE_NOT_IN_PLAN',
  'PERMISSION_DENIED',
  'RUN_NOT_FOUND',
  'RUN_ITEM_NOT_FOUND',
  'STALE_VERSION',
  'INVALID_STATE',
  'IDEMPOTENCY_KEY_REUSED',
  'RUN_PERIOD_EXISTS',
  'RUN_STALE',
  'APPROVAL_ALREADY_PENDING',
  'RUN_PERIOD_INVALID',
  'RUN_PERIOD_TOO_FAR',
  'RUN_SPLIT_INPUT_MISSING',
  'RUN_CONFIRM_MISMATCH',
  'RUN_HAS_EXCEPTIONS',
  'RUN_EMPTY',
  'GST_SETTINGS_INVALID',
  'SOCIETY_SUSPENDED',
  'SOCIETY_CLOSED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
];

describe('billingRunError: one plain message per code', () => {
  it.each(SECTION_12_RUN_CODES)('%s has its own words, not the raw server text', code => {
    const text = billingRunError(new ApiError(400, code, 'raw server text'));
    expect(text).not.toBe('raw server text');
    expect(text.length).toBeGreaterThan(15);
    expect(text).not.toContain(code);
    expect(KNOWN_ERROR_CODES).toContain(code);
  });

  it('falls back to the server message for an unknown code and handles plain errors', () => {
    expect(billingRunError(new ApiError(500, 'WEIRD', 'Weird thing'))).toBe('Weird thing');
    expect(billingRunError(new Error('boom'))).toBe('boom');
    expect(billingRunError('x')).toBe('Something went wrong. Try again.');
    expect(billingRunError(new ApiError(0, 'NETWORK_ERROR', 'x'))).toMatch(/Cannot reach the server/);
  });

  it('keeps the support reference when it rewrites an error for ErrorState', () => {
    const e = plainError(new ApiError(404, 'RUN_NOT_FOUND', 'raw', undefined, 'req_9')) as ApiError;
    expect(e.requestId).toBe('req_9');
    expect(e.message).toMatch(/not found/);
  });
});

describe('periods', () => {
  const now = new Date(2026, 9, 28); // 28 Oct 2026
  it('monthly: two before, current and next, with next as the default', () => {
    const o = periodOptions('MONTHLY', now);
    expect(o.map(x => x.value)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01']);
    expect(o.at(-1)).toMatchObject({ label: 'November 2026', isNext: true });
    expect(nextPeriod('MONTHLY', now)).toBe('2026-11-01');
  });
  it('quarterly follows 1 Apr, 1 Jul, 1 Oct, 1 Jan', () => {
    expect(periodOptions('QUARTERLY', now).map(x => x.value)).toEqual([
      '2026-04-01',
      '2026-07-01',
      '2026-10-01',
      '2027-01-01',
    ]);
    expect(periodLabel('2026-10-01', 'QUARTERLY')).toBe('Oct 2026 to Dec 2026');
  });
  it('half-yearly and annual are aligned to April and October', () => {
    expect(nextPeriod('HALF_YEARLY', now)).toBe('2027-04-01');
    expect(
      periodOptions('HALF_YEARLY', now)
        .map(x => x.value)
        .slice(-2),
    ).toEqual(['2026-10-01', '2027-04-01']);
    expect(nextPeriod('ANNUAL', now)).toBe('2027-04-01');
  });
  it('a date in January belongs to the financial year that began the April before', () => {
    expect(nextPeriod('MONTHLY', new Date(2027, 0, 5))).toBe('2027-02-01');
    expect(nextPeriod('QUARTERLY', new Date(2027, 0, 5))).toBe('2027-04-01');
  });
});

describe('periods a new run can bill', () => {
  const now = new Date(2026, 10, 4); // 4 Nov 2026
  it('with no regular run: the current period by default, then the next, nothing older', () => {
    const c = runPeriodChoices('MONTHLY', [], now);
    expect(c.defaultValue).toBe('2026-11-01');
    expect(c.billingStart).toBeNull();
    expect(c.options.map(o => [o.value, o.isCurrent, o.isNext])).toEqual([
      ['2026-11-01', true, false],
      ['2026-12-01', false, true],
    ]);
  });
  it('after a first run of November: December by default, never before November', () => {
    const c = runPeriodChoices('MONTHLY', ['2026-11-01'], now);
    expect(c.defaultValue).toBe('2026-12-01');
    expect(c.billingStart).toBe('2026-11-01');
    expect(c.options.map(o => o.value)).toEqual(['2026-11-01', '2026-12-01']);
  });
  it('offers the gaps since the billing start, but not more than 12 months back', () => {
    const c = runPeriodChoices('MONTHLY', ['2025-06-01', '2026-09-01'], now);
    expect(c.options[0].value).toBe('2025-12-01');
    expect(c.options.at(-1)!.value).toBe('2026-12-01');
    expect(c.defaultValue).toBe('2026-10-01');
  });
  it('defaults to the next period when the latest run is the current one or ahead', () => {
    expect(runPeriodChoices('MONTHLY', ['2026-10-01', '2026-11-01'], now).defaultValue).toBe('2026-12-01');
    expect(runPeriodChoices('MONTHLY', ['2026-12-01'], now).defaultValue).toBe('2026-12-01');
  });
  it('quarterly: the current quarter first, then the period after the latest run', () => {
    expect(runPeriodChoices('QUARTERLY', [], now).defaultValue).toBe('2026-10-01');
    const c = runPeriodChoices('QUARTERLY', ['2026-10-01'], now);
    expect(c.options.map(o => o.value)).toEqual(['2026-10-01', '2027-01-01']);
    expect(c.defaultValue).toBe('2027-01-01');
  });
});

describe('bill counts', () => {
  it('counts bills: ready before issue, issued after', () => {
    const c = (ready: number, issued: number) => ({ ready, issued });
    expect(billCount({ status: 'PREVIEW', counts: c(71, 0) })).toBe(71);
    expect(billCount({ status: 'ISSUING', counts: c(41, 30) })).toBe(71);
    expect(billCount({ status: 'ISSUED', counts: c(0, 65) })).toBe(65);
    expect(billsText(1)).toBe('1 bill');
  });
});

describe('money text', () => {
  it('turns typed rupees into integer paise', () => {
    expect(rupeesToPaise('84321')).toBe(8432100);
    expect(rupeesToPaise('1,200.5')).toBe(120050);
    expect(rupeesToPaise('0.07')).toBe(7);
    expect(rupeesToPaise('12.345')).toBeNull();
    expect(rupeesToPaise('-5')).toBeNull();
    expect(rupeesToPaise('')).toBeNull();
  });
  it('formats a change with its sign', () => {
    expect(pctText(1.16)).toBe('+1.2 %');
    expect(pctText(-3)).toBe('-3.0 %');
    expect(pctText(null)).toBe('-');
  });
});

describe('billingRunError details', () => {
  it('shows what the 400 says is wrong, not the generic words', () => {
    const e = new ApiError(400, 'VALIDATION_FAILED', 'raw', [
      { field: 'scopeValues', message: 'Every flat must be an active flat of the society' },
    ]);
    expect(billingRunError(e)).toBe('Every flat must be an active flat of the society');
  });
  it('adds the split rule that has no amount', () => {
    const e = new ApiError(422, 'RUN_SPLIT_INPUT_MISSING', 'raw', [
      { field: 'splitInputs', message: 'Amount missing for split rule 4', billSplitRuleId: 4 },
    ]);
    expect(billingRunError(e)).toContain('Amount missing for split rule 4');
  });
});
