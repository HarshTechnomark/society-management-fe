import { ApiError } from '@/lib/apiClient';
import type { Tone } from '@/components/ui/Chip';
import type { GrantScope, GrantStatus, HealthBand, SocietyStatus } from '@/types/societies';

export const STATUSES: SocietyStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CLOSED'];

export const STATUS_LABEL: Record<SocietyStatus, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Past due',
  SUSPENDED: 'Suspended',
  CLOSED: 'Closed',
};
export const STATUS_TONE: Record<SocietyStatus, Tone> = {
  TRIAL: 'info',
  ACTIVE: 'ok',
  PAST_DUE: 'warn',
  SUSPENDED: 'bad',
  CLOSED: 'neutral',
};

export const PLAN_LABEL: Record<string, string> = {
  STARTER: 'Starter',
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
  ENTERPRISE: 'Enterprise',
};

/** BR-05-35 bands: HEALTHY ≥ 75, WATCH 55 to 74, AT_RISK below 55. */
export function healthBand(score: number | null | undefined): HealthBand | null {
  if (score === null || score === undefined) return null;
  return score >= 75 ? 'HEALTHY' : score >= 55 ? 'WATCH' : 'AT_RISK';
}
export const HEALTH_LABEL: Record<HealthBand, string> = {
  HEALTHY: 'Healthy',
  WATCH: 'Watch',
  AT_RISK: 'At risk',
};

export const GRANT_STATUS_LABEL: Record<GrantStatus, string> = {
  PENDING_CONSENT: 'Waiting for consent',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  ENDED: 'Ended',
  REVOKED: 'Revoked',
  DENIED: 'Denied',
  CANCELLED: 'Cancelled',
  CONSENT_EXPIRED: 'Consent expired',
};
export const GRANT_STATUS_TONE: Record<GrantStatus, Tone> = {
  PENDING_CONSENT: 'warn',
  ACTIVE: 'bad',
  EXPIRED: 'neutral',
  ENDED: 'neutral',
  REVOKED: 'neutral',
  DENIED: 'neutral',
  CANCELLED: 'neutral',
  CONSENT_EXPIRED: 'neutral',
};
export const SCOPE_LABEL: Record<GrantScope, string> = {
  READ_ONLY: 'Read only',
  READ_WRITE: 'Read and write',
};
/** Plain words for society users (A-02). */
export const SCOPE_PLAIN: Record<GrantScope, string> = {
  READ_ONLY: 'can view but not change',
  READ_WRITE: 'can view and change',
};

export const SUSPEND_REASONS = [
  ['NON_PAYMENT', 'Non-payment'],
  ['POLICY_VIOLATION', 'Policy violation'],
  ['FRAUD_SUSPECTED', 'Fraud suspected'],
  ['CUSTOMER_REQUEST', 'Customer request'],
  ['LEGAL_DISPUTE', 'Legal dispute'],
  ['OTHER', 'Other'],
] as const;

export const CLOSURE_REASONS = [
  ['CUSTOMER_REQUEST', 'Customer request'],
  ['NON_PAYMENT', 'Non-payment'],
  ['TRIAL_NOT_CONVERTED', 'Trial not converted'],
  ['DUPLICATE', 'Duplicate society'],
  ['FRAUD', 'Fraud'],
  ['MERGED', 'Merged into another society'],
  ['OTHER', 'Other'],
] as const;

export const NOTE_CATEGORIES = [
  ['GENERAL', 'General'],
  ['BILLING', 'Billing'],
  ['SUPPORT', 'Support'],
  ['ONBOARDING', 'Onboarding'],
  ['RISK', 'Risk'],
] as const;

