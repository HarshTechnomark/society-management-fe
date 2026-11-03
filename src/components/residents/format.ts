import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { shortDate } from '@/lib/money';
import type {
  DocType,
  FamilyRelation,
  JoinStatus,
  KycStatus,
  MoveStatus,
  Occupancy,
  PermitStatus,
  PoliceStatus,
  Relation,
  TenancyStatus,
  TransferStatus,
  TransferType,
  VerificationStatus,
  WorkCategory,
} from '@/types/residents';

/** Words for every module 09 error code (spec section 12) and the codes it passes through. */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  OWNER_ACTION_ONLY: 'Only an owner, or the primary owner of the flat, can do this.',
  HOUSEHOLD_CONTROL_REQUIRED: 'You do not manage this household, so you cannot change it.',
  EMERGENCY_PROFILE_LOCKED: 'Emergency details open only while an SOS is active for the flat.',
  DIRECTORY_DISABLED: 'Your society has turned the neighbour directory off.',
  RESIDENT_NOT_FOUND: 'This person no longer exists.',
  LINK_NOT_FOUND: 'This flat link no longer exists, or the flat is not yours.',
  UNIT_NOT_FOUND: 'This flat was not found.',
  TENANCY_NOT_FOUND: 'This tenancy no longer exists.',
  DOCUMENT_NOT_FOUND: 'This document was not found.',
  JOIN_REQUEST_NOT_FOUND: 'This join request was not found.',
  MOVE_REQUEST_NOT_FOUND: 'This move request was not found.',
  PERMIT_NOT_FOUND: 'This renovation permit was not found.',
  TRANSFER_NOT_FOUND: 'This ownership transfer was not found.',
  PET_NOT_FOUND: 'This pet was not found.',
  SOS_NOT_FOUND: 'This SOS was not found.',
  SOCIETY_CODE_NOT_FOUND: 'No society has this code. Check it with your committee.',
  IMPORT_JOB_NOT_FOUND: 'This import was not found.',
  RESIDENT_MOBILE_EXISTS: 'This mobile number already belongs to a resident of the society.',
  RESIDENT_HAS_ACTIVE_LINKS: 'End the flat links of this person first, then delete.',
  LINK_ALREADY_ACTIVE: 'This person is already linked to the flat.',
  OWNER_ALREADY_EXISTS: 'This flat already has an owner. Add a co-owner or start an ownership transfer.',
  ALREADY_LINKED: 'This person is already linked to the flat or already has app access.',
  JOIN_REQUEST_EXISTS: 'You already have a join request waiting in this society.',
  TENANCY_ALREADY_ACTIVE: 'This flat already has a live tenancy. End it first.',
  MOVE_REQUEST_EXISTS: 'An open move request already exists for this flat. Complete or cancel it first.',
  MOVE_SLOT_CONFLICT: 'This lift and time slot are already booked. Pick another slot.',
  PERMIT_EXISTS: 'This flat already has an open renovation permit.',
  TRANSFER_EXISTS: 'This flat already has an open ownership transfer.',
  TRANSFER_SELLER_MISMATCH: 'The owners changed after the transfer was submitted. Cancel and start it again.',
  DOCUMENT_IN_USE: 'This document is attached to a pending request, so it cannot be removed.',
  IMPORT_RUNNING: 'Another import is running. Wait for it to finish.',
  UNIT_NOT_RESIDENTIAL: 'This unit is a parking-only unit. People cannot live in it.',
  OWNER_REQUIRED: 'The flat needs an owner for this. Add the owner first.',
  OWNERSHIP_SHARE_INVALID: 'Ownership shares must add up to exactly 100%.',
  PRIMARY_MUST_BE_OWNER: 'The primary contact must be an owner.',
  LINK_DATES_INVALID: 'The dates overlap or fall in the wrong order. Check from and to dates.',
  NO_LIVE_TENANCY: 'The flat has no live tenancy for a tenant household.',
  USE_TENANCY_FLOW: 'Tenants are managed through tenancies. Use the Tenancies tab.',
  MINOR_NOT_ALLOWED: 'A minor cannot be an owner or a tenant. Check the date of birth.',
  INVITE_NOT_POSSIBLE: 'An invite needs a mobile number and permission to log in.',
  MOBILE_MANAGED_BY_USER: 'This person has a login and changes the mobile in their own security settings.',
  MEMBER_HAS_LOGIN: 'This member manages their own profile, so you cannot edit it.',
  DOCUMENT_TYPE_NOT_ALLOWED: 'This kind of document cannot be uploaded here.',
  DOCUMENTS_REQUIRED: 'Some required documents are missing. Attach them and try again.',
  APPROVAL_NOT_FOUND: 'This approval request was not found. Reload the page.',
  SOCIETY_NOT_JOINABLE: 'This society is not accepting join requests right now.',
  PROFILE_INCOMPLETE: 'Add your name in your profile before you ask to join.',
  TENANCY_DATES_INVALID:
    'The agreement dates are not valid. The end must be after the start, within the allowed term.',
  TENANCY_STATE_INVALID: 'This move is not allowed for the current tenancy state.',
  VERIFICATION_DETAILS_REQUIRED: 'Add the verification date and reference.',
  MOVE_SLOT_NOT_ALLOWED: 'Moves are not allowed at this time. Choose moving hours on a working day.',
  GATE_PASS_INVALID: 'The gate pass code is wrong or not for this date.',
  DEDUCTION_TOO_HIGH: 'The deduction is more than the deposit.',
  PERMIT_DATES_INVALID: 'The work dates are not valid. Check the start, end and the longest allowed period.',
  PERMIT_HOURS_NOT_ALLOWED: 'The work hours are outside the hours the society allows.',
  PERMIT_EXPIRED: 'The permit end date has passed. Extend it first.',
  EXTENSION_LIMIT_REACHED: 'A permit can be extended at most 3 times.',
  TRANSFER_DATE_INVALID: 'The effective date is not allowed, or it is too early to complete.',
  TRANSFER_PARTIES_INVALID: 'The buyer list is not valid. Shares must total 100% with one primary buyer.',
  TRANSFER_DUES_PENDING: 'Dues or fees are still unpaid. Clear them before completing.',
  FEE_ABOVE_CAP: 'A fee is above the limit set by the bye-laws.',
  PET_VACCINATION_REQUIRED: 'A dog needs a valid vaccination. Add the vaccination dates.',
  CONSENT_REQUIRED: 'Tick the consent before saving health details.',
  FILTER_TOO_BROAD: 'Too many flats for this filter. Choose a building first.',
  EXPORT_TOO_LARGE: 'More than 20,000 rows. Narrow the filters and export again.',
  IMPORT_TOO_LARGE: 'More than 5,000 rows. Split the file.',
  IMPORT_FORMAT_INVALID: 'The file is missing columns of the template.',
  // passed through from other modules
  INVITATION_ALREADY_PENDING: 'An invitation is already waiting for this person.',
  ALREADY_MEMBER: 'This person is already a member of the society.',
  MEMBER_SUSPENDED: 'This person is a suspended member of the society.',
  EMAIL_IN_USE: 'This email belongs to another account.',
  ACCOUNT_DISABLED: 'This account is disabled.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FILE_NOT_LINKABLE: 'This file cannot be used here. Upload it again.',
  FILE_NOT_READY: 'The file is still being scanned. Try again in a moment.',
  FILE_INFECTED: 'The file was blocked because it is not safe.',
  REQUEST_IN_PROGRESS: 'The same request is still running. Wait a moment.',
  SUPPORT_ROUTE_FORBIDDEN: 'This is not available during a support session.',
  SOCIETY_CLOSED: 'This society is closed.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  NO_BILL_TO: 'No one is set to receive the bill for this flat.',
  DUPLICATE_ADHOC_CHARGE: 'This charge was already raised.',
  CHARGE_HEAD_ARCHIVED: 'The charge head for this fee is archived.',
  APPROVAL_ALREADY_PENDING: 'This is already waiting for approval.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed in the current state. Reload and try again.',
  MAKER_CHECKER_VIOLATION: 'A different person must approve this, not the one who created it.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

