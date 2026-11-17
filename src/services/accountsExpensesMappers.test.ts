import { describe, expect, it } from 'vitest';
import { mapCashBook, mapExpenseDetail } from './accountsExpensesMappers';

/** The shapes below are what the real backend answers (reconciled against the running API). */
describe('expense mappers on the real backend shapes', () => {
  const raw = {
    id: 1,
    displayId: 'EXP-1',
    status: 'POSTED',
    voucherNo: 'VCH/2026-27/000001',
    expenseDate: '2026-11-10',
    payee: 'Clean Co',
    ledgerAccount: { id: 148, code: '5100', name: 'Housekeeping' },
    grossAmountPaise: 100000,
    netPaidPaise: 100000,
    paidFrom: { id: 174, code: '1120', name: 'Cash in hand' },
    paymentMode: 'CASH',
    fundId: null,
    billFileCount: 1,
    createdBy: 268,
    createdByName: 'Meera Iyer',
    files: [{ id: 5, name: 'bill.png', mimeType: 'image/png', status: 'CLEAN' }],
    approval: { requestId: 1, status: 'APPROVED' },
    journal: {
      id: 2,
      lines: [
        {
          ledgerAccount: { id: 148, code: '5100', name: 'Housekeeping' },
          debitPaise: 100000,
          creditPaise: 0,
        },
      ],
    },
    canApprove: false,
    canReverse: false,
    version: 3,
  };
  it('reads the numeric createdBy, the journal line account object and the dev bill link', () => {
    const d = mapExpenseDetail(raw);
    expect(d.createdById).toBe(268);
    expect(d.createdByName).toBe('Meera Iyer');
    expect(d.journalLines[0]).toMatchObject({ account: 'Housekeeping', debitPaise: 100000 });
    expect(d.files[0]!.url).toBe('/api/v1/dev/files/5');
    expect(d.approval?.status).toBe('APPROVED');
    expect(d.canReverse).toBe(false);
  });
  it('keeps a manual journal reference id (a uuid) as text', () => {
    const b = mapCashBook({
      openingPaise: 0,
      closingPaise: 5,
      rows: [
        {
          date: '2026-11-01',
          voucherNo: 'JV/1',
          refType: 'manual_journal',
          refId: '9208b818-2570-4ae6',
          inPaise: 5,
        },
      ],
    });
    expect(b.rows[0]!.refId).toBe('9208b818-2570-4ae6');
  });
});
