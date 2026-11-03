import type { ApiError } from '@/lib/apiClient';
import { isValidEmail } from '@/lib/validation';
import type {
  Designation,
  JoinMode,
  Portfolio,
  Seat,
  SeatInput,
  Term,
  TermInput,
  TermKind,
  TermPatch,
} from '@/types/committee';

export type EditorMode = 'new' | 'past' | 'edit';
export type SeatJoin = Exclude<JoinMode, 'CO_OPTED'>;

/** Designations that only one seat can hold (BR-10-4). */
export const UNIQUE_DESIGNATIONS: Designation[] = [
  'CHAIRMAN',
  'VICE_CHAIRMAN',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
];
/** Roles that are not a staff or custom role, so "Replace current role" is not needed (BR-10-9). */
const PLAIN_ROLES = [
  'owner',
  'tenant',
  'resident',
  'family_member',
  'chairman',
  'secretary',
  'treasurer',
  'committee_member',
];
export const needsReplaceChoice = (roleKey: string | null | undefined) =>
  !!roleKey && !PLAIN_ROLES.includes(roleKey);

export interface SeatRow {
  key: string;
  seatId?: string;
  userId: number | null;
  name: string;
  roleKey: string | null;
  roleName: string | null;
  designation: Designation;
  joinMode: SeatJoin;
  unitId: number | null;
  unitLabel: string;
  portfolios: Portfolio[];
  publicEmail: string;
  show: boolean;
  replace: boolean;
}

export interface TermForm {
  name: string;
  kind: TermKind;
  startDate: string;
  endDate: string;
  strength: number;
  notes: string;
  resolutionRef: string;
  seats: SeatRow[];
}

let counter = 0;
export const newSeatRow = (over: Partial<SeatRow> = {}): SeatRow => ({
  key: `row${++counter}`,
  userId: null,
  name: '',
  roleKey: null,
  roleName: null,
  designation: 'MEMBER',
  joinMode: 'ELECTED',
  unitId: null,
  unitLabel: '',
  portfolios: [],
  publicEmail: '',
  show: true,
  replace: false,
  ...over,
});

export const emptyForm = (): TermForm => ({
  name: '',
  kind: 'ELECTED',
  startDate: '',
  endDate: '',
  strength: 5,
  notes: '',
  resolutionRef: '',
  seats: [newSeatRow({ designation: 'CHAIRMAN' })],
});

/** The editable seats of a term (LEFT seats are history). */
export function formFromTerm(t: Term): TermForm {
  return {
    name: t.name,
    kind: t.kind,
    startDate: t.startDate,
    endDate: t.endDate,
    strength: t.strength,
    notes: t.notes ?? '',
    resolutionRef: t.resolutionRef ?? '',
    seats: t.seats.filter((s: Seat) => s.status !== 'LEFT').map(rowFromSeat),
  };
}

const rowFromSeat = (s: Seat): SeatRow =>
  newSeatRow({
    seatId: s.seatId,
    userId: s.userId,
    name: s.name,
    roleKey: s.roleKey,
    designation: s.designation,
    joinMode: s.joinMode === 'CO_OPTED' ? 'APPOINTED' : s.joinMode,
    unitId: s.unitId,
    unitLabel: s.unitLabel ?? '',
    portfolios: s.portfolios,
    publicEmail: s.publicEmail ?? '',
    show: s.showOnResidentPage,
    replace: s.replaceExistingRole,
  });

const iso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const utc = (v: string) => Date.parse(`${v}T00:00:00Z`);
const DAY = 86_400_000;

export interface FormErrors {
  form: Record<string, string>;
  seats: Record<string, Record<string, string>>;
}
export const hasErrors = (e: FormErrors) => Object.keys(e.form).length > 0 || Object.keys(e.seats).length > 0;

