/** Module 13 deposits (spec 8.17): admin list and actions, and the resident's own deposits. */
import { api, apiList } from '@/lib/apiClient';
import {
  normaliseDeposit,
  normalisePagination,
  paidFromAccounts,
  rows,
  summarise,
} from './accountsDepositsMappers';
import type {
  CreateDepositInput,
  DepositPage,
  DepositQuery,
  DepositRefundMode,
  DepositSummary,
  PaidFromAccount,
} from '@/types/accountsDeposits';

type Query = Record<string, string | number | boolean | undefined>;
const B = '/accounts/deposits';

async function list(path: string, q: object): Promise<DepositPage> {
  const r = await apiList<unknown>(path, { query: q as Query });
  const items = rows(r.data).map(normaliseDeposit);
  return { items, pagination: normalisePagination(r.pagination, items.length) };
}
const post = (path: string, body: object) =>
  api<unknown>(path, { method: 'POST', body, idempotent: true }).then(normaliseDeposit);

export const accountsDepositsService = {
  list: (q: DepositQuery = {}) => list(B, q),
  get: (id: number) => api<unknown>(`${B}/${id}`).then(normaliseDeposit),
  /** Tiles: read from the newest 100 deposits (no filters). */
  async summary(): Promise<DepositSummary> {
    return summarise((await list(B, { limit: 100 })).items);
  },
  create: (body: CreateDepositInput) => post(B, body),
  deduct: (id: number, body: { amountPaise: number; reason: string; date: string; version: number }) =>
    post(`${B}/${id}/deduct`, body),
  forfeit: (id: number, body: { reason: string; date: string; version: number }) =>
    post(`${B}/${id}/forfeit`, body),
  requestRefund: (id: number, body: { reason?: string; version: number }) =>
    post(`${B}/${id}/refund-request`, body),
  /** Step-up (REAUTH_REQUIRED) is handled by the API client. */
  refundPaid: (
    id: number,
    body: {
      paidFromLedgerAccountId: number;
      refundMode: DepositRefundMode;
      refundReference?: string;
      date: string;
      version: number;
    },
  ) => post(`${B}/${id}/refund-paid`, body),
  cancel: (id: number, body: { reason: string; version: number }) => post(`${B}/${id}/cancel`, body),
  /** Bank and cash accounts to pay from; an empty list means the picker falls back to a typed ledger account number. */
  async paidFromAccounts(): Promise<PaidFromAccount[]> {
    try {
      return paidFromAccounts(await api<unknown>('/accounts/ledger-accounts'));
    } catch {
      return [];
    }
  },
  mine: (q: { page?: number; limit?: number } = {}) => list('/me/deposits', q),
};
