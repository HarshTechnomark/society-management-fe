import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import type {
  Designation,
  ExitReason,
  JoinMode,
  Portfolio,
  SeatFlag,
  TermKind,
  TermSource,
  TermStatus,
} from '@/types/committee';

/** Words for every module 10 error code (spec section 12). Section 11.3 and 11.4 give some of the texts. */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  USAGE_LIMIT_EXCEEDED: 'All staff seats are used. Free one staff seat or upgrade your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  CANNOT_GRANT_UNHELD_PERMISSION: 'You cannot give a role with more access than yours.',
  SELF_CHANGE_NOT_ALLOWED: 'You cannot change your own role. Ask another committee member.',
  COMMITTEE_TERM_NOT_FOUND: 'This committee term was not found. It may have been deleted.',
  COMMITTEE_SEAT_NOT_FOUND: 'This seat is not in the committee any more. Reload the page.',
  HANDOVER_ITEM_NOT_FOUND: 'This checklist item was not found. Reload the page.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed in the current state of the committee. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  COMMITTEE_DRAFT_EXISTS: 'A draft committee already exists. Edit or delete it first.',
  COMMITTEE_PREVIEW_STALE: 'Something changed since you opened this. Review the updated plan.',
  LAST_CHAIRMAN: 'The society needs at least one active chairman.',
  COMMITTEE_TERM_DATES_INVALID:
    'The dates are not valid. The end must be after the start and within 5 years, and the date must fall inside the term.',
  COMMITTEE_TERM_NOT_STARTED: 'This committee starts later. It cannot take charge before its start date.',
  COMMITTEE_STRENGTH_INVALID:
    'The number of seats is not valid. Use 3 to 25 seats, and not fewer than the seats filled.',
  COMMITTEE_DESIGNATION_DUPLICATE: 'Only one Chairman, Secretary and Treasurer per committee.',
  COMMITTEE_HOLDER_DUPLICATE: 'The same person is on the committee twice.',
  COMMITTEE_OFFICE_BEARERS_REQUIRED: 'The committee needs a Chairman, a Secretary and a Treasurer.',
  COMMITTEE_CHAIRMAN_REQUIRED: 'Pick the new chairman before the current one steps down.',
  COMMITTEE_HOLDER_NOT_MEMBER: 'Not on the app yet. Invite them as a resident first.',
  COMMITTEE_HOLDER_NOT_ACTIVE: 'This person is suspended or has not accepted the invitation yet.',
  COMMITTEE_HOLDER_INELIGIBLE: 'Only flat owners can be on the committee.',
  COMMITTEE_ROLE_CONFLICT:
    'This person already has a staff or custom role. Tick "Replace current role" to move them to the committee.',
  COMMITTEE_ELECTED_SEATS_LOCKED: 'Elected members come from the election result and cannot be changed here.',
  COMMITTEE_COOPTION_NOT_ALLOWED: 'Your society settings do not allow co-opting members.',
  COMMITTEE_CHANGE_INVALID:
    'These changes do not fit together. Check for the same seat twice, the same designation or an elected add.',
  COMMITTEE_SEAT_LIMIT: 'The committee has too many seat entries (limit 150).',
  HANDOVER_ITEM_LIMIT: 'A checklist can have at most 40 items.',
  FILE_NOT_LINKABLE: 'This file cannot be used here. Upload it again.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  SUPPORT_GRANT_READ_ONLY: 'Support access is read only. Committee changes are not possible.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
  // passed through from module 03
  INVITATION_ALREADY_PENDING: 'An invitation is already waiting for this person.',
  ALREADY_MEMBER: 'This person is already a member of the society.',
  MEMBER_SUSPENDED: 'This person is suspended. Enable them instead of inviting again.',
  EMAIL_IN_USE: 'This email belongs to another person.',
};

/** The message for an error, in plain words. */
export function committeeError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  return TEXT[e.code] ?? e.message;
}
/** The same error with its message in plain words, for `ErrorState` (keeps the support reference). */
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, committeeError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}
export const KNOWN_ERROR_CODES = Object.keys(TEXT);

