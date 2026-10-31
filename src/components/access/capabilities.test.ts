import { describe, expect, it } from 'vitest';
import { assignableRoles } from './useRoleDetails';
import { PLATFORM_CAPABILITIES, SOCIETY_CAPABILITIES, hasCapability } from './capabilities';
import { accessErrorText } from './format';
import { ApiError } from '@/lib/apiClient';
import { CATALOGUE, keysOfScope } from '@/constants/permissions';
import { roleDetail, roleSummary } from '@/test/accessFixtures';

describe('capability rows', () => {
  it('has the prototype row counts and only real catalogue keys', () => {
    expect(SOCIETY_CAPABILITIES).toHaveLength(7);
    expect(PLATFORM_CAPABILITIES).toHaveLength(8);
    const all = new Set<string>([...keysOfScope('society'), ...keysOfScope('platform')]);
    for (const c of [...SOCIETY_CAPABILITIES, ...PLATFORM_CAPABILITIES])
      c.keys.forEach(k => expect(all.has(k), k).toBe(true));
    expect(Object.keys(CATALOGUE)).toHaveLength(5);
  });

  it('a row needs every key', () => {
    const view = SOCIETY_CAPABILITIES[0];
    expect(hasCapability(['finance.accounts.view', 'residents.people.view'], view)).toBe(false);
    expect(
      hasCapability(['finance.accounts.view', 'residents.people.view', 'helpdesk.tickets.view'], view),
    ).toBe(true);
  });
});

describe('assignableRoles', () => {
  const chairman = roleSummary({ id: 1, key: 'chairman' });
  const guard = roleSummary({ id: 2, key: 'guard', scope: 'gate' });
  const owner = roleSummary({ id: 3, key: 'owner', scope: 'resident' });
  const details = new Map([[1, roleDetail({ id: 1, permissionKeys: ['finance.expenses.approve'] })]]);

  it('drops society roles with unheld keys and resident roles, keeps field roles', () => {
    expect(assignableRoles([chairman, guard, owner], details, new Set()).map(r => r.id)).toEqual([2]);
    expect(
      assignableRoles([chairman, guard, owner], details, new Set(['finance.expenses.approve'])).map(
        r => r.id,
      ),
    ).toEqual([1, 2]);
  });
  it('offers everything while details are loading', () => {
    expect(assignableRoles([chairman, guard], null, new Set()).map(r => r.id)).toEqual([1, 2]);
  });
});

describe('accessErrorText', () => {
  it('uses the spec wording for key codes and falls back to the API message', () => {
    expect(accessErrorText(new ApiError(409, 'LAST_CHAIRMAN', 'x'))).toBe(
      'The society needs at least one active chairman.',
    );
    expect(accessErrorText(new ApiError(403, 'CHAIRMAN_ROLE_LOCKED', 'x'))).toBe(
      'Only SocietyApp support can change the Chairman role.',
    );
    expect(accessErrorText(new ApiError(500, 'WHATEVER', 'From server'))).toBe('From server');
    expect(accessErrorText(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
});
