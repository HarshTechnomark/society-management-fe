import { describe, expect, it } from 'vitest';
import { ruleRaw } from '@/test/approvalsRulesFixtures';
import { mapRule } from '@/services/approvalsRulesMappers';
import { amountRange, formFrom, indiaToIso, inputFrom, stepsSummary, validateRule } from './rulesFormat';

describe('rules format', () => {
  it('words amount ranges', () => {
    expect(amountRange(0, null)).toBe('Any amount');
    expect(amountRange(0, 2500000)).toBe('Up to ₹25,000');
    expect(amountRange(2500001, null)).toBe('₹25,000.01 and above');
    expect(amountRange(100000, 500000)).toBe('₹1,000 to ₹5,000');
  });
  it('summarises steps', () => {
    expect(stepsSummary(mapRule(ruleRaw()), { chairman: 'Chairman' })).toBe(
      'At least 2 of Chairman, Treasurer, Secretary',
    );
    expect(stepsSummary({ action: 'AUTO_APPROVE', steps: [] })).toBe('Approved automatically');
  });
  it('validates BR-14-28 field rules', () => {
    const f = formFrom();
    expect(Object.keys(validateRule(f, true))).toEqual(expect.arrayContaining(['name', 'step1']));
    const ok = {
      ...formFrom(mapRule(ruleRaw())),
    };
    expect(validateRule(ok, true)).toEqual({});
    expect(validateRule({ ...ok, minRupees: '500', maxRupees: '100' }, true).max).toMatch(/cannot be below/);
    expect(validateRule({ ...ok, name: 'ab' }, true).name).toBeTruthy();
    expect(validateRule({ ...ok, priority: '1000' }, true).priority).toBeTruthy();
    expect(validateRule({ ...ok, categories: 'bad code!' }, true).categories).toBeTruthy();
    expect(validateRule({ ...ok, escalateAfter: '10', slaHours: '48' }, true).escalate).toBeTruthy();
    const nof = { ...ok, steps: [{ ...ok.steps[0], requiredCount: 5 }] };
    expect(validateRule(nof, true).step1).toMatch(/count/);
    const all = {
      ...ok,
      steps: [{ ...ok.steps[0], mode: 'ALL_OF' as const, roleKeys: ['a', 'b', 'c', 'd', 'e', 'f'] }],
    };
    expect(validateRule(all, true).step1).toMatch(/at most 5/);
    expect(validateRule({ ...ok, action: 'AUTO_APPROVE', steps: [] }, true)).toEqual({});
  });
  it('builds the request body in paise with null for no limit', () => {
    const body = inputFrom(
      {
        ...formFrom(),
        name: ' Big ',
        minRupees: '250.50',
        maxRupees: '',
        categories: 'lift, plumbing',
        action: 'AUTO_APPROVE',
      },
      true,
    );
    expect(body).toMatchObject({
      name: 'Big',
      minAmountPaise: 25050,
      maxAmountPaise: null,
      categoryKeys: ['LIFT', 'PLUMBING'],
      steps: [],
      stepUpAbovePaise: null,
    });
  });
  it('reads a typed time as India time', () => {
    expect(indiaToIso('2026-12-01T05:30')).toBe('2026-12-01T00:00:00.000Z');
  });
});
