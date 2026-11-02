/** Every module 07 network call (spec section 8). Screens import from here and never call `fetch` themselves. */
import { api, apiBlob, apiList, type Pagination } from '@/lib/apiClient';
import type {
  ActivityItem,
  Announcement,
  AnnouncementInput,
  AudiencePreview,
  AuditArchives,
  AuditPage,
  AuditQuery,
  AuditRow,
  BannerAnnouncement,
  CheckResult,
  DashboardData,
  FailedJob,
  FailedJobQuery,
  HealthSummary,
  Incident,
  JobDetail,
  NewIncident,
  NewProvider,
  NewSocietyTicket,
  Organization,
  OrganizationInput,
  PlatformTicket,
  Provider,
  PublicStatusData,
  QueueRow,
  QueuesData,
  SettingChange,
  SettingsData,
  SocietyTicket,
  TestSendResult,
  TicketCounts,
  TicketQuery,
} from '@/types/platformOps';

type Query = Record<string, string | number | boolean | undefined>;

export interface Page<T> {
  items: T[];
  pagination: Pagination | null;
}

const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });
const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });

/** Accepts `data: [...]` with `pagination` (the API's way) and `data: { items }` alike. */
async function list<T>(path: string, query: object = {}): Promise<Page<T>> {
  const r = await apiList<T>(path, { query: query as Query });
  const d = r.data as unknown;
  const items = Array.isArray(d) ? d : ((d as { items?: T[] } | null)?.items ?? []);
  return { items, pagination: r.pagination ?? null };
}

/** The same, for responses that carry extra fields next to `items` (ticket counts, audit cutoff). */
async function listWith<T, X extends object>(path: string, query: object = {}) {
  const r = await apiList<T>(path, { query: query as Query });
  const d = r.data as unknown;
  const obj = (Array.isArray(d) ? {} : (d ?? {})) as { items?: T[] } & Partial<X>;
  const items = Array.isArray(d) ? d : (obj.items ?? []);
  return { items, extra: obj as Partial<X>, pagination: (r.pagination ?? null) as Pagination | null };
}

const items = <T>(d: unknown): T[] => (Array.isArray(d) ? d : ((d as { items?: T[] } | null)?.items ?? []));

const P = '/platform';

