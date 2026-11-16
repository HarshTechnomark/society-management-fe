import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type {
  AmountMode,
  CollectionFilter,
  CollectionKind,
  CollectionStatus,
  PayListVisibility,
  RequestStatus,
} from '@/types/collections';

export { downloadBlob } from '@/components/maintenance/ledger/format';
export { addDaysIso, todayIso } from '@/components/maintenance/invoices/format';

/** Words for every error code the collection routes can return (spec 8.11, 8.21 to 8.23 and section 12). */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  COLLECTION_NOT_FOUND: 'This collection was not found. It may belong to another society.',
  COLLECTION_REQUEST_NOT_FOUND: 'This flat has no open request in the collection. Reload the page.',
  FUND_NOT_FOUND: 'This fund was not found or is not active. Choose another fund.',
  UNIT_NOT_FOUND: 'This flat was not found.',
  COLLECTION_TITLE_EXISTS: 'A collection with this title already exists. Choose another title.',
  COLLECTION_HAS_PAYMENTS:
    'Money was already collected, or the collection is mandatory and live, so it cannot be cancelled. Close it instead.',
  MANDATORY_MUST_BE_FIXED: 'A mandatory collection must be a fixed amount per flat.',
  COLLECTION_DUE_DATE_PAST: 'The due date is in the past. Choose a date from today.',
  COLLECTION_NO_AUDIENCE: 'No flat will be asked to pay. Change who pays.',
  REMINDER_LIMIT_REACHED: 'The most reminders allowed for this collection were already sent.',
  REMINDER_TOO_SOON: 'A reminder went out less than 24 hours ago. Try again later.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed in the current state of the collection. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  REQUEST_IN_PROGRESS: 'The same request is still running. Wait a moment.',
  APPROVAL_ALREADY_PENDING: 'This collection already waits for approval.',
  MAKER_CHECKER_VIOLATION: 'A different committee member must approve this collection.',
  DUPLICATE_REFERENCE: 'A payment with this reference number is already recorded.',
  DUPLICATE_PAYMENT_SUSPECTED: 'A payment of this amount was just recorded for this flat.',
  CASH_LIMIT_EXCEEDED: 'This is above the cash limit. Use another method.',
  AMOUNT_TOO_LARGE: 'This amount is above the maximum for the method.',
  AMOUNT_BELOW_MINIMUM: 'This amount is below the minimum of the collection.',
  CHEQUE_DATE_INVALID: 'The cheque date is not valid.',
  CHEQUE_PAYMENTS_BLOCKED: 'Cheques are not accepted right now. Choose another method.',
  PAYMENT_DATE_INVALID: 'The payment date cannot be in the future or older than 365 days.',
  PERIOD_LOCKED: 'This date falls in a locked accounting period.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};
export const KNOWN_ERROR_CODES = Object.keys(TEXT);

export function collectionError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const detail = e.errors?.map(x => x.message).filter(Boolean);
  if (e.code === 'VALIDATION_FAILED' && detail?.length) return detail.join(' ');
  return TEXT[e.code] ?? e.message;
}

export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, collectionError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

export const KIND_LABEL: Record<CollectionKind, string> = {
  FESTIVAL: 'Festival',
  EVENT: 'Event',
  REPAIR_CALL: 'Repair fund call',
  DONATION: 'Donation',
  OTHER: 'Other',
};
export const MODE_LABEL: Record<AmountMode, string> = {
  FIXED_PER_UNIT: 'Fixed amount per flat',
  MIN_PER_UNIT: 'Suggested amount with a minimum',
  VOLUNTARY: 'Voluntary any amount',
};
export const VISIBILITY_LABEL: Record<PayListVisibility, string> = {
  HIDDEN: 'Hide who paid (residents see only the total)',
  COUNT_ONLY: 'Show the total and the number of flats',
  FLATS_ONLY: 'Show the flats that paid',
  FLATS_AND_AMOUNTS: 'Show the flats and their amounts',
};
export const STATUS_LABEL: Record<CollectionStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Awaiting approval',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved, not yet live',
  REJECTED: 'Rejected',
  PUBLISHED: 'Live',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
export const STATUS_TONE: Record<CollectionStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warn',
  CHANGES_REQUESTED: 'warn',
  APPROVED: 'info',
  REJECTED: 'bad',
  PUBLISHED: 'ok',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};
export const REQUEST_LABEL = (s: RequestStatus): string =>
  ({
    PAID: 'Paid',
    PART_PAID: 'Part paid',
    OPEN: 'Not paid yet',
    WAIVED: 'Waived',
    CANCELLED: 'Cancelled',
  })[s];
export const REQUEST_TONE: Record<RequestStatus, Tone> = {
  PAID: 'ok',
  PART_PAID: 'warn',
  OPEN: 'info',
  WAIVED: 'neutral',
  CANCELLED: 'neutral',
};

export const FILTERS: { key: CollectionFilter; label: string; status?: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'LIVE', label: 'Live', status: 'PUBLISHED' },
  { key: 'AWAITING', label: 'Awaiting approval', status: 'PENDING_APPROVAL,CHANGES_REQUESTED,APPROVED' },
  { key: 'DRAFTS', label: 'Drafts', status: 'DRAFT,REJECTED' },
  { key: 'CLOSED', label: 'Closed', status: 'CLOSED' },
  { key: 'CANCELLED', label: 'Cancelled', status: 'CANCELLED' },
];

export const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** "1200", "1,200" or "1200.50" in rupees to paise; null when it is not an amount. */
export function rupeesToPaise(text: string): number | null {
  const t = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
export const paiseToRupees = (p: number): string => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

export const maxReminders = (mandatory: boolean) => (mandatory ? 10 : 2);
export const EDITABLE: CollectionStatus[] = ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'];
