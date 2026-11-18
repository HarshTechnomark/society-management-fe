import { ApiError } from '@/lib/apiClient';
import type { Tone } from '@/components/ui/Chip';
import type { EmergencyStatus, EmergencyType } from '@/types/communication';

export const EMERGENCY_TYPES: { value: EmergencyType; label: string }[] = [
  { value: 'FIRE', label: 'Fire' },
  { value: 'GAS_LEAK', label: 'Gas leak' },
  { value: 'WATER', label: 'Water outage' },
  { value: 'SECURITY_THREAT', label: 'Security threat' },
  { value: 'MEDICAL', label: 'Medical emergency' },
  { value: 'LIFT_STUCK', label: 'Lift trapped' },
  { value: 'POWER', label: 'Power failure' },
  { value: 'NATURAL_DISASTER', label: 'Natural disaster' },
  { value: 'OTHER', label: 'Other' },
];
export const typeLabel = (t: string) => EMERGENCY_TYPES.find(x => x.value === t)?.label ?? t;

export const STATUS_TONE: Record<EmergencyStatus, [string, Tone]> = {
  ACTIVE: ['Active', 'bad'],
  RESOLVED: ['All clear', 'ok'],
  CANCELLED: ['False alarm', 'neutral'],
};

/** Words for the section 12 codes the emergency, notice and survey calls can return. */
export const COMM_TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  PERMISSION_DENIED: 'You are not allowed to do this.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  EMERGENCY_ALREADY_ACTIVE: 'An alert of this type is already active. Open it instead of starting a new one.',
  EMERGENCY_AUDIENCE_INVALID: 'One of the chosen towers was not found. Choose again.',
  EMERGENCY_NOT_FOUND: 'This alert was not found.',
  EMERGENCY_NOT_ACTIVE: 'This alert has already ended.',
  EMERGENCY_REALERT_TOO_SOON: 'You can re-alert only once every 3 minutes. Try again shortly.',
  EMERGENCY_CANCEL_WINDOW_PASSED:
    'A false alarm can be declared only in the first 15 minutes. Send an all clear instead.',
  EMERGENCY_RESPONSES_DISABLED: 'This alert does not collect replies.',
  EMERGENCY_UNIT_REQUIRED: 'Choose the flat this reply is for.',
  STALE_VERSION: 'This changed in the meantime. Reload and try again.',
  INVALID_STATE: 'This cannot be done in its current state. Reload the page.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  RATE_LIMITED: 'Too many tries. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'Drills are paused while the society is suspended.',
  SOCIETY_CLOSED: 'This society is closed.',
  NOTICE_NOT_FOUND: 'This notice was not found.',
  NOTICE_ACK_NOT_REQUIRED: 'This notice does not need an acknowledgement.',
  FILE_NOT_FOUND: 'This file was not found.',
  FILE_NOT_READY: 'This file is still being checked. Try again in a minute.',
  FILE_INFECTED: 'This file failed the safety check and cannot be opened.',
  SURVEY_NOT_FOUND: 'This survey was not found.',
  SURVEY_NOT_OPEN: 'This survey is closed.',
  SURVEY_ALREADY_RESPONDED: 'You have already answered this survey.',
  SURVEY_ANSWER_INVALID: 'One of the answers is not valid. Check the marked questions.',
  SURVEY_UNIT_REQUIRED: 'Choose the flat you are answering for.',
  FEATURE_NOT_IN_PLAN: 'This is not part of your society’s plan.',
  NOTIFICATION_NOT_FOUND: 'This notification was not found.',
  PREFERENCE_LOCKED: 'Emergency and security alerts cannot be switched off.',
  QUIET_HOURS_INVALID: 'Choose different start and end times for quiet hours.',
  PUSH_ENDPOINT_NOT_ALLOWED: 'This browser’s push service is not supported.',
  PUSH_NOT_CONFIGURED: 'Phone notifications are not set up yet.',
  PUSH_SUBSCRIPTION_NOT_FOUND: 'This device was not found.',
  TEMPLATE_NOT_FOUND: 'This template was not found.',
  TEMPLATE_INVALID: 'The text has a problem (unknown placeholder, too long, or it does not render).',
  TEMPLATE_DLT_REQUIRED: 'The SMS text changed. Register it and enter the new DLT id too.',
  REAUTH_REQUIRED: 'Confirm it is you and try again.',
};

export function commError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  return COMM_TEXT[e.code] ?? e.message;
}
export function plainCommError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, commError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

/** "5 min ago" style, falls back to a date after 30 days. */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '-';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d <= 30) return `${d} d ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function istTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
}
export const istDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-';
/** Minutes since `iso`. */
export const minutesSince = (iso: string, now = Date.now()) => Math.floor((now - Date.parse(iso)) / 60_000);
