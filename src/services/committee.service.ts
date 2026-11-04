/** Module 10 network calls of the committee tab, term editor and history (spec 8.1 to 8.6). Screens import from here. */
import { api, apiList } from '@/lib/apiClient';
import {
  normaliseActivation,
  normaliseHandover,
  normaliseMyCommittee,
  normalisePast,
  normaliseSeatUsage,
  normaliseListItem,
  normaliseOverview,
  normalisePlan,
  normaliseSummary,
  normaliseTerm,
} from './committeeMappers';
import type {
  ActivationInput,
  ChangesInput,
  Designation,
  Handover,
  HandoverPatch,
  SeatPatch,
  TermInput,
  TermPatch,
  TermQuery,
} from '@/types/committee';

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

  activationPreview: (id: number) =>
    api<unknown>(`${base}/terms/${id}/activation-preview`).then(normalisePlan),
  activate: (id: number, body: ActivationInput) =>
    api<unknown>(`${base}/terms/${id}/activate`, { method: 'POST', body, idempotent: true }).then(r =>
      normaliseActivation(r),
    ),
  changesPreview: (id: number, body: ChangesInput) =>
    api<unknown>(`${base}/terms/${id}/changes/preview`, { method: 'POST', body }).then(normalisePlan),
  applyChanges: (id: number, body: ChangesInput & { previewHash: string; reason: string }) =>
    api<unknown>(`${base}/terms/${id}/changes`, { method: 'POST', body, idempotent: true }).then(r => ({
      term: normaliseTerm(r),
      summary: normaliseSummary(r),
    })),

  handover: (id: number) => api<unknown>(`${base}/terms/${id}/handover`).then(normaliseHandover),
  addHandoverItem: (
    id: number,
    body: { title: string; ownerDesignation: Designation | null },
  ): Promise<Handover> =>
    api<unknown>(`${base}/terms/${id}/handover/items`, { method: 'POST', body, idempotent: true }).then(
      normaliseHandover,
    ),
  updateHandoverItem: (id: number, itemId: string, body: HandoverPatch): Promise<Handover> =>
    api<unknown>(`${base}/terms/${id}/handover/items/${itemId}`, { method: 'PATCH', body }).then(
      normaliseHandover,
    ),

  seatUsage: () => api<unknown>(`${base}/seat-usage`).then(normaliseSeatUsage),

  // resident app
  myCommittee: () => api<unknown>('/me/committee').then(normaliseMyCommittee),
  myHistory: async (q: { page?: number; limit?: number } = {}) => {
    const r = await apiList<unknown>('/me/committee/history', { query: q as Query });
    return {
      items: (Array.isArray(r.data) ? r.data : []).map(normalisePast),
      pagination: r.pagination ?? null,
    };
  },
};
