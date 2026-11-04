import { describe, expect, it } from 'vitest';
import { detailRaw, noteRaw, rowRaw } from '@/test/billingInvoicesFixtures';
import {
  normaliseCancel,
  normaliseInvoice,
  normaliseNote,
  normalisePdfUrl,
  normaliseRow,
} from './billingInvoicesMappers';

describe('billingInvoicesMappers', () => {
  it('maps a list row', () => {
    expect(normaliseRow(rowRaw())).toMatchObject({
      id: 5123,
      unitLabel: 'C-0801',
      outstandingPaise: 506100,
      status: 'PARTIALLY_PAID',
      isOverdue: false,
    });
  });

  it('maps the detail: nested unit and bill-to, GST split, payments, explanation', () => {
    const d = normaliseInvoice(detailRaw());
    expect(d.unitId).toBe(312);
    expect(d.billToName).toBe('Anil Deshmukh');
    expect(d.cgstPaise).toBe(74070);
    expect(d.sgstPaise).toBe(74070);
    expect(d.lines).toHaveLength(5);
    expect(d.lines[0].explanation).toBe('2,150 sq ft × ₹3.20 = ₹6,880.00');
    expect(d.payments[0]).toMatchObject({ label: 'Payment #9001', amountPaise: 500000 });
    expect(d.financialYear).toBe('2026-27');
  });

  it('maps payments from the real allocations {paymentId, allocatedOn, amountPaise}', () => {
    const d = normaliseInvoice(
      detailRaw({
        allocations: [
          { paymentId: 9001, allocatedOn: '2026-11-05', amountPaise: 300000 },
          { paymentId: 9001, allocatedOn: '2026-11-06', amountPaise: 200000 },
          { allocatedOn: '2026-11-07', amountPaise: 100 },
        ],
      }),
    );
    expect(d.payments).toEqual([
      {
        id: 9001,
        key: '9001-0',
        label: 'Payment #9001',
        date: '2026-11-05',
        mode: null,
        amountPaise: 300000,
      },
      {
        id: 9001,
        key: '9001-1',
        label: 'Payment #9001',
        date: '2026-11-06',
        mode: null,
        amountPaise: 200000,
      },
      { id: 0, key: 'x-2', label: 'Payment', date: '2026-11-07', mode: null, amountPaise: 100 },
    ]);
  });

  it('takes tax and round-off from the lines when the totals are missing', () => {
    const d = normaliseInvoice(
      detailRaw({
        cgstPaise: undefined,
        sgstPaise: undefined,
        taxPaise: undefined,
        roundOffPaise: undefined,
        allocations: [{ paymentId: 1, amountPaise: 300 }],
      }),
    );
    expect(d.cgstPaise).toBe(74070);
    expect(d.roundOffPaise).toBe(-40);
    expect(d.payments[0].amountPaise).toBe(300);
  });

  it('never throws on junk', () => {
    expect(normaliseInvoice(null).lines).toEqual([]);
    expect(normaliseRow('x').status).toBe('ISSUED');
  });

  it('maps notes and the pdf url', () => {
    expect(normaliseNote(noteRaw({ status: 'PENDING_APPROVAL', noteNo: null })).noteNo).toBeNull();
    expect(normalisePdfUrl({ url: 'https://f/x.pdf', expiresAt: 'z' }).url).toBe('https://f/x.pdf');
  });

  it('tells a pending cancellation from a finished one', () => {
    expect(normaliseCancel({ approvalRequestId: 9, status: 'PENDING' }).outcome).toBe('PENDING');
    expect(normaliseCancel(detailRaw({ status: 'CANCELLED' })).outcome).toBe('CANCELLED');
  });
});