/**
 * Codes the API raises with a different, specific message for each cause (for example which date is wrong).
 * For these the API's own message is shown, and the words in `TEXT` are the fallback when it sends none.
 */
const SERVER_MESSAGE_FIRST = new Set([
  'TENANCY_DATES_INVALID',
  'GATE_PASS_INVALID',
  'LINK_DATES_INVALID',
  'PERMIT_DATES_INVALID',
  'OWNER_REQUIRED',
  'OWNERSHIP_SHARE_INVALID',
  'MINOR_NOT_ALLOWED',
  'DOCUMENT_TYPE_NOT_ALLOWED',
  'INVITE_NOT_POSSIBLE',
  'UNIT_NOT_RESIDENTIAL',
]);

/** The message for an error, in plain words. */
export function residentsError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const base = (SERVER_MESSAGE_FIRST.has(e.code) && e.message.trim() ? e.message : TEXT[e.code]) ?? e.message;
  const missing = e.code === 'DOCUMENTS_REQUIRED' ? missingDocuments(e) : [];
  if (missing.length) return `${base} Still needed: ${missing.map(docLabel).join(', ')}.`;
  const slots = e.code === 'MOVE_SLOT_CONFLICT' ? slotConflicts(e) : [];
  if (slots.length) return `${base} Booked: ${slots.join(', ')}.`;
  return base;
}

