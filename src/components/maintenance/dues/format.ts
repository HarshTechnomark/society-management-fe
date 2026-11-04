import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type { AgeingBucketKey, InvoiceStatus } from '@/types/billingDues';

/** Words for every section 12 error code the dues, defaulter, reminder and resident bill routes can return. */
export const DUES_TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  INVOICE_NOT_FOUND: 'This bill was not found. It may belong to another flat.',
  UNIT_NOT_FOUND:
    'This flat was not found. Tenants cannot see the statement of the flat, use the list of your bills.',
  INVALID_STATE: 'This bill is not open any more, so it cannot be reminded. Reload the page.',
  REMINDER_TOO_SOON: 'A reminder for this bill was sent in the last 24 hours. Try again tomorrow.',
  PDF_NOT_READY: 'The PDF of this bill is not ready yet. Try again in a few minutes.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  EXPORT_TOO_LARGE: 'The export is too large. Raise the thresholds to shorten the list.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

const FIELD_LABEL: Record<string, string> = {
  from: 'From',
  to: 'To',
  month: 'Month',
  minDaysOverdue: 'Days overdue',
  minAmountPaise: 'Amount',
  buildingId: 'Building',
};

function waitText(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} seconds`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} minutes`;
  return `${Math.round(seconds / 3600)} hours`;
}

/** The message for an error in plain words (a rate limit says how long to wait when the API tells). */
export function billingDuesError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const base = DUES_TEXT[e.code] ?? e.message;
  if (e.code === 'RATE_LIMITED' && e.retryAfterSeconds)
    return `${base} You can try again in about ${waitText(e.retryAfterSeconds)}.`;
  if (e.code === 'VALIDATION_FAILED') {
    const parts = (e.errors ?? [])
      .filter(f => f.field && f.message)
      .slice(0, 3)
      .map(f => `${FIELD_LABEL[f.field] ?? f.field}: ${f.message}`);
    if (parts.length) return `${base} ${parts.join('. ')}.`;
  }
  return base;
}

/** The same error with its message in plain words, for `ErrorState` (keeps the support reference). */
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, billingDuesError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

export const AGEING_LABEL: Record<AgeingBucketKey, string> = {
  '0_30': '0 to 30 days',
  '31_60': '31 to 60 days',
  '61_90': '61 to 90 days',
  '90_PLUS': 'Over 90 days',
};

/** A bill's status in words: overdue is derived from the due date, never shown by colour alone. */
export function invoiceStatus(i: { status: InvoiceStatus; isOverdue: boolean }): {
  label: string;
  tone: Tone;
} {
  switch (i.status) {
    case 'PAID':
      return { label: 'Paid', tone: 'ok' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'PARTIALLY_PAID':
      return i.isOverdue
        ? { label: 'Part paid, overdue', tone: 'bad' }
        : { label: 'Part paid', tone: 'warn' };
    default:
      return i.isOverdue ? { label: 'Overdue', tone: 'bad' } : { label: 'Due', tone: 'info' };
  }
}

export const LINE_KIND_LABEL: Record<string, string> = {
  CHARGE: 'Charge',
  INTEREST: 'Interest',
  LATE_FEE: 'Late fee',
  CGST: 'CGST',
  SGST: 'SGST',
  ROUND_OFF: 'Round off',
  WRITE_OFF: 'Write-off',
};

/** `YYYY-MM` of today, for the month picker. */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Readable name of an input key of a computation: `areaSqft` becomes "Area sqft". */
export function inputLabel(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Link to the module 12 pay route (placeholder until module 12 ships), like the module 09 screens. */
export function payHref(unitId: number, invoiceId?: number): string {
  return `/pay?unitId=${unitId}${invoiceId ? `&invoiceId=${invoiceId}` : ''}`;
}