/** `errors[0].termId` of a `409 COMMITTEE_DRAFT_EXISTS`. */
export function existingDraftId(e: unknown): number | null {
  if (!(e instanceof ApiError) || e.code !== 'COMMITTEE_DRAFT_EXISTS') return null;
  const v =
    (e.errors?.[0] as { termId?: unknown; message?: unknown } | undefined)?.termId ?? e.errors?.[0]?.message;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Codes that belong next to a field of the term form (spec 11.3). */
export const SEAT_FIELD_CODES: Record<string, 'designation' | 'holder' | 'flat'> = {
  COMMITTEE_DESIGNATION_DUPLICATE: 'designation',
  COMMITTEE_HOLDER_DUPLICATE: 'holder',
  COMMITTEE_HOLDER_NOT_MEMBER: 'holder',
  COMMITTEE_HOLDER_NOT_ACTIVE: 'holder',
  COMMITTEE_HOLDER_INELIGIBLE: 'flat',
  COMMITTEE_ROLE_CONFLICT: 'holder',
};

export const DESIGNATION_LABEL: Record<Designation, string> = {
  CHAIRMAN: 'Chairman',
  VICE_CHAIRMAN: 'Vice Chairman',
  SECRETARY: 'Secretary',
  JOINT_SECRETARY: 'Joint Secretary',
  TREASURER: 'Treasurer',
  MEMBER: 'Member',
};
/** Order of seat cards: Chairman first, Members last. */
export const DESIGNATION_ORDER: Designation[] = [
  'CHAIRMAN',
  'VICE_CHAIRMAN',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
  'MEMBER',
];
export const JOIN_LABEL: Record<JoinMode, string> = {
  ELECTED: 'Elected',
  CO_OPTED: 'Co-opted',
  NOMINATED: 'Nominated',
  APPOINTED: 'Appointed',
};
export const PORTFOLIO_LABEL: Record<Portfolio, string> = {
  ACCOUNTS: 'Accounts',
  MAINTENANCE: 'Maintenance',
  SECURITY: 'Security',
  EVENTS: 'Events',
  LEGAL: 'Legal',
  HOUSEKEEPING: 'Housekeeping',
  PARKING: 'Parking',
  OTHER: 'Other',
};
export const KIND_LABEL: Record<TermKind, string> = {
  ELECTED: 'Elected',
  PROVISIONAL: 'Provisional',
  AD_HOC: 'Ad hoc',
};
export const SOURCE_LABEL: Record<TermSource, string> = {
  MANUAL: 'Manual',
  ELECTION: 'From election',
  HISTORICAL: 'Past record',
};
export const STATUS_LABEL: Record<TermStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  EXPIRED: 'Caretaker',
  ENDED: 'Ended',
};
export const STATUS_TONE: Record<TermStatus, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'ok',
  EXPIRED: 'warn',
  ENDED: 'neutral',
};
export const EXIT_LABEL: Record<ExitReason, string> = {
  TERM_ENDED: 'Term ended',
  RESIGNED: 'Resigned',
  REMOVED: 'Removed',
  DECEASED: 'Deceased',
  DISQUALIFIED: 'Disqualified',
  REDESIGNATED: 'Changed designation',
  MEMBERSHIP_ENDED: 'Membership ended',
};
export const FLAG_LABEL: Record<SeatFlag, string> = {
  ROLE_MISMATCH: 'Role does not match the seat',
  MEMBERSHIP_SUSPENDED: 'Membership suspended',
  NOT_OWNER: 'No longer an owner',
};

export const ROLE_LABEL: Record<string, string> = {
  chairman: 'Chairman',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  committee_member: 'Committee Member',
  society_admin: 'Society Admin',
  accountant: 'Accountant',
  facility_manager: 'Facility Manager',
  security_supervisor: 'Security Supervisor',
  auditor: 'Auditor',
  owner: 'Owner',
  tenant: 'Tenant',
  resident: 'Resident',
};
export const roleLabel = (key: string) =>
  ROLE_LABEL[key] ??
  key
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

export const COMMITTEE_ROLE_KEYS = ['chairman', 'secretary', 'treasurer', 'committee_member'];
export const STAFF_ROLE_KEYS = [
  'society_admin',
  'accountant',
  'facility_manager',
  'security_supervisor',
  'auditor',
];

export const BLOCKER_FIX: Record<string, string> = {
  NO_FREE_SEAT: 'Free one staff seat or upgrade.',
  HOLDER_NOT_MEMBER: 'Invite them to the app as a resident first.',
  HOLDER_NOT_ACTIVE: 'Enable the member or wait for them to accept the invitation.',
  HOLDER_INELIGIBLE: 'Only flat owners can be on the committee.',
  OFFICE_BEARERS_REQUIRED: 'Add a Chairman, a Secretary and a Treasurer.',
  ROLE_CONFLICT: 'Tick "Replace current role" for this person.',
  TERM_NOT_STARTED: 'Wait for the start date of the term.',
  UNHELD_PERMISSION: 'You cannot give access you do not have. Ask the chairman.',
  SELF_CHANGE: 'You cannot change your own role. Ask another committee member.',
};

/** "Term ends in 28 days. Plan the election." and the other banner texts of spec 11.1. */
export function bannerText(
  b: { code: string; daysLeft?: number; endedOn?: string | null },
  fmt: (iso: string | null | undefined) => string,
): string {
  switch (b.code) {
    case 'TERM_ENDING': {
      const d = b.daysLeft ?? 0;
      return d <= 0
        ? 'Term ends today. Plan the election.'
        : `Term ends in ${d} ${d === 1 ? 'day' : 'days'}. Plan the election.`;
    }
    case 'CARETAKER':
      return `Term ended${b.endedOn ? ` on ${fmt(b.endedOn)}` : ''}. The committee continues as caretaker until the new committee takes charge.`;
    case 'DRAFT_FROM_ELECTION':
      return 'Election results are in. Review the new committee.';
    default:
      return 'No committee recorded yet. Add your managing committee.';
  }
}

export const today = () => new Date().toISOString().slice(0, 10);
export const designationLabel = (d: Designation) => DESIGNATION_LABEL[d] ?? d;
/** "Member · Co-opted" for a member who joined other than by election, else the designation. */
export const seatLabel = (designation: Designation, joinMode: JoinMode) =>
  designation === 'MEMBER' && joinMode !== 'ELECTED'
    ? `Member · ${JOIN_LABEL[joinMode]}`
    : DESIGNATION_LABEL[designation];

export const opts = <T extends string>(map: Record<T, string>) =>
  (Object.keys(map) as T[]).map(value => ({ value, label: map[value] }));
