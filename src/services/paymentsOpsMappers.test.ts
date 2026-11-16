import { describe, expect, it } from 'vitest';
import { advancesRaw, mandateRaw, orderRaw, refundRaw } from '@/test/paymentsOpsFixtures';
import {
  normaliseAdvances,
  normaliseLink,
  normaliseMandate,
  normaliseOrder,
  normalisePagination,
  normaliseRefund,
  rows,
} from './paymentsOpsMappers';

describe('paymentsOpsMappers', () => {
  it('maps a refund and tolerates a nested payment and missing fields', () => {
    const r = normaliseRefund(refundRaw());
    expect(r).toMatchObject({
      id: 12,
      mode: 'BANK_TRANSFER',
      status: 'PROCESSING',
      version: 3,
      refundNo: null,
    });
    const d = normaliseRefund({ id: 1, payment: { id: 9, receiptNo: 'RCT/1' }, unit: { label: 'C-1' } });
    expect(d).toMatchObject({ paymentId: 9, receiptNo: 'RCT/1', unitLabel: 'C-1', version: 1 });
    expect(normaliseRefund(null).id).toBe(0);
  });
  it('maps an order, reading orderId and items', () => {
    const o = normaliseOrder({
      ...orderRaw(),
      items: [{ itemType: 'INVOICE', label: 'INV-1', amountPaise: '500' }],
    });
    expect(o.items).toEqual([{ itemType: 'INVOICE', label: 'INV-1', amountPaise: 500 }]);
    expect(normaliseOrder({ orderId: 7, status: 'PAID' }).id).toBe(7);
    expect(o.basePaise).toBeNull();
  });
  it('maps a mandate with a null last debit', () => {
    expect(normaliseMandate(mandateRaw()).lastDebitStatus).toBe('SUCCESS');
    expect(
      normaliseMandate(mandateRaw({ lastDebitAt: null, lastDebitStatus: null })).lastDebitStatus,
    ).toBeNull();
  });
  it('maps a created link and advances', () => {
    expect(normaliseLink({ orderId: 5, url: 'https://x/pay/a#b', amountPaise: 100 })).toMatchObject({
      orderId: 5,
      expiresAt: null,
    });
    const a = normaliseAdvances(advancesRaw());
    expect(a.balancePaise).toBe(120000);
    expect(a.entries).toHaveLength(2);
    expect(normaliseAdvances(undefined).entries).toEqual([]);
  });
  it('reads rows and pagination from several shapes', () => {
    expect(rows({ items: [1] })).toEqual([1]);
    expect(rows(null)).toEqual([]);
    expect(normalisePagination(undefined, 3)).toMatchObject({ total: 3, totalPages: 1 });
  });
  it('takes the payment id of an order detail from its payments list', () => {
    expect(normaliseOrder({ id: 4, payments: [{ id: 91 }] }).paymentId).toBe(91);
    expect(normaliseOrder({ id: 4 }).paymentId).toBeNull();
  });
});
