import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import {
  emptyForm,
  expectedSeatIds,
  formErrorsFromApi,
  hasErrors,
  needsReplaceChoice,
  newSeatRow,
  seatKeyOf,
  toCreate,
  toPatch,
  validateForm,
  type TermForm,
} from './termForm';

const TODAY = '2026-11-03';
const good = (): TermForm => ({
  ...emptyForm(),
  name: 'Managing Committee 2026-2031',
  startDate: '2026-04-01',
  endDate: '2031-03-31',
  strength: 5,
  seats: [
    newSeatRow({ userId: 1, name: 'A', unitId: 5, designation: 'CHAIRMAN' }),
    newSeatRow({ userId: 2, name: 'B', unitId: 6, designation: 'TREASURER' }),
  ],
});

describe('validateForm', () => {
  it('accepts a good manual term', () => {
    expect(hasErrors(validateForm(good(), 'new', TODAY))).toBe(false);
  });
  it('checks the name, dates, strength and seat count', () => {
    const f = { ...good(), name: 'ab', endDate: '2026-04-10', strength: 2 };
    const e = validateForm(f, 'new', TODAY).form;
    expect(e.name).toBeTruthy();
    expect(e.endDate).toMatch(/30 days/);
    expect(e.strength).toBeTruthy();
    expect(validateForm({ ...good(), endDate: '2031-04-01' }, 'new', TODAY).form.endDate).toMatch(/5 years/);
    expect(validateForm({ ...good(), endDate: '2026-04-01' }, 'new', TODAY).form.endDate).toMatch(/after/);
    expect(
      validateForm({ ...good(), strength: 3, seats: [...good().seats, ...good().seats] }, 'new', TODAY).form
        .strength,
    ).toMatch(/more seats/);
  });
  it('flags duplicate designations and holders, a missing flat and a bad email', () => {
    const f = good();
    f.seats[1] = { ...f.seats[1], designation: 'CHAIRMAN', userId: 1, unitId: null, publicEmail: 'x' };
    const e = validateForm(f, 'new', TODAY).seats[f.seats[1].key];
    expect(e.designation).toBeTruthy();
    expect(e.holder).toMatch(/twice/);
    expect(e.publicEmail).toBeTruthy();
    // the same member row twice is fine for MEMBER
    const g = good();
    g.seats.push(newSeatRow({ userId: 3, unitId: 7 }), newSeatRow({ userId: 4, unitId: 8 }));
    expect(hasErrors(validateForm(g, 'new', TODAY))).toBe(false);
  });
  it('a past committee needs free-text names, a resolution and an end before today', () => {
    const f = good();
    f.seats = [newSeatRow({ designation: 'CHAIRMAN' })];
    f.startDate = '2022-04-01';
    f.endDate = '2026-12-01';
    const e = validateForm(f, 'past', TODAY);
    expect(e.form.resolutionRef).toBeTruthy();
    expect(e.form.endDate).toMatch(/before today/);
    expect(e.seats[f.seats[0].key].holder).toBeTruthy();
  });
});

describe('request bodies', () => {
  it('builds the manual create body (spec 8.3)', () => {
    const f = good();
    f.notes = ' hello ';
    const b = toCreate(f, 'new');
    expect(b).toMatchObject({ source: 'MANUAL', strength: 5, notes: 'hello', kind: 'ELECTED' });
    expect(b.seats[0]).toMatchObject({
      userId: 1,
      unitId: 5,
      designation: 'CHAIRMAN',
      replaceExistingRole: false,
    });
    expect(b.seats[0]).not.toHaveProperty('name');
  });
  it('builds the historical body with names and no flats', () => {
    const f = good();
    f.resolutionRef = 'GBM/2024/3';
    const b = toCreate(f, 'past');
    expect(b.source).toBe('HISTORICAL');
    expect(b.resolutionRef).toBe('GBM/2024/3');
    expect(b.seats[0]).toMatchObject({ name: 'A' });
    expect(b.seats[0]).not.toHaveProperty('unitId');
    expect(b.seats[0]).not.toHaveProperty('replaceExistingRole');
  });
  it('forces office bearers to be shown and keeps seatId in a patch', () => {
    const f = good();
    f.seats[0] = { ...f.seats[0], seatId: 'S1', show: false };
    const p = toPatch(f, 7);
    expect(p.version).toBe(7);
    expect(p.seats![0]).toMatchObject({ seatId: 'S1', showOnResidentPage: true });
    expect(p.notes).toBeNull();
  });
});

