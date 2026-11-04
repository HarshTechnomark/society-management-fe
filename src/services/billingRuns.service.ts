/** Module 11 network calls of the billing run wizard and run detail (spec 8.2, 8.3, 8.5 to 8.10). */
import { api, apiList } from '@/lib/apiClient';
import {
  normaliseCycle,
  normaliseItem,
  normalisePagination,
  normaliseRates,
  normaliseRun,
  normaliseSplitInputs,
  rows,
} from './billingRunsMappers';
import type { CreateRunInput, ItemQuery, RunQuery, SplitInput } from '@/types/billingRuns';

type Query = Record<string, string | number | boolean | undefined>;
const base = '/billing/runs';

export const billingRunsService = {
  runs: async (q: RunQuery = {}) => {
    const r = await apiList<unknown>(base, { query: q as Query });
    const items = rows(r.data).map(normaliseRun);
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  /** `poll` keeps the idle timer of the session untouched (background refresh). */
  run: (id: number, poll = false) =>
    api<unknown>(`${base}/${id}`, { activity: poll ? false : undefined }).then(normaliseRun),
  items: async (id: number, q: ItemQuery = {}, poll = false) => {
    const r = await apiList<unknown>(`${base}/${id}/items`, {
      query: q as Query,
      activity: poll ? false : undefined,
    });
    const items = rows(r.data).map(normaliseItem);
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  create: (body: CreateRunInput) =>
    api<unknown>(base, { method: 'POST', body, idempotent: true }).then(normaliseRun),
  update: (id: number, body: { version: number; splitInputs?: SplitInput[]; notes?: string }) =>
    api<unknown>(`${base}/${id}`, { method: 'PATCH', body }).then(normaliseRun),
  recompute: (id: number, version: number) =>
    api<unknown>(`${base}/${id}/recompute`, { method: 'POST', body: { version } }).then(normaliseRun),
  exclude: (id: number, itemId: number, body: { reason: string; version: number }) =>
    api<unknown>(`${base}/${id}/items/${itemId}/exclude`, { method: 'POST', body }),
  include: (id: number, itemId: number, version: number) =>
    api<unknown>(`${base}/${id}/items/${itemId}/include`, { method: 'POST', body: { version } }),
  /** The API asks for a fresh sign in on some societies; the API client opens it. One new key per call. */
  publish: (id: number, body: { confirmLabel: string; version: number }) =>
    api<unknown>(`${base}/${id}/publish`, { method: 'POST', body, idempotent: true }).then(normaliseRun),
  cancel: (id: number, body: { reason: string; version: number }) =>
    api<unknown>(`${base}/${id}/cancel`, { method: 'POST', body }).then(normaliseRun),
  resumeIssue: (id: number, version: number) =>
    api<unknown>(`${base}/${id}/resume-issue`, { method: 'POST', body: { version } }).then(normaliseRun),

  // read-only inputs of step 1
  rates: () => api<unknown>('/billing/rules').then(normaliseRates),
  splitRules: () => api<unknown>('/billing/split-rules').then(normaliseSplitInputs),
  cycle: () => api<unknown>('/society/settings', { query: { namespace: 'billing' } }).then(normaliseCycle),
};
