import type { Change, Designation, Seat, VacateReason } from '@/types/committee';
import { newSeatRow, type SeatRow } from './termForm';

export type AddJoin = 'CO_OPTED' | 'NOMINATED' | 'APPOINTED';

/** One row of the make-changes dialog (spec 11.5). */
export type ChangeRow =
  | { key: string; op: 'VACATE'; seatId: string; exitReason: VacateReason; note: string }
  | { key: string; op: 'REDESIGNATE'; seatId: string; designation: Designation }
  | {
      key: string;
      op: 'ADD';
      /** The holder, flat and designation, edited with the same fields as the term editor. */
      seat: SeatRow;
      joinMode: AddJoin;
      resolutionRef: string;
    };

let n = 0;
const key = () => `chg${++n}`;

export const newVacate = (seatId = ''): ChangeRow => ({
  key: key(),
  op: 'VACATE',
  seatId,
  exitReason: 'RESIGNED',
  note: '',
});
export const newRedesignate = (seatId = '', designation: Designation = 'MEMBER'): ChangeRow => ({
  key: key(),
  op: 'REDESIGNATE',
  seatId,
  designation,
});
export const newAdd = (designation: Designation = 'MEMBER'): ChangeRow => ({
  key: key(),
  op: 'ADD',
  seat: newSeatRow({ designation }),
  joinMode: 'CO_OPTED',
  resolutionRef: '',
});

export const MAX_CHANGES = 10;
const iso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** After the change set, is a Chairman still seated? (the server answers `COMMITTEE_CHAIRMAN_REQUIRED` otherwise) */
export function leavesNoChairman(rows: ChangeRow[], seats: Seat[]): boolean {
  const seated = seats.filter(s => s.status === 'SEATED');
  const hadChairman = seated.some(s => s.designation === 'CHAIRMAN');
  if (!hadChairman) return false;
  const gone = new Set(
    rows.filter(r => r.op !== 'ADD' && r.seatId).map(r => (r as { seatId: string }).seatId),
  );
  const remains = seated.some(s => s.designation === 'CHAIRMAN' && !gone.has(s.seatId));
  const added = rows.some(
    r =>
      (r.op === 'ADD' && r.seat.designation === 'CHAIRMAN') ||
      (r.op === 'REDESIGNATE' && r.designation === 'CHAIRMAN'),
  );
  return !remains && !added;
}

export type RowErrors = Record<string, Record<string, string>>;

/** The checks the server repeats (spec 8.9, BR-10-20), so people see the mistake before sending. */
export function validateChanges(
  rows: ChangeRow[],
  seats: Seat[],
  effectiveDate: string,
  today: string,
  tookChargeOn: string | null,
): { form: Record<string, string>; rows: RowErrors } {
  const form: Record<string, string> = {};
  const errs: RowErrors = {};
  const set = (k: string, f: string, m: string) => {
    errs[k] = { ...errs[k], [f]: m };
  };
  if (rows.length < 1) form.changes = 'Add at least one change.';
  if (rows.length > MAX_CHANGES) form.changes = `Make at most ${MAX_CHANGES} changes at a time.`;
  if (!iso(effectiveDate)) form.effectiveDate = 'Choose the date the change takes effect.';
  else if (effectiveDate > today) form.effectiveDate = 'The date cannot be in the future.';
  else if (tookChargeOn && effectiveDate < tookChargeOn)
    form.effectiveDate = 'The date cannot be before the committee took charge.';
  const used = new Set<string>();
  const holders = new Set<number>();
  for (const r of rows) {
    if (r.op === 'ADD') {
      const s = r.seat;
      if (!s.userId) set(r.key, 'holder', 'Choose the person.');
      else if (holders.has(s.userId)) set(r.key, 'holder', 'The same person is added twice.');
      else holders.add(s.userId);
      if (!s.unitId) set(r.key, 'flat', 'Choose the flat that qualifies this person.');
      const ref = r.resolutionRef.trim();
      if (r.joinMode !== 'APPOINTED' && (ref.length < 3 || ref.length > 100))
        set(r.key, 'resolutionRef', 'Enter the resolution reference (3 to 100 characters).');
      else if (ref.length > 100) set(r.key, 'resolutionRef', 'At most 100 characters.');
      continue;
    }
    if (!r.seatId) set(r.key, 'seat', 'Choose the seat.');
    else if (used.has(r.seatId)) set(r.key, 'seat', 'This seat is already in another change.');
    else used.add(r.seatId);
    if (r.op === 'REDESIGNATE') {
      const cur = seats.find(s => s.seatId === r.seatId);
      if (cur && cur.designation === r.designation)
        set(r.key, 'designation', 'Choose a different designation.');
    } else if (r.note.length > 300) set(r.key, 'note', 'The note can have at most 300 characters.');
  }
  return { form, rows: errs };
}

/** The request items of 8.9. */
export function toChanges(rows: ChangeRow[]): Change[] {
  return rows.map((r): Change => {
    if (r.op === 'VACATE') {
      const note = r.note.trim();
      return {
        op: 'VACATE',
        seatId: r.seatId,
        exitReason: r.exitReason,
        ...(note ? { note } : {}),
      };
    }
    if (r.op === 'REDESIGNATE') return { op: 'REDESIGNATE', seatId: r.seatId, designation: r.designation };
    const s = r.seat;
    const ref = r.resolutionRef.trim();
    const email = s.publicEmail.trim();
    return {
      op: 'ADD',
      userId: s.userId as number,
      designation: s.designation,
      joinMode: r.joinMode,
      unitId: s.unitId as number,
      ...(ref ? { resolutionRef: ref } : {}),
      ...(s.portfolios.length ? { portfolios: s.portfolios } : {}),
      ...(email ? { publicEmail: email } : {}),
      ...(s.replace ? { replaceExistingRole: true } : {}),
    };
  });
}
