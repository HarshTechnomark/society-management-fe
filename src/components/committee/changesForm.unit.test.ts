import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import {
  normaliseActivation,
  normalisePlan,
  normaliseSeat,
  normaliseSummary,
} from '@/services/committeeMappers';
import { changesSummaryRaw, planRaw, seatRaw, termRaw } from '@/test/committeeFixtures';
import {
  newAdd,
  newRedesignate,
  newVacate,
  leavesNoChairman,
  toChanges,
  validateChanges,
} from './changesForm';
import { committeeError, committeeErrorFull, plainError, skippedText } from './format';
import { roleChange } from './PlanView';

const seats = [
  normaliseSeat(seatRaw()),
  normaliseSeat(seatRaw({ seatId: 'S2', userId: 12, name: 'Arjun', designation: 'SECRETARY' })),
];
const withSeat = (r: ReturnType<typeof newVacate>, seatId: string) => ({ ...r, seatId }) as typeof r;

describe('change set rules', () => {
  it('sees when the Chairman is left without a successor', () => {
    expect(leavesNoChairman([withSeat(newVacate(), 'S1')], seats)).toBe(true);
    expect(leavesNoChairman([withSeat(newVacate(), 'S2')], seats)).toBe(false);
    expect(leavesNoChairman([withSeat(newVacate(), 'S1'), newAdd('CHAIRMAN')], seats)).toBe(false);
    expect(
      leavesNoChairman([withSeat(newVacate(), 'S1'), withSeat(newRedesignate('', 'CHAIRMAN'), 'S2')], seats),
    ).toBe(false);
    expect(leavesNoChairman([withSeat(newRedesignate('', 'MEMBER'), 'S1')], seats)).toBe(true);
    expect(leavesNoChairman([newAdd()], seats)).toBe(false);
  });
  it('validates dates and the number of changes', () => {
    const v = (rows: Parameters<typeof validateChanges>[0], date = '2026-11-03') =>
      validateChanges(rows, seats, date, '2026-11-03', '2024-04-01');
    expect(v([]).form.changes).toBe('Add at least one change.');
    expect(v(Array.from({ length: 11 }, () => newAdd())).form.changes).toContain('at most 10');
    expect(v([newAdd()], '2026-12-01').form.effectiveDate).toBe('The date cannot be in the future.');
    expect(v([newAdd()], '2020-01-01').form.effectiveDate).toContain('before the committee took charge');
    expect(v([newAdd()], 'x').form.effectiveDate).toContain('Choose');
  });
  it('builds the request items of spec 8.9', () => {
    const add = newAdd('TREASURER');
    if (add.op !== 'ADD') throw new Error('x');
    add.seat = { ...add.seat, userId: 61, unitId: 601, replace: true, publicEmail: ' t@x.in ' };
    add.resolutionRef = ' CM/1 ';
    expect(toChanges([withSeat(newVacate(), 'S3'), add])).toEqual([
      { op: 'VACATE', seatId: 'S3', exitReason: 'RESIGNED' },
      {
        op: 'ADD',
        userId: 61,
        designation: 'TREASURER',
        joinMode: 'CO_OPTED',
        unitId: 601,
        resolutionRef: 'CM/1',
        publicEmail: 't@x.in',
        replaceExistingRole: true,
      },
    ]);
  });
});

