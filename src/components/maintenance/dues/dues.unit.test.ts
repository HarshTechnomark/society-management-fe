import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { mapInvoice, mapMyDues, mapSummary } from '@/services/billingDuesMappers';
import { invoiceDetailRaw, myDuesRaw, summaryRaw } from '@/test/billingDuesFixtures';
import { DUES_TEXT, billingDuesError, inputLabel, invoiceStatus, payHref } from './format';

describe('billingDuesError', () => {
  // One test per section 12 code the dues, reminder and resident bill routes can return.
  it.each(Object.entries(DUES_TEXT))('%s has a plain message', (code, text) => {
    const e = new ApiError(400, code, 'raw server text');
    expect(billingDuesError(e)).toBe(text);
    expect(text).not.toMatch(/^[A-Z_]+$/);
    expect(text.length).toBeGreaterThan(15);
  });

  it('covers every code of the routes', () => {
    for (const c of [
      'VALIDATION_FAILED',
      'FEATURE_NOT_IN_PLAN',
      'PERMISSION_DENIED',
      'INVOICE_NOT_FOUND',
      'UNIT_NOT_FOUND',
      'INVALID_STATE',
      'REMINDER_TOO_SOON',
      'PDF_NOT_READY',
      'IDEMPOTENCY_KEY_REUSED',
      'EXPORT_TOO_LARGE',
      'RATE_LIMITED',
      'SOCIETY_SUSPENDED',
      'SOCIETY_CLOSED',
      'INTERNAL_ERROR',
    ])
      expect(DUES_TEXT[c]).toBeTruthy();
  });

  it('says how long to wait on a rate limit', () => {
    const e = new ApiError(429, 'RATE_LIMITED', 'x', undefined, undefined, 1800);
    expect(billingDuesError(e)).toContain('about 30 minutes');
  });

  it('falls back to the server message for an unknown code', () => {
    expect(billingDuesError(new ApiError(400, 'NEW_CODE', 'Server words'))).toBe('Server words');
  });
});

describe('mappers', () => {
  it('maps the summary and always returns the four ageing buckets in order', () => {
    const s = mapSummary(
      summaryRaw({ efficiencyPct: '75.5', ageing: [{ bucket: '90_PLUS', amountPaise: '10' }] }),
    );
    expect(s.efficiencyPct).toBe(75.5);
    expect(s.ageing.map(a => a.bucket)).toEqual(['0_30', '31_60', '61_90', '90_PLUS']);
    expect(s.ageing[3].amountPaise).toBe(10);
    expect(mapSummary({ efficiencyPct: null }).efficiencyPct).toBeNull();
  });

  it('maps my dues and a bill with its optional explanation', () => {
    expect(mapMyDues(myDuesRaw())[0]).toMatchObject({
      unitId: 312,
      relation: 'OWNER',
      outstandingPaise: 506100,
    });
    const inv = mapInvoice(invoiceDetailRaw());
    expect(inv.billToRelation).toBe('OWNER');
    expect(inv.lines[0].computation?.inputs[0]).toEqual({ key: 'areaSqft', value: '2150.000' });
    expect(inv.lines[1].computation).toBeNull();
    const noExplain = mapInvoice(
      invoiceDetailRaw({ lines: [{ id: 1, lineKind: 'CHARGE', amountPaise: 5 }] }),
    );
    expect(noExplain.lines[0].computation).toBeNull();
  });
});

describe('format', () => {
  it('shows the status in words', () => {
    expect(invoiceStatus({ status: 'ISSUED', isOverdue: true }).label).toBe('Overdue');
    expect(invoiceStatus({ status: 'ISSUED', isOverdue: false }).label).toBe('Due');
    expect(invoiceStatus({ status: 'PARTIALLY_PAID', isOverdue: false }).label).toBe('Part paid');
    expect(invoiceStatus({ status: 'PARTIALLY_PAID', isOverdue: true }).label).toBe('Part paid, overdue');
    expect(invoiceStatus({ status: 'PAID', isOverdue: false }).label).toBe('Paid');
    expect(invoiceStatus({ status: 'CANCELLED', isOverdue: false }).label).toBe('Cancelled');
  });
  it('builds labels and the pay link', () => {
    expect(inputLabel('areaSqft')).toBe('Area sqft');
    expect(inputLabel('ratePerSqftPaise')).toBe('Rate per sqft paise');
    expect(payHref(312)).toBe('/pay?unitId=312');
    expect(payHref(312, 5)).toBe('/pay?unitId=312&invoiceId=5');
  });
});