/** The checks the server repeats (spec 8.3, BR-10-2 to BR-10-4), so people see the mistake before sending. */
export function validateForm(f: TermForm, mode: EditorMode, today: string): FormErrors {
  const form: Record<string, string> = {};
  const seats: Record<string, Record<string, string>> = {};
  const past = mode === 'past';
  const name = f.name.trim();
  if (name.length < 3 || name.length > 120) form.name = 'Enter a name of 3 to 120 characters.';
  if (!iso(f.startDate)) form.startDate = 'Choose the start date.';
  if (!iso(f.endDate)) form.endDate = 'Choose the end date.';
  if (!form.startDate && !form.endDate) {
    const s = utc(f.startDate);
    const e = utc(f.endDate);
    const limit = new Date(s);
    limit.setUTCFullYear(limit.getUTCFullYear() + 5);
    if (e <= s) form.endDate = 'The end date must be after the start date.';
    else if (e < s + 30 * DAY) form.endDate = 'A term lasts at least 30 days.';
    else if (e > limit.getTime() - DAY) form.endDate = 'A term lasts at most 5 years.';
    else if (past && f.endDate >= today) form.endDate = 'A past committee must have ended before today.';
  }
  if (!Number.isInteger(f.strength) || f.strength < 3 || f.strength > 25)
    form.strength = 'Choose 3 to 25 seats.';
  else if (f.seats.length > f.strength) form.strength = 'There are more seats than the strength.';
  if (f.notes.length > 1000) form.notes = 'Notes can have at most 1000 characters.';
  const ref = f.resolutionRef.trim();
  if (past ? ref.length < 3 : ref.length > 0 && ref.length < 3)
    form.resolutionRef = 'Enter the resolution reference (3 to 100 characters).';
  else if (ref.length > 100) form.resolutionRef = 'At most 100 characters.';
  if (f.seats.length === 0) form.seats = 'Add at least one seat.';

  const seen = new Map<string, string>();
  const holders = new Map<number, string>();
  for (const s of f.seats) {
    const e: Record<string, string> = {};
    if (past) {
      if (s.name.trim().length < 2) e.holder = 'Enter the name of the member (at least 2 characters).';
    } else {
      if (!s.userId) e.holder = 'Choose the person.';
      else if (holders.has(s.userId)) e.holder = 'The same person is on the committee twice.';
      else holders.set(s.userId, s.key);
      if (!s.unitId && s.userId) e.flat = 'Choose the flat that qualifies this person.';
    }
    if (UNIQUE_DESIGNATIONS.includes(s.designation)) {
      if (seen.has(s.designation)) e.designation = 'Only one per designation. Use Member for the others.';
      else seen.set(s.designation, s.key);
    }
    if (s.publicEmail.trim() && !isValidEmail(s.publicEmail.trim())) e.publicEmail = 'Enter a valid email.';
    if (Object.keys(e).length) seats[s.key] = e;
  }
  return { form, seats };
}

const seatInput = (s: SeatRow, mode: EditorMode): SeatInput => ({
  ...(s.seatId ? { seatId: s.seatId } : {}),
  ...(s.userId ? { userId: s.userId } : {}),
  ...(mode === 'past' ? { name: s.name.trim() } : {}),
  designation: s.designation,
  joinMode: s.joinMode,
  ...(mode !== 'past' && s.unitId ? { unitId: s.unitId } : {}),
  portfolios: s.portfolios,
  // an edited draft keeps the stored email unless it is sent: null clears it
  ...(s.publicEmail.trim()
    ? { publicEmail: s.publicEmail.trim().toLowerCase() }
    : mode === 'edit' && s.seatId
      ? { publicEmail: null }
      : {}),
  showOnResidentPage: s.designation === 'MEMBER' ? s.show : true,
  ...(mode !== 'past' ? { replaceExistingRole: s.replace } : {}),
});

export function toCreate(f: TermForm, mode: EditorMode): TermInput {
  const notes = f.notes.trim();
  const ref = f.resolutionRef.trim();
  return {
    name: f.name.trim(),
    kind: f.kind,
    source: mode === 'past' ? 'HISTORICAL' : 'MANUAL',
    startDate: f.startDate,
    endDate: f.endDate,
    strength: f.strength,
    ...(notes ? { notes } : {}),
    ...(ref ? { resolutionRef: ref } : {}),
    seats: f.seats.map(s => seatInput(s, mode)),
  };
}

