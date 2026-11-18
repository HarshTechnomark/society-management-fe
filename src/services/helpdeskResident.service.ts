/** Module 15 resident and field calls (spec 8.1, 8.10, 8.11, 8.17, 8.22 to 8.28). */
import { api, apiList } from '@/lib/apiClient';
import {
  mapCategories,
  mapIssueRows,
  mapQr,
  mapReported,
  mapTicket,
  mapTicketList,
  mapTransparency,
  mapUpvote,
  mapComment,
  rows,
} from './helpdeskResidentMappers';
import type {
  Audience,
  BuildingIssueInput,
  BuildingIssueQuery,
  MyTicketQuery,
  PersonalComplaintInput,
  SimilarQuery,
} from '@/types/helpdeskResident';

type Query = Record<string, string | number | boolean | undefined>;
const pick = (q: object, keys: string[]): Query =>
  Object.fromEntries(
    Object.entries(q).filter(([k, v]) => keys.includes(k) && v !== undefined && v !== ''),
  ) as Query;

const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body, idempotent: true });

export const helpdeskResidentService = {
  /** GET /me/ticket-categories: `kind` is required. The gate and work apps are assumed to have the same route. */
  categories: (kind: 'PERSONAL' | 'BUILDING', audience: Audience = 'me') =>
    api<unknown>(`/${audience}/ticket-categories`, { query: { kind } }).then(mapCategories),

  /** GET /me/tickets: strict query, `tab` OPEN or CLOSED. */
  myTickets: async (q: MyTicketQuery = {}) => {
    const r = await apiList<unknown>('/me/tickets', {
      query: pick(q, ['tab', 'kind', 'unitId', 'page', 'limit']),
    });
    return mapTicketList(r.data, r.pagination);
  },
  ticket: (id: number) => api<unknown>(`/me/tickets/${id}`).then(mapTicket),
  /** GET /me/tickets/:id/comments (PUBLIC only, newest first). */
  comments: (id: number) =>
    api<unknown>(`/me/tickets/${id}/comments`, { query: { limit: 100 } }).then(r => rows(r).map(mapComment)),
  addComment: (id: number, body: { body: string; fileIds?: number[] }) =>
    post<unknown>(`/me/tickets/${id}/comments`, body).then(mapComment),
  fileUrl: (ticketId: number, fileId: number) =>
    api<{ url: string }>(`/me/tickets/${ticketId}/files/${fileId}/download-url`),

  /** POST /me/tickets (8.23). */
  createComplaint: (body: PersonalComplaintInput) =>
    post<unknown>('/me/tickets', body).then(r => mapTicket(r)),

  /** GET /me/building-issues (8.24). */
  buildingIssues: async (q: BuildingIssueQuery = {}) => {
    const r = await apiList<unknown>('/me/building-issues', {
      query: pick(q, ['scope', 'status', 'buildingId', 'page', 'limit']),
      plan: false,
    });
    return mapIssueRows(r.data);
  },
  /** GET /me/building-issues/qr/:qrToken (8.25). */
  qr: (token: string) =>
    api<unknown>(`/me/building-issues/qr/${encodeURIComponent(token)}`, { plan: false }).then(mapQr),

  /** GET /{me|gate|work}/building-issues/similar (8.11). `q` needs 2 or more characters. */
  similar: (audience: Audience, q: SimilarQuery) => {
    const query: Query = { locationNodeId: q.locationNodeId, categoryId: q.categoryId };
    if (q.q && q.q.trim().length >= 2) query.q = q.q.trim();
    return api<unknown>(`/${audience}/building-issues/similar`, { query, activity: false }).then(
      mapIssueRows,
    );
  },
  /** POST /{me|gate|work}/building-issues (8.10). */
  reportIssue: (audience: Audience, body: BuildingIssueInput) =>
    post<unknown>(`/${audience}/building-issues`, body).then(r => mapReported(r)),
  /** The resident route returns the whole ticket. */
  reportIssueResident: (body: BuildingIssueInput) =>
    post<unknown>('/me/building-issues', body).then(r => mapTicket(r)),

  /** POST and DELETE /me/tickets/:id/upvote (8.26). */
  upvote: (id: number, note?: string) =>
    post<unknown>(`/me/tickets/${id}/upvote`, note?.trim() ? { note: note.trim() } : {}).then(mapUpvote),
  removeUpvote: (id: number) =>
    api<unknown>(`/me/tickets/${id}/upvote`, { method: 'DELETE', idempotent: true }).then(mapUpvote),

  /** Actions of 8.27. */
  confirm: (id: number, body: { version: number; score?: number; comment?: string }) =>
    post<unknown>(`/me/tickets/${id}/confirm`, body).then(mapTicket),
  rate: (id: number, body: { score: number; comment?: string }) =>
    post<unknown>(`/me/tickets/${id}/rating`, body),
  reopen: (id: number, body: { version: number; reason: string }) =>
    post<unknown>(`/me/tickets/${id}/reopen`, body).then(mapTicket),
  cancel: (id: number, body: { version: number; reason: string }) =>
    post<unknown>(`/me/tickets/${id}/cancel`, body).then(mapTicket),
  escalate: (id: number, body: { reason: string }) => post<unknown>(`/me/tickets/${id}/escalate`, body),
  decideEstimate: (id: number, body: { decision: 'APPROVE' | 'REJECT'; version: number; comment?: string }) =>
    post<unknown>(`/me/tickets/${id}/estimate-decision`, body).then(mapTicket),

  /** GET /me/helpdesk/transparency (8.28). */
  transparency: (months = 6) =>
    api<unknown>('/me/helpdesk/transparency', { query: { months }, plan: false }).then(mapTransparency),
};
