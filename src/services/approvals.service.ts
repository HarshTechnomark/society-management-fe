/** Module 14 calls for the approvals inbox, the detail and the resident view (spec 8.1 to 8.11, 8.19). */
import { api, apiList } from '@/lib/apiClient';
import {
  mapBulk,
  mapCounts,
  mapDecision,
  mapDetail,
  mapList,
  mapResidentRequest,
  mapTypes,
} from './approvalsMappers';
import type { ApprovalListQuery, ApprovalList, BulkResult, ResidentRequestList } from '@/types/approvals';

type Query = Record<string, string | number | boolean | undefined>;
const clean = (q: object): Query =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Query;

/** The backend list queries are strict: send only the names it knows; `q` needs 2 or more characters. */
const LIST_KEYS = [
  'view',
  'type',
  'status',
  'overdue',
  'scope',
  'q',
  'from',
  'to',
  'sortBy',
  'sortOrder',
  'page',
  'limit',
];
const listQuery = (q: ApprovalListQuery): Query => {
  const out = clean(Object.fromEntries(Object.entries(q).filter(([k]) => LIST_KEYS.includes(k))));
  if (typeof out.q === 'string' && out.q.trim().length < 2) delete out.q;
  return out;
};

async function list(path: string, q: ApprovalListQuery): Promise<ApprovalList> {
  const r = await apiList<unknown>(path, { query: listQuery(q) });
  return mapList(r.data, r.pagination);
}

export const approvalsService = {
  /** GET /approvals (views FOR_ME, ALL_PENDING, DECIDED). */
  inbox: (q: ApprovalListQuery = {}) => list('/approvals', q),
  /** GET /approvals/submitted: requests I made. */
  submitted: (q: ApprovalListQuery = {}) => list('/approvals/submitted', { ...q, view: undefined }),
  /** GET /approvals/counts */
  counts: () => api<unknown>('/approvals/counts', { activity: false }).then(mapCounts),
  /** GET /approvals/types */
  types: () => api<unknown>('/approvals/types').then(mapTypes),
  /** GET /approvals/:id */
  get: (id: number) => api<unknown>(`/approvals/${id}`).then(mapDetail),

  approve: (id: number, body: { version: number; comment?: string; onBehalfOfUserId?: number }) =>
    api<unknown>(`/approvals/${id}/approve`, { method: 'POST', body, idempotent: true }).then(r =>
      mapDecision(r),
    ),
  reject: (id: number, body: { version: number; reason: string; onBehalfOfUserId?: number }) =>
    api<unknown>(`/approvals/${id}/reject`, { method: 'POST', body, idempotent: true }).then(r =>
      mapDecision(r),
    ),
  requestChanges: (id: number, body: { version: number; reason: string; onBehalfOfUserId?: number }) =>
    api<unknown>(`/approvals/${id}/request-changes`, { method: 'POST', body, idempotent: true }).then(r =>
      mapDecision(r),
    ),
  cancel: (id: number, body: { version: number; reason: string }) =>
    api<unknown>(`/approvals/${id}/cancel`, { method: 'POST', body, idempotent: true }).then(r =>
      mapDecision(r),
    ),
  reassign: (id: number, body: { version: number; userId: number; reason: string; slotIndex?: number }) =>
    api<unknown>(`/approvals/${id}/reassign`, { method: 'POST', body, idempotent: true }).then(mapDetail),
  /** POST /approvals/bulk-approve: up to 50 items, one result per item. */
  bulkApprove: (items: { id: number; version: number }[]): Promise<BulkResult> =>
    api<unknown>('/approvals/bulk-approve', { method: 'POST', body: { items }, idempotent: true }).then(r =>
      mapBulk(r),
    ),

  /** Approve from another screen (join requests): reads the current version first, as the decision needs it. */
  approveLatest: async (id: number, comment?: string) => {
    const d = await approvalsService.get(id);
    return approvalsService.approve(id, { version: d.version, ...(comment ? { comment } : {}) });
  },
  /** Reject from another screen: reads the current version first. */
  rejectLatest: async (id: number, reason: string) => {
    const d = await approvalsService.get(id);
    return approvalsService.reject(id, { version: d.version, reason });
  },

  /** GET /me/approval-requests */
  myRequests: async (
    q: { status?: string; page?: number; limit?: number } = {},
  ): Promise<ResidentRequestList> => {
    const r = await apiList<unknown>('/me/approval-requests', { query: clean(q) });
    return {
      items: r.data.map(mapResidentRequest),
      total: r.pagination?.total ?? r.data.length,
      totalPages: Math.max(1, r.pagination?.totalPages ?? 1),
    };
  },
  /** POST /me/approval-requests/:id/cancel */
  cancelMine: (id: number, body: { version: number; reason: string }) =>
    api<unknown>(`/me/approval-requests/${id}/cancel`, { method: 'POST', body, idempotent: true }),
};
