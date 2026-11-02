import { ApiError } from '@/lib/apiClient';
import type { Tone } from '@/components/ui/Chip';
import type { BuildingKind, RecordStatus, StepKey, UnitType } from '@/types/societySetup';

/** Words for every module 08 error code (spec section 12). */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNKNOWN_SETTING_KEY: 'This setting does not exist.',
  SETTING_VALUE_INVALID: 'That value is not allowed for this setting.',
  PATTERN_INVALID:
    'The numbering pattern is not valid. Use letters, digits, - or / and tokens like {floor} and {pos:2}.',
  UNAUTHENTICATED: 'Please sign in again.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This feature is not part of your plan.',
  USAGE_LIMIT_EXCEEDED: 'Your plan allows no more flats. Archive flats or upgrade your plan.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
  NOT_FOUND: 'This record no longer exists.',
  BUILDING_NOT_FOUND: 'This building no longer exists.',
  UNIT_NOT_FOUND: 'This flat no longer exists.',
  LOCATION_NOT_FOUND: 'This location no longer exists.',
  HOLIDAY_NOT_FOUND: 'This holiday no longer exists.',
  IMPORT_NOT_FOUND: 'This import expired or does not exist. Upload the file again.',
  FILE_NOT_FOUND: 'The uploaded file was not found. Upload it again.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed in the current state. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  REQUEST_IN_PROGRESS: 'The same request is still running. Wait a moment.',
  BUILDING_CODE_TAKEN: 'This building code is already used. Codes are never reused.',
  BUILDING_CODE_LOCKED: 'The code cannot change once the building has flats.',
  BUILDING_HAS_ACTIVE_UNITS: 'Archive or move the active flats and wings of this building first.',
  BUILDING_IN_USE: 'This building is in use and cannot be deleted. Archive it instead.',
  UNIT_NUMBER_TAKEN: 'An active flat in this building already has this number.',
  UNIT_NUMBER_CONFLICT: 'Some flat numbers already exist. Preview again and remove the conflicts.',
  UNIT_ARCHIVE_BLOCKED: 'This flat cannot be archived yet.',
  UNIT_DELETE_NOT_ALLOWED: 'Flats can be deleted only before go-live or within 24 hours. Archive it instead.',
  UNIT_IN_USE: 'Other records use this flat, so it cannot be deleted. Archive it instead.',
  PREVIEW_STALE: 'The inputs changed after the preview. Preview again before creating.',
  IMPORT_FILE_NOT_READY: 'The file is still being scanned. Try again in a moment.',
  IMPORT_IN_PROGRESS: 'Another import is running for this society. Wait for it to finish.',
  LOCATION_NAME_TAKEN: 'A location with this name already exists here.',
  HOLIDAY_DATE_TAKEN: 'This date is already a holiday.',
  ALREADY_LIVE: 'The society is already live.',
  GSTIN_CHECKSUM_INVALID: 'The GSTIN check digit is wrong. Check the number.',
  GSTIN_STATE_MISMATCH: 'The GSTIN does not start with the state code of the selected state.',
  GSTIN_PAN_MISMATCH: 'The PAN inside the GSTIN does not match the PAN entered.',
  TIMEZONE_LOCKED: 'Time zone and language cannot change after go-live.',
  SETTING_NOT_EDITABLE_HERE: 'This setting is edited from the society profile.',
  PREFIX_CLASH: 'Invoice and receipt prefixes must be different.',
  OFFICE_HOURS_INVALID: 'Office opening time must be before closing time.',
  QUIET_HOURS_INVALID: 'Quiet hours start and end cannot be the same.',
  GST_REQUIRES_GSTIN: 'Add the society GSTIN before turning GST on.',
  LATE_FEE_DEFAULT_INVALID: 'Enter a late fee rate or amount that matches the chosen mode.',
  COMMITTEE_STRENGTH_INVALID: 'Committee minimum cannot be above the maximum.',
  HELPDESK_WAITING_RULE_INVALID: 'Auto-resolve days must be longer than the waiting reminder.',
  PARENT_BUILDING_INVALID: 'A wing needs an active tower as its parent.',
  BUILDING_STRUCTURE_CONFLICT: 'A building cannot hold flats and wings at the same time.',
  BUILDING_FLOORS_IN_USE: 'Floors in use cannot be removed. Archive those flats first.',
  BUILDING_ARCHIVED: 'This building is archived. Restore it first.',
  FLOOR_OUT_OF_RANGE: 'This floor is outside the floors of the building.',
  AREA_ORDER_INVALID: 'Carpet area cannot be more than built-up, and built-up not more than super built-up.',
  SHARE_TOTAL_EXCEEDS_100: 'The undivided shares of all flats cannot add up to more than 100%.',
  PATTERN_NOT_UNIQUE: 'The pattern needs a floor and a position (or {seq}) so every number is different.',
  GENERATOR_TOO_LARGE: 'Too many flats in one run. The limit is 2,000.',
  IMPORT_TOO_MANY_ROWS: 'The file has more than 5,000 rows. Split it and import in parts.',
  IMPORT_FILE_INVALID: 'The file could not be read or a column heading is missing.',
  IMPORT_HAS_ERRORS: 'Rows with errors exist. Fix them, or choose "Import valid rows only".',
  IMPORT_NOTHING_TO_COMMIT: 'There is nothing to write: no new or changed rows.',
  IMPORT_STALE: 'The data changed after the check and new errors appeared. Upload the file again.',
  FILE_NOT_LINKABLE: 'This file cannot be used here.',
  LOCATION_PARENT_INVALID: 'This kind of location cannot be placed there.',
  LOCATION_DEPTH_EXCEEDED: 'Locations can be nested at most four levels deep.',
  LOCATION_CYCLE: 'A location cannot be moved inside itself.',
  LOCATION_MANAGED: 'Building entries are managed with the building. Edit the building instead.',
  ONBOARDING_STEP_INCOMPLETE: 'This step is not finished yet.',
  ONBOARDING_STEP_NOT_SKIPPABLE: 'This step is required and cannot be skipped.',
  ONBOARDING_NOT_READY: 'The society is not ready to go live yet.',
  SOCIETY_SUSPENDED: 'Your society’s account is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

