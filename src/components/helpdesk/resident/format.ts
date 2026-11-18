import { inr } from '@/lib/money';
import { ApiError } from '@/lib/apiClient';
import type { ResidentTicket } from '@/types/helpdeskResident';
import type { Tone } from '@/components/ui/Chip';

/** Words for the section 12 codes the resident and field helpdesk calls can return. */
export const HELP_TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  FEATURE_NOT_IN_PLAN: 'This is not part of your society’s plan.',
  PERMISSION_DENIED: 'You cannot do this on this complaint.',
  TICKET_NOT_FOUND: 'This complaint was not found.',
  CATEGORY_NOT_FOUND: 'This category is not available. Choose another one.',
  UNIT_NOT_FOUND: 'This flat was not found among your flats.',
  LOCATION_NOT_FOUND: 'This place was not found. Choose it again.',
  QR_NOT_FOUND: 'This QR code is not valid for your society.',
  UPVOTE_NOT_FOUND: 'You have not added Me too on this issue.',
  ALREADY_UPVOTED: 'You already added Me too on this issue.',
  INVALID_STATE: 'This cannot be done in its current state. Reload the page.',
  TICKET_INVALID_TRANSITION: 'This cannot be done at the current stage of the complaint.',
  STALE_VERSION: 'This changed in the meantime. Reload the page and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  SIMILAR_ISSUE_EXISTS: 'A similar issue is already open. Tap Me too on it, or say why yours is different.',
  ESTIMATE_APPROVER_NOT_ALLOWED: 'Only an owner or tenant of the flat can decide on the estimate.',
  CATEGORY_ARCHIVED: 'This category is no longer in use. Choose another one.',
  CATEGORY_SCOPE_MISMATCH: 'This category does not fit this kind of report.',
  SUBCATEGORY_PARENT_MISMATCH: 'The sub-category does not belong to the category.',
  LOCATION_ARCHIVED: 'This place is no longer in use. Choose another one.',
  AFFECTED_LEVEL_INVALID: 'This place cannot affect that many flats. Choose another place.',
  URGENCY_NOT_ALLOWED: 'Emergency is only for building issues. Choose Normal or Urgent.',
  FILE_NOT_LINKABLE: 'A photo could not be used. Add it again.',
  FILE_INFECTED: 'A photo failed the safety check. Choose another photo.',
  FILE_NOT_READY: 'A photo is still being checked. Try again in a minute.',
  COMMENT_NOT_ALLOWED: 'Only the person who reported it, or those who added Me too, can reply here.',
  RATING_NOT_ALLOWED: 'You cannot rate this complaint.',
  RATING_WINDOW_EXPIRED: 'The time to rate this complaint is over.',
  REOPEN_WINDOW_EXPIRED: 'The time to reopen this complaint is over. Raise a new one.',
  REOPEN_LIMIT_REACHED: 'This complaint was reopened too many times. Raise a new one.',
  TICKET_HAS_UPVOTES: 'Others added Me too on this issue, so it cannot be cancelled. Ask the committee.',
  UPVOTE_NOT_BUILDING_ISSUE: 'Me too works only on building issues.',
  UPVOTE_OWN_TICKET: 'You reported this issue yourself.',
  ESCALATION_NOT_ALLOWED: 'You can ask the committee to look at this only after the due time has passed.',
  ESCALATION_TOO_SOON: 'You already asked in the last 24 hours. Wait a little.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

export function helpError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  return HELP_TEXT[e.code] ?? e.message;
}

/** The same error in plain words for `ErrorState` (keeps the support reference). */
export function plainHelpError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, helpError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

/** Ids from `errors[]` of SIMILAR_ISSUE_EXISTS. */
export const isSimilarError = (e: unknown) => e instanceof ApiError && e.code === 'SIMILAR_ISSUE_EXISTS';

export const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Received',
  REOPENED: 'Reopened',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'Being fixed',
  WAITING_ON_RESIDENT: 'Waiting for you',
  RESOLVED: 'Fixed, please confirm',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
export function statusTone(s: string): Tone {
  if (s === 'RESOLVED' || s === 'CLOSED') return 'ok';
  if (s === 'WAITING_ON_RESIDENT') return 'warn';
  if (s === 'CANCELLED') return 'neutral';
  return 'info';
}
export const isTerminal = (s: string) => ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(s);

export const PRIORITY_LABEL: Record<string, string> = {
  P1: 'Emergency',
  P2: 'Urgent',
  P3: 'Normal',
  P4: 'Low',
};

/** The steps shown on the ticket page. */
export const STEPS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export function stepIndex(status: string): number {
  if (status === 'WAITING_ON_RESIDENT') return 2;
  return Math.max(0, STEPS.indexOf(status));
}

const IST = 'Asia/Kolkata';
/** "Tue 4 pm" style, in India time. */
export function whenText(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: IST,
  });
  const time = d
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST })
    .replace(':00', '');
  return `${day}, ${time}`;
}

export function etaText(t: Pick<ResidentTicket, 'status' | 'waitingReason' | 'resolutionDueAt'>): string {
  if (t.status === 'WAITING_ON_RESIDENT') return 'On hold: waiting for you';
  if (isTerminal(t.status)) return '';
  if (!t.resolutionDueAt) return '';
  const due = new Date(t.resolutionDueAt).getTime();
  return !Number.isNaN(due) && due < Date.now()
    ? `Overdue since ${whenText(t.resolutionDueAt)}`
    : `Expected by ${whenText(t.resolutionDueAt)}`;
}

/** What the resident may do: the API's `allowedActions` (CONFIRM, REOPEN, CANCEL, RATE, ESCALATE, COMMENT) is the only source. */
export const canDo = (
  t: Pick<ResidentTicket, 'allowedActions'> & { canRate?: boolean | null },
  action: string,
): boolean => t.allowedActions.includes(action) && !(action === 'RATE' && t.canRate === false);

/** The estimate card: waiting on the resident for the estimate, and the estimate was sent. */
export const estimateOpen = (t: Pick<ResidentTicket, 'status' | 'waitingReason' | 'charge'>): boolean =>
  t.status === 'WAITING_ON_RESIDENT' &&
  t.waitingReason === 'ESTIMATE_APPROVAL' &&
  t.charge?.status === 'ESTIMATE_SENT';

export const URGENCY_LABEL: Record<string, string> = {
  NORMAL: 'Normal',
  URGENT: 'Urgent',
  EMERGENCY: 'Emergency',
};

/** Other residents are never named: "A neighbour" on a building issue, "Neighbour" elsewhere. */
export function commentAuthor(label: string, role: string, kind: string): string {
  if (!label) return 'Society';
  if (role === 'RESIDENT' && label !== 'You') {
    if (kind === 'BUILDING') return 'A neighbour';
    if (/^(user|resident)(,|$)/i.test(label)) return 'Neighbour';
  }
  return label;
}

/** Amounts in comment text ("Rs 650.00") shown as ₹ in Indian format. */
export function rupeeText(text: string): string {
  return text.replace(/\b(?:Rs\.?|INR)\s?(\d[\d,]*(?:\.\d+)?)/g, (_m, n: string) => {
    const v = Number(n.replace(/,/g, ''));
    return Number.isFinite(v) ? inr(Math.round(v * 100)) : _m;
  });
}
