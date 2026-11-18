/** Module 15 admin calls: tickets and building issues (spec 8.7 to 8.21). */
import { api, apiBlob, apiList } from '@/lib/apiClient';
import {
  arr,
  mapAssignees,
  mapComment,
  mapCreated,
  mapList,
  mapSimilar,
  mapStats,
  mapTicket,
  obj,
} from './helpdeskMappers';
import type {
  AssignInput,
  Assignees,
  BuildingIssueInput,
  CommentInput,
  CreatedTicket,
  PersonalTicketInput,
  SimilarTicket,
  Ticket,
  TicketComment,
  TicketList,
  TicketListQuery,
  TicketPatch,
  TicketStats,
  TransitionInput,
} from '@/types/helpdesk';

type Query = Record<string, string | number | boolean | undefined>;
const clean = (q: object): Query =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Query;

/** The backend list query is strict (`.strict()`): send only the names it knows. `q` needs 2 or more characters. */
export const TICKET_LIST_KEYS = [
  'view',
  'status',
  'kind',
  'priority',
  'categoryId',
  'assigneeUserId',
  'assigneeType',
  'unitId',
  'buildingId',
  'locationNodeId',
  'isRecurring',
  'createdFrom',
  'createdTo',
  'q',
  'sortBy',
  'sortOrder',
  'page',
  'limit',
];
/** The export takes the same filters without paging. */
export const TICKET_EXPORT_KEYS = TICKET_LIST_KEYS.filter(k => k !== 'page' && k !== 'limit');
export const STATS_KEYS = ['from', 'to', 'kind', 'categoryId'];
export const SIMILAR_KEYS = ['locationNodeId', 'categoryId', 'q'];

export const pick = (q: object, keys: string[]): Query => {
  const out = clean(Object.fromEntries(Object.entries(q).filter(([k]) => keys.includes(k))));
  if (typeof out.q === 'string' && out.q.trim().length < 2) delete out.q;
  return out;
};

export const helpdeskService = {
  /** GET /tickets: the list also carries `counts` for the segment chips (inside `data` or as a sibling). */
  list: async (q: TicketListQuery = {}): Promise<TicketList> => {
    const r = await apiList<unknown>('/tickets', { query: pick(q, TICKET_LIST_KEYS) });
    const d = r.data as unknown;
    if (Array.isArray(d)) return mapList(d, undefined, r.pagination);
    const o = obj(d);
    return mapList(arr(o.items), o.counts, (o.pagination as typeof r.pagination) ?? r.pagination);
  },
  /** GET /tickets/stats */
  stats: (q: { from?: string; to?: string; kind?: string; categoryId?: number } = {}): Promise<TicketStats> =>
    api<unknown>('/tickets/stats', { query: pick(q, STATS_KEYS), activity: false }).then(mapStats),
  /** GET /tickets/export: the CSV as a file. */
  exportCsv: (q: TicketListQuery = {}) => apiBlob('/tickets/export', { query: pick(q, TICKET_EXPORT_KEYS) }),
  /** GET /tickets/assignees */
  assignees: (q: { q?: string; type?: 'MEMBER' | 'STAFF' | 'VENDOR' } = {}): Promise<Assignees> =>
    api<unknown>('/tickets/assignees', { query: clean(q) }).then(mapAssignees),
  /** GET /tickets/:id */
  get: (id: number): Promise<Ticket> => api<unknown>(`/tickets/${id}`).then(mapTicket),

  /** POST /tickets: a personal complaint on behalf of a flat. */
  createPersonal: (body: PersonalTicketInput): Promise<CreatedTicket> =>
    api<unknown>('/tickets', { method: 'POST', body, idempotent: true }).then(mapCreated),
  /** POST /building-issues */
  createBuilding: (body: BuildingIssueInput): Promise<CreatedTicket> =>
    api<unknown>('/building-issues', { method: 'POST', body, idempotent: true }).then(mapCreated),
  /** GET /building-issues/similar: needs a location and a category. */
  similar: async (q: {
    locationNodeId: number;
    categoryId: number;
    q?: string;
  }): Promise<SimilarTicket[]> => {
    const r = await api<unknown>('/building-issues/similar', { query: pick(q, SIMILAR_KEYS) });
    return arr(Array.isArray(r) ? r : obj(r).items).map(mapSimilar);
  },

  /** PATCH /tickets/:id */
  update: (id: number, body: TicketPatch): Promise<Ticket> =>
    api<unknown>(`/tickets/${id}`, { method: 'PATCH', body }).then(mapTicket),
  /** POST /tickets/:id/assign */
  assign: (id: number, body: AssignInput): Promise<Ticket> =>
    api<unknown>(`/tickets/${id}/assign`, { method: 'POST', body }).then(mapTicket),
  /** POST /tickets/:id/unassign (only from ASSIGNED). */
  unassign: (id: number, body: { reason: string; version: number }): Promise<Ticket> =>
    api<unknown>(`/tickets/${id}/unassign`, { method: 'POST', body }).then(mapTicket),
  /** POST /tickets/:id/transition */
  transition: (id: number, body: TransitionInput): Promise<Ticket> =>
    api<unknown>(`/tickets/${id}/transition`, { method: 'POST', body, idempotent: true }).then(mapTicket),
  /** POST /tickets/:id/merge: the duplicate and the primary come back. */
  merge: async (
    id: number,
    body: { intoTicketId: number; note?: string; version: number },
  ): Promise<{ duplicate: Ticket; primary: Ticket }> => {
    const r = obj(await api<unknown>(`/tickets/${id}/merge`, { method: 'POST', body }));
    return { duplicate: mapTicket(r.duplicate), primary: mapTicket(r.primary) };
  },
  /** POST /tickets/:id/estimate */
  estimate: (id: number, body: { estimatePaise: number; note: string; version: number }): Promise<Ticket> =>
    api<unknown>(`/tickets/${id}/estimate`, { method: 'POST', body, idempotent: true }).then(mapTicket),

  /** GET /tickets/:id/comments: newest first, internal included. */
  comments: async (id: number, q: { before?: number; limit?: number } = {}): Promise<TicketComment[]> => {
    const r = await api<unknown>(`/tickets/${id}/comments`, { query: clean(q) });
    return arr(Array.isArray(r) ? r : obj(r).items).map(mapComment);
  },
  /** POST /tickets/:id/comments */
  addComment: (id: number, body: CommentInput): Promise<TicketComment> =>
    api<unknown>(`/tickets/${id}/comments`, { method: 'POST', body, idempotent: true }).then(mapComment),
  /** DELETE /tickets/:id/comments/:commentId */
  removeComment: (id: number, commentId: number, reason?: string) =>
    api<unknown>(`/tickets/${id}/comments/${commentId}`, {
      method: 'DELETE',
      ...(reason ? { body: { reason } } : {}),
    }),
  /** GET /tickets/:id/files/:fileId/download-url */
  fileUrl: async (id: number, fileId: number): Promise<string> => {
    const r = obj(await api<unknown>(`/tickets/${id}/files/${fileId}/download-url`));
    return typeof r.url === 'string' ? r.url : '';
  },
};
