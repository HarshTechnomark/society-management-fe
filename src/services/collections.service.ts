/** Module 12 network calls of the collections screens, admin side (spec 8.11, 8.21 to 8.23). Screens never call `fetch`. */
import { resetAccountsFundsSession } from './accountsFunds.service';
import { api, apiBlob, apiList, ApiError } from '@/lib/apiClient';
import {
  normaliseBuildingOption,
  normaliseCollection,
  normaliseDetail,
  normaliseFund,
  normalisePagination,
  normaliseRemind,
  normaliseRequest,
  normaliseUnitOption,
  normaliseUrl,
  rows,
} from './collectionsMappers';
import type {
  CollectionInput,
  CollectionQuery,
  OfflineContributionInput,
  RequestQuery,
} from '@/types/collections';

type Query = Record<string, string | number | boolean | undefined>;
const base = '/collections';

let fundsMissing: ApiError | null = null;
/** Forgets what the session learned about optional routes (used by tests). */
export const resetCollectionsSession = () => {
  fundsMissing = null;
  resetAccountsFundsSession();
};

export const collectionsService = {
  list: async (q: CollectionQuery = {}) => {
    const r = await apiList<unknown>(base, { query: q as Query });
    const items = rows(r.data).map(normaliseCollection);
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  get: (id: number) => api<unknown>(`${base}/${id}`).then(normaliseDetail),
  create: (body: CollectionInput) =>
    api<unknown>(base, { method: 'POST', body, idempotent: true }).then(normaliseDetail),
  update: (id: number, body: Partial<CollectionInput> & { version: number }) =>
    api<unknown>(`${base}/${id}`, { method: 'PATCH', body }).then(normaliseDetail),
  remove: (id: number, version: number) =>
    api<unknown>(`${base}/${id}`, { method: 'DELETE', query: { version } }),
  submit: (id: number, version: number) =>
    api<unknown>(`${base}/${id}/submit`, { method: 'POST', body: { version }, idempotent: true }).then(
      normaliseDetail,
    ),
  publish: (id: number, body: { version: number; reason?: string }) =>
    api<unknown>(`${base}/${id}/publish`, { method: 'POST', body, idempotent: true }).then(normaliseDetail),
  remind: (id: number, version: number) =>
    api<unknown>(`${base}/${id}/remind`, { method: 'POST', body: { version } }).then(normaliseRemind),
  close: (id: number, body: { reason: string; version: number }) =>
    api<unknown>(`${base}/${id}/close`, { method: 'POST', body }).then(normaliseDetail),
  cancel: (id: number, body: { reason: string; version: number }) =>
    api<unknown>(`${base}/${id}/cancel`, { method: 'POST', body }).then(normaliseDetail),

  requests: async (id: number, q: RequestQuery = {}) => {
    const r = await apiList<unknown>(`${base}/${id}/requests`, { query: q as Query });
    const items = rows(r.data).map(normaliseRequest);
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  addUnits: (id: number, body: { unitIds: number[]; version: number }) =>
    api<unknown>(`${base}/${id}/requests`, { method: 'POST', body }),
  waive: (requestId: number, body: { reason: string; version: number }) =>
    api<unknown>(`/collection-requests/${requestId}/waive`, { method: 'POST', body }),
  exportRequests: (id: number) => apiBlob(`${base}/${id}/requests/export`),
  statementPdf: (id: number) =>
    api<unknown>(`${base}/${id}/statement`, { query: { format: 'pdf' } }).then(normaliseUrl),

  /** Offline contribution (8.11): sent for approval by the API unless auto-approved. */
  recordContribution: (b: OfflineContributionInput) =>
    api<unknown>('/payments/offline', {
      method: 'POST',
      idempotent: true,
      body: { ...b, payingFor: 'COLLECTION' },
    }),

  // read-only inputs of the wizard
  funds: async () => {
    // Module 13 may not exist yet: a 404 is remembered for the session and the route is not called again.
    if (fundsMissing) throw fundsMissing;
    let r;
    try {
      r = await apiList<unknown>('/funds', { query: { limit: 100 } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) fundsMissing = e;
      throw e;
    }
    return rows(r.data)
      .map(normaliseFund)
      .filter(f => f.active)
      .map(({ id, label }) => ({ id, label }));
  },
  buildings: async () => {
    const r = await apiList<unknown>('/buildings', { query: { limit: 100 } });
    return rows(r.data).map(normaliseBuildingOption);
  },
  units: async (q: string) => {
    const r = await apiList<unknown>('/units', { query: { q: q || undefined, status: 'ACTIVE', limit: 20 } });
    return rows(r.data).map(normaliseUnitOption);
  },
};
