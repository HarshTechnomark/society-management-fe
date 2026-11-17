import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type { MandateStatus, OrderStatus, RefundMode, RefundStatus } from '@/types/paymentsOps';
import { todayIST } from '@/lib/indiaDate';

/** Words for the section 12 error codes the refund, order, mandate, link and advance routes can return. */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  UNIT_NOT_FOUND: 'This flat was not found. It may be archived.',
  PAYMENT_NOT_FOUND: 'This payment was not found.',
  PAYMENT_ORDER_NOT_FOUND: 'This payment order was not found.',
  REFUND_NOT_FOUND: 'This refund was not found.',
  MANDATE_NOT_FOUND: 'This AutoPay mandate was not found.',
  INVALID_STATE: 'This is not allowed in the current state. Reload the page and try again.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  PAYMENT_NOT_EFFECTIVE: 'This payment is not effective, so it cannot be refunded.',
  REFUND_IN_PROGRESS: 'A refund for this payment is already open. Finish or cancel it first.',
  REFUND_EXCEEDS_REFUNDABLE: 'The amount is more than what can still be refunded for this payment.',
  REFUND_NEEDS_REALLOCATION:
    'The flat advance is not enough. Tick "Free the amount from the bills it paid" and try again.',
  REFUND_MODE_NOT_ALLOWED: 'This refund mode is not allowed for this payment.',
  PERIOD_LOCKED: 'The accounting period of this date is locked.',
  NOTHING_TO_PAY: 'The flat has nothing outstanding, so there is nothing to pay.',
  GATEWAY_NOT_CONFIGURED: 'No payment gateway account is active. Set it up in Settings > Payments.',
  GATEWAY_ERROR: 'The payment gateway did not answer. Try again in a moment.',
  AUTOPAY_NOT_AVAILABLE: 'AutoPay is not available for this society.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};
export const KNOWN_ERROR_CODES = Object.keys(TEXT);

export function opsError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const detail = e.errors?.map(x => x.message).filter(Boolean);
  if (e.code === 'VALIDATION_FAILED' && detail?.length) return detail.join(' ');
  return TEXT[e.code] ?? e.message;
}
/** The same error with its message in plain words, for `ErrorState` (keeps the support reference). */
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, opsError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}
/** The plan or the flag does not offer this (402, or 422 AUTOPAY_NOT_AVAILABLE): a state to show, not an error. */
export const isPlan402 = (e: unknown) =>
  e instanceof ApiError &&
  (e.status === 402 || e.code === 'AUTOPAY_NOT_AVAILABLE' || e.code === 'FEATURE_NOT_IN_PLAN');

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING_APPROVAL: 'Waiting for approval',
  REJECTED: 'Rejected',
  PROCESSING: 'Being paid out',
  PROCESSED: 'Refunded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};
export const REFUND_STATUS_TONE: Record<RefundStatus, Tone> = {
  PENDING_APPROVAL: 'warn',
  REJECTED: 'bad',
  PROCESSING: 'info',
  PROCESSED: 'ok',
  FAILED: 'bad',
  CANCELLED: 'neutral',
};
export const REFUND_MODE_LABEL: Record<RefundMode, string> = {
  GATEWAY: 'Back to the payer (gateway)',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
};
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: 'Waiting for payment',
  ATTEMPTED: 'Attempt failed',
  PAID: 'Paid',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};
export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  CREATED: 'info',
  ATTEMPTED: 'warn',
  PAID: 'ok',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  FAILED: 'bad',
};
export const ORDER_SOURCE_LABEL: Record<string, string> = {
  PAY_LIST: 'Pay list',
  MODULE: 'Other service',
  PAYMENT_LINK: 'Payment link',
  AUTOPAY: 'AutoPay',
};
export const MANDATE_STATUS_LABEL: Record<MandateStatus, string> = {
  PENDING_AUTH: 'Waiting for the payer',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
};
export const MANDATE_STATUS_TONE: Record<MandateStatus, Tone> = {
  PENDING_AUTH: 'warn',
  ACTIVE: 'ok',
  PAUSED: 'info',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  FAILED: 'bad',
};
export const MANDATE_TYPE_LABEL: Record<string, string> = { UPI_AUTOPAY: 'UPI AutoPay', ENACH: 'e-NACH' };
export const ADVANCE_ENTRY_LABEL: Record<string, string> = {
  PAYMENT_EXCESS: 'Excess of a payment',
  OPENING: 'Opening balance',
  OPENING_BALANCE: 'Opening balance',
  APPLIED: 'Used on a bill',
  DEBIT: 'Used on a bill',
  CREDIT: 'Money added',
  ALLOCATION_RELEASED: 'Released from a bill',
  EXCESS_REVERSED: 'Advance reversed',
  REFUND_HOLD: 'Refund held',
  REFUND_RELEASE: 'Refund hold released',
  REFUND_REVERSED: 'Refund not paid, money back',
  REFUND: 'Refunded to you',
  ADJUST_IN: 'Added by the society',
  ADJUST_OUT: 'Taken by the society',
  ADJUSTMENT: 'Adjusted by the society',
};
/** Words for an advance entry code; an unknown code is shown as plain lower-case words, never as the raw code. */
export const advanceEntryLabel = (code: string): string => {
  const known = ADVANCE_ENTRY_LABEL[code];
  if (known) return known;
  const words = code.toLowerCase().replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Entry';
};
/** The server's "Advance from payment #45" repeats the label and shows an internal number: drop or tidy it. */
export const advanceNarration = (text: string | null | undefined): string => {
  const t = (text ?? '').trim();
  if (/^Advance from payment\s+#\d+$/i.test(t)) return '';
  return t.replace(/^Advance from payment\s+/i, 'From receipt ');
};
export const isOpenRefund = (s: RefundStatus) => s === 'PENDING_APPROVAL' || s === 'PROCESSING';
/** Today as YYYY-MM-DD in India time (the society's calendar). */
export const todayIso = () => todayIST();
/** Rupees typed as text ("1,250.50") to paise; null when not a positive amount with at most two decimals. */
export function rupeesToPaise(text: string): number | null {
  const t = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const p = Math.round(Number(t) * 100);
  return p > 0 ? p : null;
}
