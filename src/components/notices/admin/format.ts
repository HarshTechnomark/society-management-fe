import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type { NoticeCategory, NoticeKind, NoticeListItem, NoticeStatus } from '@/types/notices';
export { ago, dateTime } from '@/components/approvals/format';

export const STATUS_LABEL: Record<NoticeStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Awaiting approval',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  EXPIRED: 'Expired',
  RECALLED: 'Recalled',
  ARCHIVED: 'Archived',
};
export const statusTone = (s: NoticeStatus): Tone =>
  s === 'PUBLISHED'
    ? 'ok'
    : s === 'PENDING_APPROVAL' || s === 'SCHEDULED'
      ? 'warn'
      : s === 'RECALLED'
        ? 'bad'
        : s === 'DRAFT'
          ? 'info'
          : 'neutral';

export const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  GENERAL: 'General',
  MAINTENANCE: 'Maintenance',
  FINANCE: 'Finance',
  GOVERNANCE: 'Governance',
  FESTIVAL: 'Festival',
  SAFETY: 'Safety',
  COMMUNITY: 'Community',
};
export const KIND_LABEL: Record<NoticeKind, string> = {
  STANDARD: 'Standard',
  UTILITY_SHUTDOWN: 'Utility shutdown',
  SYSTEM: 'System',
};
export const UTILITY_TYPES = [
  { value: 'WATER', label: 'Water' },
  { value: 'POWER', label: 'Power' },
  { value: 'LIFT', label: 'Lift' },
  { value: 'GAS', label: 'Gas' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'OTHER', label: 'Other' },
];
export const ACTION_LABEL: Record<string, string> = {
  PAY_COLLECTION: 'Pay',
  PAY_DUES: 'Pay dues',
  RSVP: 'RSVP',
  VOTE: 'Vote',
  LINK: 'Link',
};

/** Segment filter of spec 11.1 -> the `status` query value of spec 8.1. */
export const SEGMENTS = [
  { key: 'ALL', label: 'All', status: undefined },
  { key: 'PUBLISHED', label: 'Published', status: 'PUBLISHED' },
  { key: 'PENDING_APPROVAL', label: 'Awaiting approval', status: 'PENDING_APPROVAL' },
  { key: 'SCHEDULED', label: 'Scheduled', status: 'SCHEDULED' },
  { key: 'DRAFT', label: 'Drafts', status: 'DRAFT' },
  { key: 'EXPIRED', label: 'Expired', status: 'EXPIRED' },
  { key: 'RECALLED', label: 'Recalled', status: 'RECALLED' },
  { key: 'ARCHIVED', label: 'Archived', status: 'ARCHIVED' },
] as const;
export type SegmentKey = (typeof SEGMENTS)[number]['key'];

/** Percent of `part` in `whole`, 0 when there is no whole. */
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : 0);
export const readPct = (n: Pick<NoticeListItem, 'readCount' | 'recipientCount'>) =>
  pct(n.readCount, n.recipientCount);

export const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ERROR_TEXT: Record<string, string> = {
  STALE_VERSION: 'Someone changed this notice. Reload and try again.',
  INVALID_STATE: 'This notice cannot be changed in its current state. Reload and check.',
  NOTICE_NOT_FOUND: 'This notice was not found.',
  NOTICE_AUDIENCE_INVALID: 'One of the chosen towers, flats or roles is not valid any more.',
  NOTICE_AUDIENCE_EMPTY: 'Nobody would receive this notice. Change who it is for.',
  NOTICE_ACTION_INVALID: 'One of the buttons points to something that is not open.',
  NOTICE_INCOMPLETE: 'Add a title (5+ characters) and a message (10+ characters).',
  NOTICE_SCHEDULE_INVALID: 'Pick a time at least 5 minutes from now and within 90 days.',
  NOTICE_EXPIRY_INVALID: 'The expiry or acknowledgement date is not allowed. Check the dates.',
  NOTICE_UTILITY_INVALID: 'The outage must start in the future and end within 7 days of its start.',
  NOTICE_ATTACHMENTS_PENDING: 'An attachment is still being checked. Try again in a minute.',
  NOTICE_PIN_LIMIT_REACHED: 'The pin limit is reached. Unpin another notice first.',
  NOTICE_REMIND_TOO_SOON: 'A reminder went out in the last 6 hours. Try again later.',
  NOTICE_REMIND_LIMIT: 'The maximum number of reminders is reached, or the due date has passed.',
  FILE_NOT_LINKABLE: 'One of the attachments cannot be used.',
  APPROVAL_ALREADY_PENDING: 'An approval is already open for this notice.',
  SURVEY_NOT_FOUND: 'This survey was not found.',
  SURVEY_QUESTIONS_REQUIRED: 'Add at least one question before opening the survey.',
  SURVEY_CLOSE_INVALID: 'The closing time must be between 1 hour and 90 days from now.',
  SURVEY_AUDIENCE_EMPTY: 'Nobody would receive this survey. Change who it is for.',
  PREFERENCE_LOCKED: 'Emergency and security alerts cannot be switched off.',
  QUIET_HOURS_INVALID: 'Quiet hours need a start and an end time that differ.',
  PUSH_NOT_CONFIGURED: 'Push alerts are not set up for this installation yet.',
  PUSH_ENDPOINT_NOT_ALLOWED: 'This browser cannot be registered for push alerts.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This was already sent. Reload and check.',
  SOCIETY_SUSPENDED: 'The society is suspended, so changes cannot be saved.',
  FEATURE_NOT_IN_PLAN: 'This is not part of your plan.',
};
/** Readable text for an API error. Field messages of a 400 are shown as sent. */
export const noticeError = (e: unknown): string => {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const detail = e.errors?.map(x => x.message).filter(Boolean);
  if (e.code === 'VALIDATION_FAILED' && detail?.length) return detail.join(' ');
  if (e.code === 'FEATURE_NOT_IN_PLAN') return e.message || ERROR_TEXT.FEATURE_NOT_IN_PLAN;
  return ERROR_TEXT[e.code] ?? e.message;
};
export const isStale = (e: unknown) => e instanceof ApiError && e.code === 'STALE_VERSION';
export const plainError = (e: unknown): unknown =>
  e instanceof ApiError
    ? new ApiError(e.status, e.code, noticeError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;

/** `datetime-local` value (browser time) -> ISO string, or undefined when empty. */
export const localToIso = (v: string): string | undefined => (v ? new Date(v).toISOString() : undefined);
/** ISO string -> `datetime-local` value in the browser's time zone. */
export const isoToLocal = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
