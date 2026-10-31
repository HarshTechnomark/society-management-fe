import { describe, expect, it } from 'vitest';
import { CATALOGUE, PERMISSIONS, isPrivilegedKey, keysOfScope, type PermissionScope } from './permissions';

const KEY = /^[a-z_]+\.[a-z_]+\.(view|create|edit|delete|import|export|approve)$/;

describe('permission catalogue (T03-01)', () => {
  it('has the expected key counts per scope and 300 in total', () => {
    const counts = Object.fromEntries(
      (Object.keys(CATALOGUE) as PermissionScope[]).map(s => [s, keysOfScope(s).length]),
    );
    expect(counts).toEqual({ platform: 39, society: 211, resident: 29, gate: 15, work: 6 });
    const all = (Object.keys(CATALOGUE) as PermissionScope[]).flatMap(keysOfScope);
    expect(all).toHaveLength(300);
    expect(new Set(all).size).toBe(300);
    all.forEach(k => expect(k).toMatch(KEY));
  });

  it('PERMISSIONS mirrors the catalogue exactly', () => {
    const leaves: string[] = [];
    const walk = (o: unknown) =>
      typeof o === 'string' ? leaves.push(o) : Object.values(o as object).forEach(walk);
    walk(PERMISSIONS);
    const all = (Object.keys(CATALOGUE) as PermissionScope[]).flatMap(keysOfScope);
    expect([...leaves].sort()).toEqual([...all].sort());
    expect(PERMISSIONS.settings.members.create).toBe('settings.members.create');
  });

  it('flags privileged keys per section 5.1', () => {
    for (const k of [
      'platform.team.view',
      'finance.expenses.approve',
      'finance.bank.import',
      'residents.people.export',
      'settings.roles.edit',
      'settings.members.delete',
      'settings.billing_rules.edit',
      'residents.contacts.view',
      'settings.data_export.create',
    ])
      expect(isPrivilegedKey(k), k).toBe(true);
    for (const k of [
      'finance.expenses.view',
      'settings.members.view',
      'settings.billing_rules.view',
      'helpdesk.tickets.edit',
      'resident.payments.create',
      'communication.notices.approve',
    ])
      expect(isPrivilegedKey(k), k).toBe(false);
  });
});
