import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import {
  collectionRaw,
  fakeOrderRaw,
  mandateRaw,
  paidOrderRaw,
  payablesRaw,
  paymentRaw,
} from '@/test/paymentsResidentFixtures';
import { mapCheckout, mapPublicLink } from './paymentsResidentMappers';
import { paymentsResidentService as svc } from './paymentsResident.service';

beforeEach(resetAll);

describe('mappers', () => {
  it('maps the pay list and keeps basis points and the live order', () => {
    const api = mockApi({
      'GET /me/payables': ok(payablesRaw({ liveOrder: { orderId: 9, status: 'CREATED' } })),
    });
    return svc.payables(312).then(p => {
      expect(api.calls[0].path).toBe('/me/payables');
      expect(p.items).toHaveLength(3);
      expect(p.items[0]).toMatchObject({
        type: 'COLLECTION_REQUEST',
        suggestedPaise: 110000,
        outstandingPaise: null,
      });
      expect(p.fee.methods.CARD).toBe(180);
      expect(p.liveOrder).toEqual({ orderId: 9, status: 'CREATED' });
      expect(p.advanceBalancePaise).toBe(2500);
    });
  });

  it('tells the fake gateway checkout from a real one', () => {
    expect(mapCheckout({ order_id: 'order_x', amount: 5 })).toMatchObject({
      gatewayOrderId: 'order_x',
      isFake: true,
    });
    expect(mapCheckout({ keyId: 'rzp', gatewayOrderId: 'o1', upiIntentUrl: 'upi://pay?x=1' }).isFake).toBe(
      false,
    );
    // the real API sends a key, a UPI link and a QR even for the development gateway: the provider decides
    expect(
      mapCheckout({
        provider: 'FAKE',
        keyId: 'key_fake_1',
        gatewayOrderId: 'o1',
        upiIntentUrl: 'upi://pay?x=1',
      }).isFake,
    ).toBe(true);
    expect(mapCheckout({ gatewayOrderId: 'o1', redirect_url: 'https://pay.example/h' })).toMatchObject({
      isFake: false,
      redirectUrl: 'https://pay.example/h',
    });
  });

  it('treats an unknown public link status as expired', () => {
    expect(mapPublicLink({ status: 'WEIRD' }).status).toBe('EXPIRED');
  });
});

