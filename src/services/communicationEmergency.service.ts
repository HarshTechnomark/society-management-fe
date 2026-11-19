/** Module 16 emergency broadcast calls (spec 8.25 to 8.30). The audience picks the route group. */
import { api, apiEnvelope, apiList } from '@/lib/apiClient';
import { mapActiveList, mapDetail, mapListItem, mapRollCall, obj } from './communicationEmergencyMappers';
import type {
  EmergencyAudience,
  EmergencyListQuery,
  RespondInput,
  RespondResult,
  RollCallQuery,
  StartEmergencyInput,
} from '@/types/communication';

type Query = Record<string, string | number | boolean | undefined>;
const pick = (q: object): Query =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Query;
const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body, idempotent: true });
const base = (a: EmergencyAudience) =>
  a === 'gate' ? '/gate/emergency-broadcasts' : '/emergency-broadcasts';
const POLL = { activity: false, plan: false } as const;

export const communicationEmergencyService = {
  /** GET /emergency-broadcasts (8.26). */
  list: async (q: EmergencyListQuery = {}) => {
    const r = await apiList<unknown>('/emergency-broadcasts', { query: pick(q), plan: false });
    return r.data.map(mapListItem);
  },
  detail: (id: number, audience: EmergencyAudience = 'admin', background = false) =>
    api<unknown>(`${base(audience)}/${id}`, background ? POLL : { plan: false }).then(mapDetail),

  /** POST /emergency-broadcasts (8.25): `confirm` is always true here (set by the slide or hold control). */
  start: (body: StartEmergencyInput) =>
    post<unknown>('/emergency-broadcasts', { ...body, confirm: true }).then(mapDetail),
  update: (id: number, body: { version: number; message: string }) =>
    post<unknown>(`/emergency-broadcasts/${id}/updates`, body).then(mapDetail),
  realert: (id: number, body: { version: number }) =>
    post<unknown>(`/emergency-broadcasts/${id}/realert`, body).then(mapDetail),
  resolve: (id: number, body: { version: number; allClearMessage: string }) =>
    post<unknown>(`/emergency-broadcasts/${id}/resolve`, body).then(mapDetail),
  cancel: (id: number, body: { version: number; reason: string }) =>
    post<unknown>(`/emergency-broadcasts/${id}/cancel`, body).then(mapDetail),

  /** GET /emergency-broadcasts/:id/roll-call and /gate/... (8.27). */
  rollCall: async (id: number, audience: EmergencyAudience, q: RollCallQuery = {}, background = false) => {
    const j = await apiEnvelope(`${base(audience)}/${id}/roll-call`, {
      query: pick(q),
      ...(background ? POLL : { plan: false }),
    });
    const p = j.pagination as { total?: number; totalPages?: number } | undefined;
    return mapRollCall(j.data, j, p);
  },

  /** POST /emergency-broadcasts/:id/responses and /gate/... (8.29). */
  respond: (id: number, audience: EmergencyAudience, body: RespondInput) =>
    post<Record<string, unknown>>(`${base(audience)}/${id}/responses`, body).then((r): RespondResult => ({
      responseId: Number(r?.responseId ?? 0),
      status: r?.status === 'NEED_HELP' ? 'NEED_HELP' : 'SAFE',
      peopleCount: Number(r?.peopleCount ?? 1),
      respondedAt: String(r?.respondedAt ?? ''),
      counts: {
        safe: Number(obj(r?.counts).safe ?? 0),
        needHelp: Number(obj(r?.counts).needHelp ?? 0),
      },
    })),
  /** POST /emergency-broadcasts/:id/responses/:responseId/attend (8.29), "Help on the way". */
  attend: (id: number, responseId: number, note?: string) =>
    post<unknown>(
      `/emergency-broadcasts/${id}/responses/${responseId}/attend`,
      note?.trim() ? { note: note.trim() } : {},
    ),

  /** GET /me/emergency-broadcasts/active and /gate/emergency-broadcasts/active (8.30). Polled quietly. */
  active: (audience: 'me' | 'gate') =>
    api<unknown>(
      audience === 'gate' ? '/gate/emergency-broadcasts/active' : '/me/emergency-broadcasts/active',
      POLL,
    ).then(mapActiveList),
};
