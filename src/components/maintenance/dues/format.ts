import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import type { AgeingBucketKey, InvoiceStatus } from '@/types/billingDues';

/** Words for every section 12 error code the dues, defaulter, reminder and resident bill routes can return. */
export const DUES_TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  INVOICE_NOT_FOUND: 'This bill was not found. It may belong to another flat.',
  UNIT_NOT_FOUND:
    'This flat was not found. You can only see the statement of a flat you own. Your bills are in the list of your bills.',
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

/** A number with up to 3 decimals, without trailing zeros: "800.000" becomes "800", "12.5" stays "12.5". */
const plainNumber = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
const numberOf = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The inputs of a line's computation in a resident's words and units (spec 11.10, explain my bill). Internal keys
 * (paise, milli units, rule ids, slab tables) are never shown: each known key becomes a plain label and a value in
 * rupees, square feet, units or days; unknown keys are left out.
 */
export function friendlyInputs(inputs: { key: string; value: string }[]): { label: string; value: string }[] {
  const by = new Map(inputs.map(i => [i.key, i.value]));
  const get = (k: string) => numberOf(by.get(k));
  const out: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null) => {
    if (value !== null) out.push({ label, value });
  };
  const milli = get('areaMilli');
  const area = milli !== null ? milli / 1000 : get('areaSqft');
  add('Area', area === null ? null : `${plainNumber(area)} sq ft`);
  const basis = by.get('areaBasis');
  add(
    'Area type',
    basis ? `${basis.charAt(0)}${basis.slice(1).toLowerCase().replace(/_/g, ' ')} area` : null,
  );
  const perSqft = get('ratePerSqftPaise');
  add('Rate', perSqft === null ? null : `${inr(perSqft)} per sq ft`);
  const flatType = by.get('class');
  add('Flat type', flatType ? flatType : null);
  const perFlat = get('ratePaise');
  add('Rate', perFlat === null ? null : `${inr(perFlat)} per month`);
  const share = get('sharePaise');
  add('Your share', share === null ? null : inr(share));
  const used = get('consumptionMilli');
  add('Units used', used === null ? null : plainNumber(used / 1000));
  const minimum = get('minimumChargePaise');
  add('Minimum charge', minimum === null || minimum === 0 ? null : inr(minimum));
  const base = get('basePaise');
  add('Charged on', base === null ? null : inr(base));
  const percent = get('percent');
  add('Percent', percent === null ? null : `${plainNumber(percent)}%`);
  const liable = get('liableDays');
  const periodDays = get('periodDays');
  add(
    'Days charged',
    liable === null ? null : periodDays === null ? String(liable) : `${liable} of ${periodDays}`,
  );
  const months = get('months');
  add('Months', months === null ? null : plainNumber(months));
  const amount = get('amountPaise');
  add('Amount per month', amount === null ? null : inr(amount));
  return out;
}

/** Link to the module 12 pay route (placeholder until module 12 ships), like the module 09 screens. */
export function payHref(unitId: number, invoiceId?: number): string {
  return `/pay?unitId=${unitId}${invoiceId ? `&invoiceId=${invoiceId}` : ''}`;
}