describe('calls', () => {
  it('creates an order with an Idempotency-Key and the spec body', async () => {
    const api = mockApi({ 'POST /me/payables/payment-orders': ok(fakeOrderRaw(), 'Payment order created') });
    const o = await svc.createOrder({
      unitId: 312,
      allocationMode: 'SELECTED',
      items: [{ type: 'INVOICE', id: 87, amountPaise: 120000 }],
      payListVersion: 'a'.repeat(64),
    });
    expect(o.orderId).toBe(4412);
    expect(o.checkout.gatewayOrderId).toBe('order_fake1');
    expect(api.calls[0].body).toMatchObject({ allocationMode: 'SELECTED', unitId: 312 });
    const headers = (api.fn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeTruthy();
  });

  it('verifies, reads, cancels an order and drives the fake gateway', async () => {
    const api = mockApi({
      'POST /me/payables/payment-orders/4412/verify': ok(paidOrderRaw()),
      'GET /me/payment-orders/4412': ok(paidOrderRaw({ status: 'ATTEMPTED', payment: null })),
      'POST /me/payment-orders/4412/cancel': ok(paidOrderRaw({ status: 'CANCELLED', payment: null })),
      'POST /dev/payments/order_fake1/pay': ok({ gatewayPaymentId: 'pay_abc123', status: 'captured' }),
    });
    expect((await svc.verify(4412, 'pay_abc123')).payment?.receiptNo).toBe('RCT/2026-27/000046');
    expect(api.last('POST', '/me/payables/payment-orders/4412/verify')?.body).toEqual({
      gatewayPaymentId: 'pay_abc123',
    });
    expect((await svc.order(4412)).status).toBe('ATTEMPTED');
    expect((await svc.cancelOrder(4412)).status).toBe('CANCELLED');
    expect((await svc.devPay('order_fake1', 'captured')).gatewayPaymentId).toBe('pay_abc123');
    expect(api.last('POST', '/dev/payments/order_fake1/pay')?.body).toEqual({ status: 'captured' });
  });

  it('reads payments, receipt url, advances, collections and mandates', async () => {
    mockApi({
      'GET /me/payments': ok([paymentRaw()], 'OK', {
        pagination: { page: 1, limit: 30, total: 1, totalPages: 2 },
      }),
      'GET /me/payments/7781/receipt-url': ok({
        url: 'https://files/r.pdf',
        expiresAt: '2026-11-20T06:00:00Z',
      }),
      'GET /me/advances': ok({
        unitId: 312,
        balancePaise: 500,
        entries: [
          {
            id: 1,
            entryType: 'CREDIT',
            amountPaise: 500,
            balanceAfterPaise: 500,
            narration: 'x',
            createdAt: '2026-11-01',
          },
        ],
      }),
      'GET /me/collections': ok([collectionRaw()]),
      'GET /me/collections/9': ok({ ...collectionRaw(), whoPaid: [{ unitLabel: 'A-1', paidPaise: 100 }] }),
      'GET /me/autopay-mandates': ok([mandateRaw()]),
    });
    const page = await svc.payments({ unitId: 312 });
    expect(page.totalPages).toBe(2);
    expect(page.items[0].receiptNo).toBe('RCT/2026-27/000046');
    expect((await svc.receiptUrl(7781)).url).toBe('https://files/r.pdf');
    expect((await svc.advances(312)).entries).toHaveLength(1);
    expect((await svc.collections())[0].myRequests[0].unitLabel).toBe('C-0801');
    expect((await svc.collection(9)).whoPaid).toEqual([{ unitLabel: 'A-1', paidPaise: 100 }]);
    expect((await svc.mandates())[0]).toMatchObject({ id: 31, version: 3 });
  });

  it('declares a transfer and manages a mandate with its version', async () => {
    const api = mockApi({
      'POST /me/payments/declared': ok({ id: 1 }),
      'POST /me/autopay-mandates': ok({
        mandateId: 5,
        status: 'PENDING_AUTH',
        authorisation: { upiIntentUrl: 'upi://x' },
        expiresAt: '2026-12-01T00:00:00Z',
      }),
      'POST /me/autopay-mandates/5/pause': ok({}),
      'POST /me/autopay-mandates/5/resume': ok({}),
      'POST /me/autopay-mandates/5/cancel': ok({}),
    });
    await svc.declare({
      unitId: 1,
      method: 'NEFT',
      amountPaise: 100,
      paymentDate: '2026-11-01',
      referenceNo: 'UTR1234',
      fileIds: [3],
    });
    expect(
      ((api.fn.mock.calls[0][1] as RequestInit).headers as Record<string, string>)['Idempotency-Key'],
    ).toBeTruthy();
    const m = await svc.createMandate({
      unitId: 1,
      mandateType: 'UPI_AUTOPAY',
      maxAmountPaise: 100000,
      startDate: '2026-12-01',
      endDate: '2027-12-01',
    });
    expect(m).toMatchObject({ mandateId: 5, upiIntentUrl: 'upi://x' });
    await svc.pauseMandate(5, 3);
    await svc.resumeMandate(5, 4);
    await svc.cancelMandate(5, 5, 'moving');
    expect(api.last('POST', '/me/autopay-mandates/5/pause')?.body).toEqual({ version: 3 });
    expect(api.last('POST', '/me/autopay-mandates/5/cancel')?.body).toEqual({ version: 5, reason: 'moving' });
  });

  it('calls the public link with the token in X-Pay-Token and never the session', async () => {
    const api = mockApi({
      'GET /public/pay/AB12CD34EF': ok({
        societyName: 'Sky Heights CHS',
        unitLabel: 'A-1203',
        payerNameMasked: 'R*** S****',
        amountPaise: 910900,
        status: 'PAYABLE',
        expiresAt: null,
      }),
      'POST /public/pay/AB12CD34EF/checkout': ok({
        checkout: { gatewayOrderId: 'o1', keyId: 'k', upiIntentUrl: 'upi://p' },
      }),
      'POST /public/pay/AB12CD34EF/verify': ok(paidOrderRaw()),
    });
    const l = await svc.publicLink('AB12CD34EF', 'tok');
    expect(l.payerNameMasked).toBe('R*** S****');
    const init = api.fn.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Pay-Token']).toBe('tok');
    expect(init.credentials).toBeUndefined();
    expect((await svc.publicCheckout('AB12CD34EF', 'tok')).upiIntentUrl).toBe('upi://p');
    expect(api.last('POST', '/public/pay/AB12CD34EF/checkout')?.body).toEqual({ token: 'tok' });
    await svc.publicVerify('AB12CD34EF', 'tok', 'pay_abc123');
    expect(api.last('POST', '/public/pay/AB12CD34EF/verify')?.body).toEqual({
      token: 'tok',
      gatewayPaymentId: 'pay_abc123',
    });
  });

  it('turns an error envelope into an ApiError with its code', async () => {
    mockApi({ 'GET /public/pay/XX': err(410, 'PAYMENT_LINK_EXPIRED') });
    await expect(svc.publicLink('XX', 't')).rejects.toMatchObject({
      status: 410,
      code: 'PAYMENT_LINK_EXPIRED',
    });
  });
});
