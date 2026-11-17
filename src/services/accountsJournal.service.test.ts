import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { accountsJournalService as svc } from './accountsJournal.service';

beforeEach(resetAll);
const key = (api: ReturnType<typeof mockApi>, i: number) =>
  new Headers((api.fn.mock.calls[i]![1] as RequestInit).headers).get('Idempotency-Key');

describe('accountsJournalService', () => {
  it('sends an Idempotency-Key on every create and money call, and not on a read', async () => {
    const api = mockApi({
      'GET /accounts/ledger-accounts': ok([]),
      'POST /accounts/ledger-accounts': ok({ id: 1 }),
      'POST /accounts/journals': ok({ id: 2 }),
      'POST /accounts/journals/2/submit': ok({ id: 2 }),
      'POST /accounts/journals/2/reverse': ok({ id: 2 }),
      'POST /accounts/opening-balances': ok({ journalId: 3 }),
    });
    await svc.chart();
    await svc.createAccount({ parentId: 1, code: '5999', name: 'Misc' });
    await svc.createJournal({ date: '2026-11-01', narration: 'abc', lines: [] });
    await svc.submitJournal(2, 1);
    await svc.reverseJournal(2, { reason: 'wrong entry', version: 1 });
    await svc.postOpeningBalances({ asOfDate: '2026-11-01', autoBalance: true, lines: [] });
    expect(key(api, 0)).toBeNull();
    for (let i = 1; i <= 5; i++) expect(key(api, i)).toBeTruthy();
    expect(api.last('POST', '/accounts/journals/2/submit')?.body).toEqual({ version: 1 });
  });
  it('asks the list for the filters in the spec names', async () => {
    const api = mockApi({
      'GET /accounts/journals': ok({ items: [{ id: 1, status: 'POSTED' }] }, 'OK', {
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    });
    const r = await svc.journals({ source: 'MANUAL', voucherType: 'OPENING_BALANCE', q: 'ab' });
    expect(r.items).toHaveLength(1);
    const url = String(api.fn.mock.calls[0]![0]);
    expect(url).toContain('source=MANUAL');
    expect(url).toContain('voucherType=OPENING_BALANCE');
  });
  it('cancels a draft with DELETE and patches with the version', async () => {
    const api = mockApi({
      'DELETE /accounts/journals/4': ok(null),
      'PATCH /accounts/ledger-accounts/6': ok({ id: 6 }),
    });
    await svc.cancelJournal(4);
    await svc.updateAccount(6, { name: 'New', version: 2 });
    expect(api.last('PATCH', '/accounts/ledger-accounts/6')?.body).toEqual({ name: 'New', version: 2 });
    expect(vi.isMockFunction(api.fn)).toBe(true);
  });
});
