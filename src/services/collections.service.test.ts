import { beforeEach, describe, expect, it } from 'vitest';
import { colRaw, reqRaw } from '@/test/collectionsFixtures';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { collectionsService } from './collections.service';

beforeEach(resetAll);
const page = { pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } };

describe('collectionsService', () => {
  it('lists with the query and maps the items', async () => {
    const api = mockApi({ 'GET /collections': ok([colRaw()], 'OK', page) });
    const r = await collectionsService.list({ status: 'PUBLISHED' });
    expect(r.items[0].title).toBe('Ganesh Utsav 2026');
    expect(r.pagination.total).toBe(1);
    expect(api.fn.mock.calls[0][0]).toContain('status=PUBLISHED');
  });
  it('creates with an Idempotency-Key and patches with the version', async () => {
    const api = mockApi({
      'POST /collections': ok(colRaw({ status: 'DRAFT' })),
      'PATCH /collections/12': ok(colRaw({ status: 'DRAFT', version: 2 })),
    });
    await collectionsService.create({ title: 'x' } as never);
    const headers = (api.fn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeTruthy();
    const d = await collectionsService.update(12, { version: 1, title: 'Ganesh' });
    expect(d.version).toBe(2);
    expect(api.last('PATCH', '/collections/12')?.body).toEqual({ version: 1, title: 'Ganesh' });
  });
  it('sends the action bodies of 8.22 and 8.23', async () => {
    const api = mockApi({
      'POST /collections/12/submit': ok(colRaw()),
      'POST /collections/12/publish': ok(colRaw()),
      'POST /collections/12/remind': ok({ sentTo: 32, reminderCount: 2 }),
      'POST /collections/12/close': ok(colRaw()),
      'POST /collections/12/cancel': ok(colRaw()),
      'POST /collections/12/requests': ok({ skippedUnitIds: [] }),
      'POST /collection-requests/301/waive': ok(reqRaw({ status: 'WAIVED' })),
      'DELETE /collections/12': ok(null),
    });
    await collectionsService.submit(12, 3);
    await collectionsService.publish(12, { version: 3, reason: 'Go' });
    expect((await collectionsService.remind(12, 3)).sentTo).toBe(32);
    await collectionsService.close(12, { reason: 'Done now', version: 3 });
    await collectionsService.cancel(12, { reason: 'Not needed', version: 3 });
    await collectionsService.addUnits(12, { unitIds: [1], version: 3 });
    await collectionsService.waive(301, { reason: 'Hardship', version: 1 });
    await collectionsService.remove(12, 3);
    expect(api.last('POST', '/collections/12/publish')?.body).toEqual({ version: 3, reason: 'Go' });
    expect(api.last('POST', '/collections/12/close')?.body).toEqual({ reason: 'Done now', version: 3 });
    expect(api.last('POST', '/collection-requests/301/waive')?.body).toEqual({
      reason: 'Hardship',
      version: 1,
    });
    expect(api.fn.mock.calls.at(-1)?.[0]).toContain('/collections/12?version=3');
  });
  it('posts a contribution to the offline payment route for a collection request', async () => {
    const api = mockApi({ 'POST /payments/offline': ok({ status: 'PENDING_APPROVAL' }) });
    await collectionsService.recordContribution({
      unitId: 51,
      collectionRequestId: 301,
      method: 'CASH',
      amountPaise: 100000,
      paymentDate: '2026-11-16',
    });
    expect(api.last('POST', '/payments/offline')?.body).toMatchObject({
      payingFor: 'COLLECTION',
      collectionRequestId: 301,
      unitId: 51,
    });
  });
  it('keeps only active funds as options', async () => {
    mockApi({
      'GET /funds': ok([
        { id: 1, name: 'Festival fund', status: 'ACTIVE' },
        { id: 2, name: 'Old', status: 'ARCHIVED' },
      ]),
    });
    expect(await collectionsService.funds()).toEqual([{ id: 1, label: 'Festival fund' }]);
  });
});
