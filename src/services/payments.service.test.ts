import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiList = vi.fn();
const api = vi.fn();
const apiBlob = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  api: (...a: unknown[]) => api(...a),
  apiList: (...a: unknown[]) => apiList(...a),
  apiBlob: (...a: unknown[]) => apiBlob(...a),
}));

import {
  chequeDetailRaw,
  chequeRaw,
  detailRaw,
  liveItemRaw,
  pagination,
  paymentRaw,
  summaryRaw,
} from '@/test/paymentsFixtures';
import { paymentsService } from './payments.service';
import { eventLabel, landsIn } from '@/components/payments/admin/format';
import { mapPayment, mapPaymentDetail, mapSummary } from './paymentsMappers';

beforeEach(() => {
  api.mockReset();
  apiList.mockReset();
  apiBlob.mockReset();
});

describe('payments mappers', () => {
  it('reads amounts sent as strings and fills defaults', () => {
    const p = mapPayment({ id: '5', amountPaise: '12000', method: 'CASH', status: 'PENDING_APPROVAL' });
    expect(p.id).toBe(5);
    expect(p.amountPaise).toBe(12000);
    expect(p.grossAmountPaise).toBe(12000);
    expect(p.receiptNo).toBeNull();
    expect(p.needsReview).toBe(false);
    expect(p.version).toBe(1);
  });
  it('keeps efficiency null when the plan leaves it out', () => {
    expect(mapSummary(summaryRaw({ efficiency: undefined })).efficiency).toBeNull();
    expect(mapSummary(summaryRaw()).efficiency?.percent).toBe(85);
    expect(mapSummary(summaryRaw()).month.byMethod.UPI).toBe(30210000);
  });
});