/** `errors[0].missing` of a `422 DOCUMENTS_REQUIRED`: the document types still to attach. */
export function missingDocuments(e: unknown): string[] {
  if (!(e instanceof ApiError)) return [];
  const m = e.errors?.find(x => Array.isArray(x.missing))?.missing;
  return Array.isArray(m) ? m.filter((x): x is string => typeof x === 'string') : [];
}

/** `errors[0].conflicts` of a `409 MOVE_SLOT_CONFLICT`, as "10:00 to 12:00". */
export function slotConflicts(e: unknown): string[] {
  if (!(e instanceof ApiError)) return [];
  const c = e.errors?.find(x => Array.isArray(x.conflicts))?.conflicts;
  if (!Array.isArray(c)) return [];
  return c
    .filter(
      (x): x is { slotStart: string; slotEnd: string } => !!x && typeof x === 'object' && 'slotStart' in x,
    )
    .map(x => `${x.slotStart} to ${x.slotEnd}`);
}

export const KNOWN_ERROR_CODES = Object.keys(TEXT);

/** `errors[0].residentId` of a `409 RESIDENT_MOBILE_EXISTS`, when the API sends it. */
export function existingResidentId(e: unknown): number | null {
  if (!(e instanceof ApiError) || e.code !== 'RESIDENT_MOBILE_EXISTS') return null;
  const v = e.errors?.[0]?.residentId ?? e.errors?.[0]?.message;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const RELATION_LABEL: Record<Relation, string> = {
  OWNER: 'Owner',
  CO_OWNER: 'Co-owner',
  TENANT: 'Tenant',
  FAMILY: 'Family member',
  CARETAKER: 'Caretaker',
};
export const FAMILY_LABEL: Record<FamilyRelation, string> = {
  SPOUSE: 'Spouse',
  CHILD: 'Child',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  GRANDPARENT: 'Grandparent',
  GRANDCHILD: 'Grandchild',
  RELATIVE: 'Relative',
  OTHER: 'Other',
};
export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  OWNER_OCCUPIED: 'Owner-occupied',
  RENTED: 'Rented',
  VACANT: 'Vacant',
};
export const OCCUPANCY_TONE: Record<Occupancy, Tone> = {
  OWNER_OCCUPIED: 'ok',
  RENTED: 'info',
  VACANT: 'neutral',
};

