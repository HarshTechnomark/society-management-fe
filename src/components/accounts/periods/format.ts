import { ApiError } from '@/lib/apiClient';

/** Words for the section 12 error codes of the periods, reports and export routes. */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  UNLOCK_ALREADY_ACTIVE: 'The books are already open for a temporary window. End it first.',
  YEAR_ALREADY_CLOSED: 'This financial year is already closed.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  LOCK_DATE_INVALID: 'Choose a month that has ended and is after the month already locked.',
  LOCK_PRECONDITION_FAILED: 'Some items dated on or before that month are still pending. Finish them first.',
  YEAR_CLOSE_PRECONDITION: 'This year cannot be closed yet. Fix the items listed and try again.',
  LEDGER_ACCOUNT_NOT_FOUND: 'This account was not found.',
  RATE_LIMITED: 'Too many exports. You can prepare 10 files an hour; try again later.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

export function periodsError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const detail = e.errors?.map(x => x.message).filter(Boolean);
  if ((e.code === 'VALIDATION_FAILED' || e.code === 'YEAR_CLOSE_PRECONDITION') && detail?.length)
    return detail.join(' ');
  return TEXT[e.code] ?? e.message;
}
export const isPlanError = (e: unknown) =>
  e instanceof ApiError && (e.status === 402 || e.code === 'FEATURE_NOT_IN_PLAN');

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Last day of the month of "YYYY-MM". */
export function monthEnd(month: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  return `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`;
}
/** Financial year ("2026-27") of an ISO date; years run 1 April to 31 March. */
export function financialYearOf(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
export const fyStart = (fy: string) => `${fy.slice(0, 4)}-04-01`;
