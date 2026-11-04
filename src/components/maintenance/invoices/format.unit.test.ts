import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import {
  KNOWN_ERROR_CODES,
  billingInvoiceError,
  creditLimits,
  estimateCreditTax,
  plainError,
  canCancel,
  canWriteOff,
} from './format';

const SECTION_12_INVOICE_CODES = [
  'VALIDATION_FAILED',
  'REAUTH_REQUIRED',
  'FEATURE_NOT_IN_PLAN',
  'PERMISSION_DENIED',
  'CHARGE_HEAD_NOT_FOUND',
  'INVOICE_NOT_FOUND',
  'NOTE_NOT_FOUND',
  'UNIT_NOT_FOUND',
  'STALE_VERSION',
  'INVALID_STATE',
  'IDEMPOTENCY_KEY_REUSED',
  'CREDIT_NOTE_PENDING',
  'INVOICE_CANCEL_PENDING',
  'APPROVAL_ALREADY_PENDING',
  'REMINDER_TOO_SOON',
  'PDF_NOT_READY',
  'CREDIT_EXCEEDS_LINE',
  'WRITE_OFF_EXCEEDS_OUTSTANDING',
  'CHARGE_HEAD_NOT_ALLOWED',
  'CHARGE_HEAD_ARCHIVED',
  'NO_BILL_TO',
  'MIXED_BILL_TO',
  'GST_SETTINGS_INVALID',
  'PERIOD_LOCKED',
  'FUND_NOT_RESOLVED',
  'EXPORT_TOO_LARGE',
  'SOCIETY_SUSPENDED',
  'SOCIETY_CLOSED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
];

describe('billingInvoiceError: one plain message per code', () => {
  it.each(SECTION_12_INVOICE_CODES)('%s has its own words, not the raw server text', code => {
    const text = billingInvoiceError(new ApiError(400, code, 'raw server text'));
    expect(text).not.toBe('raw server text');
    expect(text.length).toBeGreaterThan(15);
    expect(text).not.toContain(code);
    expect(KNOWN_ERROR_CODES).toContain(code);
  });

  it('falls back for unknown codes and plain errors', () => {
    expect(billingInvoiceError(new ApiError(500, 'WEIRD', 'Weird thing'))).toBe('Weird thing');
    expect(billingInvoiceError(new Error('boom'))).toBe('boom');
    expect(billingInvoiceError('x')).toBe('Something went wrong. Try again.');
  });

  it('keeps the support reference for ErrorState', () => {
    const e = plainError(new ApiError(404, 'INVOICE_NOT_FOUND', 'raw', undefined, 'req_9')) as ApiError;
    expect(e.requestId).toBe('req_9');
    expect(e.message).toMatch(/not found/);
  });
});

describe('credit helpers', () => {
  it('reads the maximum per line from CREDIT_EXCEEDS_LINE: lines[i] is the i-th line sent', () => {
    const e = new ApiError(422, 'CREDIT_EXCEEDS_LINE', 'x', [
      { field: 'lines[1].amountPaise', message: 'too much', maxAllowedPaise: 5000 },
      { field: 'lines[0].amountPaise', message: 'too much', maxAllowedPaise: 0 },
    ]);
    expect(creditLimits(e, [90122, 90121])).toEqual({ 90121: 5000, 90122: 0 });
    expect(creditLimits(e, [])).toEqual({});
    expect(creditLimits(new Error('x'), [1])).toEqual({});
  });

  it('gives the whole-bill cap of CREDIT_EXCEEDS_LINE and WRITE_OFF_EXCEEDS_OUTSTANDING in words', () => {
    const whole = new ApiError(422, 'CREDIT_EXCEEDS_LINE', 'x', [
      { field: 'lines', message: 'More than the invoice still owes', maxAllowedPaise: 120000 },
    ]);
    expect(billingInvoiceError(whole)).toMatch(/At most ₹1,200 in all\.$/);
    expect(creditLimits(whole, [90121])).toEqual({});
    const w = new ApiError(422, 'WRITE_OFF_EXCEEDS_OUTSTANDING', 'x', [
      { field: 'amountPaise', message: 'More than the outstanding amount', maxAllowedPaise: 50000 },
    ]);
    expect(billingInvoiceError(w)).toMatch(/At most ₹500 in all\.$/);
  });
});

describe('billingInvoiceError: errors[] details', () => {
  it('lists the field messages of VALIDATION_FAILED with readable names', () => {
    const e = new ApiError(400, 'VALIDATION_FAILED', 'x', [
      { field: 'dueDate', message: 'Today up to one year ahead' },
      { field: 'lines[1].amountPaise', message: 'Too big' },
      { field: 'lines[0].invoiceLineId', message: 'This line cannot be credited' },
      { field: 'remarks', message: 'Too short' },
    ]);
    expect(billingInvoiceError(e)).toBe(
      'Some details are not valid. Check the fields and try again. Due date: Today up to one year ahead. ' +
        'Line 2, amount: Too big. Line 1: This line cannot be credited.',
    );
  });

  it('names the line of a charge head error', () => {
    const e = new ApiError(422, 'CHARGE_HEAD_ARCHIVED', 'x', [
      { field: 'lines[2].chargeHeadId', message: 'Archived' },
    ]);
    expect(billingInvoiceError(e)).toMatch(/Line 3, charge head: Archived\.$/);
  });

  it('says when a failed PDF is tried again', () => {
    const e = new ApiError(409, 'PDF_NOT_READY', 'x', [
      { field: 'pdf', message: 'Rendering failed', retryAt: '2026-11-04T10:30:00.000Z' },
    ]);
    expect(billingInvoiceError(e)).toMatch(/tried again after/);
    expect(billingInvoiceError(new ApiError(409, 'PDF_NOT_READY', 'x'))).not.toMatch(/tried again/);
  });

  it('estimates GST on the taxable part only', () => {
    const d = { gstApplied: true, taxableValuePaise: 823000, cgstPaise: 74070 };
    expect(estimateCreditTax(d, 823000)).toBe(148140);
    expect(estimateCreditTax(d, 0)).toBe(0);
    expect(estimateCreditTax({ ...d, gstApplied: false }, 1000)).toBe(0);
  });

  it('allows cancel only on unpaid bills and write-off only with money due', () => {
    expect(canCancel({ status: 'ISSUED' })).toBe(true);
    expect(canCancel({ status: 'PARTIALLY_PAID' })).toBe(false);
    expect(canWriteOff({ status: 'PARTIALLY_PAID', outstandingPaise: 5 })).toBe(true);
    expect(canWriteOff({ status: 'PAID', outstandingPaise: 0 })).toBe(false);
    expect(canWriteOff({ status: 'CANCELLED', outstandingPaise: 0 })).toBe(false);
  });
});