/** Status chips always carry words; the tone only adds colour. */
export const TENANCY_LABEL: Record<TenancyStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  EXPIRED_OVERSTAY: 'Overstaying',
  ENDED: 'Ended',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};
export const TENANCY_TONE: Record<TenancyStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warn',
  APPROVED: 'info',
  ACTIVE: 'ok',
  EXPIRED_OVERSTAY: 'bad',
  ENDED: 'neutral',
  REJECTED: 'bad',
  CANCELLED: 'neutral',
};
export const POLICE_LABEL: Record<PoliceStatus, string> = {
  NOT_REQUIRED: 'Police verification not required',
  NOT_SUBMITTED: 'Police verification not submitted',
  SUBMITTED: 'Police verification submitted',
  VERIFIED: 'Police verification done',
  REJECTED: 'Police verification rejected',
};
export const POLICE_TONE: Record<PoliceStatus, Tone> = {
  NOT_REQUIRED: 'neutral',
  NOT_SUBMITTED: 'warn',
  SUBMITTED: 'info',
  VERIFIED: 'ok',
  REJECTED: 'bad',
};
export const JOIN_LABEL: Record<JoinStatus, string> = {
  PENDING_OWNER: 'Waiting for the owner',
  PENDING_ADMIN: 'Waiting for the committee',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  WITHDRAWN: 'Withdrawn',
};
export const JOIN_TONE: Record<JoinStatus, Tone> = {
  PENDING_OWNER: 'warn',
  PENDING_ADMIN: 'warn',
  APPROVED: 'ok',
  REJECTED: 'bad',
  EXPIRED: 'neutral',
  WITHDRAWN: 'neutral',
};
export const MOVE_LABEL: Record<MoveStatus, string> = {
  PENDING_OWNER: 'Waiting for the owner',
  BLOCKED_DUES: 'Blocked: dues unpaid',
  PENDING_DEPOSIT: 'Waiting for the deposit',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};
export const MOVE_TONE: Record<MoveStatus, Tone> = {
  PENDING_OWNER: 'warn',
  BLOCKED_DUES: 'bad',
  PENDING_DEPOSIT: 'warn',
  PENDING_APPROVAL: 'warn',
  APPROVED: 'ok',
  IN_PROGRESS: 'info',
  COMPLETED: 'ok',
  REJECTED: 'bad',
  CANCELLED: 'neutral',
};
export const PERMIT_LABEL: Record<PermitStatus, string> = {
  PENDING_DEPOSIT: 'Waiting for the deposit',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  IN_PROGRESS: 'Work in progress',
  SUSPENDED: 'Stopped: work suspended',
  INSPECTION_PENDING: 'Waiting for inspection',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};
export const PERMIT_TONE: Record<PermitStatus, Tone> = {
  PENDING_DEPOSIT: 'warn',
  PENDING_APPROVAL: 'warn',
  APPROVED: 'ok',
  IN_PROGRESS: 'info',
  SUSPENDED: 'bad',
  INSPECTION_PENDING: 'warn',
  COMPLETED: 'ok',
  REJECTED: 'bad',
  CANCELLED: 'neutral',
};
export const TRANSFER_LABEL: Record<TransferStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved: fees raised',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};
export const TRANSFER_TONE: Record<TransferStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warn',
  APPROVED: 'info',
  COMPLETED: 'ok',
  REJECTED: 'bad',
  CANCELLED: 'neutral',
};
export const TRANSFER_TYPE_LABEL: Record<TransferType, string> = {
  SALE: 'Sale',
  GIFT: 'Gift',
  INHERITANCE: 'Inheritance',
  NOMINATION: 'Nomination',
  COURT_ORDER: 'Court order',
  FAMILY_SETTLEMENT: 'Family settlement',
};
export const WORK_LABEL: Record<WorkCategory, string> = {
  INTERIOR: 'Interior',
  CIVIL: 'Civil work',
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  CARPENTRY: 'Carpentry',
  PAINTING: 'Painting',
  FLOORING: 'Flooring',
  WATERPROOFING: 'Waterproofing',
  KITCHEN: 'Kitchen',
  BATHROOM: 'Bathroom',
  OTHER: 'Other',
};
export const KYC_LABEL: Record<KycStatus, string> = {
  NONE: 'No ID uploaded',
  PENDING: 'ID waiting for check',
  VERIFIED: 'ID verified',
  REJECTED: 'ID rejected',
};
export const KYC_TONE: Record<KycStatus, Tone> = {
  NONE: 'neutral',
  PENDING: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'bad',
};
export const VERIFY_LABEL: Record<VerificationStatus, string> = {
  PENDING: 'Waiting for check',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};
