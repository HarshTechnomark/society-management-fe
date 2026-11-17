/** Module 13 chart of accounts, journals and opening balances (spec 8.10 to 8.12). */
import { api, apiList } from '@/lib/apiClient';
import {
  normaliseFunds,
  normaliseJournal,
  normaliseJournalDetail,
  normaliseOpening,
  normalisePagination,
  normaliseTree,
  normaliseAccount,
  rows,
} from './accountsJournalMappers';
import type {
  CreateLedgerAccountInput,
  JournalInput,
  JournalQuery,
  OpeningBalanceInput,
  UpdateLedgerAccountInput,
} from '@/types/accountsJournal';

type Query = Record<string, string | number | boolean | undefined>;
const B = '/accounts';

export const accountsJournalService = {
  /** The chart as a tree (always on; the pickers use it on every plan). */
  chart: (q: { activeOnly?: boolean; type?: string } = {}) =>
    api<unknown>(`${B}/ledger-accounts`, { query: q as Query }).then(normaliseTree),
  createAccount: (body: CreateLedgerAccountInput) =>
    api<unknown>(`${B}/ledger-accounts`, { method: 'POST', body, idempotent: true }).then(a =>
      normaliseAccount(a),
    ),
  updateAccount: (id: number, body: UpdateLedgerAccountInput) =>
    api<unknown>(`${B}/ledger-accounts/${id}`, { method: 'PATCH', body }).then(a => normaliseAccount(a)),

  journals: async (q: JournalQuery = {}) => {
    const r = await apiList<unknown>(`${B}/journals`, { query: q as Query, plan: false });
    const items = rows(r.data).map(normaliseJournal);
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  journal: (id: number) => api<unknown>(`${B}/journals/${id}`).then(normaliseJournalDetail),
  createJournal: (body: JournalInput) =>
    api<unknown>(`${B}/journals`, { method: 'POST', body, idempotent: true }).then(normaliseJournalDetail),
  updateJournal: (id: number, body: Partial<JournalInput> & { version: number }) =>
    api<unknown>(`${B}/journals/${id}`, { method: 'PATCH', body, idempotent: true }).then(
      normaliseJournalDetail,
    ),
  submitJournal: (id: number, version: number) =>
    api<unknown>(`${B}/journals/${id}/submit`, { method: 'POST', body: { version }, idempotent: true }).then(
      normaliseJournalDetail,
    ),
  cancelJournal: (id: number) => api<unknown>(`${B}/journals/${id}`, { method: 'DELETE', idempotent: true }),
  reverseJournal: (id: number, body: { reversalDate?: string; reason: string; version: number }) =>
    api<unknown>(`${B}/journals/${id}/reverse`, { method: 'POST', body, idempotent: true }).then(
      normaliseJournalDetail,
    ),

  postOpeningBalances: (body: OpeningBalanceInput) =>
    api<unknown>(`${B}/opening-balances`, { method: 'POST', body, idempotent: true }).then(normaliseOpening),

  /** Funds for the line picker (module 13 part 4 owns the funds screens); callers treat a failure as "no list". */
  fundOptions: () => api<unknown>(`${B}/funds`, { plan: false }).then(normaliseFunds),
};