describe('paymentsService', () => {
  it('lists with the query and maps items and pagination', async () => {
    apiList.mockResolvedValue({
      data: [paymentRaw(), chequeRaw()],
      pagination: pagination({ total: 41, totalPages: 3 }).pagination,
    });
    const r = await paymentsService.list({ page: 2, method: 'CASH', chequeStatus: 'PENDING' });
    expect(apiList.mock.calls[0]![0]).toBe('/payments');
    expect(apiList.mock.calls[0]![1].query).toMatchObject({
      page: 2,
      method: 'CASH',
      chequeStatus: 'PENDING',
    });
    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(41);
    expect(r.totalPages).toBe(3);
  });
  it('reads the detail with allocations and the cheque block', async () => {
    api.mockResolvedValueOnce(detailRaw()).mockResolvedValueOnce(chequeDetailRaw());
    const d = await paymentsService.get(7781);
    expect(api.mock.calls[0]![0]).toBe('/payments/7781');
    expect(d.allocations).toHaveLength(2);
    expect(d.cheque).toBeNull();
    const c = await paymentsService.get(7790);
    expect(c.cheque?.bankName).toBe('HDFC Bank');
    expect(c.recordedBy).toBe('Asha Kulkarni');
  });
  it('exports csv without paging', async () => {
    apiBlob.mockResolvedValue(new Blob(['x']));
    await paymentsService.exportCsv({ page: 3, limit: 20, method: 'UPI' });
    const [path, opts] = apiBlob.mock.calls[0]!;
    expect(path).toBe('/payments/export');
    expect(opts.query).toMatchObject({ method: 'UPI', format: 'csv', type: 'PAYMENTS' });
    expect(opts.query.page).toBeUndefined();
  });
  it('sends an Idempotency-Key on record, deposit, bounce and reverse', async () => {
    api.mockResolvedValue({
      id: 1,
      status: 'PENDING_APPROVAL',
      approval: { requestId: 3, status: 'PENDING' },
    });
    const body = {
      unitId: 1,
      payingFor: 'DUES' as const,
      method: 'CASH' as const,
      amountPaise: 1000,
      paymentDate: '2026-11-20',
    };
    const r = await paymentsService.recordOffline(body);
    expect(api.mock.calls[0]![0]).toBe('/payments/offline');
    expect(api.mock.calls[0]![1]).toMatchObject({ method: 'POST', idempotent: true, body });
    expect(r.approval?.requestId).toBe(3);
    await paymentsService.depositCheques({ paymentIds: [1], depositedOn: '2026-11-20', bankAccountId: 3 });
    expect(api.mock.calls[1]![0]).toBe('/payments/cheques/deposit');
    expect(api.mock.calls[1]![1].idempotent).toBe(true);
    await paymentsService.bounceCheque(5, {
      bouncedOn: '2026-11-20',
      reason: 'Funds insufficient',
      applyBounceCharge: true,
      bounceChargePaise: 50000,
      version: 2,
    });
    expect(api.mock.calls[2]![0]).toBe('/payments/5/cheque/bounce');
    expect(api.mock.calls[2]![1].idempotent).toBe(true);
    await paymentsService.reverse(5, {
      reasonCode: 'WRONG_ENTRY',
      reason: 'Typed twice by mistake',
      version: 2,
    });
    expect(api.mock.calls[3]![0]).toBe('/payments/5/reverse');
    expect(api.mock.calls[3]![1].idempotent).toBe(true);
  });
  it('calls clear, return, reallocate, review-done, receipt and resend on the spec routes', async () => {
    api.mockResolvedValue({});
    await paymentsService.clearCheque(5, { clearedOn: '2026-11-21', version: 3 });
    await paymentsService.returnCheque(5, { reason: 'Payer asked for it', version: 1 });
    await paymentsService.reallocate(5, {
      targets: [{ type: 'ADVANCE', amountPaise: 1000 }],
      reason: 'Wrong invoice',
      version: 1,
    });
    await paymentsService.reviewDone(5, { note: 'Checked', version: 1 });
    await paymentsService.receiptUrl(5);
    await paymentsService.resendReceipt(5, ['EMAIL', 'SMS']);
    expect(api.mock.calls.map(c => c[0])).toEqual([
      '/payments/5/cheque/clear',
      '/payments/5/cheque/return',
      '/payments/5/reallocate',
      '/payments/5/review-done',
      '/payments/5/receipt-url',
      '/payments/5/receipt/resend',
    ]);
    expect(api.mock.calls[5]![1].body).toEqual({ channels: ['EMAIL', 'SMS'] });
  });
  it('reads the summary and the live feed', async () => {
    api.mockResolvedValueOnce(summaryRaw()).mockResolvedValueOnce([liveItemRaw()]);
    expect((await paymentsService.summary()).today.count).toBe(4);
    const feed = await paymentsService.liveFeed();
    expect(api.mock.calls[1]![0]).toBe('/payments/live-feed');
    expect(feed[0]!.unitLabel).toBe('A-1203');
  });
  it('reads bank accounts bare, as items or under bankAccounts', async () => {
    const a = { id: 3, displayName: 'HDFC Current', maskedNumber: 'XXXX4821' };
    api
      .mockResolvedValueOnce([a])
      .mockResolvedValueOnce({ bankAccounts: [a] })
      .mockResolvedValueOnce({ items: [a] });
    for (let i = 0; i < 3; i++)
      expect((await paymentsService.bankAccounts())[0]!.label).toBe('HDFC Current XXXX4821');
  });
  it('keeps only open invoices for the reallocate dialog', async () => {
    apiList.mockResolvedValue({
      data: [
        { id: 1, invoiceNo: 'A', status: 'PAID' },
        { id: 2, invoiceNo: 'B', status: 'OVERDUE', outstandingPaise: 500 },
      ],
      pagination: pagination().pagination,
    });
    const r = await paymentsService.openInvoices(51);
    expect(r.map(i => i.id)).toEqual([2]);
  });
  it('keeps the landsIn account of the detail and words the audit actions', () => {
    const d = mapPaymentDetail(
      detailRaw({ landsIn: 'CHEQUES_IN_CLEARING', method: 'CHEQUE', status: 'RECEIVED' }),
    );
    expect(d.landsIn).toBe('CHEQUES_IN_CLEARING');
    expect(landsIn(d)).toBe('Cheques in clearing');
    expect(landsIn({ status: 'REVERSED', method: 'NEFT', landsIn: 'BANK' })).toBe('-');
    expect(eventLabel('payments.payment.recorded')).toBe('Payment recorded');
    expect(eventLabel('Payment received')).toBe('Payment received');
  });
});
