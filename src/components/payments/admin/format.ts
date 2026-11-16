import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import type { PaymentItem, PaymentStatus } from '@/types/payments';

export { rupeesToPaise, paiseText, today } from '@/components/billing/format';
export { downloadBlob } from '@/components/maintenance/ledger/format';

/** Words for the section 12 codes the admin payment routes return. */
export const PAYMENT_TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  UNIT_NOT_FOUND: 'This flat was not found or is archived. Pick another flat.',
  PAYMENT_NOT_FOUND: 'This payment was not found. Reload the page.',
  COLLECTION_REQUEST_NOT_FOUND: 'This flat has no open request in that collection.',
  BANK_ACCOUNT_NOT_FOUND: 'This bank account was not found. Pick another one.',
  INVALID_STATE: 'This is not allowed for the current state of the payment. Reload and try again.',
  STALE_VERSION: 'Someone else changed this payment a moment ago. Reload and try again.',
  MAKER_CHECKER_VIOLATION: 'You recorded this payment, so someone else must do this.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  REQUEST_IN_PROGRESS: 'The same request is still running. Wait a moment.',
  DUPLICATE_REFERENCE: 'A payment with this UTR, UPI reference or cheque is already recorded.',
  DUPLICATE_PAYMENT_SUSPECTED:
    'A payment for this flat with the same method, amount and date is already recorded.',
  RECEIPT_NOT_READY: 'The receipt is not ready yet. Try again in a few minutes.',
  CASH_LIMIT_EXCEEDED:
    'Cash above the legal limit (section 269ST) cannot be accepted. Use a cheque or transfer.',
  AMOUNT_TOO_LARGE: 'This amount is above the maximum for the method.',
  AMOUNT_BELOW_MINIMUM: 'This amount is below the minimum of the collection.',
  AMOUNT_EXCEEDS_DUE: 'This amount is more than the item can take.',
  PAYABLE_NOT_FOUND: 'One of the targets is not an open item of this flat.',
  PAYMENT_DATE_INVALID: 'The payment date cannot be in the future or older than 365 days.',
  CHEQUE_DATE_INVALID:
    'The cheque date is stale, too far ahead, or the deposit date is before the cheque date.',
  CHEQUE_PAYMENTS_BLOCKED: 'Cheques from this flat are blocked after too many bounces.',
  BOUNCE_WINDOW_PASSED: 'This cheque cleared too long ago to be returned.',
  REALLOCATION_INVALID: 'The totals or limits of the new allocation are wrong. The total must stay the same.',
  BUSINESS_RULE_FAILED: 'This is not allowed. Online payments can only be reversed after a lost chargeback.',
  PERIOD_LOCKED: 'This date is in a locked accounting period.',
  EXPORT_TOO_LARGE: 'The export has more than 50,000 rows. Narrow the filters.',
  FILE_NOT_LINKABLE: 'The proof file cannot be attached. Upload it again.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

export function paymentError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const base = PAYMENT_TEXT[e.code] ?? e.message;
  if (e.code === 'VALIDATION_FAILED') {
    const parts = (e.errors ?? [])
      .filter(f => f.field && f.message)
      .slice(0, 3)
      .map(f => `${f.field}: ${f.message}`);
    if (parts.length) return `${base} ${parts.join('. ')}.`;
  }
  return base;
}

/** The same error with plain words, for `ErrorState` (keeps the support reference). */
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, paymentError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

export const METHOD_LABEL: Record<string, string> = {
  UPI: 'UPI',
  CARD: 'Card',
  NETBANKING: 'Netbanking',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  NEFT: 'NEFT',
  IMPS: 'IMPS',
  RTGS: 'RTGS',
  UPI_TO_BANK: 'UPI to society QR',
};
export const methodLabel = (m: string) => METHOD_LABEL[m] ?? m;

const STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'warn' },
  CONFIRMED: { label: 'Received', tone: 'ok' },
  CAPTURED: { label: 'Received', tone: 'ok' },
  RECEIVED: { label: 'Cheque received', tone: 'info' },
  DEPOSITED: { label: 'Deposited', tone: 'info' },
  CLEARED: { label: 'Cleared', tone: 'ok' },
  BOUNCED: { label: 'Bounced', tone: 'bad' },
  RETURNED: { label: 'Returned', tone: 'neutral' },
  REVERSED: { label: 'Reversed', tone: 'bad' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
  FAILED: { label: 'Failed', tone: 'bad' },
};
export const statusInfo = (s: string) => STATUS[s as PaymentStatus] ?? { label: s, tone: 'neutral' as Tone };

