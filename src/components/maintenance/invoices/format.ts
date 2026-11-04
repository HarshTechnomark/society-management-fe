import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import type {
  CreditReason,
  DebitReason,
  InvoiceDetail,
  InvoiceStatus,
  NoteStatus,
} from '@/types/billingInvoices';

export { rupeesToPaise, periodOptions, RELATION_LABEL } from '../runs/format';
export { downloadBlob } from '../ledger/format';

/** Words for every error code the invoice routes can return (spec 8.11 to 8.17 and section 12). */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  INVOICE_NOT_FOUND: 'This invoice was not found. It may belong to another society.',
  NOTE_NOT_FOUND: 'This credit or debit note was not found. Reload the page.',
  UNIT_NOT_FOUND: 'This flat was not found or is archived. Pick another flat.',
  CHARGE_HEAD_NOT_FOUND: 'This charge head was not found. Reload the page and pick it again.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed for the current state of the bill. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  CREDIT_NOTE_PENDING:
    'A credit note for this bill still waits for approval. Wait for the decision before cancelling the bill.',
  INVOICE_CANCEL_PENDING:
    'A cancellation of this bill waits for approval. No credit note, debit note or write-off can be added until it is decided.',
  APPROVAL_ALREADY_PENDING: 'This request already waits for approval. Open the approvals page to follow it.',
  REMINDER_TOO_SOON: 'A reminder was sent in the last 24 hours. Try again tomorrow.',
  PDF_NOT_READY: 'The PDF of this bill is not ready yet. Try again in a minute.',
  CREDIT_EXCEEDS_LINE: 'An amount is above what can still be credited on that line. See the limit shown.',
  WRITE_OFF_EXCEEDS_OUTSTANDING: 'The write-off is more than the amount still due on this bill.',
  CHARGE_HEAD_NOT_ALLOWED: 'System heads cannot be used here. Pick another charge head.',
  CHARGE_HEAD_ARCHIVED: 'This charge head is archived. Pick an active head.',
  NO_BILL_TO: 'This flat has no owner or payer to bill. Record the owner first.',
  MIXED_BILL_TO: 'These charge heads are billed to different people. Create one invoice for each of them.',
  GST_SETTINGS_INVALID:
    'A taxed charge head has no SAC code. Add the SAC code in Settings > Billing and try again.',
  PERIOD_LOCKED: 'The books are locked for this date. Ask the accountant to open the period.',
  FUND_NOT_RESOLVED:
    'The fund this charge is booked to could not be found. Check the fund of the charge head in Settings > Billing.',
  EXPORT_TOO_LARGE: 'Too many invoices to export at once (more than 50,000). Narrow the filters.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};
export const KNOWN_ERROR_CODES = Object.keys(TEXT);

const FIELD_LABEL: Record<string, string> = {
  unitId: 'Flat',
  dueDate: 'Due date',
  description: 'Description',
  remarks: 'Remarks',
  reason: 'Reason',
  reasonCode: 'Reason',
  amountPaise: 'Amount',
  chargeHeadId: 'Charge head',
  invoiceLineId: 'Line',
  lines: 'Lines',
  version: 'Version',
};
/** `lines[1].amountPaise` reads "Line 2, amount"; `dueDate` reads "Due date". */
export function fieldLabel(field: string): string {
  const m = /^lines\[(\d+)\](?:\.(\w+))?$/.exec(field);
  if (m) {
    const part = m[2] && m[2] !== 'invoiceLineId' ? `, ${(FIELD_LABEL[m[2]] ?? m[2]).toLowerCase()}` : '';
    return `Line ${Number(m[1]) + 1}${part}`;
  }
  return FIELD_LABEL[field] ?? field;
}

/** The extra detail of an error from its `errors[]` (field messages, the maximum allowed, when a failed PDF is retried). */
function detail(e: ApiError): string {
  const errors = e.errors ?? [];
  if (
    e.code === 'VALIDATION_FAILED' ||
    e.code === 'CHARGE_HEAD_NOT_ALLOWED' ||
    e.code === 'CHARGE_HEAD_ARCHIVED'
  ) {
    const parts = errors
      .filter(f => f.field && f.message)
      .slice(0, 3)
      .map(f => `${fieldLabel(String(f.field))}: ${f.message}`);
    return parts.length ? ` ${parts.join('. ')}.` : '';
  }
  if (e.code === 'WRITE_OFF_EXCEEDS_OUTSTANDING' || e.code === 'CREDIT_EXCEEDS_LINE') {
    const whole = errors.find(
      f => (f.field === 'amountPaise' || f.field === 'lines') && f.maxAllowedPaise != null,
    );
    return whole ? ` At most ${inr(Number(whole.maxAllowedPaise))} in all.` : '';
  }
  if (e.code === 'PDF_NOT_READY') {
    const at = errors.find(f => typeof f.retryAt === 'string')?.retryAt as string | undefined;
    const d = at ? new Date(at) : null;
    return d && !Number.isNaN(d.getTime())
      ? ` Making it failed; it is tried again after ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`
      : '';
  }
  return '';
}

/** The message for an error, in plain words, with the details the API gives in `errors[]`. */
export function billingInvoiceError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const base = TEXT[e.code];
  return base ? `${base}${detail(e)}` : e.message;
}

/** The same error with its message in plain words, for `ErrorState` (keeps the support reference). */
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, billingInvoiceError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

