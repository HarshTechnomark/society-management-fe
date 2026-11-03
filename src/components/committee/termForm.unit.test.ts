import { describe, expect, it } from 'vitest';
import {
  emptyForm,
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