export const platformOpsService = {
  // dashboard
  dashboard: (period: '7' | '30' | '90') => api<DashboardData>(`${P}/dashboard`, { query: { period } }),
  activity: async () =>
    items<ActivityItem>(await api<unknown>(`${P}/dashboard/activity`, { activity: false })),
  healthSummary: () => api<HealthSummary>(`${P}/health/summary`, { activity: false }),

  /** Societies by plan for the dashboard donut (module 04 plan summary). */
  plansByCount: async () =>
    items<{ code: string; name: string; activeSubscriptions: number }>(await api<unknown>(`${P}/plans`)),

  /** Society name search for the announcement audience picker and the audit filter. */
  societySearch: async (q: string) =>
    (await list<{ id: number; name: string; city?: string }>(`${P}/societies`, { q, limit: 10 })).items,

  // platform tickets
  tickets: async (q: TicketQuery = {}) => {
    const r = await listWith<PlatformTicket, { counts: TicketCounts }>(`${P}/tickets`, q);
    return { items: r.items, counts: r.extra.counts ?? null, pagination: r.pagination };
  },
  ticket: (id: number) => api<PlatformTicket>(`${P}/tickets/${id}`),
  updateTicket: (
    id: number,
    body: {
      version: number;
      status?: string;
      closeReason?: string;
      priority?: string;
      category?: string;
      assigneeUserId?: number | null;
    },
  ) => patch<PlatformTicket>(`${P}/tickets/${id}`, body),
  replyTicket: (id: number, body: { body: string; visibility: 'PUBLIC' | 'INTERNAL'; fileIds?: number[] }) =>
    post<{ ticket: { id: number; status: string; version: number } }>(
      `${P}/tickets/${id}/messages`,
      body,
      true,
    ),
  /** Active platform users for the assignee select (module 03 team list). */
  assignees: async () => {
    const d = await api<unknown>(`${P}/team`, { query: { status: 'ACTIVE', limit: 100 } });
    return items<{ kind?: string; userId?: number; name: string | null }>(d)
      .filter(u => (u.kind === undefined || u.kind === 'USER') && typeof u.userId === 'number')
      .map(u => ({ userId: u.userId as number, name: u.name ?? 'Team member' }));
  },

  // society tickets
  societyTickets: (q: { status?: string; page?: number; limit?: number } = {}) =>
    list<SocietyTicket>('/support-tickets', q),
  societyTicket: (id: number) => api<SocietyTicket>(`/support-tickets/${id}`),
  createSocietyTicket: (body: NewSocietyTicket) => post<SocietyTicket>('/support-tickets', body, true),
  replySocietyTicket: (id: number, body: { body: string; fileIds?: number[] }) =>
    post<unknown>(`/support-tickets/${id}/messages`, body, true),
  reopenTicket: (id: number, body: string) => post<SocietyTicket>(`/support-tickets/${id}/reopen`, { body }),
  closeTicket: (id: number, reason?: string) =>
    post<SocietyTicket>(`/support-tickets/${id}/close`, reason ? { reason } : {}),
  rateTicket: (id: number, rating: number, comment?: string) =>
    post<unknown>(`/support-tickets/${id}/rating`, comment ? { rating, comment } : { rating }),

  // providers
  providers: async () => items<Provider>(await api<unknown>(`${P}/providers`)),
  createProvider: (body: NewProvider) => post<Provider>(`${P}/providers`, body, true),
  updateProvider: (id: number, body: Record<string, unknown>) =>
    patch<Provider>(`${P}/providers/${id}`, body),
  replaceCredentials: (id: number, body: { version: number; credentials: Record<string, string> }) =>
    api<Provider>(`${P}/providers/${id}/credentials`, { method: 'PUT', body }),
  deleteProvider: (id: number, body: { version: number; reason: string }) =>
    api<null>(`${P}/providers/${id}`, { method: 'DELETE', body }),
  checkProvider: (id: number) => post<{ results: CheckResult[] }>(`${P}/providers/${id}/check`),
  checkAll: () => post<{ results: CheckResult[] }>(`${P}/providers/check-all`),
  testSend: (id: number, body: { to?: string; pushSubscriptionOfMe?: boolean }) =>
    post<TestSendResult>(`${P}/providers/${id}/test-send`, body),
  setProviderStatus: (
    id: number,
    body: { version: number; mode: 'MANUAL' | 'AUTOMATIC'; status?: string; reason?: string },
  ) => post<{ provider: Provider; incidentId: number | null }>(`${P}/providers/${id}/status`, body),

  // incidents
  incidents: (q: { status?: string; page?: number; limit?: number } = {}) =>
    list<Incident>(`${P}/incidents`, q),
  incident: (id: number) => api<Incident>(`${P}/incidents/${id}`),
  createIncident: (body: NewIncident) => post<Incident>(`${P}/incidents`, body, true),
  updateIncident: (id: number, body: Record<string, unknown>) =>
    patch<Incident>(`${P}/incidents/${id}`, body),
  postIncidentUpdate: (
    id: number,
    body: { version: number; status?: string; message: string; isPublic?: boolean },
  ) => post<Incident>(`${P}/incidents/${id}/updates`, body),
  resolveIncident: (id: number, body: { version: number; message: string; rootCause?: string }) =>
    post<Incident>(`${P}/incidents/${id}/resolve`, body),
  publicStatus: () => api<PublicStatusData>('/public/status', { recover: false, activity: false }),

  // announcements
  announcements: (q: { status?: string; page?: number; limit?: number } = {}) =>
    list<Announcement>(`${P}/announcements`, q),
  announcement: (id: number) => api<Announcement>(`${P}/announcements/${id}`),
  createAnnouncement: (body: AnnouncementInput) => post<Announcement>(`${P}/announcements`, body, true),
  updateAnnouncement: (id: number, body: Partial<AnnouncementInput> & { version: number }) =>
    patch<Announcement>(`${P}/announcements/${id}`, body),
  audiencePreview: (body: Partial<AnnouncementInput>) =>
    post<AudiencePreview>(`${P}/announcements/audience-preview`, body),
  publishAnnouncement: (id: number, version: number) =>
    post<Announcement>(`${P}/announcements/${id}/publish`, { version }),
  cancelAnnouncement: (id: number, body: { version: number; reason: string }) =>
    post<Announcement>(`${P}/announcements/${id}/cancel`, body),
  deleteAnnouncement: (id: number, version: number) =>
    api<null>(`${P}/announcements/${id}`, { method: 'DELETE', body: { version } }),
  myBanners: async () => items<BannerAnnouncement>(await api<unknown>('/platform-announcements')),
  dismissBanner: (id: number) => post<null>(`/platform-announcements/${id}/dismiss`),

  // jobs and queues
  queues: (activity = true) => api<QueuesData>(`${P}/queues`, { activity }),
  failedJobs: (q: FailedJobQuery = {}) => list<FailedJob>(`${P}/jobs/failed`, q),
  job: (queue: string, jobId: string) =>
    api<JobDetail>(`${P}/queues/${encodeURIComponent(queue)}/jobs/${encodeURIComponent(jobId)}`),
  retryJob: (queue: string, jobId: string) =>
    post<{ jobId: string; state: string; warning: string | null }>(
      `${P}/queues/${encodeURIComponent(queue)}/jobs/${encodeURIComponent(jobId)}/retry`,
    ),
  discardJob: (queue: string, jobId: string, reason: string) =>
    post<null>(`${P}/queues/${encodeURIComponent(queue)}/jobs/${encodeURIComponent(jobId)}/discard`, {
      reason,
    }),
  pauseQueue: (name: string, reason: string) =>
    post<QueueRow>(`${P}/queues/${encodeURIComponent(name)}/pause`, { reason }),
  resumeQueue: (name: string, reason: string) =>
    post<QueueRow>(`${P}/queues/${encodeURIComponent(name)}/resume`, { reason }),
  retryFailed: (body: { queue?: string; includePermanent?: boolean } = {}) =>
    post<{ examined: number; retried: number; skippedPermanent: number }>(`${P}/queues/retry-failed`, body),

  // audit
  platformAudit: async (q: AuditQuery = {}): Promise<AuditPage> => auditPage(`${P}/audit-logs`, q),
  societyAudit: async (q: AuditQuery = {}): Promise<AuditPage> => auditPage('/audit-logs', q),
  platformAuditRow: (id: number) => api<AuditRow>(`${P}/audit-logs/${id}`),
  societyAuditRow: (id: number) => api<AuditRow>(`/audit-logs/${id}`),
  exportPlatformAudit: (q: AuditQuery = {}) => apiBlob(`${P}/audit-logs/export`, { query: q as Query }),
  exportSocietyAudit: (q: AuditQuery = {}) => apiBlob('/audit-logs/export', { query: q as Query }),
  auditArchives: () => api<AuditArchives>(`${P}/audit-logs/archives`),
  archiveDownloadUrl: (month: string, part: number) =>
    post<{ url: string; expiresAt: string }>(`${P}/audit-logs/archives/download-url`, { month, part }),

  // settings
  settings: async () => {
    const d = await api<{ categories?: SettingsData } & SettingsData>(`${P}/settings`);
    return (d.categories ?? d) as SettingsData;
  },
  saveSettings: (changes: SettingChange[], reason?: string) =>
    patch<unknown>(`${P}/settings`, reason ? { changes, reason } : { changes }),

  // organizations
  organizations: (q: { status?: string; q?: string; page?: number; limit?: number } = {}) =>
    list<Organization>(`${P}/organizations`, q),
  organization: (id: number) => api<Organization>(`${P}/organizations/${id}`),
  createOrganization: (body: OrganizationInput) => post<Organization>(`${P}/organizations`, body, true),
  updateOrganization: (id: number, body: Partial<OrganizationInput>) =>
    patch<Organization>(`${P}/organizations/${id}`, body),
  setOrganizationStatus: (id: number, body: { status: string; reason: string }) =>
    post<Organization>(`${P}/organizations/${id}/status`, body),
};

async function auditPage(path: string, q: AuditQuery): Promise<AuditPage> {
  const r = await listWith<AuditRow, { archivedBefore: string | null }>(path, q);
  const p = r.pagination as unknown as { nextCursor?: string | null; hasMore?: boolean } | null;
  return {
    items: r.items,
    archivedBefore: r.extra.archivedBefore ?? null,
    nextCursor: p?.nextCursor ?? null,
    hasMore: !!p?.hasMore,
  };
}
