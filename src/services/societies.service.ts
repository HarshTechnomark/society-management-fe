/**
 * Every module 05 network call (spec section 8), plus the module 02 support hand-off calls used by module 05 screens
 * (8.20). Screens import from here and never call `fetch` themselves.
 */
import { api, apiBlob, apiList, type Pagination } from '@/lib/apiClient';
import type {
  CreateSocietyInput,
  CreatedSociety,
  CurrentGrant,
  DataExport,
  DownloadUrl,
  HandoffTicket,
  LifecycleEvent,
  NoteCategory,
  SignupInput,
  SignupResult,
  SlugAvailability,
  SocietyDetail,
  SocietyListItem,
  SocietyListQuery,
  SocietyNote,
  SocietyPatch,
  SocietyStatusInfo,
  SupportGrant,
  SupportGrantDetail,
  SupportGrantInput,
  SupportGrantQuery,
} from '@/types/societies';

export interface Page<T> {
  data: T[];
  pagination: Pagination;
}

type Query = Record<string, string | number | boolean | undefined>;

/**
 * List endpoints answer `data: [...]` with `pagination` next to it; a `data: { items, pagination }` body is read the
 * same way so the screens do not care which of the two the API sends.
 */
async function list<T>(path: string, query: Query = {}): Promise<Page<T>> {
  const r = await apiList<T>(path, { query });
  const raw = r.data as unknown;
  const box = !Array.isArray(raw) && raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const data = (box ? (box.items ?? []) : (raw ?? [])) as T[];
  const pagination = r.pagination ??
    (box?.pagination as Pagination | undefined) ?? {
      page: 1,
      limit: data.length,
      total: data.length,
      totalPages: 1,
    };
  return { data, pagination };
}

const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });

const P = '/platform/societies';

