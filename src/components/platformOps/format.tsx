import { Chip, type Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { billingError } from '@/components/billing/format';
import type {
  AnnouncementStatus,
  AuditRow,
  HealthStatus,
  IncidentStatus,
  OrgStatus,
  Severity,
  TicketPriority,
  TicketStatus,
} from '@/types/platformOps';

/** "5 min ago", "2 h ago", "3 d ago"; falls back to a date after 30 days. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
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

/** "1 h 20 m" from minutes. */
export function hoursMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h >= 48) return `${Math.floor(h / 24)} d ${h % 24} h`;
  return h > 0 ? `${h} h ${r} m` : `${r} m`;
}

/** Indian Standard Time, "1 Nov, 10:00 am". */
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

/** Value for `<input type="datetime-local">` in IST from an ISO instant. */
export function toIstInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + 330 * 60_000);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
}
/** ISO instant from a datetime-local value typed in IST. */
export function fromIstInput(local: string): string | null {
  if (!local) return null;
  const t = Date.parse(`${local}:00.000Z`) - 330 * 60_000;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export const TICKET_STATUS: Record<TicketStatus, [string, Tone]> = {
  OPEN: ['Open', 'info'],
  IN_PROGRESS: ['In progress', 'warn'],
  WAITING: ['Waiting on society', 'neutral'],
  RESOLVED: ['Resolved', 'ok'],
  CLOSED: ['Closed', 'neutral'],
};
export const PRIORITY: Record<TicketPriority, [string, Tone]> = {
  LOW: ['Low', 'neutral'],
  MEDIUM: ['Medium', 'info'],
  HIGH: ['High', 'bad'],
};
export const CATEGORY_LABEL: Record<string, string> = {
  BILLING: 'Billing',
  PAYMENTS: 'Payments',
  TECHNICAL: 'Technical',
  ONBOARDING: 'Onboarding',
  ACCOUNT: 'Account',
  DATA_FIX: 'Data fix',
  FEATURE_REQUEST: 'Feature request',
  OTHER: 'Other',
};
export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }));

export const TicketStatusChip = ({ status }: { status: string }) => {
  const [label, tone] = TICKET_STATUS[status as TicketStatus] ?? [words(status), 'neutral' as Tone];
  return <Chip tone={tone}>{label}</Chip>;
};
export const PriorityChip = ({ priority }: { priority: string }) => {
  const [label, tone] = PRIORITY[priority as TicketPriority] ?? [words(priority), 'neutral' as Tone];
  return <Chip tone={tone}>{label}</Chip>;
};

const HEALTH: Record<HealthStatus, [string, Tone]> = {
  OPERATIONAL: ['Operational', 'ok'],
  DEGRADED: ['Degraded', 'warn'],
  OUTAGE: ['Outage', 'bad'],
  UNKNOWN: ['Unknown', 'neutral'],
};
export const HealthChip = ({ status }: { status: string }) => {
  const [label, tone] = HEALTH[status as HealthStatus] ?? [words(status), 'neutral' as Tone];
  return <Chip tone={tone}>{label}</Chip>;
};

export const SEVERITY_TONE: Record<Severity, Tone> = { SEV1: 'bad', SEV2: 'bad', SEV3: 'warn', SEV4: 'info' };
const INCIDENT: Record<IncidentStatus, [string, Tone]> = {
  INVESTIGATING: ['Investigating', 'bad'],
  IDENTIFIED: ['Identified', 'warn'],
  MONITORING: ['Monitoring', 'info'],
  RESOLVED: ['Resolved', 'ok'],
};
export const IncidentChip = ({ status }: { status: string }) => {
  const [label, tone] = INCIDENT[status as IncidentStatus] ?? [words(status), 'neutral' as Tone];
  return <Chip tone={tone}>{label}</Chip>;
};

const ANN: Record<AnnouncementStatus, [string, Tone]> = {
  DRAFT: ['Draft', 'neutral'],
  SCHEDULED: ['Scheduled', 'info'],
  PUBLISHED: ['Published', 'ok'],
  EXPIRED: ['Expired', 'neutral'],
  CANCELLED: ['Cancelled', 'bad'],
};
export const AnnouncementChip = ({ status }: { status: string }) => {
  const [label, tone] = ANN[status as AnnouncementStatus] ?? [words(status), 'neutral' as Tone];
  return <Chip tone={tone}>{label}</Chip>;
};

export const COMPONENT_LABEL: Record<string, string> = {
  api: 'Sign-in and API',
  admin_app: 'Society admin app',
  resident_app: 'Resident app',
  gate_console: 'Guard console',
  work_app: 'Staff app',
  payments: 'Online payments',
  notifications_sms: 'SMS',
  notifications_whatsapp: 'WhatsApp',
  notifications_email: 'Email',
  notifications_push: 'Push notifications',
  file_storage: 'Documents and photos',
  visitor_calls: 'Visitor calls',
};

export const CHANNEL_LABEL: Record<string, string> = {
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  PUSH: 'Push',
  PAYMENT_GATEWAY: 'Payment gateway',
  STORAGE: 'File storage',
  IVR: 'Visitor calls (IVR)',
};

