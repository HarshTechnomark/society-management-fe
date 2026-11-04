import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { mapDefaulters, mapInvoice, mapMyDues, mapSummary } from '@/services/billingDuesMappers';
import { defaultersRaw, invoiceDetailRaw, myDuesRaw, summaryRaw } from '@/test/billingDuesFixtures';
import { DUES_TEXT, billingDuesError, friendlyInputs, invoiceStatus, payHref } from './format';

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

  it('adds the field messages of VALIDATION_FAILED (statement range)', () => {
    const e = new ApiError(400, 'VALIDATION_FAILED', 'x', [
      { field: 'to', message: 'The range is at most 366 days' },
    ]);
    expect(billingDuesError(e)).toBe(
      'Some details are not valid. Check the fields and try again. To: The range is at most 366 days.',
    );
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

  it('reads efficiencyPct sent as a string with one decimal', () => {
    expect(mapSummary(summaryRaw()).efficiencyPct).toBe(75);
    expect(mapSummary(summaryRaw({ efficiencyPct: '50.0' })).efficiencyPct).toBe(50);
  });

  it('maps the defaulters: data.items, totals of every page, pagination, billToNames as one text', () => {
    const p = mapDefaulters(defaultersRaw(undefined, { flats: 40, overduePaise: 99 }), {
      page: 2,
      limit: 20,
      total: 40,
      totalPages: 2,
    });
    expect(p.items).toHaveLength(2);
    expect(p.items[1].billToNames).toEqual(['Meera Shah, Ravi Nair']);
    expect(p.totals).toEqual({ flats: 40, overduePaise: 99 });
    expect(p.page).toBe(2);
    expect(p.totalPages).toBe(2);
    expect(mapDefaulters({ items: [{ unitId: 1, billToNames: '' }] }).items[0].billToNames).toEqual([]);
  });

  it('maps the rule version number and date of a computation (resident detail)', () => {
    const c = mapInvoice(invoiceDetailRaw()).lines[0].computation;
    expect(c).toMatchObject({ ruleVersionId: 28, ruleVersionNo: 3, ruleEffectiveFrom: '2026-04-01' });
    expect(mapInvoice(invoiceDetailRaw()).unitId).toBe(312);
  });

  it('maps my dues and a bill with its optional explanation', () => {
    expect(mapMyDues({ units: [{ unitId: 9, relation: 'FORMER' }] })[0].relation).toBe('FORMER');
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
  it('turns computation inputs into plain labels and units, leaving internals out', () => {
    const inputs = (o: Record<string, string>) => Object.entries(o).map(([key, value]) => ({ key, value }));
    expect(
      friendlyInputs(
        inputs({ areaSqft: '800.000', areaMilli: '800000', ratePerSqftPaise: '320', months: '1' }),
      ),
    ).toEqual([
      { label: 'Area', value: '800 sq ft' },
      { label: 'Rate', value: '₹3.20 per sq ft' },
      { label: 'Months', value: '1' },
    ]);
    expect(friendlyInputs(inputs({ amountPaise: '60000', months: '3' }))).toEqual([
      { label: 'Months', value: '3' },
      { label: 'Amount per month', value: '₹600' },
    ]);
    expect(friendlyInputs(inputs({ class: '2BHK', ratePaise: '250000', months: '1' }))).toEqual([
      { label: 'Flat type', value: '2BHK' },
      { label: 'Rate', value: '₹2,500 per month' },
      { label: 'Months', value: '1' },
    ]);
    expect(
      friendlyInputs(inputs({ basePaise: '500000', percent: '18', liableDays: '15', periodDays: '30' })),
    ).toEqual([
      { label: 'Charged on', value: '₹5,000' },
      { label: 'Percent', value: '18%' },
      { label: 'Days charged', value: '15 of 30' },
    ]);
    expect(friendlyInputs(inputs({ sharePaise: '12345', billSplitRuleId: '9', slabs: '[]' }))).toEqual([
      { label: 'Your share', value: '₹123.45' },
    ]);
  });

  it('builds the pay link for module 12', () => {
    expect(payHref(312)).toBe('/pay?unitId=312');
    expect(payHref(312, 5)).toBe('/pay?unitId=312&invoiceId=5');
  });
});