/** Module 01 states and union territories. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

/** BR-05-6: lowercase, non-alphanumerics to `-`, trimmed to 60. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}
export const isValidSlug = (s: string) =>
  s.length >= 3 && s.length <= 60 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
export const isValidPincode = (s: string) => /^[1-9]\d{5}$/.test(s.trim());

/** "30 Oct, 11:12" in Indian English. */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "11:42" clock time. */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "12:05" minutes and seconds left. */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "30 Oct 11:12 to 12:12", or "Not started". */
export function grantWindow(g: { startedAt: string | null; endsAt: string | null }): string {
  if (!g.startedAt) return 'Not started';
  const start = new Date(g.startedAt);
  const day = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${day} ${clockTime(g.startedAt)} to ${clockTime(g.endsAt)}`;
}

export function bytes(n: number | null | undefined): string {
  if (!n) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export const firstName = (name: string | null | undefined) =>
  (name ?? '').trim().split(/\s+/)[0] || 'Support';

const TEXT: Record<string, string> = {
  PERMISSION_DENIED: 'You do not have permission to do this.',
  SOCIETY_NOT_FOUND: 'This society no longer exists.',
  SLUG_TAKEN: 'This web address is already in use.',
  SLUG_RESERVED: 'This web address is reserved. Choose another.',
  POSSIBLE_DUPLICATE_SOCIETY: 'A society with a similar name already exists at this pincode.',
  TRIAL_ALREADY_USED:
    'You already have a society on a free trial. Convert it to a paid plan or contact our sales team.',
  INVITATION_CONFLICT: 'The invite to this admin could not be created. Check the mobile number and email.',
  INVALID_LIFECYCLE_TRANSITION:
    'This action is not allowed in the society’s current status. Reload and try again.',
  SOCIETY_PURGED: 'This society’s data has already been purged.',
  SUPPORT_GRANT_ALREADY_OPEN: 'You already have a pending or active support access grant. End it first.',
  CONSENT_WINDOW_EXPIRED: 'This request expired before it was approved.',
  EXPORT_ALREADY_RUNNING: 'An export is already being prepared. Wait for it to finish.',
  EXPORT_NOT_READY: 'This export is not ready yet.',
  EXPORT_EXPIRED: 'This export has expired. Request a new one.',
  EXPORT_RATE_LIMITED: 'Only two full exports can be made in 24 hours. Try again later.',
  EXPORT_TOO_LARGE: 'More than 5,000 societies match. Add a filter and export again.',
  INVALID_STATE: 'This record changed in the meantime. Reload and try again.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  ORGANIZATION_REQUIRES_ENTERPRISE: 'An organization can be linked only on the Enterprise plan.',
  ORGANIZATION_NOT_ACTIVE: 'That organization is not active.',
  CUSTOM_PRICE_ENTERPRISE_ONLY: 'A custom price is allowed only on the Enterprise plan.',
  PLAN_NOT_AVAILABLE: 'This plan is not available.',
  TRIAL_EXTENSION_LIMIT: 'No trial extensions are left.',
  GRACE_DATE_REQUIRED: 'This society has overdue invoices. Choose a grace date.',
  NO_PAID_SUBSCRIPTION: 'The trial expired without a paid plan. Extend the trial or convert it instead.',
  CONFIRM_NAME_MISMATCH: 'The name you typed does not match the society name.',
  EMERGENCY_SCOPE_READ_ONLY: 'Emergency access must be read only and at most 60 minutes.',
  NOTE_EDIT_WINDOW_CLOSED: 'Notes can be edited only within 24 hours.',
  NOTE_PIN_LIMIT: 'At most three notes can be pinned.',
  NOT_NOTE_AUTHOR: 'Only the author can change this note.',
  SOCIETY_NOTE_NOT_FOUND: 'This note no longer exists.',
  NUDGE_TOO_SOON: 'A nudge was sent in the last 24 hours.',
  SOCIETY_SUSPENDED: 'Your society’s account is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  SUPPORT_ACCESS_EXPIRED: 'Support access ended.',
  SUPPORT_ROUTE_FORBIDDEN: 'Support staff cannot do this.',
  SUPPORT_GRANT_NOT_FOUND: 'This support request no longer exists.',
  DATA_EXPORT_NOT_FOUND: 'This export no longer exists.',
  SIGNUP_TOKEN_INVALID: 'Your mobile verification has expired. Verify your mobile again.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  RATE_LIMITED: 'Too many attempts. Wait a little and try again.',
};

/** Words for a module 05 error code; falls back to the API message. */
export function societyErrorText(e: unknown): string {
  if (e instanceof ApiError) return TEXT[e.code] ?? e.message;
  return 'Something went wrong. Try again.';
}
