import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { countsRaw, detailRaw, listOf, requestRaw, rowRaw, typesRaw } from '@/test/approvalsFixtures';
import { approvalsService as svc } from './approvals.service';
import { mapRow } from './approvalsMappers';

beforeEach(resetAll);
const key = (api: ReturnType<typeof mockApi>, i = 0) =>
  ((api.fn.mock.calls[i][1] as RequestInit).headers as Record<string, string>)['Idempotency-Key'];

describe('mappers', () => {
  it('maps a row: requester, steps chips data, can-act and stuck', () => {
    const r = mapRow(
      rowRaw({ stuckAt: '2026-11-01T00:00:00Z', myAction: { canAct: false, reason: 'MAKER_CHECKER' } }),
    );
    expect(r).toMatchObject({
      id: 5012,
      requesterName: 'Meera Iyer',
      amountPaise: 4800000,
      canAct: false,
      reason: 'MAKER_CHECKER',
      stuck: true,
      bulkEligible: true,
    });
  });
  it('falls back to requestedByName and survives missing fields', () => {
    expect(mapRow({ id: 1, type: 'WRITE_OFF', requestedByName: 'Asha' })).toMatchObject({
      requesterName: 'Asha',
      title: '',
      status: 'PENDING',
      canAct: false,
    });
  });
});

describe('reads', () => {
  it('lists the inbox with a view and drops empty filters', async () => {
    const api = mockApi({ 'GET /approvals': listOf([rowRaw()], 3) });
    const l = await svc.inbox({ view: 'FOR_ME', type: '', overdue: true, page: 2 });
    expect(api.fn.mock.calls[0][0]).toContain('view=FOR_ME');
    expect(api.fn.mock.calls[0][0]).toContain('overdue=true');
    expect(api.fn.mock.calls[0][0]).not.toContain('type=');
    expect(l.totalPages).toBe(3);
    expect(l.items).toHaveLength(1);
  });
  it('lists submitted requests without a view', async () => {
    const api = mockApi({ 'GET /approvals/submitted': listOf([rowRaw()]) });
    await svc.submitted({ view: 'FOR_ME', status: 'APPROVED' });
    expect(api.fn.mock.calls[0][0]).not.toContain('view=');
    expect(api.fn.mock.calls[0][0]).toContain('status=APPROVED');
  });
  it('maps counts, types and the detail', async () => {
    mockApi({
      'GET /approvals/counts': ok(countsRaw()),
      'GET /approvals/types': ok(typesRaw()),
      'GET /approvals/5012': ok(detailRaw()),
    });
    expect((await svc.counts()).forMeByType).toEqual({ EXPENSE: 2 });
    expect((await svc.types())[1]).toMatchObject({ type: 'MOVE_IN', allowsChanges: false });
    const d = await svc.get(5012);
    expect(d.facts[0].label).toBe('Payee');
    expect(d.link).toBe('/admin/money/expenses/77');
    expect(d.steps[0].slots).toHaveLength(2);
    expect(d.myAction.canApprove).toBe(true);
  });
  it('lists my requests', async () => {
    const api = mockApi({ 'GET /me/approval-requests': listOf([requestRaw()]) });
    const l = await svc.myRequests({ status: 'PENDING' });
    expect(api.fn.mock.calls[0][0]).toContain('status=PENDING');
    expect(l.items[0]).toMatchObject({ canCancel: true, statusLabel: 'Waiting for Secretary' });
  });
});

describe('decisions send an Idempotency-Key and the version', () => {
  it('approve, reject, request changes, cancel, reassign', async () => {
    const api = mockApi({
      'POST /approvals/5012/approve': ok({ id: 5012, status: 'APPROVED', stepCompleted: true, version: 4 }),
      'POST /approvals/5012/reject': ok({ id: 5012, status: 'REJECTED', version: 4 }),
      'POST /approvals/5012/request-changes': ok({ id: 5012, status: 'CHANGES_REQUESTED', version: 4 }),
      'POST /approvals/5012/cancel': ok({ id: 5012, status: 'CANCELLED', version: 4 }),
      'POST /approvals/5012/reassign': ok(detailRaw()),
    });
    expect((await svc.approve(5012, { version: 3, comment: 'ok' })).status).toBe('APPROVED');
    await svc.reject(5012, { version: 3, reason: 'Too high' });
    await svc.requestChanges(5012, { version: 3, reason: 'Add the bill' });
    await svc.cancel(5012, { version: 3, reason: 'Sent by mistake' });
    await svc.reassign(5012, { version: 3, userId: 9, reason: 'Away', slotIndex: 0 });
    for (let i = 0; i < 5; i++) expect(key(api, i)).toBeTruthy();
    expect(api.calls[0].body).toEqual({ version: 3, comment: 'ok' });
    expect(api.calls[4].body).toEqual({ version: 3, userId: 9, reason: 'Away', slotIndex: 0 });
  });
  it('bulk approve returns one result per item', async () => {
    const api = mockApi({
      'POST /approvals/bulk-approve': ok({
        approved: 1,
        skipped: 1,
        results: [
          { id: 1, ok: true, status: 'APPROVED', version: 2 },
          { id: 2, ok: false, code: 'BULK_NOT_ALLOWED', message: 'x' },
        ],
      }),
    });
    const r = await svc.bulkApprove([
      { id: 1, version: 1 },
      { id: 2, version: 1 },
    ]);
    expect(key(api)).toBeTruthy();
    expect(r.results[1]).toMatchObject({ ok: false, code: 'BULK_NOT_ALLOWED' });
    expect(r.approved).toBe(1);
  });
  it('withdraws a resident request with a key', async () => {
    const api = mockApi({ 'POST /me/approval-requests/5101/cancel': ok({ id: 5101, status: 'CANCELLED' }) });
    await svc.cancelMine(5101, { version: 1, reason: 'Plans changed' });
    expect(key(api)).toBeTruthy();
  });
});
