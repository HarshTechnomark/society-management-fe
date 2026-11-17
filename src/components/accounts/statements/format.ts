import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type { LineMatchStatus, MatchMethod, StatementStatus } from '@/types/accountsStatements';
import type { SettlementStatus } from '@/types/accountsSettlements';

/** Words for the section 12 error codes of the settlement, statement and BRS routes. */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  SETTLEMENT_NOT_FOUND: 'This settlement was not found.',
  STATEMENT_NOT_FOUND: 'This statement was not found.',
  STATEMENT_LINE_NOT_FOUND: 'This statement line was not found. Reload the page.',
  BANK_ACCOUNT_NOT_FOUND: 'This bank account was not found.',
  SETTLEMENT_ALREADY_POSTED: 'This settlement is already posted to the books.',
  STATEMENT_ALREADY_IMPORTED: 'This statement file was already imported for this bank account.',
  LINE_ALREADY_MATCHED: 'This line is already matched or ignored. Reload the page.',
  JOURNAL_LINE_ALREADY_MATCHED: 'That book entry is already matched to another statement line.',
  INVALID_STATE: 'This is not allowed in the current state. Reload the page and try again.',
  PERIOD_LOCKED: 'The accounting period of this date is locked.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  MATCH_AMOUNT_MISMATCH: 'The amounts do not match, so these cannot be matched.',
  MATCH_WRONG_ACCOUNT: 'That book entry is not on this bank account or is on the wrong side.',
  RECONCILIATION_INCOMPLETE: 'Some lines are still unmatched. Match or ignore every line first.',
  SETTLEMENT_TOTALS_INVALID: 'The totals in the settlement do not add up to the net amount.',
  SETTLEMENT_MISMATCH: 'Some payments in this settlement still do not match.',
  COLLECTION_ACCOUNT_REQUIRED: 'Choose a collection bank account first (Money > Bank and funds).',
  STATEMENT_PARSE_FAILED: 'The file could not be read. Check the template and try again.',
  UNKNOWN_LEDGER_CODE: 'That account code is not in your chart of accounts.',
  ACCOUNT_NOT_POSTABLE: 'That account is a group. Choose an account inside it.',
  ACCOUNT_INACTIVE: 'That account is not active.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};
export const KNOWN_ERROR_CODES = Object.keys(TEXT);

export function bankError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const detail = e.errors?.map(x => x.message).filter(Boolean);
  if ((e.code === 'VALIDATION_FAILED' || e.code === 'STATEMENT_PARSE_FAILED') && detail?.length)
    return `${e.code === 'STATEMENT_PARSE_FAILED' ? TEXT.STATEMENT_PARSE_FAILED + ' ' : ''}${detail.join(' ')}`;
  return TEXT[e.code] ?? e.message;
}
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, bankError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}
export const isPlan402 = (e: unknown) =>
  e instanceof ApiError && (e.status === 402 || e.code === 'FEATURE_NOT_IN_PLAN');
export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  RECEIVED: 'Received',
  MISMATCH: 'Mismatch',
  POSTED: 'Posted',
};
export const SETTLEMENT_STATUS_TONE: Record<SettlementStatus, Tone> = {
  RECEIVED: 'info',
  MISMATCH: 'bad',
  POSTED: 'ok',
};
export const STATEMENT_STATUS_LABEL: Record<StatementStatus, string> = {
  UPLOADED: 'Reading the file',
  PARSED: 'Ready to match',
  FAILED: 'Failed',
  RECONCILED: 'Reconciled',
};
export const STATEMENT_STATUS_TONE: Record<StatementStatus, Tone> = {
  UPLOADED: 'info',
  PARSED: 'warn',
  FAILED: 'bad',
  RECONCILED: 'ok',
};
export const LINE_STATUS_LABEL: Record<LineMatchStatus, string> = {
  UNMATCHED: 'Unmatched',
  MATCHED: 'Matched',
  IGNORED: 'Ignored',
};
export const LINE_STATUS_TONE: Record<LineMatchStatus, Tone> = {
  UNMATCHED: 'warn',
  MATCHED: 'ok',
  IGNORED: 'neutral',
};
export const MATCH_METHOD_LABEL: Record<MatchMethod, string> = {
  AUTO_REFERENCE: 'Matched by reference',
  AUTO_AMOUNT_DATE: 'Matched by amount and date',
  MANUAL: 'Matched by you',
  CREATED_ENTRY: 'Entry created from this line',
};

/** Accounts offered when a line has no book entry yet (spec 11.4); "Other" takes any account code. */
export const QUICK_ACCOUNTS = [
  { code: '5600', label: 'Bank charges (5600)' },
  { code: '4300', label: 'Interest (4300)' },
  { code: '1420', label: 'TDS by bank (1420)' },
];

export const GATEWAY_PROVIDERS = [
  { value: 'RAZORPAY', label: 'Razorpay' },
  { value: 'CASHFREE', label: 'Cashfree' },
  { value: 'PAYU', label: 'PayU' },
  { value: 'PHONEPE', label: 'PhonePe' },
];

/** The file cannot exceed 20 MB (spec 8.16). */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
