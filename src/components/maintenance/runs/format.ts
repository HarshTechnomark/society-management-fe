import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { shortDate } from '@/lib/money';
import type { ItemStatus, RunCycle, RunStatus } from '@/types/billingRuns';

/** Words for every error code the billing run routes can return (spec 8.5 to 8.10 and section 12). */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  RUN_NOT_FOUND: 'This billing run was not found. It may belong to another society.',
  RUN_ITEM_NOT_FOUND: 'This flat is not in the run any more. Reload the page.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed in the current state of the run. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  RUN_PERIOD_EXISTS: 'A billing run for this period already exists. Open it from the list of runs.',
  RUN_STALE:
    'Rates, settings or resident details changed after this run was computed. Recompute the run to see the new amounts.',
  APPROVAL_ALREADY_PENDING: 'This run already waits for approval. Open the approvals page to follow it.',
  RUN_PERIOD_INVALID:
    'This period cannot be billed. Choose a period that matches your billing cycle, is not before your billing start and is not more than 12 months old.',
  RUN_PERIOD_TOO_FAR: 'You can bill at most one period ahead. Choose an earlier period.',
  RUN_SPLIT_INPUT_MISSING: 'Enter the total amount for every split rule that needs one.',
  RUN_CONFIRM_MISMATCH: 'The run number you typed does not match. Type it exactly as shown.',
  RUN_HAS_EXCEPTIONS:
    'Some flats still need attention. Fix the cause and recompute, or exclude those flats, then try again.',
  RUN_EMPTY: 'No flat is ready to be billed. Include at least one flat or recompute the run.',
  GST_SETTINGS_INVALID:
    'A taxed charge head has no SAC code. Add the SAC code in Settings > Billing and recompute.',
  MAKER_CHECKER_VIOLATION: 'A different committee member must approve this run.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};
export const KNOWN_ERROR_CODES = Object.keys(TEXT);

/** The message for an error, in plain words. */
export function billingRunError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  return TEXT[e.code] ?? e.message;
}

/** The same error with its message in plain words, for `ErrorState` (keeps the support reference). */
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, billingRunError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

export const isCode = (e: unknown, code: string) => e instanceof ApiError && e.code === code;

/** Why a compute job failed (`computeError`), in words. */
export const COMPUTE_ERROR_TEXT: Record<string, string> = {
  SPLIT_NO_ELIGIBLE_UNITS:
    'A split rule has no flat to share its total with. Check the scope of the split rule.',
};
export const computeErrorText = (code: string) => COMPUTE_ERROR_TEXT[code] ?? code;

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  DRAFT: 'Queued',
  COMPUTING: 'Computing',
  PREVIEW: 'Ready to review',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  ISSUING: 'Issuing bills',
  ISSUED: 'Issued',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};
export const RUN_STATUS_TONE: Record<RunStatus, Tone> = {
  DRAFT: 'neutral',
  COMPUTING: 'info',
  PREVIEW: 'gold',
  PENDING_APPROVAL: 'warn',
  APPROVED: 'ok',
  ISSUING: 'info',
  ISSUED: 'ok',
  CANCELLED: 'neutral',
  FAILED: 'bad',
};
/** A short mark in front of the words, so the state is clear without colour. */
export const RUN_STATUS_MARK: Record<RunStatus, string> = {
  DRAFT: '○',
  COMPUTING: '◔',
  PREVIEW: '◐',
  PENDING_APPROVAL: '◑',
  APPROVED: '✓',
  ISSUING: '◕',
  ISSUED: '✓',
  CANCELLED: '✕',
  FAILED: '!',
};
export const statusLabel = (s: RunStatus) => RUN_STATUS_LABEL[s] ?? s;

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  READY: 'Ready',
  EXCEPTION: 'Needs attention',
  EXCLUDED: 'Excluded',
  ISSUED: 'Issued',
};
export const ITEM_STATUS_TONE: Record<ItemStatus, Tone> = {
  READY: 'ok',
  EXCEPTION: 'bad',
  EXCLUDED: 'neutral',
  ISSUED: 'info',
};
export const ITEM_STATUS_MARK: Record<ItemStatus, string> = {
  READY: '✓',
  EXCEPTION: '!',
  EXCLUDED: '–',
  ISSUED: '✓',
};