/**
 * "Max ₹X" per line from a `CREDIT_EXCEEDS_LINE` answer. The API names the line by its position in the request
 * (`{ field: 'lines[i].amountPaise', maxAllowedPaise }`), so `sentLineIds[i]` is the invoice line it means.
 */
export function creditLimits(e: unknown, sentLineIds: number[]): Record<number, number> {
  const out: Record<number, number> = {};
  if (!(e instanceof ApiError)) return out;
  for (const f of e.errors ?? []) {
    const m = /^lines\[(\d+)\]\.amountPaise$/.exec(String(f.field));
    const id = m ? sentLineIds[Number(m[1])] : undefined;
    const max = Number(f.maxAllowedPaise);
    if (id !== undefined && f.maxAllowedPaise != null && Number.isFinite(max)) out[id] = max;
  }
  return out;
}

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  ISSUED: 'Unpaid',
  PARTIALLY_PAID: 'Part paid',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};
export const STATUS_TONE: Record<InvoiceStatus, Tone> = {
  ISSUED: 'info',
  PARTIALLY_PAID: 'warn',
  PAID: 'ok',
  CANCELLED: 'neutral',
};
/** A short mark in front of the words, so the state is clear without colour. */
export const STATUS_MARK: Record<InvoiceStatus, string> = {
  ISSUED: '○',
  PARTIALLY_PAID: '◐',
  PAID: '✓',
  CANCELLED: '✕',
};

export const NOTE_STATUS_LABEL: Record<NoteStatus, string> = {
  PENDING_APPROVAL: 'Waiting for approval',
  CHANGES_REQUESTED: 'Changes requested',
  ISSUED: 'Issued',
  REJECTED: 'Rejected',
};
export const NOTE_STATUS_TONE: Record<NoteStatus, Tone> = {
  PENDING_APPROVAL: 'warn',
  CHANGES_REQUESTED: 'warn',
  ISSUED: 'ok',
  REJECTED: 'bad',
};
export const NOTE_STATUS_MARK: Record<NoteStatus, string> = {
  PENDING_APPROVAL: '◑',
  CHANGES_REQUESTED: '!',
  ISSUED: '✓',
  REJECTED: '✕',
};

export const TYPE_LABEL: Record<string, string> = {
  REGULAR: 'Regular',
  SUPPLEMENTARY: 'Extra run',
  ADHOC: 'One-off',
  OPENING: 'Opening balance',
};

/** Segments of the status filter (spec 11.1): value is what the API takes. */
export const STATUS_FILTERS = [
  { value: '', label: 'All bills' },
  { value: 'OPEN', label: 'Open (money due)' },
  { value: 'ISSUED', label: 'Unpaid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PARTIALLY_PAID', label: 'Part paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const SORT_OPTIONS = [
  { value: 'invoiceDate', label: 'Bill date' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'totalPaise', label: 'Amount' },
  { value: 'outstandingPaise', label: 'Amount due' },
  { value: 'unitLabel', label: 'Flat' },
  { value: 'invoiceNo', label: 'Invoice number' },
];

export const CREDIT_REASONS: { value: CreditReason; label: string }[] = [
  { value: 'BILLING_ERROR', label: 'Billing error' },
  { value: 'WAIVER', label: 'Waiver' },
  { value: 'DISPUTE_RESOLUTION', label: 'Dispute resolution' },
  { value: 'OTHER', label: 'Other' },
];
export const DEBIT_REASONS: { value: DebitReason; label: string }[] = [
  { value: 'ADDITIONAL_CHARGE', label: 'Additional charge' },
  { value: 'BILLING_ERROR', label: 'Billing error' },
  { value: 'OTHER', label: 'Other' },
];
export const REASON_LABEL: Record<string, string> = {
  BILLING_ERROR: 'Billing error',
  WAIVER: 'Waiver',
  DISPUTE_RESOLUTION: 'Dispute resolution',
  CANCELLATION: 'Cancellation',
  WRITE_OFF: 'Write-off',
  SOURCE_REFUND: 'Refund',
  INTEREST: 'Interest',
  LATE_FEE: 'Late fee',
  ADDITIONAL_CHARGE: 'Additional charge',
  OTHER: 'Other',
};

/** The statuses in which notes can be added (BR-11-41, BR-11-46). */
export const canAddNote = (d: Pick<InvoiceDetail, 'status'>) => d.status !== 'CANCELLED';
export const canCancel = (d: Pick<InvoiceDetail, 'status'>) => d.status === 'ISSUED';
export const canWriteOff = (d: Pick<InvoiceDetail, 'status' | 'outstandingPaise'>) =>
  (d.status === 'ISSUED' || d.status === 'PARTIALLY_PAID') && d.outstandingPaise > 0;
export const canRemind = (d: Pick<InvoiceDetail, 'status' | 'outstandingPaise'>) =>
  d.status !== 'CANCELLED' && d.outstandingPaise > 0;

/**
 * An estimate of the GST of a credit of `taxableCreditedPaise` (BR-11-41): the invoice's own CGST share of its
 * taxable value, on both halves. The server decides the final figure.
 */
export function estimateCreditTax(
  d: Pick<InvoiceDetail, 'gstApplied' | 'taxableValuePaise' | 'cgstPaise'>,
  taxableCreditedPaise: number,
): number {
  if (!d.gstApplied || d.taxableValuePaise <= 0 || taxableCreditedPaise <= 0) return 0;
  return 2 * Math.round((taxableCreditedPaise * d.cgstPaise) / d.taxableValuePaise);
}

export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
export const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayIso(d);
};
