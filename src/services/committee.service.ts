/** Module 10 network calls of the committee tab, term editor and history (spec 8.1 to 8.6). Screens import from here. */
import { api, apiList } from '@/lib/apiClient';
import { normaliseListItem, normaliseOverview, normaliseTerm } from './committeeMappers';
import type { SeatPatch, TermInput, TermPatch, TermQuery } from '@/types/committee';

type Query = Record<string, string | number | boolean | undefined>;
const base = '/committee';

export const committeeService = {
  overview: () => api<unknown>(base).then(normaliseOverview),
  terms: async (q: TermQuery = {}) => {
    const r = await apiList<unknown>(`${base}/terms`, { query: q as Query });
    return {
      items: (Array.isArray(r.data) ? r.data : []).map(normaliseListItem),
      pagination: r.pagination ?? null,
    };
  },
  term: (id: number) => api<unknown>(`${base}/terms/${id}`).then(normaliseTerm),
  createTerm: (body: TermInput) =>
    api<unknown>(`${base}/terms`, { method: 'POST', body, idempotent: true }).then(normaliseTerm),
  updateTerm: (id: number, body: TermPatch) =>
    api<unknown>(`${base}/terms/${id}`, { method: 'PATCH', body }).then(normaliseTerm),
  deleteTerm: (id: number, body: { version: number; reason: string }) =>
    api<void>(`${base}/terms/${id}`, { method: 'DELETE', body }),
  updateSeat: (id: number, seatId: string, body: SeatPatch) =>
    api<unknown>(`${base}/terms/${id}/seats/${seatId}`, { method: 'PATCH', body }).then(normaliseTerm),
};