export const EXCEPTION_LABEL: Record<string, string> = {
  MISSING_AREA: 'The flat has no area',
  MISSING_UNIT_TYPE_RATE: 'No rate for this flat type',
  MISSING_READING: 'Meter reading missing',
  NO_BILL_TO: 'No owner or payer to bill',
  ALREADY_BILLED: 'Already billed for this period',
};
export const EXCEPTION_FIX: Record<string, string> = {
  MISSING_AREA: 'Add the area of the flat, then recompute. Or exclude the flat.',
  MISSING_UNIT_TYPE_RATE: 'Add a rate for this flat type in Settings > Billing, then recompute.',
  MISSING_READING: 'Enter the meter reading, then recompute. Or exclude the flat.',
  NO_BILL_TO: 'Record the owner or tenant of the flat, then recompute.',
  ALREADY_BILLED: 'Nothing to do. Exclude the flat from this run.',
};
export const WARNING_LABEL: Record<string, string> = {
  LARGE_VARIANCE: 'Large change from the last bill',
  ESTIMATED_READING: 'Estimated meter reading',
  MINIMUM_CHARGE_APPLIED: 'Minimum charge applied',
  PRORATED: 'Part of the period',
};
export const warningLabel = (c: string) => WARNING_LABEL[c] ?? c;
export const exceptionLabel = (c: string | null) => (c ? (EXCEPTION_LABEL[c] ?? c) : '');

/** Reasons the system gives when it excludes a flat itself. */
export const SYSTEM_EXCLUDE_LABEL: Record<string, string> = {
  ZERO_TOTAL: 'Nothing to bill (total is zero)',
  ALREADY_BILLED: 'Already billed for this period',
  UNIT_ARCHIVED: 'The flat was archived',
};
export const excludeReasonText = (r: string | null) => (r ? (SYSTEM_EXCLUDE_LABEL[r] ?? r) : '');

export const RELATION_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  CO_OWNER: 'Co-owner',
  TENANT: 'Tenant',
};

export const CYCLE_LABEL: Record<RunCycle, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  ANNUAL: 'Annual',
};
const CYCLE_MONTHS: Record<RunCycle, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, ANNUAL: 12 };
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const iso = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, '0')}-01`;

/** "November 2026", "Oct 2026 to Dec 2026" for a period start in the given cycle. */
export function periodLabel(start: string, cycle: RunCycle = 'MONTHLY'): string {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7)) - 1;
  if (!y || m < 0) return start;
  const months = CYCLE_MONTHS[cycle];
  if (months === 1) return `${MONTHS[m]} ${y}`;
  const end = m + months - 1;
  const endY = y + Math.floor(end / 12);
  return `${MONTHS[m].slice(0, 3)} ${y} to ${MONTHS[end % 12].slice(0, 3)} ${endY}`;
}

/**
 * Period starts aligned to the financial year (BR-11-24: 1 April; quarterly 1 Apr/Jul/Oct/Jan; half-yearly 1 Apr
 * and 1 Oct). Returns the periods from `back` before the current one to one after it, newest last. The one after
 * the current period is the default (spec 11.2).
 */
export function periodOptions(cycle: RunCycle, now = new Date(), back = 2) {
  const step = CYCLE_MONTHS[cycle];
  const y = now.getFullYear();
  const m = now.getMonth();
  // Months since April of the financial year that contains `now`.
  const fyStart = m >= 3 ? y : y - 1;
  const sinceApril = (y - fyStart) * 12 + (m - 3);
  const current = Math.floor(sinceApril / step) * step;
  const out: { value: string; label: string; isNext: boolean }[] = [];
  for (let k = -back; k <= 1; k++) {
    const offset = current + k * step;
    const abs = fyStart * 12 + 3 + offset;
    const value = iso(Math.floor(abs / 12), abs % 12);
    out.push({ value, label: periodLabel(value, cycle), isNext: k === 1 });
  }
  return out;
}

export const nextPeriod = (cycle: RunCycle, now = new Date()) =>
  periodOptions(cycle, now).find(o => o.isNext)!.value;

/** "Billing run BR-2026-11 sent for approval" and the like need a short date range. */
export const rangeText = (start: string, end: string) => `${shortDate(start)} to ${shortDate(end)}`;

/** Rupees typed in a field to integer paise; null when it is not a number with at most 2 decimals. */
export function rupeesToPaise(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export const pctText = (p: number | null | undefined) =>
  p === null || p === undefined ? '-' : `${p > 0 ? '+' : ''}${p.toFixed(1)} %`;

/** Statuses in which the run is still being worked on in the background, so the screen polls. */
export const BUSY: RunStatus[] = ['DRAFT', 'COMPUTING', 'ISSUING'];