export const societiesService = {
  // 8.2 to 8.6 platform society list and detail
  list: (query: SocietyListQuery = {}) => list<SocietyListItem>(P, { ...query }),
  exportCsv: (query: SocietyListQuery = {}) => apiBlob(`${P}/export`, { query: { ...query } }),
  slugAvailability: (slug: string) => api<SlugAvailability>(`${P}/slug-availability`, { query: { slug } }),
  create: (body: CreateSocietyInput) => post<CreatedSociety>(P, body, true),
  detail: (id: number) => api<SocietyDetail>(`${P}/${id}`),
  update: (id: number, body: SocietyPatch) => api<SocietyDetail>(`${P}/${id}`, { method: 'PATCH', body }),
  lifecycleEvents: (id: number, query: { eventType?: string; page?: number; limit?: number } = {}) =>
    list<LifecycleEvent>(`${P}/${id}/lifecycle-events`, { limit: 50, ...query }),

  // 8.8 to 8.15 lifecycle actions (step-up is answered by the API client on 401 REAUTH_REQUIRED)
  extendTrial: (id: number, body: { days: number; reason: string; version: number }) =>
    post<{ id: number; status: string; trialEndsAt: string; trialExtendedCount: number; version: number }>(
      `${P}/${id}/extend-trial`,
      body,
    ),
  convert: (
    id: number,
    body: {
      planKey?: string;
      billingCycle: string;
      customPricePerFlatPaise?: number;
      reason: string;
      version: number;
    },
  ) => post<{ id: number; status: string; version: number }>(`${P}/${id}/convert`, body, true),
  suspend: (id: number, body: { reasonCategory: string; reason: string; version: number }) =>
    post<{ id: number; status: string; version: number }>(`${P}/${id}/suspend`, body),
  reactivate: (id: number, body: { reason: string; graceUntil?: string; version: number }) =>
    post<{ id: number; status: string; suspensionHoldUntil: string | null; version: number }>(
      `${P}/${id}/reactivate`,
      body,
    ),
  close: (
    id: number,
    body: {
      closureReason: string;
      reason: string;
      confirmName: string;
      notifyResidents: boolean;
      version: number;
    },
  ) =>
    post<{ id: number; status: string; closedAt: string; purgeAfter: string; version: number }>(
      `${P}/${id}/close`,
      body,
    ),
  reopen: (
    id: number,
    body: {
      planKey: string;
      billingCycle: string;
      customPricePerFlatPaise?: number;
      reason: string;
      version: number;
    },
  ) => post<{ id: number; status: string; version: number }>(`${P}/${id}/reopen`, body, true),
  setPurgeHold: (id: number, body: { reason: string; version: number }) =>
    api<{ id: number; purgeHoldReason: string | null; version: number }>(`${P}/${id}/purge-hold`, {
      method: 'PUT',
      body,
    }),
  clearPurgeHold: (id: number, body: { reason: string; version: number }) =>
    api<{ id: number; purgeHoldReason: string | null; version: number }>(`${P}/${id}/purge-hold`, {
      method: 'DELETE',
      body,
    }),
  nudge: (id: number, body: { template?: string; note?: string } = {}) =>
    post<{ sentTo: number; lastNudgedAt: string }>(`${P}/${id}/nudge`, body),

  // 8.16 notes
  notes: (id: number, query: { category?: string; page?: number; limit?: number } = {}) =>
    list<SocietyNote>(`${P}/${id}/notes`, { limit: 50, ...query }),
  addNote: (id: number, body: { body: string; category?: NoteCategory; isPinned?: boolean }) =>
    post<SocietyNote>(`${P}/${id}/notes`, body, true),
  updateNote: (
    id: number,
    noteId: number,
    body: { body?: string; category?: NoteCategory; isPinned?: boolean; version: number },
  ) => api<SocietyNote>(`${P}/${id}/notes/${noteId}`, { method: 'PATCH', body }),
  deleteNote: (id: number, noteId: number) => api<null>(`${P}/${id}/notes/${noteId}`, { method: 'DELETE' }),

  // 8.17 platform data exports (start only; platform users never download)
  platformExports: (id: number) => list<DataExport>(`${P}/${id}/data-exports`, { limit: 20 }),
  startPlatformExport: (id: number, body: { reason: string; includeDocuments: boolean }) =>
    post<DataExport>(`${P}/${id}/data-exports`, body, true),

  // 8.18 to 8.21 platform support access
  grants: (query: SupportGrantQuery = {}) =>
    list<SupportGrant>('/platform/support-access', { limit: 50, ...query }),
  grant: (id: number) => api<SupportGrantDetail>(`/platform/support-access/${id}`),
  /** The caller's open grant; accepts `{ grant, secondsLeft }`, a grant with `secondsLeft`, or null. */
  currentGrant: async (): Promise<CurrentGrant> => {
    const r = await api<
      (SupportGrant & { secondsLeft?: number }) | { grant: SupportGrant | null; secondsLeft?: number } | null
    >('/platform/support-access/current', { activity: false });
    if (!r) return { grant: null, secondsLeft: null };
    if ('grant' in r) return { grant: r.grant ?? null, secondsLeft: r.secondsLeft ?? null };
    return { grant: r, secondsLeft: r.secondsLeft ?? null };
  },
  requestGrant: (body: SupportGrantInput) => post<SupportGrant>('/platform/support-access', body, true),
  endGrant: (id: number) => post<SupportGrant>(`/platform/support-access/${id}/end`),
  cancelGrant: (id: number) => post<SupportGrant>(`/platform/support-access/${id}/cancel`),
  revokeGrantPlatform: (id: number, body: { reason: string; version: number }) =>
    post<SupportGrant>(`/platform/support-access/${id}/revoke`, body),

  // 8.20 module 02 support hand-off
  startHandoff: (grantId: number) => post<HandoffTicket>('/auth/support-handoff', { grantId }),
  redeemHandoff: (token: string) =>
    api<unknown>('/auth/support-handoff/redeem', { method: 'POST', body: { token }, recover: false }),
  /** Leave on the admin host ends only the hand-off session (module 02 logout); the grant stays ACTIVE. */
  leaveSupportSession: () => api<null>('/auth/logout', { method: 'POST', body: {}, recover: false }),

  // 8.22 status banner for the admin app
  /** `recover: false` for a support hand-off tab: a revoked session must show "Support access ended", not sign-in. */
  societyStatus: (recover = true) => api<SocietyStatusInfo>('/society-status', { activity: false, recover }),

  // 8.23 society support access
  societyGrants: (query: { status?: string; page?: number; limit?: number } = {}) =>
    list<SupportGrant>('/support-access', { limit: 50, ...query }),
  societyGrant: (id: number) => api<SupportGrantDetail>(`/support-access/${id}`),
  approveGrant: (id: number, version: number) =>
    post<SupportGrant>(`/support-access/${id}/approve`, { version }),
  denyGrant: (id: number, body: { reason: string; version: number }) =>
    post<SupportGrant>(`/support-access/${id}/deny`, body),
  revokeGrant: (id: number, body: { reason: string; version: number }) =>
    post<SupportGrant>(`/support-access/${id}/revoke`, body),
  supportSettings: () =>
    api<{ requiresSupportConsent: boolean; version: number }>('/support-access/settings'),
  updateSupportSettings: (body: { requiresSupportConsent: boolean; version: number }) =>
    api<{ requiresSupportConsent: boolean; version: number }>('/support-access/settings', {
      method: 'PATCH',
      body,
    }),

  // 8.24 society data exports
  exports: (query: { status?: string; kind?: string; page?: number; limit?: number } = {}) =>
    list<DataExport>('/data-exports', { limit: 20, ...query }),
  exportDetail: (id: number) => api<DataExport>(`/data-exports/${id}`),
  requestExport: (includeDocuments: boolean) => post<DataExport>('/data-exports', { includeDocuments }, true),
  downloadUrl: (id: number, part = 1) =>
    api<DownloadUrl>(`/data-exports/${id}/download-url`, { query: { part } }),

  // 8.1 public sign-up (no session yet, so no refresh or step-up)
  signup: (body: SignupInput) =>
    api<SignupResult>('/public/signups', { method: 'POST', body, idempotent: true, recover: false }),
};