/** A PATCH of a draft: the whole form (seats are a full replacement). */
export function toPatch(f: TermForm, version: number): TermPatch {
  return {
    version,
    name: f.name.trim(),
    kind: f.kind,
    startDate: f.startDate,
    endDate: f.endDate,
    strength: f.strength,
    notes: f.notes.trim() ? f.notes.trim() : null,
    seats: f.seats.map(s => seatInput(s, 'edit')),
  };
}

/** Which seat row an `errors[]` entry points at: `seats[2].x`, `seats.2.x`, a seat id, or none. */
export function seatKeyOf(field: string | undefined, seats: SeatRow[]): string | null {
  if (!field) return null;
  const m = /seats?[.[](\d+)/.exec(field);
  if (m) return seats[Number(m[1])]?.key ?? null;
  const byId = seats.find(s => s.seatId && s.seatId === field);
  return byId?.key ?? null;
}

/** Codes whose `errors[0].seatIds` point at seat cards, and the field of the card they belong next to. */
const SEAT_ID_CODES: Record<string, 'designation' | 'holder' | 'flat'> = {
  COMMITTEE_DESIGNATION_DUPLICATE: 'designation',
  COMMITTEE_HOLDER_DUPLICATE: 'holder',
  COMMITTEE_HOLDER_NOT_MEMBER: 'holder',
  COMMITTEE_HOLDER_NOT_ACTIVE: 'holder',
  COMMITTEE_HOLDER_INELIGIBLE: 'flat',
};
const SEAT_SUBFIELD: Record<string, string> = {
  userId: 'holder',
  name: 'holder',
  unitId: 'flat',
  designation: 'designation',
  publicEmail: 'publicEmail',
};
const FORM_FIELDS = ['name', 'startDate', 'endDate', 'strength', 'notes', 'resolutionRef', 'seats'];

/**
 * The seat id the server gives each row: a stored seat keeps its id, a new row gets `max + 1` over every id the term
 * ever held, in input order (BR-10-32). A create starts from nothing, so row 1 is `S1`.
 */
export function expectedSeatIds(rows: SeatRow[], storedIds: string[]): string[] {
  let max = storedIds.reduce((m, id) => Math.max(m, Number(id.slice(1)) || 0), 0);
  return rows.map(r => r.seatId ?? `S${++max}`);
}

/**
 * Puts a 400 or 422 of the term routes next to the right field: `errors[].field` is `name`, `endDate`, `seats` (with
 * `seatIds`) or `seats[2].userId` / `seats.2.userId` (400). `text` is the plain-words message for seat cards.
 */
export function formErrorsFromApi(
  e: ApiError,
  rows: SeatRow[],
  storedIds: string[],
  text: string,
): FormErrors {
  const form: Record<string, string> = {};
  const seats: Record<string, Record<string, string>> = {};
  const ids = expectedSeatIds(rows, storedIds);
  const put = (key: string | undefined, field: string, msg: string) => {
    if (key) seats[key] = { ...seats[key], [field]: seats[key]?.[field] ?? msg };
  };
  for (const x of e.errors ?? []) {
    const seatIds = Array.isArray(x.seatIds) ? (x.seatIds as unknown[]).map(String) : [];
    const sub = SEAT_ID_CODES[e.code];
    if (seatIds.length) {
      // the flat rule reads the owners-only setting, so the server's own sentence is the exact one
      const msg = e.code === 'COMMITTEE_HOLDER_INELIGIBLE' && x.message ? x.message : text;
      if (sub) for (const id of seatIds) put(rows[ids.indexOf(id)]?.key, sub, msg);
      continue;
    }
    const m = /^seats(?:\[(\d+)\]|\.(\d+))\.(\w+)$/.exec(x.field ?? '');
    if (m) {
      put(rows[Number(m[1] ?? m[2])]?.key, SEAT_SUBFIELD[m[3]] ?? 'holder', x.message);
      continue;
    }
    if (FORM_FIELDS.includes(x.field)) form[x.field] ??= x.message;
  }
  if (e.code === 'COMMITTEE_TERM_DATES_INVALID' && !form.startDate) form.endDate ??= text;
  if (e.code === 'COMMITTEE_STRENGTH_INVALID' && !form.seats) form.strength ??= text;
  return { form, seats };
}
