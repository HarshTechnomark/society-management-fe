import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiList = vi.fn();
const api = vi.fn();
vi.mock('@/lib/apiClient', async () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
    ) {
      super(code);
    }
  }
  return { api: (...a: unknown[]) => api(...a), apiList: (...a: unknown[]) => apiList(...a), ApiError };
});

import { ApiError } from '@/lib/apiClient';
import { detailRaw, expenseRaw, ledgerTree } from '@/test/expensesFixtures';
import { accountsExpensesService as svc, resetAccountsExpensesSession } from './accountsExpenses.service';
import { mapExpense, mapExpenseDetail, mapLedgerTree } from './accountsExpensesMappers';

beforeEach(() => {
  api.mockReset();
  apiList.mockReset();
  resetAccountsExpensesSession();
});

describe('expense mappers', () => {
  it('fills defaults and reads string amounts', () => {
    const x = mapExpense({ id: '5', grossAmountPaise: '12000', tdsPaise: '2000' });
    expect(x.displayId).toBe('EXP-5');
    expect(x.netPaidPaise).toBe(10000);
    expect(x.status).toBe('DRAFT');
    expect(x.fundId).toBeNull();
  });
  it('maps the detail with files, approval and journal', () => {
    const d = mapExpenseDetail(detailRaw());
    expect(d.files[0]!.url).toBe('https://f.test/bill.jpg');
    expect(d.approval?.levels).toBe(2);
    expect(d.approval?.actions[0]!.by).toBe('Meera');
    expect(d.journalLines).toHaveLength(1);
    expect(d.createdByName).toBe('Anita Rao');
  });
  it('flattens the ledger tree to active leaves', () => {
    const leaves = mapLedgerTree(ledgerTree);
    expect(leaves.map(l => l.code)).toEqual(['5350', '5330', '1120', '1110-001']);
    expect(leaves[2]!.balancePaise).toBe(500000);
  });
});

describe('accountsExpensesService', () => {
  it('lists with the query and drops empty values', async () => {
    apiList.mockResolvedValue({
      data: [expenseRaw()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const r = await svc.list({ page: 1, status: 'DRAFT', q: '' });
    expect(apiList.mock.calls[0]![0]).toBe('/expenses');
    expect(apiList.mock.calls[0]![1].query).toEqual({ page: 1, status: 'DRAFT' });
    expect(r.items).toHaveLength(1);
  });
  it('sends an idempotency key on create, update, submit, withdraw, cancel and reverse', async () => {
    api.mockResolvedValue({ id: 1, status: 'DRAFT', version: 1 });
    await svc.create({
      expenseDate: '2026-10-30',
      payee: 'A',
      grossAmountPaise: 100,
      paidFromLedgerAccountId: 1,
      paymentMode: 'CASH',
    });
    await svc.update(1, { version: 1, payee: 'B' });
    await svc.submit(1, 1);
    await svc.withdraw(1, { version: 1, reason: 'wrong one' });
    await svc.cancelDraft(1, { version: 1, reason: 'wrong one' });
    await svc.reverse(1, { version: 1, reason: 'wrong one' });
    expect(api.mock.calls.map(c => [c[1].method, c[1].idempotent])).toEqual([
      ['POST', true],
      ['PATCH', true],
      ['POST', true],
      ['POST', true],
      ['DELETE', true],
      ['POST', true],
    ]);
    expect(api.mock.calls[5]![0]).toBe('/expenses/1/reverse');
  });
  it('reads the cash book object with its pagination', async () => {
    apiList.mockResolvedValue({
      data: {
        openingPaise: 100,
        closingPaise: 50,
        rows: [{ date: '2026-10-01', voucherNo: 'V1', inPaise: 0, outPaise: 50, runningPaise: 50 }],
      },
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    const b = await svc.cashBook({ account: 'ALL', from: '2026-10-01', to: '2026-10-31' });
    expect(b.openingPaise).toBe(100);
    expect(b.rows[0]!.outPaise).toBe(50);
  });
  it('remembers a 404 on the funds list and does not ask again', async () => {
    api.mockRejectedValue(new (ApiError as unknown as new (s: number, c: string) => Error)(404, 'NOT_FOUND'));
    await expect(svc.funds()).rejects.toBeTruthy();
    await expect(svc.funds()).rejects.toBeTruthy();
    expect(api).toHaveBeenCalledTimes(1);
  });
});
