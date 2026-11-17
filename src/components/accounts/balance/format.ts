import { ApiError } from '@/lib/apiClient';

export const ymd = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const timeOf = (iso: string | null): string =>
  iso && !Number.isNaN(new Date(iso).getTime())
    ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '-';

/** Plain words for the section 12 codes these screens can meet. */
export function plainBalanceError(e: unknown): unknown {
  if (!(e instanceof ApiError)) return e;
  const text =
    e.code === 'FEATURE_NOT_IN_PLAN'
      ? 'This is not part of your society’s plan.'
      : e.code === 'PERMISSION_DENIED'
        ? 'You do not have permission to see this.'
        : e.code === 'VALIDATION_FAILED'
          ? 'The dates are not valid. Pick a range of up to a year ending today.'
          : e.message;
  return new ApiError(e.status, e.code, text, e.errors, e.requestId, e.retryAfterSeconds);
}
