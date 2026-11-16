import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { advancesRaw, listOf, orderRaw, refundRaw } from '@/test/paymentsOpsFixtures';
import { paymentsOpsService as s } from './paymentsOps.service';

beforeEach(resetAll);

describe('paymentsOpsService', () => {
  it('lists refunds with the filters in the query', async () => {
    const api = mockApi({ 'GET /refunds': listOf([refundRaw()]) });
    const r = await s.refunds({ status: 'PROCESSING', mode: 'CASH', page: 2 });
    expect(r.items).toHaveLength(1);
    const url = String(api.fn.mock.calls[0][0]);
    expect(url).toContain('status=PROCESSING');
    expect(url).toContain('mode=CASH');
    expect(url).toContain('page=2');
  });
  it('requests a refund with an idempotency key and completes one with its version', async () => {
    const api = mockApi({
      'POST /refunds': ok(refundRaw({ status: 'PENDING_APPROVAL' })),
      'POST /refunds/12/complete': ok(refundRaw({ status: 'PROCESSED' })),
    });
    await s.requestRefund({
      paymentId: 7781,
      amountPaise: 100,
      mode: 'CASH',
      reason: 'Paid twice by mistake',
    });
    const init = api.fn.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy();
    await s.completeRefund(12, { paidOutOn: '2026-11-21', bankReference: 'UTR12345', version: 3 });
    expect(api.last('POST', '/refunds/12/complete')?.body).toEqual({
      paidOutOn: '2026-11-21',
      bankReference: 'UTR12345',
      version: 3,
    });
  });
  it('reads, cancels and checks an order', async () => {
    const api = mockApi({
      'GET /payment-orders/4412': ok(orderRaw()),
      'POST /payment-orders/4412/cancel': ok(orderRaw({ status: 'CANCELLED' })),
      'POST /payment-orders/4412/check': ok(orderRaw({ status: 'PAID' })),
    });
    expect((await s.order(4412)).status).toBe('CREATED');
    expect((await s.cancelOrder(4412, 'Wrong amount')).status).toBe('CANCELLED');
    expect(api.last('POST', '/payment-orders/4412/cancel')?.body).toEqual({ reason: 'Wrong amount' });
    expect((await s.checkOrder(4412)).status).toBe('PAID');
  });
  it('cancels a mandate, creates a link and reads advances', async () => {
    const api = mockApi({
      'POST /autopay-mandates/31/cancel': ok(null),
      'POST /payment-links': ok({
        orderId: 9,
        url: 'https://my.societyapp.in/pay/abc#tok',
        amountPaise: 5000,
      }),
      'GET /units/51/advances': ok(advancesRaw()),
    });
    await s.cancelMandate(31, { reason: 'Left society', version: 2 });
    expect(api.last('POST', '/autopay-mandates/31/cancel')?.body).toEqual({
      reason: 'Left society',
      version: 2,
    });
    expect((await s.createLink({ unitId: 51, amountMode: 'OUTSTANDING' })).url).toContain('#tok');
    expect((await s.advances(51)).balancePaise).toBe(120000);
  });
});
