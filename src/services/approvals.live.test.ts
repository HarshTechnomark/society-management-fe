import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { approvalsService as svc } from './approvals.service';
import { mapBulk, mapCounts, mapDetail, mapRow } from './approvalsMappers';
import { mapSimulation } from './approvalsRulesMappers';

/** Shapes captured from the real backend (module 14 live check): write-off, refund, offline payment. */
const writeOff = {
  id: 265,
  type: 'WRITE_OFF',
  entityType: 'billing_note',
  entityId: 5,
  title: 'Write off INV/2026-27/DEMO-OVERDUE',
  summary: 'Unrecoverable old dues',
  amountPaise: 100000,
  status: 'PENDING',
  round: 1,
  ruleName: 'Write-offs',
  requester: { userId: 1499, name: 'Meera Iyer' },
  steps: [
    {
      stepNo: 1,
      name: 'Two of Chairman, Treasurer, Secretary',
      mode: 'N_OF',
      requiredCount: 2,
      approvalsGiven: 1,
      widened: false,
      approvedBy: ['Rajesh Kulkarni'],
      state: 'CURRENT',
      slots: [{ type: 'ROLE', ref: 'chairman', label: 'Chairman' }],
    },
    {
      stepNo: 2,
      name: 'Both',
      mode: 'ALL_OF',
      requiredCount: null,
      approvalsGiven: 0,
      approvedBy: [],
      state: 'UPCOMING',
      slots: [
        { type: 'ROLE', ref: 'a', label: 'A' },
        { type: 'ROLE', ref: 'b', label: 'B' },
      ],
    },
  ],
  description: { facts: [{ label: 'Amount', value: '₹1,000', kind: 'money' }], link: null },
  myAction: {
    canApprove: false,
    canReject: false,
    canRequestChanges: false,
    canCancel: false,
    onBehalfOptions: [],
    reason: 'ALREADY_ACTED',
    reasonText: 'x',
  },
  stepUpRequired: false,
  stepUpAbovePaise: 2500000,
  actions: [],
  version: 2,
};

beforeEach(resetAll);

describe('real backend shapes', () => {
  it('detail without typeLabel keeps a title and summary, and reads null requiredCount', () => {
    const d = mapDetail(writeOff);
    expect(d).toMatchObject({
      title: 'Write off INV/2026-27/DEMO-OVERDUE',
      summary: 'Unrecoverable old dues',
      typeLabel: '',
    });
    expect(d.steps[0]).toMatchObject({ requiredCount: 2, approvalsGiven: 1, state: 'CURRENT' });
    expect(d.steps[1]).toMatchObject({ requiredCount: 2, state: 'UPCOMING' });
    expect(d.facts[0]).toMatchObject({ kind: 'money' });
  });
  it('row with null summary and an offline payment title', () => {
    const r = mapRow({
      id: 266,
      type: 'OFFLINE_PAYMENT',
      typeLabel: 'Offline payment',
      title: 'Cash ₹30,000 from B-404',
      summary: null,
      amountPaise: 3000000,
      status: 'PENDING',
      requester: { userId: 1, name: 'Meera Iyer' },
      hasEligibleApprover: true,
      stuckAt: null,
      myAction: { canAct: false, onBehalfOf: null, reason: 'MAKER_CHECKER' },
      version: 1,
    });
    expect(r).toMatchObject({
      summary: '',
      typeLabel: 'Offline payment',
      requesterName: 'Meera Iyer',
      stuck: false,
      reason: 'MAKER_CHECKER',
    });
  });
  it('counts and bulk results', () => {
    expect(
      mapCounts({
        forMe: 1,
        forMeByType: { WRITE_OFF: 1 },
        overdueForMe: 0,
        allPending: 2,
        submittedOpen: 0,
        stuck: 0,
      }).forMeByType,
    ).toEqual({ WRITE_OFF: 1 });
    const b = mapBulk({
      approved: 0,
      skipped: 1,
      results: [{ id: 267, ok: false, code: 'BULK_NOT_ALLOWED', message: 'No' }],
    });
    expect(b.results[0]).toMatchObject({ ok: false, code: 'BULK_NOT_ALLOWED', status: null });
  });
  it('simulation vacant seats come as slotType and slotRef objects', () => {
    const s = mapSimulation({
      matchedRuleId: 1,
      ruleName: 'R',
      routing: 'STEPS',
      stepUpRequired: false,
      steps: [
        {
          stepNo: 1,
          name: 'S',
          mode: 'ANY_OF',
          eligibleNow: [],
          vacantSlots: [{ slotType: 'ROLE', slotRef: 'chairman' }],
        },
      ],
    });
    expect(s.steps[0].vacantSlots).toEqual(['chairman']);
  });
  it('sends only the fields the strict list query allows and drops a one-letter search', async () => {
    const api = mockApi({
      'GET /approvals': ok([], 'OK', { pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
    });
    await svc.inbox({ view: 'DECIDED', status: 'APPROVED', q: 'a', unknown: 'x' } as never);
    const url = api.fn.mock.calls[0][0] as string;
    expect(url).toContain('status=APPROVED');
    expect(url).not.toContain('q=');
    expect(url).not.toContain('unknown');
  });
});