/** Words for a module 07 error code; falls back to the billing wording, then the API message. */
const TEXT: Record<string, string> = {
  STALE_VERSION: 'This changed while you were looking. It has been reloaded; check and try again.',
  TICKET_CLOSED: 'This ticket is closed and cannot be changed.',
  INVALID_STATE: 'That change is not allowed in the current state.',
  PUBLIC_REPLY_REQUIRED: 'Send a public reply to the society before you set this status.',
  ASSIGNEE_NOT_ELIGIBLE: 'That person cannot be assigned tickets.',
  TOO_MANY_OPEN_TICKETS: 'You have too many open tickets. Close some before raising another.',
  REOPEN_WINDOW_EXPIRED: 'The time to reopen this ticket has passed. Raise a new ticket.',
  REOPEN_LIMIT_REACHED: 'This ticket was reopened the maximum number of times. Raise a new ticket.',
  RATING_ALREADY_GIVEN: 'You already rated this ticket.',
  PROVIDER_KEY_TAKEN: 'That provider key was used before. Choose another.',
  PROVIDER_PRIORITY_TAKEN: 'Another provider of this channel already has that priority.',
  PROVIDER_IN_USE: 'Disable the provider before you delete it.',
  LAST_ENABLED_PROVIDER: 'This is the last enabled provider of its channel, so it cannot be disabled.',
  PROVIDER_CREDENTIALS_MISSING: 'Add credentials to this provider first.',
  CREDENTIALS_NOT_APPLICABLE: 'This provider reads its credentials from the server environment.',
  CREDENTIALS_SCHEMA_INVALID: 'The credentials do not match what this vendor needs. Check each field.',
  CONFIG_SCHEMA_INVALID: 'The settings do not match what this vendor needs. Check each field.',
  VENDOR_NOT_ALLOWED_FOR_CHANNEL: 'That vendor does not serve this channel.',
  FAKE_PROVIDER_IN_PRODUCTION: 'The fake provider cannot be used in production.',
  TEST_RECIPIENT_REQUIRED: 'Enter a phone number or email to send the test to.',
  ROOT_CAUSE_REQUIRED: 'Describe the root cause (at least 20 characters) for a SEV1 or SEV2 incident.',
  INCIDENT_UPDATES_LIMIT: 'This incident has reached its limit of 100 updates.',
  NOTIFY_REQUIRES_PUBLIC_SEV1_SEV2: 'Societies can be notified only about public SEV1 or SEV2 incidents.',
  WHATSAPP_NOT_ALLOWED: 'WhatsApp is only for critical or maintenance announcements.',
  CTA_URL_NOT_ALLOWED: 'The link must start with https:// and point to an allowed address.',
  UNKNOWN_PLAN_KEY: 'One of the chosen plans does not exist.',
  AUDIENCE_EMPTY: 'No one would receive this. Widen the audience.',
  PUBLISH_WINDOW_INVALID: 'The publish time or the expiry has already passed. Change the times.',
  NOT_DISMISSIBLE: 'This notice cannot be dismissed.',
  JOB_NOT_FAILED: 'That job is no longer in the failed list.',
  JOB_NOT_FOUND: 'That job no longer exists.',
  QUEUE_NOT_FOUND: 'That queue does not exist.',
  QUEUE_ALREADY_PAUSED: 'The queue is already paused.',
  QUEUE_NOT_PAUSED: 'The queue is not paused.',
  AUDIT_RANGE_TOO_LARGE: 'Choose a date range of at most 366 days.',
  INVALID_CURSOR: 'Reload the list and try again.',
  EXPORT_TOO_LARGE: 'More than 100,000 rows. Narrow the filters.',
  ARCHIVE_NOT_FOUND: 'That archive is not available.',
  SETTING_READ_ONLY: 'That setting is managed by the system.',
  GSTIN_STATE_MISMATCH: 'The GSTIN must start with the state code and contain the PAN.',
  SUSPEND_NOT_AFTER_PAST_DUE: 'Suspend must come at least one day after past due.',
  REMINDER_BEFORE_ISSUE: 'A reminder cannot be earlier than the payment terms allow.',
  ALLOWLIST_EXCLUDES_YOU: 'That allowlist would lock you out. Add your own address.',
  ORGANIZATION_SLUG_TAKEN: 'That web address is already used by another organization.',
  ORGANIZATION_HAS_SOCIETIES: 'Close or move the organization’s societies first.',
  IP_NOT_ALLOWED: 'This address is not on the platform allowlist.',
  SOCIETY_CLOSED: 'That society is closed.',
  RAISER_NOT_MEMBER: 'That person is not an active member of the society.',
};

export function opsError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'VALIDATION_FAILED' || e.code === 'SETTING_VALUE_INVALID') return billingError(e);
    const t = TEXT[e.code];
    if (t) return t;
  }
  return billingError(e);
}

/** The "Live" pill of the prototype headers. */
export function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcefe5] px-2.5 py-0.5 text-[12px] font-semibold text-[#14583a]">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" />
      Live
    </span>
  );
}

export const roleLabel = (key: string) => words(key.replace(/_/g, ' '));

export type AuditScope = 'platform' | 'society';

/** "SocietyApp Support · Platform" for platform people seen from a society (spec 11.7). */
export function actorLabel(row: AuditRow, scope: AuditScope): string {
  const platformSide = row.source === 'Platform console' || row.source === 'Support access';
  if (scope === 'society' && platformSide) return 'SocietyApp Support · Platform';
  return row.actor.name;
}

const ORG_TONE: Record<OrgStatus, [string, Tone]> = {
  ACTIVE: ['Active', 'ok'],
  SUSPENDED: ['Suspended', 'bad'],
  CLOSED: ['Closed', 'neutral'],
};
export const OrgStatusChip = ({ status }: { status: OrgStatus }) => (
  <Chip tone={ORG_TONE[status][1]}>{ORG_TONE[status][0]}</Chip>
);

/** True while `iso` is still in the future. */
export const isFuture = (iso: string | null | undefined) => !!iso && Date.parse(iso) > Date.now();
