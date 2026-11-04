import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import type { OpeningStatus } from '@/types/ledger';

/** Words for every section 12 error code the ledger, statement and opening balance routes can return. */
export const LEDGER_TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  OPENING_BALANCE_NOT_FOUND: 'This opening balance row no longer exists. Reload the list.',
  UNIT_NOT_FOUND: 'This flat no longer exists or is archived.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed in the current state. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  OPENING_BALANCE_INVALID: 'This opening balance row cannot be posted.',
  NO_BILL_TO: 'A flat has no owner or tenant to bill. Add the resident first.',
  INVOICE_CANCEL_PENDING: 'A cancellation request is open on this arrears invoice. Finish it first.',
  INVOICE_NOT_FOUND: 'The arrears invoice was not found. Reload the list.',
  OPENING_BALANCE_EXISTS: 'This flat already has a posted opening balance. Reverse it first.',
  IMPORT_FILE_INVALID: 'The file could not be read, or a column heading is missing. Use the template.',
  IMPORT_TOO_MANY_ROWS: 'The file has more than 5,000 rows. Split it and import in parts.',
  OPENING_BALANCE_DATE_INVALID:
    'This as-of date is not allowed. It cannot be in the future, and once billing has started it must be the day before the billing start.',
  OPENING_BALANCE_HAS_INVALID_ROWS:
    'Rows with errors remain. Fix the file and upload it again, or delete them.',
  OPENING_BALANCE_TOTAL_MISMATCH:
    'The total you typed does not match the draft rows. Check it and try again.',
  OPENING_BALANCE_HAS_PAYMENTS:
    'This arrears invoice already has a payment or credit note, so it cannot be reversed.',
  OPENING_ADVANCE_NOT_REVERSIBLE:
    'An opening advance cannot be reversed. Correct it with an ad-hoc invoice or a refund.',
  LEDGER_ENTRY_CONFLICT: 'The ledger already holds this entry with different amounts. Contact support.',
  LEDGER_ENTRY_INVALID: 'A ledger entry was not valid. Nothing was saved. Contact support.',
  PERIOD_LOCKED: 'The books are locked for this date. Ask the treasurer to unlock the period.',
  EXPORT_TOO_LARGE: 'The export is too large. Choose a shorter period.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'Your society’s account is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

/** The message for an error in plain words. */
export function ledgerError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const text = LEDGER_TEXT[e.code] ?? e.message;
  // these codes name the flat or the file problem in errors[]
  const detail = DETAIL_CODES.includes(e.code) ? e.errors?.[0]?.message : undefined;
  return detail && !text.includes(detail) ? `${text} ${detail}.`.replace(/\.\.$/, '.') : text;
}
const DETAIL_CODES = ['IMPORT_FILE_INVALID', 'NO_BILL_TO', 'OPENING_BALANCE_INVALID', 'PERIOD_LOCKED'];

export const OPENING_LABEL: Record<OpeningStatus, string> = {
  DRAFT: 'Draft',
  INVALID: 'Invalid',
  POSTED: 'Posted',
  REVERSED: 'Reversed',
};
export const OPENING_TONE: Record<OpeningStatus, Tone> = {
  DRAFT: 'info',
  INVALID: 'bad',
  POSTED: 'ok',
  REVERSED: 'neutral',
};

export const ENTRY_LABEL: Record<string, string> = {
  OPENING_BALANCE: 'Opening balance',
  INVOICE: 'Bill',
  DEBIT_NOTE: 'Debit note',
  CREDIT_NOTE: 'Credit note',
  PAYMENT: 'Receipt',
  PAYMENT_REVERSAL: 'Receipt reversal',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
};

/** Rupees typed by a person (`1,234.50`) to paise, with no floating point. Null when not a valid amount. */
export function rupeesToPaise(text: string): number | null {
  const t = text.trim().replace(/,/g, '').replace(/^₹/, '');
  const m = /^(-?)(\d{1,9})(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const paise = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0') || '0');
  return m[1] ? -paise : paise;
}

/** A balance in words, never by colour alone: "₹1,200 due", "₹500 advance", "Nil". */
export function balanceText(paise: number): string {
  if (paise > 0) return `${inr(paise)} due`;
  if (paise < 0) return `${inr(-paise)} advance`;
  return 'Nil';
}

/** What a flat owes (`duesPaise` of module 09): positive is dues, negative an advance, zero paid up. */
export function duesView(paise: number): { label: string; tone: 'due' | 'advance' | 'clear' } {
  if (paise > 0) return { label: inr(paise), tone: 'due' };
  if (paise < 0) return { label: `Advance ${inr(-paise)}`, tone: 'advance' };
  return { label: 'Paid up', tone: 'clear' };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** First day of the current Indian financial year (1 April). */
export function financialYearStart(now = new Date()): string {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-04-01`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
