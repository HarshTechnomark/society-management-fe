/** Module 11 network calls of the billing run wizard and run detail (spec 8.2, 8.3, 8.5 to 8.10). */
import { api, apiList } from '@/lib/apiClient';
import {
  mergeShortRun,
  normaliseCycle,
  normaliseItem,
  normalisePagination,
  normaliseRates,
  normaliseRun,
  normaliseSplitInputs,
  rows,
} from './billingRunsMappers';
import type { CreateRunInput, Run, ItemQuery, RunQuery, SplitInput } from '@/types/billingRuns';

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
  /** Answers the short run shape (no totals by head): read the run again after it. */
  update: (id: number, body: { version: number; splitInputs?: SplitInput[]; notes?: string }) =>
    api<unknown>(`${base}/${id}`, { method: 'PATCH', body }),
  /** Answers the short run shape: merge it into the run on screen with `mergeShort`. */
  recompute: (id: number, version: number) =>
    api<unknown>(`${base}/${id}/recompute`, { method: 'POST', body: { version } }),
  exclude: (id: number, itemId: number, body: { reason: string; version: number }) =>
    api<unknown>(`${base}/${id}/items/${itemId}/exclude`, { method: 'POST', body }),
  include: (id: number, itemId: number, version: number) =>
    api<unknown>(`${base}/${id}/items/${itemId}/include`, { method: 'POST', body: { version } }),
  /** The API asks for a fresh sign in on some societies; the API client opens it. One new key per call. */
  publish: (id: number, body: { confirmLabel: string; version: number; previewHash?: string }) =>
    api<unknown>(`${base}/${id}/publish`, { method: 'POST', body, idempotent: true }).then(normaliseRun),
  cancel: (id: number, body: { reason: string; version: number }) =>
    api<unknown>(`${base}/${id}/cancel`, { method: 'POST', body }),
  resumeIssue: (id: number, version: number) =>
    api<unknown>(`${base}/${id}/resume-issue`, { method: 'POST', body: { version } }),
  mergeShort: (prev: Run, short: unknown): Run => mergeShortRun(prev, short),
  /**
   * Period starts of the regular runs that are not cancelled: the earliest (first page, oldest first) is the billing
   * start of the society and the latest (first page, newest first) the last period billed.
   */
  regularStarts: async (): Promise<string[]> => {
    const q = { runType: 'REGULAR', sortBy: 'periodStart', limit: 100 } as const;
    const pages = await Promise.all([
      billingRunsService.runs({ ...q, sortOrder: 'asc' }),
      billingRunsService.runs({ ...q, sortOrder: 'desc' }),
    ]);
    const starts = pages.flatMap(p =>
      p.items.filter(r => r.status !== 'CANCELLED').map(r => r.periodStart.slice(0, 10)),
    );
    return [...new Set(starts)].sort();
  },

  // read-only inputs of step 1
  // both lists are paged (20 by default, 100 at most)
  rates: () => api<unknown>('/billing/rules', { query: { limit: 100 } }).then(normaliseRates),
  /** The split rules that need a typed amount for a run of `periodStart`. */
  splitRules: async (periodStart?: string) => {
    const [splits, rules] = await Promise.all([
      api<unknown>('/billing/split-rules', { query: { limit: 100 } }),
      api<unknown>('/billing/rules', { query: { limit: 100 } }).catch(() => undefined),
    ]);
    return normaliseSplitInputs(splits, rules, periodStart);
  },
  cycle: () => api<unknown>('/society/settings', { query: { namespace: 'billing' } }).then(normaliseCycle),
};
