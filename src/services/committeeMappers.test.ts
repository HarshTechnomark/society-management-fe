import { describe, expect, it } from 'vitest';
import {
  normaliseHandover,
  normaliseMyCommittee,
  normalisePast,
  normaliseSeatUsage,
} from './committeeMappers';

describe('committee 10.3 mappers', () => {
  it('maps the hand-over checklist and derives missing progress counts', () => {
    const h = normaliseHandover({
      termId: 12,
      completedAt: null,
      items: [
        { itemId: 'H1', title: 'Bank', ownerDesignation: 'TREASURER', status: 'DONE', canEdit: true },
        { itemId: 'H2', title: 'Keys', status: 'NOT_APPLICABLE', note: 'No keys', evidenceFileIds: [3, 'x'] },
        { itemId: 'H3', title: 'Seal' },
      ],
    });
    expect(h.progress).toEqual({ total: 3, done: 1, notApplicable: 1, pending: 1 });
    expect(h.items[0].canEdit).toBe(true);
    expect(h.items[1].evidenceFileIds).toEqual([3]);
    expect(h.items[2].status).toBe('PENDING');
    expect(h.items[2].canEdit).toBe(false);
  });

  it('maps the seat meter with the staff roles and staff list, and an unlimited plan', () => {
    const u = normaliseSeatUsage({
      limit: null,
      used: 2,
      free: null,
      pendingStaffInvitations: 1,
      byRole: [{ roleKey: 'accountant', roleName: 'Accountant', count: 2 }],
      staffRoles: [{ roleKey: 'accountant', roleName: 'Accountant', consumesSeat: true, isSystem: true }],
      staff: [
        {
          memberId: 5,
          userId: 9,
          name: 'Asha',
          roleKey: 'accountant',
          roleName: 'Accountant',
          status: 'ACTIVE',
        },
      ],
    });
    expect(u.free).toBeNull();
    expect(u.staffRoles[0].consumesSeat).toBe(true);
    expect(u.staff[0].name).toBe('Asha');
    expect(normaliseSeatUsage({ limit: 8, used: 3 }).free).toBe(5);
    expect(normaliseSeatUsage(null).staff).toEqual([]);
  });

  it('maps the resident committee page, including the hidden page', () => {
    expect(normaliseMyCommittee({ visible: false })).toMatchObject({
      visible: false,
      term: null,
      members: [],
    });
    const c = normaliseMyCommittee({
      visible: true,
      term: { name: 'T', startDate: '2024-04-01', endDate: '2029-03-31', status: 'EXPIRED', isOverdue: true },
      members: [{ name: 'Raj', designation: 'CHAIRMAN', designationLabel: 'Chairman', mobile: '98XXXXX111' }],
      vacancies: 2,
    });
    expect(c.term?.isOverdue).toBe(true);
    expect(c.members[0].mobile).toBe('98XXXXX111');
    expect(c.members[0].photoFileId).toBeNull();
    expect(c.vacancies).toBe(2);
  });

  it('maps a past committee', () => {
    const p = normalisePast({
      name: 'Old',
      startDate: '2019-04-01',
      endDate: '2024-03-31',
      officeBearers: [{ designation: 'SECRETARY', designationLabel: 'Secretary', name: 'Sam' }],
    });
    expect(p.officeBearers[0].fromDate).toBeNull();
    expect(p.actualEndDate).toBeNull();
  });
});
