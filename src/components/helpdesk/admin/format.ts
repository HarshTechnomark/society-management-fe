import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type { Priority, SlaState, TicketStatus } from '@/types/helpdesk';
export { ago, dateTime } from '@/components/approvals/format';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  WAITING_ON_RESIDENT: 'Waiting on resident',
  REOPENED: 'Reopened',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
/** The order of the groups in the list (spec 11.1). */
export const STATUS_ORDER: TicketStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_ON_RESIDENT',
  'REOPENED',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];
export const statusTone = (s: TicketStatus): Tone =>
  s === 'RESOLVED' || s === 'CLOSED'
    ? 'ok'
    : s === 'CANCELLED'
      ? 'neutral'
      : s === 'OPEN' || s === 'REOPENED'
        ? 'warn'
        : 'info';

export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: 'P1 Emergency',
  P2: 'P2 Urgent',
  P3: 'P3 Normal',
  P4: 'P4 Low',
};
export const priorityTone = (p: Priority): Tone => (p === 'P1' ? 'bad' : p === 'P2' ? 'warn' : 'neutral');

/** "3 h left", "2 days left", "SLA breached 2 h" from the due time, or "Paused" while waiting. */
export function span(ms: number): string {
  const m = Math.floor(Math.abs(ms) / 60000);
  if (m < 60) return `${Math.max(m, 1)} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} days`;
}
export function slaChip(
  state: SlaState,
  dueAt: string | null,
  status: TicketStatus,
  now = Date.now(),
): { tone: Tone; text: string } | null {
  if (status === 'RESOLVED' || status === 'CLOSED' || status === 'CANCELLED' || state === 'NONE') {
    return state === 'BREACHED' ? { tone: 'bad', text: 'SLA breached' } : null;
  }
  if (state === 'PAUSED') return { tone: 'neutral', text: 'Paused' };
  const due = dueAt ? new Date(dueAt).getTime() : NaN;
  if (state === 'BREACHED')
    return { tone: 'bad', text: Number.isNaN(due) ? 'SLA breached' : `SLA breached ${span(now - due)}` };
  if (Number.isNaN(due)) return null;
  return { tone: state === 'AT_RISK' ? 'warn' : 'ok', text: `${span(due - now)} left` };
}

export const CHANNEL_LABEL: Record<string, string> = {
  APP: 'App',
  PHONE: 'Phone',
  WALK_IN: 'Walk-in',
  GATE: 'Gate',
  STAFF_APP: 'Staff app',
  QR: 'QR code',
  SYSTEM: 'System',
};
export const ROLE_LABEL: Record<string, string> = {
  RESIDENT: 'Resident',
  GUARD: 'Guard',
  STAFF: 'Staff',
  ADMIN: 'Office',
  COMMITTEE: 'Committee',
};

export const WAITING_REASONS = [
  { value: 'INFORMATION', label: 'Need information' },
  { value: 'ACCESS_TO_FLAT', label: 'Need access to the flat' },
  { value: 'CONFIRMATION', label: 'Need confirmation' },
  { value: 'OTHER', label: 'Something else' },
];

export const ACTION_LABEL: Record<string, string> = {
  START: 'Start work',
  WAIT_ON_RESIDENT: 'Waiting on resident',
  RESUME: 'Resume',
  RESOLVE: 'Mark resolved',
  CLOSE: 'Close',
  REOPEN: 'Reopen',
  CANCEL: 'Cancel ticket',
};

export const COMMENT_KIND_LABEL: Record<string, string> = {
  STATUS_CHANGE: 'Status',
  ASSIGNMENT: 'Assignment',
  PRIORITY_CHANGE: 'Priority',
  ESCALATION: 'Escalation',
  MERGE: 'Merged',
  ESTIMATE: 'Estimate',
  SYSTEM: 'System',
};

