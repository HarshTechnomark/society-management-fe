/** Module 13 expense and cash book calls (spec 8.4 to 8.10). Every create and money call sends an Idempotency-Key. */
import { api, apiBlob, apiList, ApiError } from '@/lib/apiClient';
import {
  mapBank,
  mapCashBook,
  mapExpenseDetail,
  mapExpensePage,
  mapExpenseResult,
  mapFund,
  mapLedgerTree,
  rowsOf,
} from './accountsExpensesMappers';
import type { CashBookQuery, ExpenseInput, ExpenseQuery } from '@/types/accountsExpenses';

const missing: Record<string, ApiError | null> = {};
/** Forgets what the session learned about optional routes (used by tests). */
export const resetAccountsExpensesSession = () => {
  for (const k of Object.keys(missing)) missing[k] = null;
};

/** An optional lookup: a 404 means the route is not built yet; remembered so it is not asked again. */
async function optional<T>(key: string, run: () => Promise<T>): Promise<T> {
  const known = missing[key];
  if (known) throw known;
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) missing[key] = e;
    throw e;
  }
}

const clean = (q: object) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));

export const accountsExpensesService = {
  list: async (q: ExpenseQuery) => {
    const r = await apiList<unknown>('/expenses', { query: clean(q) });
    return mapExpensePage(r.data, r.pagination);
  },
  get: (id: number) => api<unknown>(`/expenses/${id}`).then(mapExpenseDetail),
  create: (body: ExpenseInput) =>
    api<unknown>('/expenses', { method: 'POST', body, idempotent: true }).then(mapExpenseResult),
  update: (id: number, body: Partial<ExpenseInput> & { version: number }) =>
    api<unknown>(`/expenses/${id}`, { method: 'PATCH', body, idempotent: true }).then(mapExpenseResult),
  submit: (id: number, version: number) =>
    api<unknown>(`/expenses/${id}/submit`, { method: 'POST', body: { version }, idempotent: true }).then(
      mapExpenseResult,
    ),
  withdraw: (id: number, body: { version: number; reason: string }) =>
    api<unknown>(`/expenses/${id}/withdraw`, { method: 'POST', body, idempotent: true }).then(
      mapExpenseResult,
    ),
  cancelDraft: (id: number, body: { version: number; reason: string }) =>
    api<unknown>(`/expenses/${id}`, { method: 'DELETE', body, idempotent: true }).then(mapExpenseResult),
  /** Needs a fresh step-up; the API client opens the confirm dialog on `REAUTH_REQUIRED` and retries. */
  reverse: (id: number, body: { version: number; reason: string; reversalDate?: string }) =>
    api<unknown>(`/expenses/${id}/reverse`, { method: 'POST', body, idempotent: true }).then(r => ({
      ...mapExpenseResult(r),
      reversalVoucherNo: ((r as { reversalVoucherNo?: unknown } | null)?.reversalVoucherNo as string) ?? null,
    })),
  /** CSV of the expenses the filters match (synchronous download). */
  exportCsv: (q: ExpenseQuery) =>
    apiBlob('/expenses/export', { query: clean({ ...q, page: undefined, limit: undefined, format: 'csv' }) }),

  cashBook: async (q: CashBookQuery) => {
    const r = await apiList<unknown>('/accounts/cash-book', { query: clean(q) });
    return mapCashBook(r.data, r.pagination);
  },

  /** Active leaf ledger accounts (heads and paid-from accounts). `/accounts/ledger-accounts` is always on. */
  ledgerOptions: (cashBookOnly: boolean) =>
    optional('ledger', async () =>
      mapLedgerTree(
        await api<unknown>('/accounts/ledger-accounts', {
          query: cashBookOnly ? { cashBookOnly: true } : {},
        }),
      ),
    ),
  bankAccounts: () =>
    optional('banks', async () =>
      rowsOf(await api<unknown>('/accounts/bank-accounts'), 'bankAccounts').map(mapBank),
    ),
  funds: () =>
    optional('funds', async () => rowsOf(await api<unknown>('/accounts/funds'), 'funds').map(mapFund)),
};
