/** Module 16 admin notice calls (spec 8.1 to 8.17). */
import { api, apiBlob, apiList } from '@/lib/apiClient';
import { arr, mapList, mapNotice, mapPreview, mapReceipts, mapTemplate, obj } from './noticesMappers';
import type {
  AudienceInput,
  AudiencePreview,
  Notice,
  NoticeInput,
  NoticeList,
  NoticeListQuery,
  NoticeTemplate,
  ReceiptQuery,
  Receipts,
} from '@/types/notices';

type Query = Record<string, string | number | boolean | undefined>;
const clean = (q: object): Query =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Query;
export const pick = (q: object, keys: string[]): Query => {
  const out = clean(Object.fromEntries(Object.entries(q).filter(([k]) => keys.includes(k))));
  if (typeof out.q === 'string' && out.q.trim().length < 2) delete out.q;
  return out;
};

/** The backend queries are strict: send only the names it knows. `q` needs 2 or more characters. */
export const NOTICE_LIST_KEYS = [
  'status',
  'category',
  'kind',
  'pinned',
  'q',
  'createdBy',
  'from',
  'to',
  'sortBy',
  'sortOrder',
  'page',
  'limit',
];
export const RECEIPT_KEYS = ['filter', 'buildingId', 'q', 'page', 'limit', 'sortBy', 'sortOrder'];
export const RECEIPT_EXPORT_KEYS = RECEIPT_KEYS.filter(k => k !== 'page' && k !== 'limit');

export const noticesService = {
  /** GET /notices */
  list: async (q: NoticeListQuery = {}): Promise<NoticeList> => {
    const r = await apiList<unknown>('/notices', { query: pick(q, NOTICE_LIST_KEYS) });
    return mapList(r.data, r.pagination);
  },
  /** GET /notices/:id */
  get: (id: number): Promise<Notice> => api<unknown>(`/notices/${id}`).then(mapNotice),
  /** GET /notices/templates */
  templates: async (locale?: string): Promise<NoticeTemplate[]> => {
    const r = await api<unknown>('/notices/templates', { query: clean({ locale }) });
    return arr(Array.isArray(r) ? r : obj(r).items).map(mapTemplate);
  },
  /** POST /notices/audience-preview */
  audiencePreview: (audience: AudienceInput): Promise<AudiencePreview> =>
    api<unknown>('/notices/audience-preview', { method: 'POST', body: { audience }, activity: false }).then(
      mapPreview,
    ),

  /** POST /notices (Idempotency-Key) */
  create: (body: NoticeInput): Promise<Notice> =>
    api<unknown>('/notices', { method: 'POST', body, idempotent: true }).then(mapNotice),
  /** PATCH /notices/:id */
  update: (id: number, body: NoticeInput & { version: number }): Promise<Notice> =>
    api<unknown>(`/notices/${id}`, { method: 'PATCH', body }).then(mapNotice),
  /** DELETE /notices/:id?version= */
  remove: (id: number, version: number) =>
    api<unknown>(`/notices/${id}`, { method: 'DELETE', query: { version } }),
  /** POST /notices/:id/publish (Idempotency-Key); the message says "Sent for approval", "Scheduled" or "Published to n people". */
  publish: async (
    id: number,
    body: { version: number; scheduledAt?: string },
  ): Promise<{ notice: Notice }> => ({
    notice: mapNotice(
      await api<unknown>(`/notices/${id}/publish`, { method: 'POST', body, idempotent: true }),
    ),
  }),
  withdraw: (id: number, body: { version: number; reason?: string }): Promise<Notice> =>
    api<unknown>(`/notices/${id}/withdraw`, { method: 'POST', body }).then(mapNotice),
  cancelSchedule: (id: number, body: { version: number; reason?: string }): Promise<Notice> =>
    api<unknown>(`/notices/${id}/cancel-schedule`, { method: 'POST', body }).then(mapNotice),
  recall: (id: number, body: { version: number; reason: string; notifyRecall: boolean }): Promise<Notice> =>
    api<unknown>(`/notices/${id}/recall`, { method: 'POST', body }).then(mapNotice),
  pin: (id: number, version: number): Promise<Notice> =>
    api<unknown>(`/notices/${id}/pin`, { method: 'POST', body: { version } }).then(mapNotice),
  unpin: (id: number, version: number): Promise<Notice> =>
    api<unknown>(`/notices/${id}/unpin`, { method: 'POST', body: { version } }).then(mapNotice),
  archive: (id: number, version: number): Promise<Notice> =>
    api<unknown>(`/notices/${id}/archive`, { method: 'POST', body: { version } }).then(mapNotice),
  /** POST /notices/:id/duplicate (Idempotency-Key) */
  duplicate: (id: number): Promise<Notice> =>
    api<unknown>(`/notices/${id}/duplicate`, { method: 'POST', body: {}, idempotent: true }).then(mapNotice),
  /** POST /notices/:id/remind -> `{ queuedFor }` */
  remind: async (id: number, version: number): Promise<{ queuedFor: number }> => ({
    queuedFor: Number(
      obj(await api<unknown>(`/notices/${id}/remind`, { method: 'POST', body: { version } })).queuedFor ?? 0,
    ),
  }),
  /** POST /notices/:id/restored */
  restored: (id: number, body: { version: number; message?: string }): Promise<Notice> =>
    api<unknown>(`/notices/${id}/restored`, { method: 'POST', body }).then(mapNotice),

  /** GET /notices/:id/receipts */
  receipts: async (id: number, q: ReceiptQuery = {}): Promise<Receipts> => {
    // `data` is an object here (`{ summary, items }`), the paging sits next to it.
    const r = await apiList<unknown>(`/notices/${id}/receipts`, { query: pick(q, RECEIPT_KEYS) });
    return mapReceipts(r.data, r.pagination);
  },
  /** GET /notices/:id/receipts/export: the CSV as a file. */
  exportReceipts: (id: number, q: ReceiptQuery = {}) =>
    apiBlob(`/notices/${id}/receipts/export`, { query: pick(q, RECEIPT_EXPORT_KEYS) }),
  /** GET /notices/:id/attachments/:fileId/download-url */
  attachmentUrl: async (id: number, fileId: number): Promise<string> => {
    const r = obj(await api<unknown>(`/notices/${id}/attachments/${fileId}/download-url`));
    return typeof r.url === 'string' ? r.url : '';
  },
};