describe('helpers', () => {
  it('asks about replacing only staff or custom roles', () => {
    expect(needsReplaceChoice('accountant')).toBe(true);
    expect(needsReplaceChoice('custom_role')).toBe(true);
    expect(needsReplaceChoice('owner')).toBe(false);
    expect(needsReplaceChoice('committee_member')).toBe(false);
    expect(needsReplaceChoice(null)).toBe(false);
  });
  it('finds the seat of an error entry', () => {
    const seats = [newSeatRow({ seatId: 'S1' }), newSeatRow({ seatId: 'S2' })];
    expect(seatKeyOf('seats[1].userId', seats)).toBe(seats[1].key);
    expect(seatKeyOf('seats.0', seats)).toBe(seats[0].key);
    expect(seatKeyOf('S2', seats)).toBe(seats[1].key);
    expect(seatKeyOf('name', seats)).toBeNull();
  });
});

describe('publicEmail of an edited draft', () => {
  it('sends null for a stored seat whose email was cleared, and nothing for a new seat or a create', () => {
    const f = good();
    f.seats[0] = { ...f.seats[0], seatId: 'S1', publicEmail: '' };
    const p = toPatch(f, 3);
    expect(p.seats![0]).toHaveProperty('publicEmail', null);
    expect(p.seats![1]).not.toHaveProperty('publicEmail');
    expect(toCreate(f, 'new').seats[0]).not.toHaveProperty('publicEmail');
  });
});

describe('server errors next to the fields', () => {
  const rows = () => [newSeatRow({ seatId: 'S1' }), newSeatRow({ seatId: 'S4' }), newSeatRow(), newSeatRow()];
  it('gives new rows the next seat ids after the highest stored one', () => {
    expect(expectedSeatIds(rows(), ['S1', 'S4', 'S5'])).toEqual(['S1', 'S4', 'S6', 'S7']);
    expect(expectedSeatIds([newSeatRow(), newSeatRow()], [])).toEqual(['S1', 'S2']);
  });
  it('maps errors[0].seatIds of a holder error to the seat cards', () => {
    const r = rows();
    const e = new ApiError(422, 'COMMITTEE_HOLDER_NOT_MEMBER', 'x', [
      { field: 'seats', message: 'x', seatIds: ['S4', 'S6'] },
    ]);
    const out = formErrorsFromApi(e, r, ['S1', 'S4', 'S5'], 'Not on the app yet.');
    expect(out.seats[r[1].key]).toEqual({ holder: 'Not on the app yet.' });
    expect(out.seats[r[2].key]).toEqual({ holder: 'Not on the app yet.' });
    expect(out.seats[r[0].key]).toBeUndefined();
  });
  it('maps the flat error and the duplicate designation', () => {
    const r = rows();
    const flat = new ApiError(422, 'COMMITTEE_HOLDER_INELIGIBLE', 'x', [
      { field: 'unitId', message: 'The flat must be one the person is linked to', seatIds: ['S1'] },
    ]);
    expect(formErrorsFromApi(flat, r, [], 'no')).toMatchObject({
      seats: { [r[0].key]: { flat: 'The flat must be one the person is linked to' } },
    });
    const dup = new ApiError(422, 'COMMITTEE_DESIGNATION_DUPLICATE', 'x', [
      { field: 'seats', message: 'x', seatIds: ['S1', 'S4'] },
    ]);
    const out = formErrorsFromApi(dup, r, [], 'dup');
    expect(out.seats[r[0].key]).toEqual({ designation: 'dup' });
    expect(out.seats[r[1].key]).toEqual({ designation: 'dup' });
  });
  it('maps 400 field paths in both spellings and top-level fields', () => {
    const r = rows();
    const e = new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', [
      { field: 'name', message: 'Too short' },
      { field: 'seats.1.userId', message: 'The seat holder is required' },
      { field: 'seats[0].unitId', message: 'The qualifying flat is required' },
      { field: 'seats.2.extra', message: 'Unknown field' },
    ]);
    const out = formErrorsFromApi(e, r, [], 'x');
    expect(out.form.name).toBe('Too short');
    expect(out.seats[r[1].key]).toEqual({ holder: 'The seat holder is required' });
    expect(out.seats[r[0].key]).toEqual({ flat: 'The qualifying flat is required' });
  });
  it('maps dates and strength rules by their field, and falls back to end date and strength', () => {
    const r = rows();
    const start = new ApiError(422, 'COMMITTEE_TERM_DATES_INVALID', 'm', [
      { field: 'startDate', message: 'The new committee must start after the current committee started' },
    ]);
    expect(formErrorsFromApi(start, r, [], 't').form).toEqual({
      startDate: 'The new committee must start after the current committee started',
    });
    const bare = new ApiError(422, 'COMMITTEE_TERM_DATES_INVALID', 'm');
    expect(formErrorsFromApi(bare, r, [], 'dates text').form).toEqual({ endDate: 'dates text' });
    const seatsOver = new ApiError(422, 'COMMITTEE_STRENGTH_INVALID', 'm', [
      { field: 'seats', message: 'The committee has 3 seats; 4 are planned' },
    ]);
    expect(formErrorsFromApi(seatsOver, r, [], 't').form).toEqual({
      seats: 'The committee has 3 seats; 4 are planned',
    });
  });
});