/** Method filter of the Payments tab (the API takes a comma list of methods, or the cheque shortcut). */
export const METHOD_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'UPI', label: 'UPI' },
  { key: 'CASH', label: 'Cash' },
  { key: 'CHEQUE', label: 'Cheque' },
  { key: 'NEFT', label: 'NEFT' },
  { key: 'NETBANKING', label: 'Netbanking' },
  { key: 'CHEQUES_PENDING', label: 'Cheques pending' },
] as const;
export type MethodFilter = (typeof METHOD_FILTERS)[number]['key'];

/** Status chips (prototype update list). `REVIEW` is the needs-review flag, not a status. */
export const STATUS_FILTERS = [
  { key: 'ANY', label: 'Any status' },
  { key: 'PENDING_APPROVAL', label: 'Pending approval' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'RETURNED', label: 'Returned' },
  { key: 'REVERSED', label: 'Reversed' },
  { key: 'REVIEW', label: 'Needs review' },
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];

/** "Received" covers every state in which the money is in: online, confirmed, cheque in hand, deposited, cleared. */
export const RECEIVED_STATUSES = 'CAPTURED,CONFIRMED,RECEIVED,DEPOSITED,CLEARED';

export const EFFECTIVE = ['CAPTURED', 'CONFIRMED', 'CLEARED'];
export const isEffective = (p: Pick<PaymentItem, 'status'>) => EFFECTIVE.includes(p.status);

/** The audit action of a timeline entry (`payments.payment.recorded`) as words ("Payment recorded"). */
export function eventLabel(action: string): string {
  if (!action.includes('.')) return action;
  const [, ...rest] = action.split('.');
  const words = rest.join(' ').replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action;
}

const LANDS_IN_LABEL: Record<string, string> = {
  BANK: 'Bank',
  CASH_IN_HAND: 'Cash in hand',
  CHEQUES_IN_CLEARING: 'Cheques in clearing',
  GATEWAY_CLEARING: 'Reaching bank',
};

/** Where the money lands (spec 11.1): the `landsIn` account of the detail when it is there, else worked out from the method. */
export function landsIn(p: Pick<PaymentItem, 'status' | 'method'> & { landsIn?: string | null }): string {
  if (
    p.landsIn &&
    LANDS_IN_LABEL[p.landsIn] &&
    !['PENDING_APPROVAL', 'REJECTED', 'FAILED', 'REVERSED', 'BOUNCED', 'RETURNED'].includes(p.status)
  )
    return LANDS_IN_LABEL[p.landsIn];
  if (['PENDING_APPROVAL', 'REJECTED', 'FAILED', 'REVERSED', 'BOUNCED', 'RETURNED'].includes(p.status))
    return '-';
  if (p.method === 'CASH') return 'Cash in hand';
  if (p.method === 'CHEQUE') return p.status === 'CLEARED' ? 'Bank' : 'Cheques in clearing';
  if (p.status === 'CAPTURED' && ['UPI', 'CARD', 'NETBANKING'].includes(p.method)) return 'Reaching bank';
  return 'Bank';
}

export const WHAT_LABEL: Record<string, string> = {
  maintenance: 'maintenance',
  contribution: 'contribution',
  mixed: 'maintenance and contribution',
  advance: 'advance',
};

/** What a payment paid for, in words. */
export function paidFor(p: Pick<PaymentItem, 'toInvoicesPaise' | 'toCollectionsPaise' | 'toAdvancePaise'>) {
  const parts: string[] = [];
  if (p.toInvoicesPaise) parts.push(`Maintenance ${inr(p.toInvoicesPaise)}`);
  if (p.toCollectionsPaise) parts.push(`Collection ${inr(p.toCollectionsPaise)}`);
  if (p.toAdvancePaise) parts.push(`Advance ${inr(p.toAdvancePaise)}`);
  return parts.join(' + ') || '-';
}

export const isoDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
