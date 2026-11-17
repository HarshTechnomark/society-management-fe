import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type { ExpenseStatus } from '@/types/accountsExpenses';

export { rupeesToPaise, paiseText, today, daysAgo } from '@/components/billing/format';
export { downloadBlob } from '@/components/maintenance/ledger/format';

export const STATUS_INFO: Record<ExpenseStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'warn' },
  CHANGES_REQUESTED: { label: 'Changes requested', tone: 'warn' },
  POSTED: { label: 'Approved and paid', tone: 'ok' },
  REJECTED: { label: 'Rejected', tone: 'bad' },
  REVERSED: { label: 'Reversed', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
export const statusInfo = (s: string) =>
  STATUS_INFO[s as ExpenseStatus] ?? { label: s.toLowerCase().replace(/_/g, ' '), tone: 'neutral' as Tone };

/** Filter segments: the key maps to the `status` query value. */
export const STATUS_FILTERS = [
  { key: 'ANY', label: 'All', status: undefined },
  { key: 'DRAFT', label: 'Drafts', status: 'DRAFT' },
  { key: 'PENDING', label: 'Pending approval', status: 'PENDING_APPROVAL' },
  { key: 'POSTED', label: 'Approved and paid', status: 'POSTED' },
  { key: 'REJECTED', label: 'Rejected', status: 'REJECTED' },
  { key: 'REVERSED', label: 'Reversed', status: 'REVERSED' },
  { key: 'CANCELLED', label: 'Cancelled', status: 'CANCELLED' },
] as const;
export type StatusFilterKey = (typeof STATUS_FILTERS)[number]['key'];

export const MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'IMPS', label: 'IMPS' },
  { value: 'UPI', label: 'UPI' },
];
export const modeLabel = (m: string) => MODES.find(x => x.value === m)?.label ?? m;
export const NEEDS_REFERENCE = ['CHEQUE', 'NEFT', 'RTGS', 'IMPS'];

export const EXPENSE_TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  EXPENSE_NOT_FOUND: 'This expense was not found. Reload the page.',
  FUND_NOT_FOUND: 'This fund was not found. Pick another one.',
  LEDGER_ACCOUNT_NOT_FOUND: 'This category or account was not found. Pick another one.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  PERIOD_LOCKED: 'This date is in a locked accounting period.',
  DATE_OUT_OF_RANGE: 'The date is in the future or too far back.',
  INVALID_EXPENSE_HEAD: 'This category cannot be used for this kind of expense.',
  INVALID_PAYMENT_SOURCE: 'Pay from a bank, cash or petty cash account that matches the payment mode.',
  BILL_REQUIRED: 'Add a photo of the bill before sending this for approval.',
  FILE_NOT_LINKABLE: 'The bill file cannot be attached. Upload it again.',
  FUND_INACTIVE: 'This fund is closed.',
  FUND_BALANCE_INSUFFICIENT: 'The fund does not have enough money for this expense.',
  INSUFFICIENT_BALANCE: 'There is not enough money in the account you are paying from.',
  VENDOR_BILL_NOT_PAYABLE: 'This vendor bill cannot be paid now.',
  STALE_VERSION: 'Someone else changed this expense a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed for the current state of the expense. Reload and try again.',
  MAKER_CHECKER_VIOLATION: 'You entered this expense, so someone else must do this.',
  JOURNAL_ALREADY_REVERSED: 'This expense was already reversed.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

export function expenseError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const base = EXPENSE_TEXT[e.code] ?? e.message;
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
    ? new ApiError(e.status, e.code, expenseError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

/** Which form field an API error code belongs under. */
export function fieldOfCode(code: string): string | null {
  if (code === 'BILL_REQUIRED' || code === 'FILE_NOT_LINKABLE') return 'bill';
  if (code === 'INSUFFICIENT_BALANCE') return 'amount';
  if (code === 'DATE_OUT_OF_RANGE' || code === 'PERIOD_LOCKED') return 'date';
  if (code === 'INVALID_EXPENSE_HEAD') return 'head';
  if (code === 'INVALID_PAYMENT_SOURCE') return 'paidFrom';
  if (code === 'FUND_INACTIVE' || code === 'FUND_BALANCE_INSUFFICIENT' || code === 'FUND_NOT_FOUND')
    return 'fund';
  return null;
}

const FIELD_MAP: Record<string, string> = {
  grossAmountPaise: 'amount',
  expenseDate: 'date',
  payee: 'payee',
  ledgerAccountId: 'head',
  paidFromLedgerAccountId: 'paidFrom',
  paymentMode: 'mode',
  paymentReference: 'reference',
  gstPaise: 'gst',
  tdsPaise: 'tds',
  tdsSection: 'tdsSection',
  fundId: 'fund',
  fileIds: 'bill',
  description: 'note',
};
export const formFieldOf = (apiField: string) => FIELD_MAP[apiField] ?? null;