export const VERIFY_TONE: Record<VerificationStatus, Tone> = {
  PENDING: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'bad',
};

export const DOC_LABEL: Partial<Record<DocType, string>> = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  PASSPORT: 'Passport',
  DRIVING_LICENCE: 'Driving licence',
  VOTER_ID: 'Voter ID',
  OTHER_ID: 'Other ID',
  ADDRESS_PROOF: 'Address proof',
  RENT_AGREEMENT: 'Rent agreement',
  POLICE_VERIFICATION: 'Police verification',
  SALE_DEED: 'Sale deed',
  INDEX_II: 'Index II',
  STAMP_DUTY_RECEIPT: 'Stamp duty receipt',
  ORIGINAL_SHARE_CERTIFICATE: 'Original share certificate',
  MEMBERSHIP_APPLICATION: 'Membership application',
  NOC: 'NOC',
  DEATH_CERTIFICATE: 'Death certificate',
  SUCCESSION_CERTIFICATE: 'Succession certificate',
  CONTRACTOR_ID: 'Contractor ID',
  WORK_PLAN: 'Work plan',
  STRUCTURAL_CERTIFICATE: 'Structural certificate',
  VACCINATION_CERTIFICATE: 'Vaccination certificate',
  OTHER: 'Other',
};
/** The upload purpose of a document type, as the API maps it: IDs and address proof are KYC, the rest are records. */
const KYC_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'OTHER_ID', 'ADDRESS_PROOF'];
export const docPurpose = (t: string): 'KYC_DOCUMENT' | 'RESIDENT_RECORD' =>
  KYC_TYPES.includes(t) ? 'KYC_DOCUMENT' : 'RESIDENT_RECORD';

export const docLabel = (t: string) => DOC_LABEL[t as DocType] ?? t;

export const opts = <T extends string>(map: Record<T, string>) =>
  (Object.keys(map) as T[]).map(value => ({ value, label: map[value] }));

export const today = () => new Date().toISOString().slice(0, 10);

/** Whole days from today to a date (negative when past). */
export function daysTo(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const a = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(a) ? null : Math.round((a - b) / 86_400_000);
}

/** Agreement end text: "30 Sep 2027", with "ends in 12 days" (amber, within 30) or "overstay" (red). */
export function agreementEndInfo(end: string, status?: TenancyStatus): { text: string; tone: Tone } {
  const d = daysTo(end);
  const base = shortDate(end);
  if (status === 'EXPIRED_OVERSTAY' || (d !== null && d < 0 && status === 'ACTIVE'))
    return { text: `${base} · overstaying`, tone: 'bad' };
  if (d !== null && d >= 0 && d <= 30 && (status === 'ACTIVE' || !status))
    return { text: `${base} · ends in ${d} ${d === 1 ? 'day' : 'days'}`, tone: 'warn' };
  return { text: base, tone: 'neutral' };
}

export const ageText = (iso?: string, now = Date.now()) => {
  if (!iso) return '';
  const h = Math.max(0, Math.floor((now - Date.parse(iso)) / 3_600_000));
  return h < 24 ? `${Math.max(1, h)}h` : `${Math.floor(h / 24)}d`;
};
