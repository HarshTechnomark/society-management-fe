/** Gateway settlements (spec 8.15, routes 39 to 42). */
import { api, apiList } from '@/lib/apiClient';
import { normaliseImportResult, normaliseSettlement } from './accountsSettlementsMappers';
import { normalisePagination, rows } from './accountsReadHelpers';
import type {
  AcceptDifferenceInput,
  ImportSettlementInput,
  PagedList,
  Settlement,
  SettlementQuery,
} from '@/types/accountsSettlements';

type Query = Record<string, string | number | boolean | undefined>;
const clean = (q: object): Query =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v !== undefined)) as Query;

export const accountsSettlementsService = {
  async list(q: SettlementQuery = {}): Promise<PagedList<Settlement>> {
    const r = await apiList<unknown>('/accounts/settlements', { query: clean(q) });
    const items = rows(r.data).map(normaliseSettlement);
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  get: (id: number) => api<unknown>(`/accounts/settlements/${id}`).then(normaliseSettlement),
  import: (body: ImportSettlementInput) =>
    api<unknown>('/accounts/settlements/import', { method: 'POST', body, idempotent: true }).then(
      normaliseImportResult,
    ),
  /** Development only (`POST /dev/accounts/settlements/generate`): a settlement from the captured online payments no settlement lists yet. */
  devGenerate: (societyId: number, reconcile = false) =>
    api<{ settlementId: number; gatewaySettlementId: string; payments: number }>(
      '/dev/accounts/settlements/generate',
      { method: 'POST', body: { societyId, reconcile } },
    ),
  reconcile: (id: number) =>
    api<unknown>(`/accounts/settlements/${id}/reconcile`, { method: 'POST', body: {} }).then(
      normaliseSettlement,
    ),
  acceptDifference: (id: number, body: AcceptDifferenceInput) =>
    api<unknown>(`/accounts/settlements/${id}/accept-difference`, {
      method: 'POST',
      body,
      idempotent: true,
    }).then(normaliseSettlement),
};