const ERROR_TEXT: Record<string, string> = {
  STALE_VERSION: 'Someone else changed this ticket. Showing the latest.',
  TICKET_NOT_FOUND: 'This ticket was not found.',
  TICKET_INVALID_TRANSITION: 'That is not possible from the ticket’s current status.',
  INVALID_STATE: 'The ticket is not in a state that allows this.',
  ALREADY_ASSIGNED: 'It is already assigned to this person.',
  ASSIGNEE_NOT_FOUND: 'This assignee was not found.',
  ASSIGNEE_NOT_ELIGIBLE: 'This person cannot take tickets right now.',
  AFTER_PHOTO_REQUIRED: 'This category needs an after photo before it can be resolved.',
  CHARGE_FINAL_REQUIRED: 'Enter the final charge, or waive it with a reason.',
  CHARGE_EXCEEDS_ESTIMATE: 'The final charge is above the approved estimate by more than the allowed margin.',
  CHARGE_INVOICED: 'The charge is already invoiced, so the ticket cannot be cancelled.',
  CHARGE_STATE_LOCKED: 'The charge setting cannot change after an estimate.',
  REOPEN_WINDOW_EXPIRED: 'The reopen window has passed.',
  REOPEN_LIMIT_REACHED: 'This ticket was reopened too many times.',
  FILE_NOT_LINKABLE: 'A photo could not be attached. Upload it again.',
  FILE_INFECTED: 'A photo failed the virus check.',
  MERGE_SELF: 'A ticket cannot be merged into itself.',
  MERGE_TARGET_INVALID: 'That issue cannot take this one: choose an open building issue.',
  ESTIMATE_NOT_ALLOWED: 'An estimate needs a chargeable flat ticket.',
  CATEGORY_NOT_FOUND: 'This category was not found.',
  CATEGORY_ARCHIVED: 'This category is archived.',
  CATEGORY_SCOPE_MISMATCH: 'This category does not fit this kind of ticket.',
  SUBCATEGORY_PARENT_MISMATCH: 'That sub-category belongs to another category.',
  UNIT_NOT_FOUND: 'This flat was not found.',
  RESIDENT_NOT_FOUND: 'That resident is not linked to this flat.',
  LOCATION_NOT_FOUND: 'This spot was not found.',
  LOCATION_ARCHIVED: 'This spot is archived.',
  AFFECTED_LEVEL_INVALID: 'That level is not possible for this spot.',
  SIMILAR_ISSUE_EXISTS: 'A similar issue is already open. Give a reason to report it anyway.',
  INVOICE_NOT_FOUND: 'This invoice was not found.',
  INVOICE_DISPUTE_OPEN: 'Another dispute ticket is already open for this invoice.',
  INVOICE_NOT_DISPUTABLE: 'This invoice cannot be disputed.',
  COMMENT_NOT_FOUND: 'This comment was not found.',
  COMMENT_DELETE_WINDOW_EXPIRED: 'You can remove your own update only within 15 minutes.',
  COMMENT_NOT_ALLOWED: 'This update is not allowed.',
  EXPORT_TOO_LARGE: 'Too many tickets to export. Narrow the dates and try again.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This was already sent. Reload and check.',
  SOCIETY_SUSPENDED: 'The society is suspended, so changes cannot be saved.',
  CATEGORY_NAME_TAKEN: 'Another category at this level already has this name.',
  CATEGORY_DEPTH_EXCEEDED: 'A sub-category cannot have its own sub-categories.',
  CATEGORY_DEFAULTS_REQUIRED: 'A top-level category needs a default priority and assignee type.',
  CATEGORY_LIMIT_REACHED: 'The category limit is reached (40 main, 30 sub-categories each).',
  DEFAULT_ASSIGNEE_INVALID: 'The default assignee is not valid for this type.',
  SLA_POLICY_NOT_FOUND: 'This SLA policy was not found.',
  SLA_POLICY_NAME_TAKEN: 'Another policy already has this name.',
  SLA_POLICY_IN_USE: 'An active category still uses this policy. Change the category first.',
  SLA_TARGETS_INVALID:
    'Each response time must be shorter than its resolution time, within the allowed range.',
  DEFAULT_POLICY_REQUIRED:
    'The default policy cannot be archived or un-defaulted. Make another one the default.',
  SLA_POLICY_LIMIT_REACHED: 'At most 20 active policies are allowed.',
  ESCALATION_RULE_NOT_FOUND: 'This rule was not found.',
  ESCALATION_TARGET_INVALID: 'The role, designation or member is not valid.',
  ESCALATION_RULE_LIMIT_REACHED: 'At most 30 active rules are allowed.',
  HELPDESK_WAITING_RULE_INVALID: 'Auto-resolve days (times 24) must be more than the waiting reminder hours.',
  UNKNOWN_SETTING_KEY: 'One of the settings is not known.',
  SETTING_VALUE_INVALID: 'One of the values is outside its allowed range.',
  FEATURE_NOT_IN_PLAN: 'This is not part of your plan.',
};
const FIELD_NAME: Record<string, string> = {
  targetDesignation: 'the designation',
  targetRoleKey: 'the role',
  targetUserId: 'the member',
  targetType: 'who to tell',
  thresholdPercent: 'the percentage',
  priority: 'the priority',
  categoryId: 'the category',
  name: 'the name',
};
/** Zod's raw wording ("Invalid enum value...", "Required") becomes a short human sentence. */
function plainFieldMessage(field: string | undefined, message: string): string {
  if (!/^(invalid|required|expected|too (small|big)|string must|number must)/i.test(message.trim()))
    return message;
  const name = field ? (FIELD_NAME[field.split('.').pop() ?? ''] ?? 'this field') : 'this field';
  return /required/i.test(message) ? `Fill in ${name}.` : `Check ${name} and try again.`;
}
/** Readable text for an API error: the field messages of a 400, the code's wording, else the API message. */
export const helpdeskError = (e: unknown): string => {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const detail = e.errors?.map(x => plainFieldMessage(x.field, x.message)).filter(Boolean);
  if (e.code === 'VALIDATION_FAILED' && detail?.length) return detail.join(' ');
  if (e.code === 'FEATURE_NOT_IN_PLAN') return e.message || ERROR_TEXT.FEATURE_NOT_IN_PLAN;
  return ERROR_TEXT[e.code] ?? e.message;
};
export const isStale = (e: unknown) => e instanceof ApiError && e.code === 'STALE_VERSION';

/** The error as `ErrorState` shows it: readable, keeping the support reference. */
export const plainError = (e: unknown): unknown =>
  e instanceof ApiError
    ? new ApiError(e.status, e.code, helpdeskError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;

/** "1 day 3 h" style duration from minutes, for SLA targets and medians. */
export function minutesText(m: number | null): string {
  if (m == null) return '-';
  if (m < 60) return `${m} min`;
  if (m < 60 * 24 && m % 60 === 0) return `${m / 60} h`;
  if (m % (60 * 24) === 0) return `${m / (60 * 24)} d`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${(m / 1440).toFixed(1)} d`;
}
