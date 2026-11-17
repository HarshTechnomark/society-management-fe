import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type { JournalStatus } from '@/types/accountsJournal';

export { rupeesToPaise, today } from '@/components/billing/format';

/** Words for the section 12 codes the chart, journal and opening balance routes return. */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  LEDGER_ACCOUNT_NOT_FOUND: 'This account was not found. Reload the page.',
  JOURNAL_NOT_FOUND: 'This journal was not found. Reload the page.',
  DUPLICATE_LEDGER_CODE: 'This account code is already used. Choose another code.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  SYSTEM_ACCOUNT_LOCKED:
    'This is a system account. Only the cash book flag, the label and the note can change.',
  ACCOUNT_BALANCE_NOT_ZERO:
    'This account still has a balance or active accounts below it, so it cannot be switched off.',
  INVALID_PARENT: 'Pick a group account to add under. System groups for banks and funds cannot be used.',
  PERIOD_LOCKED: 'This date is in a locked accounting period or a closed year.',
  INVALID_STATE: 'This is not allowed in the current state. Reload and try again.',
  JOURNAL_IMMUTABLE: 'A posted journal cannot be changed. Reverse it instead.',
  JOURNAL_ALREADY_REVERSED: 'This journal was already reversed.',
  MAKER_CHECKER_VIOLATION: 'You made this entry, so another person has to do this.',
  JOURNAL_NOT_BALANCED: 'Total debits and total credits are not equal.',
  JOURNAL_LINE_INVALID:
    'Each line needs an account and an amount on one side only, and there must be at least two lines.',
  UNKNOWN_LEDGER_CODE: 'One of the account codes is not in your chart.',
  ACCOUNT_NOT_POSTABLE: 'A group account cannot take an entry. Pick an account below it.',
  ACCOUNT_INACTIVE: 'One of the accounts is switched off.',
  FUND_INACTIVE: 'One of the funds is not active.',
  REVERSAL_NOT_ALLOWED:
    'This entry cannot be reversed here. System entries are reversed from where they came from.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  REQUEST_IN_PROGRESS: 'The same request is still running. Wait a moment.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

export function accountsError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  if (e.code === 'VALIDATION_FAILED') {
    const parts = (e.errors ?? [])
      .filter(f => f.message)
      .slice(0, 3)
      .map(f => (f.field ? `${f.field}: ${f.message}` : f.message));
    if (parts.length) return `${TEXT.VALIDATION_FAILED} ${parts.join('. ')}.`;
  }
  return TEXT[e.code] ?? e.message;
}

/** The same error in plain words, for `ErrorState` (keeps the support reference). */
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, accountsError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}
export const isPlan402 = (e: unknown) =>
  e instanceof ApiError && (e.status === 402 || e.code === 'FEATURE_NOT_IN_PLAN');

export const STATUS_LABEL: Record<JournalStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for approval',
  POSTED: 'Posted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};
export const STATUS_TONE: Record<JournalStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warn',
  POSTED: 'ok',
  REJECTED: 'bad',
  CANCELLED: 'neutral',
};
export const VOUCHER_LABEL: Record<string, string> = {
  JOURNAL: 'Journal',
  CONTRA: 'Contra',
  PAYMENT: 'Payment',
  RECEIPT: 'Receipt',
  INVOICE: 'Invoice',
  DEBIT_NOTE: 'Debit note',
  CREDIT_NOTE: 'Credit note',
  WRITE_OFF: 'Write-off',
  OPENING_BALANCE: 'Opening balance',
  CLOSING: 'Year closing',
};
export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  FUND: 'Funds',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
};
const REF_LABEL: Record<string, string> = {
  invoice: 'Invoice',
  credit_note: 'Credit note',
  payment: 'Payment',
  refund: 'Refund',
  expense: 'Expense',
  settlement: 'Settlement',
  deposit: 'Deposit',
  fund_transfer: 'Fund transfer',
  statement_line: 'Bank statement line',
  opening: 'Opening balances',
  closing: 'Year closing',
  manual_journal: 'Manual journal',
  vendor_bill: 'Vendor bill',
};
export const refLabel = (t: string) => REF_LABEL[t] ?? (t ? t.replace(/_/g, ' ') : '-');

/** Where a source document can be opened from; unknown kinds have no link. */
export function sourceHref(refType: string, refId: string): string | null {
  if (refType === 'invoice') return '/admin/billing/invoices';
  if (refType === 'payment') return '/admin/payments';
  if (refType === 'refund') return '/admin/payments/refunds';
  if (refType === 'manual_journal') return null;
  void refId;
  return null;
}

export const isManual = (source: string) => source === 'MANUAL';
