import { ApiError } from '@/lib/apiClient';
import { formatCountdown } from '@/lib/validation';

/** Seconds a locked-out user must wait, from `errors[retryAfterSeconds]` or the Retry-After header. */
export function lockSeconds(e: ApiError): number {
  return e.metaNumber('retryAfterSeconds') ?? e.retryAfterSeconds ?? 900;
}

export const lockMessage = (secondsLeft: number) =>
  `Too many attempts. Try again in ${formatCountdown(secondsLeft)}.`;

/** Plain-language text for an API error on a sign-in style screen. Screens add their own cases first. */
export function authErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  switch (e.code) {
    case 'INVALID_CREDENTIALS':
      return 'The email or password is not correct.';
    case 'NO_ACCESS_FOR_APP':
      return 'This account does not have access to this app.';
    case 'ACCOUNT_DISABLED':
      return 'This account has been disabled. Contact your society admin.';
    case 'LOGIN_METHOD_NOT_ALLOWED':
      return 'That sign-in method is not available here.';
    case 'RATE_LIMITED':
      return 'Too many requests. Wait a few minutes and try again.';
    case 'CSRF_FAILED':
      return 'This page is out of date. Reload it and try again.';
    case 'PASSKEY_INVALID':
      return 'That passkey was not accepted. Try again or use another method.';
    case 'CHALLENGE_INVALID':
      return 'That took too long. Start again.';
    case 'NETWORK_ERROR':
      return e.message;
    case 'INTERNAL_ERROR':
      return `Something went wrong on our side.${e.requestId ? ` Reference: ${e.requestId}.` : ''}`;
    default:
      return e.message;
  }
}

export const fieldErrors = (e: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (e instanceof ApiError && e.code === 'VALIDATION_FAILED')
    for (const x of e.errors ?? []) out[x.field] ??= x.message;
  return out;
};
