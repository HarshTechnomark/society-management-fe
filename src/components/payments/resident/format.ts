import { ApiError } from '@/lib/apiClient';

/** Words for the section 12 codes the resident payment routes can return. */
export const PAY_TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  FEATURE_NOT_IN_PLAN: 'This is not part of your society’s plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  UNIT_NOT_FOUND: 'This flat was not found among your flats.',
  PAYABLE_NOT_FOUND: 'One of the items is not open any more. Reload the list and choose again.',
  PAYMENT_NOT_FOUND: 'This payment was not found.',
  PAYMENT_ORDER_NOT_FOUND: 'This payment was not found.',
  COLLECTION_NOT_FOUND: 'This collection was not found.',
  MANDATE_NOT_FOUND: 'This AutoPay was not found.',
  PAYABLE_CHANGED: 'Your dues changed while you were choosing. The list is reloaded; check it and pay again.',
  PAYMENT_IN_PROGRESS: 'A payment for this flat is already in progress. Wait for it to finish or cancel it.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  REQUEST_IN_PROGRESS: 'This request is still running. Wait a moment.',
  INVALID_STATE: 'This cannot be done in its current state. Reload the page.',
  STALE_VERSION: 'This changed in the meantime. Reload the page and try again.',
  NOTHING_TO_PAY: 'Choose at least one item to pay.',
  AMOUNT_BELOW_MINIMUM: 'One amount is below the smallest amount allowed.',
  AMOUNT_EXCEEDS_DUE: 'One amount is more than what is due.',
  AMOUNT_TOO_LARGE: 'This amount is too large for one payment. Split it into smaller payments.',
  PARTIAL_NOT_ALLOWED: 'Your society does not accept part payments. Pay the full amount of each bill.',
  ADVANCE_NOT_ALLOWED: 'Your society does not accept money in advance. Pay only what is due.',
  GATEWAY_NOT_CONFIGURED: 'Online payment is not set up for your society yet. Use "Pay offline".',
  METHOD_NOT_ENABLED: 'This payment method is not available. Choose another one.',
  PAYMENT_MISMATCH: 'This payment belongs to another order. Nothing was added to your account.',
  PAYMENT_DATE_INVALID: 'The date must not be in the future or older than a year.',
  DUPLICATE_REFERENCE: 'This reference number was already recorded.',
  DUPLICATE_PAYMENT_SUSPECTED:
    'A payment with the same flat, method, amount and date is already waiting. Check the list of payments.',
  FILE_NOT_LINKABLE: 'The proof file could not be used. Upload it again.',
  RECEIPT_NOT_READY: 'The receipt is not ready yet. Try again in a few minutes.',
  MANDATE_EXISTS: 'This flat already has an AutoPay. Cancel it first to set up a new one.',
  MANDATE_LIMIT_EXCEEDED: 'The cap is outside the limits allowed. Change the amount.',
  AUTOPAY_NOT_AVAILABLE: 'AutoPay is not available for your society.',
  PAYMENT_LINK_NOT_FOUND: 'This payment link is not valid. Ask the society for a new link.',
  PAYMENT_LINK_EXPIRED: 'This payment link has expired. Ask the society for a new link.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  GATEWAY_ERROR: 'The payment service did not answer. You were not charged; try again in a moment.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

export function payError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  return PAY_TEXT[e.code] ?? e.message;
}

/** The same error with its message in plain words, for `ErrorState` (keeps the support reference). */
export function plainPayError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, payError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

/** Rupees typed by a person ("1,200.50") to paise; null when it is not an amount. */
export function rupeesToPaise(text: string): number | null {
  const t = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Paise to the text of an input: "120000" becomes "1200", "120050" becomes "1200.50". */
export function paiseToText(paise: number): string {
  const r = paise / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export const METHOD_LABEL: Record<string, string> = {
  UPI: 'UPI',
  CARD: 'Card',
  NETBANKING: 'Net banking',
  WALLET: 'Wallet',
  NEFT: 'NEFT',
  IMPS: 'IMPS',
  RTGS: 'RTGS',
  UPI_TO_BANK: 'UPI to bank',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  ONLINE: 'Online',
};

/** Fee in paise for a base amount at `bps` basis points (GST is added by the server and shown as "plus GST"). */
export const feeFor = (basePaise: number, bps: number) => Math.round((basePaise * bps) / 10000);

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  CAPTURED: 'Received',
  PENDING_APPROVAL: 'Waiting for approval',
  PENDING: 'Waiting',
  REVERSED: 'Reversed',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Part refunded',
  BOUNCED: 'Bounced',
};

/** `/resident/pay` link for a flat, optionally with one bill or one collection request ticked. */
export function payLink(
  unitId?: number | null,
  invoiceId?: number | null,
  requestId?: number | null,
): string {
  const q = new URLSearchParams();
  if (unitId) q.set('unitId', String(unitId));
  if (invoiceId) q.set('invoiceId', String(invoiceId));
  if (requestId) q.set('requestId', String(requestId));
  const s = q.toString();
  return `/resident/pay${s ? `?${s}` : ''}`;
}