describe('plan mappers and wording', () => {
  it('maps all three action kinds, staff seats, delegations and issues', () => {
    const p = normalisePlan({
      termId: 5,
      termVersion: 2,
      actions: [
        {
          kind: 'END_MEMBERSHIP',
          step: 'A',
          userId: 1,
          memberId: 2,
          name: 'A',
          fromRoleKey: 'accountant',
          seatDelta: -1,
        },
        { kind: 'NONE', userId: 3, memberId: 4, name: 'B', roleKey: 'secretary', reason: 'CONTINUING' },
        {
          kind: 'CHANGE_ROLE',
          userId: 5,
          memberId: 6,
          name: 'C',
          fromRoleKey: 'owner',
          toRoleKey: 'chairman',
          reason: 'INCOMING',
        },
      ],
      staffSeats: { limit: 8, used: 2, delta: -1 },
      handoverDelegations: [{ designation: 'TREASURER', fromName: 'M', toName: 'L' }],
      blockers: [{ code: 'NO_FREE_SEAT', message: 'm', userIds: [1, 'x'] }],
      previewHash: 'h',
    });
    expect(p.actions.map(a => a.kind)).toEqual(['END_MEMBERSHIP', 'NONE', 'CHANGE_ROLE']);
    expect(p.staffSeats).toEqual({ limit: 8, used: 2, delta: -1 });
    expect(p.handoverDelegations[0].days).toBe(30);
    expect(p.blockers[0].userIds).toEqual([1]);
    expect(roleChange(p.actions[0]).text).toBe('Accountant → Membership ends');
    expect(roleChange(p.actions[1]).same).toBe(true);
    expect(roleChange(p.actions[2]).text).toBe('Owner → Chairman');
  });
  it('never throws on junk and maps summaries and the activation result', () => {
    expect(normalisePlan(null).actions).toEqual([]);
    expect(normaliseSummary(undefined)).toEqual({
      roleChanges: 0,
      membershipsEnded: 0,
      handoverDelegationsCreated: 0,
      handoverDelegationsSkipped: [],
    });
    const r = normaliseActivation({
      term: { id: 1, status: 'ACTIVE', tookChargeOn: '2029-04-02', version: 3 },
      endedTerm: { id: 2, status: 'ENDED', actualEndDate: '2029-04-01' },
      summary: {
        roleChanges: 4,
        handoverDelegationsSkipped: [
          { designation: 'TREASURER', fromUserId: 1, toUserId: 2, skippedBecause: 'DELEGATION_OVERLAP' },
        ],
      },
    });
    expect(r.term?.version).toBe(3);
    expect(r.endedTerm?.actualEndDate).toBe('2029-04-01');
    expect(r.summary.roleChanges).toBe(4);
    expect(r.summary.handoverDelegationsSkipped).toEqual([
      { designation: 'TREASURER', fromUserId: 1, toUserId: 2, skippedBecause: 'DELEGATION_OVERLAP' },
    ]);
    expect(normaliseActivation(undefined).term).toBeNull();
  });
  it('words SUPPORT_GRANT_READ_ONLY and keeps the reference through plainError', () => {
    expect(committeeError(new ApiError(403, 'SUPPORT_GRANT_READ_ONLY', 'raw'))).toBe(
      'Support access is read only. Committee changes are not possible.',
    );
    const e = plainError(new ApiError(409, 'INVALID_STATE', 'raw', undefined, 'req_1')) as ApiError;
    expect(e.message).toContain('not allowed in the current state');
    expect(e.requestId).toBe('req_1');
    expect(plainError('x')).toBe('x');
  });

  it('reads the real preview shape: current term, seats, user ids and permission keys', () => {
    const p = normalisePlan(
      planRaw({ blockers: [{ code: 'UNHELD_PERMISSION', message: 'm', permissionKeys: ['a.b'] }] }),
    );
    expect(p).toMatchObject({ currentTermId: 12, currentTermVersion: 4 });
    expect(p.seats[0]).toMatchObject({ seatId: 'S1', name: 'Farhan Qureshi', designation: 'CHAIRMAN' });
    expect(p.handoverDelegations[0]).toMatchObject({ fromUserId: 22, toUserId: 64 });
    expect(p.blockers[0].permissionKeys).toEqual(['a.b']);
    expect(
      normalisePlan(planRaw({ currentTermId: null, currentTermVersion: null })).currentTermId,
    ).toBeNull();
  });
  it('reads the summary at the top level of the apply-changes response (term detail plus summary)', () => {
    expect(
      normaliseSummary({ ...termRaw(), summary: changesSummaryRaw({ roleChanges: 3 }) }).roleChanges,
    ).toBe(3);
  });
  it('uses the exact backend message for dates and change sets, and names seats and permissions', () => {
    const dates = new ApiError(422, 'COMMITTEE_TERM_DATES_INVALID', 'Between 2029-04-01 and today', [
      { field: 'tookChargeOn', message: 'x' },
    ]);
    expect(committeeError(dates)).toBe('Between 2029-04-01 and today');
    expect(committeeError(new ApiError(422, 'COMMITTEE_TERM_DATES_INVALID', 'raw'))).toContain('5 years');
    const inv = new ApiError(422, 'COMMITTEE_CHANGE_INVALID', 'Pick a different designation', [
      { field: 'changes', message: 'Pick a different designation', seatIds: ['S3'] },
    ]);
    expect(committeeError(inv)).toBe('Pick a different designation');
    expect(committeeErrorFull(inv, id => `Meera (${id})`)).toBe(
      'Pick a different designation Seats: Meera (S3).',
    );
    const chair = new ApiError(422, 'COMMITTEE_CHAIRMAN_REQUIRED', 'raw', [
      { field: 'changes', message: 'raw' },
    ]);
    expect(committeeError(chair)).toBe('Pick the new chairman before the current one steps down.');
    const perm = new ApiError(403, 'CANNOT_GRANT_UNHELD_PERMISSION', 'raw', [
      { field: 'permissionKey', message: 'finance.edit' },
    ]);
    expect(committeeErrorFull(perm)).toContain('Access you do not have: finance.edit.');
  });
  it('words the skipped hand-over pairs', () => {
    expect(
      skippedText([
        { designation: 'TREASURER', skippedBecause: 'DELEGATION_OVERLAP' },
        { designation: 'SECRETARY', skippedBecause: 'OTHER' },
      ]),
    ).toBe('Treasurer (a hand-over already runs for this person), Secretary');
  });
});
