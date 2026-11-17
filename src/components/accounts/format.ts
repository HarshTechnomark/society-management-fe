import { ApiError } from '@/lib/apiClient';
import { financialYearStartIST } from '@/lib/indiaDate';

/** Words for the section 12 codes the fund and bank account routes return. */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This is part of the Premium plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  FUND_NOT_FOUND: 'This fund was not found. Reload the page.',
  BANK_ACCOUNT_NOT_FOUND: 'This bank account was not found. Reload the page.',
  DUPLICATE_FUND_NAME: 'A fund with this name already exists. Use another name.',
  DUPLICATE_BANK_ACCOUNT: 'This account number with this IFSC is already added.',
  MAKER_CHECKER_VIOLATION: 'You added or changed this account, so another person must verify it.',
  INVALID_STATE: 'This is not allowed for the current state. Reload and try again.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  PERIOD_LOCKED: 'This date is in a locked accounting period.',
  SYSTEM_ACCOUNT_LOCKED: 'This fund comes with the society and cannot be closed.',
  FUND_BALANCE_NOT_ZERO: 'Move the money out of this fund first. A fund can be closed only at zero.',
  FUND_BALANCE_INSUFFICIENT: 'The fund does not have that much money.',
  FUND_INACTIVE: 'This fund is closed.',
  FUND_TRANSFER_SAME_FUND: 'Choose two different funds.',
  BANK_ACCOUNT_LIMIT: 'A society can have at most 10 active bank accounts.',
  BANK_BALANCE_NOT_ZERO: 'The book balance of this account must be zero before it is closed.',
  COLLECTION_ACCOUNT_REQUIRED: 'Make another account the collection account first.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

export function accountsError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const detail = e.errors?.map(x => x.message).filter(Boolean);
  if (e.code === 'VALIDATION_FAILED' && detail?.length) return detail.join(' ');
  return TEXT[e.code] ?? e.message;
}

/** The same error with its message in plain words, for `ErrorState` (keeps the support reference). */
export function plainAccountsError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, accountsError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

/** Server field errors keyed by field name. */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiError && e.code === 'VALIDATION_FAILED')
    for (const f of e.errors ?? []) if (f.field && f.message && !out[f.field]) out[f.field] = f.message;
  return out;
}

/** 1 April of the current financial year as an ISO day. */
export function fyStart(now = new Date()): string {
  return financialYearStartIST(now);
}
