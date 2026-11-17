import { beforeEach, describe, expect, it, vi } from 'vitest';
import { candidateRaw, importRaw, lineRaw, listOf, settlementRaw } from '@/test/accountsBankFixtures';

const apiList = vi.fn();
const api = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  api: (...a: unknown[]) => api(...a),
  apiList: (...a: unknown[]) => apiList(...a),
}));

import { accountsSettlementsService as set } from './accountsSettlements.service';
import { accountsStatementsService as st } from './accountsStatements.service';
import {
  normaliseBrs,
  normaliseCandidate,
  normaliseImport,
  normaliseLine,
} from './accountsStatementsMappers';
import { normaliseImportResult, normaliseSettlement } from './accountsSettlementsMappers';

beforeEach(() => {
  api.mockReset().mockResolvedValue({});
  apiList.mockReset();
});

describe('mappers', () => {
  it('maps a settlement with items and unmatched items, tolerating gaps', () => {
    const s = normaliseSettlement(settlementRaw());
    expect(s).toMatchObject({ id: 5, status: 'MISMATCH', netPaise: 1357635, version: 2 });
    expect(s.items[0]).toMatchObject({ receiptNo: 'RCT/1', matchedPaymentId: 7 });
    expect(s.unmatchedItems[0].reason).toBe('Payment not found');
    expect(normaliseSettlement(null)).toMatchObject({ id: 0, status: 'RECEIVED', items: [], version: 1 });
  });
  it('maps import results with string or object errors', () => {
    expect(normaliseImportResult({ created: '3', skipped: 1, errors: ['a', { message: 'b' }] })).toEqual({
      created: 3,
      skipped: 1,
      errors: ['a', 'b'],
    });
  });
  it('maps imports, lines, candidates and the BRS', () => {
    expect(normaliseImport(importRaw())).toMatchObject({
      lineCount: 142,
      matchedCount: 118,
      status: 'PARSED',
    });
    expect(normaliseLine(lineRaw())).toMatchObject({
      creditPaise: 1250000,
      matchStatus: 'UNMATCHED',
      matchMethod: null,
    });
    expect(normaliseCandidate({ id: 4, entry: { voucherNo: 'V1' }, debitPaise: 500 })).toMatchObject({
      journalLineId: 4,
      voucherNo: 'V1',
      amountPaise: 500,
    });
    const b = normaliseBrs({
      bookBalancePaise: '100',
      differencePaise: 0,
      items: [{ type: 'X', amountPaise: 5 }],
    });
    expect(b).toMatchObject({ bookBalancePaise: 100, differencePaise: 0 });
    expect(b.items[0]).toMatchObject({ kind: 'X', amountPaise: 5 });
  });
});

describe('settlement service', () => {
  it('lists with filters and drops empty ones', async () => {
    apiList.mockResolvedValue({
      data: [settlementRaw()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const r = await set.list({ status: '', q: 'UTR1', page: 2 });
    expect(apiList).toHaveBeenCalledWith('/accounts/settlements', { query: { q: 'UTR1', page: 2 } });
    expect(r.items).toHaveLength(1);
  });
  it('sends the import, reconcile and accept-difference calls, with a key on the money ones', async () => {
    await set.import({ fileId: 5, gatewayProvider: 'RAZORPAY' });
    expect(api).toHaveBeenLastCalledWith('/accounts/settlements/import', {
      method: 'POST',
      body: { fileId: 5, gatewayProvider: 'RAZORPAY' },
      idempotent: true,
    });
    await set.reconcile(5);
    expect(api).toHaveBeenLastCalledWith('/accounts/settlements/5/reconcile', { method: 'POST', body: {} });
    await set.acceptDifference(5, { reason: 'Bank agreed', version: 2 });
    expect(api).toHaveBeenLastCalledWith('/accounts/settlements/5/accept-difference', {
      method: 'POST',
      body: { reason: 'Bank agreed', version: 2 },
      idempotent: true,
    });
  });
});

describe('statement service', () => {
  it('calls the statement and line routes', async () => {
    apiList.mockResolvedValue({
      data: [lineRaw()],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    await st.lines(9, { matchStatus: 'UNMATCHED', page: 1, limit: 50 });
    expect(apiList).toHaveBeenCalledWith('/accounts/bank-statements/9/lines', {
      query: { matchStatus: 'UNMATCHED', page: 1, limit: 50 },
    });
    await st.autoMatch(9);
    expect(api).toHaveBeenLastCalledWith('/accounts/bank-statements/9/auto-match', {
      method: 'POST',
      body: {},
      idempotent: false,
    });
    await st.markReconciled(9, 4);
    expect(api).toHaveBeenLastCalledWith('/accounts/bank-statements/9/mark-reconciled', {
      method: 'POST',
      body: { version: 4 },
      idempotent: false,
    });
    await st.unmatch(101, 1);
    expect(api).toHaveBeenLastCalledWith('/accounts/bank-statement-lines/101/unmatch', {
      method: 'POST',
      body: { version: 1 },
      idempotent: false,
    });
    await st.ignore(101, { reason: 'Duplicate', version: 1 });
    expect(api.mock.calls.at(-1)![0]).toBe('/accounts/bank-statement-lines/101/ignore');
    await st.match(101, { journalLineId: 700, version: 1 });
    expect(api.mock.calls.at(-1)![0]).toBe('/accounts/bank-statement-lines/101/match');
  });
  it('sends a key on import and create-entry', async () => {
    await st.import({ bankAccountId: 3, fileId: 8 });
    expect(api).toHaveBeenLastCalledWith('/accounts/bank-statements', {
      method: 'POST',
      body: { bankAccountId: 3, fileId: 8 },
      idempotent: true,
    });
    await st.createEntry(101, { ledgerAccountCode: '5600', version: 1 });
    expect(api.mock.calls.at(-1)![1]).toMatchObject({ idempotent: true });
  });
  it('reads candidates, the BRS and bank accounts', async () => {
    api.mockResolvedValueOnce([candidateRaw()]);
    expect(await st.candidates(101)).toHaveLength(1);
    api.mockResolvedValueOnce({});
    await st.brs(3, '2026-11-30');
    expect(api).toHaveBeenLastCalledWith('/accounts/bank-accounts/3/brs', { query: { asOf: '2026-11-30' } });
    api.mockResolvedValueOnce({
      items: [{ id: 3, bankName: 'HDFC', accountNumberMasked: 'XXXX4821' }, { id: 0 }],
    });
    expect(await st.bankAccounts()).toEqual([{ id: 3, label: 'HDFC XXXX4821' }]);
  });
  it('polls a statement without bumping the idle timer', async () => {
    await st.get(9, true);
    expect(api).toHaveBeenLastCalledWith('/accounts/bank-statements/9', { activity: false });
  });
});

void listOf;
