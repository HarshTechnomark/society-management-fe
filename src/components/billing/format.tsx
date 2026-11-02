import { ApiError } from '@/lib/apiClient';
import { Chip, type Tone } from '@/components/ui/Chip';

const INVOICE_TONE: Record<string, [string, Tone]> = {
  DRAFT: ['Draft', 'neutral'],
  ISSUED: ['Issued', 'info'],
  PARTIALLY_PAID: ['Partly paid', 'warn'],
  PAID: ['Paid', 'ok'],
  OVERDUE: ['Overdue', 'bad'],
  VOID: ['Void', 'neutral'],
  WRITTEN_OFF: ['Written off', 'neutral'],
  REJECTED: ['Rejected', 'bad'],
};
const PAYMENT_TONE: Record<string, [string, Tone]> = {
  CREATED: ['Started', 'neutral'],
  PENDING_APPROVAL: ['Waiting for approval', 'warn'],
  CAPTURED: ['Received', 'ok'],
  FAILED: ['Failed', 'bad'],
  REJECTED: ['Rejected', 'bad'],
  CLAIMED: ['Claimed', 'warn'],
  VERIFIED: ['Verified', 'ok'],
  PROCESSING: ['Processing', 'info'],
  REFUNDED: ['Refunded', 'ok'],
  POSTED: ['Posted', 'ok'],
  PENDING: ['Pending', 'warn'],
};
const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function InvoiceStatusChip({ status }: { status: string }) {
  const [label, tone] = INVOICE_TONE[status] ?? [words(status), 'neutral' as Tone];
  return <Chip tone={tone}>{label}</Chip>;
}
export function PaymentStatusChip({ status }: { status: string }) {
  const [label, tone] = PAYMENT_TONE[status] ?? [words(status), 'neutral' as Tone];
  return <Chip tone={tone}>{label}</Chip>;
}

export const periodText = (start: string | null, end: string | null) =>
  start && end ? `${fmt(start)} to ${fmt(end)}` : '-';
function fmt(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const METHOD_LABEL: Record<string, string> = {
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  IMPS: 'IMPS',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  DD: 'Demand draft',
  CARD: 'Card',
  NETBANKING: 'Net banking',
  TDS: 'TDS',
  GATEWAY_REFUND: 'Gateway refund',
  BANK_TRANSFER: 'Bank transfer',
};
export const methodText = (m: string | null | undefined) => (m ? (METHOD_LABEL[m] ?? words(m)) : '-');

export const KIND_LABEL: Record<string, string> = { PAYMENT: 'Payment', TDS: 'TDS claim', REFUND: 'Refund' };

const TEXT: Record<string, string> = {
  REAUTH_REQUIRED: 'Confirm it is you and try again.',
  MAKER_CHECKER_VIOLATION: 'You asked for this, so another person has to approve or reject it.',
  STALE_VERSION: 'This changed while you were looking. Reload and try again.',
  INVOICE_NOT_PAYABLE: 'This invoice cannot take a payment now.',
  DUPLICATE_BANK_REFERENCE: 'That reference was already recorded for this payment method.',
  TDS_ALREADY_CLAIMED: 'A TDS claim already exists for this invoice.',
  TDS_EXCEEDS_LIMIT:
    'TDS is above the allowed limit (10% of the taxable value, and not more than the amount due).',
  AMOUNT_EXCEEDS_DUE: 'The amount is more than what is due.',
  AMOUNT_BELOW_MINIMUM: 'The amount must be at least ₹1 unless it clears the invoice.',
  PAYMENT_MISMATCH: 'The gateway reported a different order or amount. Nothing was applied; contact support.',
  PDF_NOT_READY: 'The PDF is still being prepared. Try again in a minute.',
  CREDIT_NOTE_EXCEEDS_INVOICE: 'Credit notes cannot add up to more than the invoice.',
  CREDIT_NOTE_TIME_BARRED: 'The GST time limit for a credit note on this invoice has passed.',
  INSUFFICIENT_CREDIT_BALANCE: 'The amount is more than the credit balance.',
  REFUND_EXCEEDS_SOURCE_PAYMENT: 'The refund is more than what is left to refund on that payment.',
  REFUND_SOURCE_TOO_OLD: 'That payment is too old to refund through the gateway. Use a bank transfer.',
  GOODWILL_LIMIT_EXCEEDED: 'The credit is above the goodwill limit.',
  GRACE_EXTENSION_INVALID: 'That extension is not allowed (1 to 30 days, and not beyond due date + 60 days).',
  NOTHING_TO_INVOICE: 'The invoice total is zero.',
  EXPORT_TOO_LARGE: 'Too many rows to export. Narrow the filters.',
  MANDATE_LIMIT_TOO_LOW: 'The autopay limit must be at least your last invoice total.',
  MANDATE_ALREADY_ACTIVE: 'Autopay is already set up or waiting for your bank.',
  FILE_NOT_LINKABLE: 'That file cannot be attached. Upload it again.',
  REMINDER_TOO_SOON: 'A reminder was already sent in the last 24 hours.',
  GATEWAY_ERROR: 'The payment gateway did not answer. Nothing was charged; try again shortly.',
  SOCIETY_SUSPENDED: 'This society is suspended.',
};

/** Plain-language text for a failed billing call. */
export function billingError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  if (e.code === 'VALIDATION_FAILED' && e.errors?.length)
    return e.errors.map(x => `${x.field}: ${x.message}`).join('; ');
  const known = TEXT[e.code];
  if (known) return known;
  if (e.status >= 500) return `Something went wrong${e.requestId ? ` (ref ${e.requestId})` : ''}.`;
  return e.message;
}

/** Rupees typed by a person to integer paise; null when not a number with at most two decimals. */
export function rupeesToPaise(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
export const paiseText = (paise: number) =>
  paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);

export const today = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/** Saves a Blob (CSV) through a temporary link. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Statuses an invoice can still be paid, reminded or written off in. */
export const isOpen = (status: string) => ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(status);
