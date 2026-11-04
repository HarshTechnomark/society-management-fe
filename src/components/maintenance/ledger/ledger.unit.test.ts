import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import {
  LEDGER_TEXT,
  balanceText,
  daysBetween,
  duesView,
  financialYearStart,
  ledgerError,
  rupeesToPaise,
} from './format';

const CODES = [
  'VALIDATION_FAILED',
  'REAUTH_REQUIRED',
  'FEATURE_NOT_IN_PLAN',
  'PERMISSION_DENIED',
  'OPENING_BALANCE_NOT_FOUND',
  'UNIT_NOT_FOUND',
  'STALE_VERSION',
  'INVALID_STATE',
  'IDEMPOTENCY_KEY_REUSED',
  'OPENING_BALANCE_EXISTS',
  'IMPORT_FILE_INVALID',
  'IMPORT_TOO_MANY_ROWS',
  'OPENING_BALANCE_DATE_INVALID',
  'OPENING_BALANCE_HAS_INVALID_ROWS',
  'OPENING_BALANCE_TOTAL_MISMATCH',
  'OPENING_BALANCE_HAS_PAYMENTS',
  'OPENING_ADVANCE_NOT_REVERSIBLE',
  'LEDGER_ENTRY_CONFLICT',
  'LEDGER_ENTRY_INVALID',
  'PERIOD_LOCKED',
  'EXPORT_TOO_LARGE',
  'RATE_LIMITED',
  'SOCIETY_SUSPENDED',
  'SOCIETY_CLOSED',
  'INTERNAL_ERROR',
];

describe('ledgerError', () => {
  it.each(CODES)('has a clear message for %s', code => {
    const e = new ApiError(422, code, 'server words');
    expect(ledgerError(e)).toBe(LEDGER_TEXT[code]);
    expect(ledgerError(e)).not.toBe('server words');
    expect(ledgerError(e).length).toBeGreaterThan(15);
  });
  it('falls back to the server message and handles plain errors', () => {
    expect(ledgerError(new ApiError(400, 'OTHER', 'hello'))).toBe('hello');
    expect(ledgerError(new Error('x'))).toBe('x');
    expect(ledgerError('?')).toBe('Something went wrong. Try again.');
  });
});

describe('format helpers', () => {
  it('parses typed rupees exactly', () => {
    expect(rupeesToPaise('12,850.50')).toBe(1285050);
    expect(rupeesToPaise('₹100')).toBe(10000);
    expect(rupeesToPaise('-1,000.5')).toBe(-100050);
    expect(rupeesToPaise('1.234')).toBeNull();
    expect(rupeesToPaise('abc')).toBeNull();
    expect(rupeesToPaise('')).toBeNull();
  });
  it('words balances and dues', () => {
    expect(balanceText(120000)).toBe('₹1,200 due');
    expect(balanceText(-50000)).toBe('₹500 advance');
    expect(balanceText(0)).toBe('Nil');
    expect(duesView(482500)).toEqual({ label: '₹4,825', tone: 'due' });
    expect(duesView(-50000)).toEqual({ label: 'Advance ₹500', tone: 'advance' });
    expect(duesView(0)).toEqual({ label: 'Paid up', tone: 'clear' });
  });
  it('finds the financial year start and day spans', () => {
    expect(financialYearStart(new Date(2026, 10, 4))).toBe('2026-04-01');
    expect(financialYearStart(new Date(2026, 1, 4))).toBe('2025-04-01');
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
  });
});
