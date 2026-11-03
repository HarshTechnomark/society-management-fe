import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import {
  normaliseActivation,
  normalisePlan,
  normaliseSeat,
  normaliseSummary,
} from '@/services/committeeMappers';
import { seatRaw } from '@/test/committeeFixtures';
import {
  newAdd,
  newRedesignate,
  newVacate,
  leavesNoChairman,
  toChanges,
  validateChanges,
} from './changesForm';
import { committeeError, plainError } from './format';
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
      summary: { roleChanges: 4, handoverDelegationsSkipped: ['X'] },
    });
    expect(r.term?.version).toBe(3);
    expect(r.endedTerm?.actualEndDate).toBe('2029-04-01');
    expect(r.summary).toMatchObject({ roleChanges: 4, handoverDelegationsSkipped: ['X'] });
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
});
