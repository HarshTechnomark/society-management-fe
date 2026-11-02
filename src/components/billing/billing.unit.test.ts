import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { mockApi, ok } from '@/test/helpers';
import { platformBillingService } from '@/services/platform-billing.service';
import { billingError, paiseText, rupeesToPaise } from './format';
import { maxTdsPaise, validateTdsClaim, emptyTds } from './TdsClaim';
import { currentFy } from './platform/GstTdsTab';

describe('money helpers', () => {
  it('turns rupees into paise', () => {
    expect(rupeesToPaise('12,671.78')).toBe(1267178);
    expect(rupeesToPaise('0.5')).toBe(50);
    expect(rupeesToPaise('1.234')).toBeNull();
    expect(rupeesToPaise('abc')).toBeNull();
    expect(paiseText(1267178)).toBe('12671.78');
    expect(paiseText(500000)).toBe('5000');
  });
});

describe('TDS rules (BR-06-33)', () => {
  const inv = { subtotalPaise: 13400000, amountDuePaise: 15812000, issueDate: '2026-10-01' };
  it('caps at 10% of taxable value and at the amount due', () => {
    expect(maxTdsPaise(inv)).toBe(1340000);
    expect(maxTdsPaise({ ...inv, amountDuePaise: 1000 })).toBe(1000);
  });
  it('rejects a claim above the cap and builds the body for a valid one', () => {
    expect(validateTdsClaim({ ...emptyTds(), amount: '13401' }, inv).input).toBeNull();
    const ok = validateTdsClaim({ ...emptyTds(), amount: '13400' }, inv);
    expect(ok.input).toMatchObject({ tdsSection: '194J', amountPaise: 1340000 });
  });
});

describe('financial year and errors', () => {
  it('finds the financial year', () => {
    expect(currentFy(new Date('2026-11-02'))).toBe('2026-27');
    expect(currentFy(new Date('2027-02-10'))).toBe('2026-27');
    expect(currentFy(new Date('2027-04-01'))).toBe('2027-28');
  });
  it('writes billing errors in plain words', () => {
    expect(billingError(new ApiError(409, 'MAKER_CHECKER_VIOLATION', 'x'))).toMatch(/another person/);
    expect(billingError(new ApiError(422, 'TDS_EXCEEDS_LIMIT', 'x'))).toMatch(/10%/);
    expect(billingError(new ApiError(500, 'INTERNAL_ERROR', 'x', undefined, 'req_1'))).toContain('req_1');
    expect(billingError(new Error('x'))).toMatch(/Something went wrong/);
  });
});

describe('service list shapes', () => {
  it('accepts data as an array with pagination and as { items }', async () => {
    mockApi({
      'GET /subscription/invoices': ok([{ id: 1 }], 'OK', {
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      'GET /platform/billing/dunning': ok({ items: [{ societyId: 2 }] }),
      'GET /platform/billing/gst-summary': ok({ rows: [{ count: 1 }] }),
    });
    expect((await platformBillingService.invoices()).items).toEqual([{ id: 1 }]);
    expect((await platformBillingService.dunning()).items).toEqual([{ societyId: 2 }]);
    expect(await platformBillingService.gstSummary('2026-10')).toEqual([{ count: 1 }]);
  });
});
