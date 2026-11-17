import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { listOf } from '@/test/approvalsFixtures';
import { delegationRaw, ruleRaw } from '@/test/approvalsRulesFixtures';
import { approvalsRulesService as svc } from './approvalsRules.service';
import { mapDelegation, mapRule, mapSimulation } from './approvalsRulesMappers';
import { rulesError } from '@/components/approvals/rules/rulesFormat';
import { ApiError } from '@/lib/apiClient';

beforeEach(resetAll);
const key = (api: ReturnType<typeof mockApi>, i = 0) =>
  ((api.fn.mock.calls[i][1] as RequestInit).headers as Record<string, string>)['Idempotency-Key'];

describe('mappers', () => {
  it('maps a rule with steps, nulls and warnings', () => {
    const r = mapRule(ruleRaw({ warnings: [{ code: 'COVERAGE_GAP', message: 'Gap' }] }));
    expect(r).toMatchObject({
      id: 301,
      maxAmountPaise: null,
      categoryKeys: null,
      openRequests: 2,
      warnings: [{ code: 'COVERAGE_GAP', message: 'Gap' }],
    });
    expect(r.steps[0]).toMatchObject({ mode: 'N_OF', requiredCount: 2 });
  });
  it('survives an empty object', () => {
    expect(mapRule({})).toMatchObject({
      action: 'REQUIRE_APPROVAL',
      steps: [],
      isActive: true,
      warnings: [],
    });
  });
  it('maps a simulation and a delegation', () => {
    const s = mapSimulation({
      matchedRuleId: 300,
      ruleName: 'R',
      routing: 'REQUIRE_APPROVAL',
      stepUpRequired: true,
      steps: [
        {
          stepNo: 1,
          name: 'S',
          mode: 'ANY_OF',
          eligibleNow: [{ userId: 2, name: 'A', roleKey: 'treasurer', via: 'ROLE' }],
          vacantSlots: [],
        },
      ],
    });
    expect(s.steps[0].eligibleNow[0].name).toBe('A');
    expect(mapDelegation(delegationRaw())).toMatchObject({
      delegateName: 'Priya Nair',
      delegatorUserId: 101,
      types: null,
    });
  });
});

describe('rules calls', () => {
  it('lists rules including inactive ones', async () => {
    const api = mockApi({ 'GET /approvals/rules': ok([ruleRaw()]) });
    const r = await svc.rules('EXPENSE');
    expect(r).toHaveLength(1);
    expect(api.fn.mock.calls[0][0]).toContain('type=EXPENSE');
    expect(api.fn.mock.calls[0][0]).toContain('includeInactive=true');
  });
  it('creates with an idempotency key and returns the warnings', async () => {
    const api = mockApi({
      'POST /approvals/rules': ok({ ...ruleRaw(), warnings: [{ code: 'RULE_SHADOWED', message: 'x' }] }),
    });
    const r = await svc.create({ type: 'EXPENSE', name: 'N' } as never);
    expect(key(api)).toBeTruthy();
    expect(r.warnings[0].code).toBe('RULE_SHADOWED');
  });
  it('patches with the version, deletes with a reason and resets by type', async () => {
    const api = mockApi({
      'PATCH /approvals/rules/301': ok(ruleRaw()),
      'DELETE /approvals/rules/301': ok({ warnings: [{ code: 'COVERAGE_GAP', message: 'gap' }] }),
      'POST /approvals/rules/reset-defaults': ok([ruleRaw()]),
    });
    await svc.update(301, { isActive: false, version: 1 });
    expect(api.last('PATCH', '/approvals/rules/301')?.body).toEqual({ isActive: false, version: 1 });
    const w = await svc.remove(301, { version: 1, reason: 'Not needed' });
    expect(w[0].message).toBe('gap');
    expect(api.last('DELETE', '/approvals/rules/301')?.body).toEqual({ version: 1, reason: 'Not needed' });
    expect(await svc.resetDefaults({ type: 'EXPENSE', reason: 'Start over' })).toHaveLength(1);
  });
  it('simulates, reads and saves settings', async () => {
    const api = mockApi({
      'POST /approvals/rules/simulate': ok({
        matchedRuleId: null,
        ruleName: '',
        routing: 'AUTO_APPROVE',
        steps: [],
      }),
      'GET /approvals/settings': ok({ stepUpAbovePaise: 2500000, bulkApproveBelowPaise: 1000000 }),
      'PATCH /approvals/settings': ok({ stepUpAbovePaise: 3000000, bulkApproveBelowPaise: 1000000 }),
    });
    expect((await svc.simulate({ type: 'EXPENSE', amountPaise: 100 })).matchedRuleId).toBeNull();
    expect((await svc.settings()).bulkApproveBelowPaise).toBe(1000000);
    expect((await svc.saveSettings({ stepUpAbovePaise: 3000000 })).stepUpAbovePaise).toBe(3000000);
    expect(api.last('PATCH', '/approvals/settings')?.body).toEqual({ stepUpAbovePaise: 3000000 });
  });
});

describe('delegation calls', () => {
  it('lists my delegations with a scope', async () => {
    const api = mockApi({ 'GET /approvals/delegations': listOf([delegationRaw()]) });
    const l = await svc.delegations({ scope: 'ALL', page: 2 });
    expect(l.items[0].id).toBe(88);
    expect(api.fn.mock.calls[0][0]).toContain('scope=ALL');
  });
  it('creates idempotently and revokes', async () => {
    const api = mockApi({
      'POST /approvals/delegations': ok(delegationRaw()),
      'POST /approvals/delegations/88/revoke': ok(delegationRaw({ displayStatus: 'REVOKED' })),
    });
    await svc.createDelegation({
      delegateUserId: 17,
      startsAt: 'a',
      endsAt: 'b',
      types: null,
      maxAmountPaise: null,
      reason: 'Leave',
    });
    expect(key(api)).toBeTruthy();
    expect((await svc.revokeDelegation(88, { version: 1, reason: 'Back early' })).displayStatus).toBe(
      'REVOKED',
    );
  });
  it('turns known codes into plain words', async () => {
    mockApi({ 'POST /approvals/delegations/88/revoke': err(409, 'DELEGATION_NOT_ACTIVE') });
    const e = await svc.revokeDelegation(88, { version: 1, reason: 'Back early' }).catch(x => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(rulesError(e)).toBe('This delegation has already ended.');
  });
});
