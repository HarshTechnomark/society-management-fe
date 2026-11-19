import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { activeRaw, broadcastRaw, rollCallRaw } from '@/test/communicationResidentFixtures';
import { mapActive, mapDetail, mapRollCall } from './communicationEmergencyMappers';
import { communicationEmergencyService as svc } from './communicationEmergency.service';

beforeEach(resetAll);

describe('emergency mappers', () => {
  it('maps the detail with counts, need-help list and updates', () => {
    const b = mapDetail(broadcastRaw());
    expect(b).toMatchObject({ id: 31, type: 'FIRE', status: 'ACTIVE', version: 2, audienceType: 'ALL' });
    expect(b.counts).toEqual({ units: 64, safe: 20, needHelp: 1, noResponse: 43, peopleSafe: 52 });
    expect(b.needHelp[0]).toMatchObject({ unitLabel: 'A-402', attendedBy: null });
    expect(b.updates[0].message).toBe('Fire brigade has arrived.');
  });
  it('derives noResponse when the API leaves it out and survives nothing', () => {
    const b = mapDetail(broadcastRaw({ counts: { units: 10, safe: 3, needHelp: 2 } }));
    expect(b.counts.noResponse).toBe(5);
    expect(mapDetail(null)).toMatchObject({ id: 0, type: 'OTHER', status: 'ACTIVE', needHelp: [] });
  });
  it('maps a roll call whose byFloor sits beside the list', () => {
    const r = rollCallRaw();
    const m = mapRollCall(r.data, r, r.pagination);
    expect(m.items).toHaveLength(2);
    expect(m.byFloor[0]).toMatchObject({ buildingCode: 'A', floor: 4, safe: 3 });
    expect(m.items[1].status).toBe('NO_RESPONSE');
  });
});

describe('emergency calls', () => {
  it('starts a broadcast with confirm true and an idempotency key', async () => {
    const api = mockApi({ 'POST /emergency-broadcasts': ok(broadcastRaw()) });
    const b = await svc.start({
      type: 'FIRE',
      message: 'Smoke on 4th floor',
      audience: { type: 'ALL' },
      includeStaff: true,
      collectResponses: true,
      isDrill: false,
    });
    expect(b.id).toBe(31);
    expect(api.last('POST', '/emergency-broadcasts')?.body).toMatchObject({
      confirm: true,
      type: 'FIRE',
      isDrill: false,
    });
    const init = api.fn.mock.calls[0][1] as RequestInit;
    expect(Object.keys(init.headers as object).map(k => k.toLowerCase())).toContain('idempotency-key');
  });
  it('posts update, realert, resolve and cancel with the version', async () => {
    const api = mockApi({
      'POST /emergency-broadcasts/31/updates': ok(broadcastRaw()),
      'POST /emergency-broadcasts/31/realert': ok(broadcastRaw()),
      'POST /emergency-broadcasts/31/resolve': ok(broadcastRaw({ status: 'RESOLVED' })),
      'POST /emergency-broadcasts/31/cancel': ok(broadcastRaw({ status: 'CANCELLED' })),
    });
    await svc.update(31, { version: 2, message: 'Fire brigade has arrived.' });
    await svc.realert(31, { version: 2 });
    expect((await svc.resolve(31, { version: 2, allClearMessage: 'All clear, return home.' })).status).toBe(
      'RESOLVED',
    );
    await svc.cancel(31, { version: 2, reason: 'Burnt toast in a kitchen.' });
    expect(api.last('POST', '/emergency-broadcasts/31/resolve')?.body).toEqual({
      version: 2,
      allClearMessage: 'All clear, return home.',
    });
    expect(api.last('POST', '/emergency-broadcasts/31/cancel')?.body).toEqual({
      version: 2,
      reason: 'Burnt toast in a kitchen.',
    });
  });
  it('uses the gate paths for guards and the plain path for residents', async () => {
    const api = mockApi({
      'GET /gate/emergency-broadcasts/31/roll-call': ok(rollCallRaw().data, 'OK', {
        byFloor: [],
        pagination: rollCallRaw().pagination,
      }),
      'POST /gate/emergency-broadcasts/31/responses': ok({
        responseId: 5,
        status: 'SAFE',
        peopleCount: 1,
        respondedAt: 'x',
      }),
      'POST /emergency-broadcasts/31/responses': ok({
        responseId: 6,
        status: 'NEED_HELP',
        peopleCount: 1,
        respondedAt: 'x',
      }),
      'GET /gate/emergency-broadcasts/active': ok([activeRaw()]),
      'GET /me/emergency-broadcasts/active': ok([activeRaw()]),
    });
    expect((await svc.rollCall(31, 'gate', { status: 'SAFE' })).items).toHaveLength(2);
    await svc.respond(31, 'gate', { status: 'SAFE', unitId: 1 });
    expect((await svc.respond(31, 'me', { status: 'NEED_HELP', note: 'help' })).status).toBe('NEED_HELP');
    expect((await svc.active('gate'))[0].myUnits[0]).toMatchObject({ unitId: 12, response: null });
    await svc.active('me');
    expect(api.calls.map(c => c.path)).toContain('/gate/emergency-broadcasts/31/responses');
  });
  it('reports the API error code', async () => {
    mockApi({ 'POST /emergency-broadcasts/31/realert': err(422, 'EMERGENCY_REALERT_TOO_SOON') });
    await expect(svc.realert(31, { version: 2 })).rejects.toMatchObject({
      code: 'EMERGENCY_REALERT_TOO_SOON',
    });
  });
});

describe('emergency replies and active alerts (real shapes)', () => {
  it('reads the 201 reply with the live counters', async () => {
    mockApi({
      'POST /emergency-broadcasts/31/responses': ok({
        responseId: 5,
        status: 'SAFE',
        peopleCount: 3,
        respondedAt: '2026-11-18T09:00:00.000Z',
        counts: { safe: 21, needHelp: 1 },
      }),
    });
    const r = await svc.respond(31, 'me', { status: 'SAFE', peopleCount: 3 });
    expect(r).toMatchObject({ responseId: 5, peopleCount: 3, counts: { safe: 21, needHelp: 1 } });
  });
  it('carries the staff reply of an alert that reached the caller without a flat', () => {
    const a = mapActive(activeRaw({ myUnits: [], myResponse: 'NEED_HELP' }));
    expect(a.myUnits).toEqual([]);
    expect(a.myResponse).toBe('NEED_HELP');
    expect(mapActive(activeRaw()).myResponse).toBeNull();
  });
});