/** The message for an error; `UNIT_ARCHIVE_BLOCKED` and similar add their guard reasons. */
export function setupError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const base = TEXT[e.code] ?? e.message;
  if (e.code === 'UNIT_ARCHIVE_BLOCKED' || e.code === 'UNIT_IN_USE') {
    const reasons = (e.errors ?? []).map(x => GUARD[x.message] ?? x.message);
    return reasons.length ? `${base} ${reasons.join(' ')}` : base;
  }
  if (e.code === 'UNIT_NUMBER_CONFLICT' && e.errors?.length) {
    const labels = e.errors.map(x => x.message).slice(0, 10);
    return `${base} ${labels.join(', ')}${e.errors.length > 10 ? ' and more' : ''}.`;
  }
  if (e.code === 'PERMISSION_DENIED' && e.errors?.[0]?.field) return `${base} (${e.errors[0].field})`;
  return base;
}

const GUARD: Record<string, string> = {
  UNIT_HAS_RESIDENTS: 'The flat has active residents.',
  UNIT_HAS_BALANCE: 'The flat has an unpaid or unsettled balance.',
  UNIT_HAS_PARKING: 'A parking slot is allotted to the flat.',
};

/** Field errors of a 400 response as `{ field: message }`. */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiError && (e.status === 400 || e.status === 422))
    for (const x of e.errors ?? []) if (x.field && !(x.field in out)) out[x.field] = x.message;
  return out;
}

export const STEP_LABEL: Record<StepKey, string> = {
  PROFILE: 'Society profile',
  STRUCTURE: 'Structure',
  UNITS: 'Flats',
  RESIDENTS: 'Residents',
  BILLING: 'Billing',
  PAYMENTS: 'Payments',
  COMMITTEE: 'Committee',
  GO_LIVE: 'Go live',
};

export const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: 'FLAT', label: 'Flat' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'PARKING_ONLY', label: 'Parking only' },
];
export const UNIT_TYPE_LABEL = Object.fromEntries(UNIT_TYPES.map(t => [t.value, t.label])) as Record<
  string,
  string
>;

export const BHK_OPTIONS = [
  'STUDIO',
  '1RK',
  '1BHK',
  '1_5BHK',
  '2BHK',
  '2_5BHK',
  '3BHK',
  '3_5BHK',
  '4BHK',
  '5BHK_PLUS',
];
const BHK_LABEL: Record<string, string> = {
  STUDIO: 'Studio',
  '1RK': '1 RK',
  '1BHK': '1 BHK',
  '1_5BHK': '1.5 BHK',
  '2BHK': '2 BHK',
  '2_5BHK': '2.5 BHK',
  '3BHK': '3 BHK',
  '3_5BHK': '3.5 BHK',
  '4BHK': '4 BHK',
  '5BHK_PLUS': '5+ BHK',
};
export const bhkLabel = (v: string | null | undefined) => (!v ? '-' : (BHK_LABEL[v] ?? v));

export const BUILDING_KINDS: { value: string; label: string }[] = [
  { value: 'TOWER', label: 'Tower' },
  { value: 'WING', label: 'Wing' },
  { value: 'BLOCK', label: 'Block' },
  { value: 'COMMERCIAL', label: 'Commercial' },
];
export const kindLabel = (k: BuildingKind) => BUILDING_KINDS.find(x => x.value === k)?.label ?? k;

export const STATUS_TONE: Record<RecordStatus, Tone> = { ACTIVE: 'ok', ARCHIVED: 'neutral' };
export const statusLabel = (s: RecordStatus) => (s === 'ACTIVE' ? 'Active' : 'Archived');

export const AREA_TYPES = [
  'LOBBY',
  'GATE',
  'LIFT',
  'STAIRCASE',
  'TERRACE',
  'PARKING',
  'CLUBHOUSE',
  'GARDEN',
  'PLAYGROUND',
  'POOL',
  'GYM',
  'OFFICE',
  'STORE',
  'OTHER',
];
export const areaTypeLabel = (t: string | undefined) =>
  !t ? '' : t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ');

/** `"1150.000"` -> `"1,150"`; null -> "-". */
export function sqft(v: string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? v : n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

export { INDIAN_STATES } from '@/components/societies/format';
export const LOCALES = [
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
  { value: 'gu-IN', label: 'Gujarati' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'kn-IN', label: 'Kannada' },
  { value: 'bn-IN', label: 'Bengali' },
];
export const TIMEZONES = ['Asia/Kolkata'];
