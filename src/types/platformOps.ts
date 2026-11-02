/** Shapes of the module 07 API (spec section 8). */
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TicketCategory =
  'BILLING' | 'PAYMENTS' | 'TECHNICAL' | 'ONBOARDING' | 'ACCOUNT' | 'DATA_FIX' | 'FEATURE_REQUEST' | 'OTHER';

export interface TicketAttachment {
  fileId: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}
export interface TicketMessage {
  id: number;
  authorSide: 'SOCIETY' | 'PLATFORM' | 'SYSTEM';
  authorName: string;
  kind: 'MESSAGE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'PRIORITY_CHANGE' | string;
  visibility: 'PUBLIC' | 'INTERNAL';
  body: string;
  attachments?: TicketAttachment[];
  createdAt: string;
}
export interface TicketSla {
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  firstResponseBreachedAt: string | null;
  resolutionWarnedAt: string | null;
  resolutionBreachedAt: string | null;
  pausedMinutes: number;
}
export interface PlatformTicket {
  id: number;
  ticketNo: string;
  society: { id: number; name: string; status: string };
  raisedBy: { id: number; name: string; roleKey: string };
  source: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: { id: number; name: string } | null;
  sla: TicketSla;
  reopenCount: number;
  messageCount: number;
  lastMessageAt: string | null;
  satisfactionRating: number | null;
  satisfactionComment: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
}
export interface TicketCounts {
  ALL: number;
  OPEN: number;
  IN_PROGRESS: number;
  WAITING: number;
  RESOLVED: number;
  CLOSED: number;
}
export interface TicketQuery {
  status?: string;
  priority?: string;
  q?: string;
  societyId?: number;
  assignee?: string;
  slaBreached?: boolean;
  page?: number;
  limit?: number;
}
export interface SocietyTicket {
  id: number;
  ticketNo: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: { name: string } | null;
  expectedFirstResponseBy: string | null;
  reopenAllowedUntil: string | null;
  reopenCount: number;
  messageCount: number;
  lastMessageAt: string | null;
  satisfactionRating: number | null;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
}
export interface NewSocietyTicket {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  body: string;
  fileIds?: number[];
}

export type ProviderChannel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH' | 'PAYMENT_GATEWAY' | 'STORAGE' | 'IVR';
export type HealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE' | 'UNKNOWN';
export interface ProviderHealth {
  status: HealthStatus;
  mode: 'AUTOMATIC' | 'MANUAL';
  reason: string | null;
  changedAt: string | null;
  consecutiveFailures: number;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
  lastCheckLatencyMs: number | null;
  lastCheckError: string | null;
  degradedLatencyMs: number;
  uptime30dPct: number | null;
}
export interface Provider {
  id: number;
  providerKey: string;
  channel: ProviderChannel;
  vendor: string;
  displayName: string;
  description: string | null;
  isEnabled: boolean;
  priority: number | null;
  credentialsSource: 'DATABASE' | 'ENV';
  config: Record<string, unknown>;
  credentialsMasked: Record<string, string> | null;
  credentialsUpdatedAt: string | null;
  health: ProviderHealth;
  lastTest: { at: string; ok: boolean } | null;
  openIncidentId: number | null;
  version: number;
  updatedAt: string;
}
export interface NewProvider {
  providerKey: string;
  channel: ProviderChannel;
  vendor: string;
  displayName: string;
  description?: string;
  priority: number;
  config: Record<string, unknown>;
  credentials?: Record<string, string>;
  degradedLatencyMs?: number;
}
export interface CheckResult {
  providerId: number;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
  healthStatus: HealthStatus;
}
export interface TestSendResult {
  ok: boolean;
  providerMessageId?: string;
  latencyMs?: number;
  error: string | null;
}

export type Severity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
export interface IncidentUpdate {
  at: string;
  status: IncidentStatus;
  message: string;
  isPublic: boolean;
  byName: string;
}
export interface Incident {
  id: number;
  incidentNo: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  components: string[];
  serviceProviderId: number | null;
  source: string;
  isPublic: boolean;
  startedAt: string;
  resolvedAt: string | null;
  durationMinutes: number | null;
  rootCause: string | null;
  announcementId: number | null;
  updates: IncidentUpdate[];
  version: number;
}
export interface NewIncident {
  title: string;
  severity: Severity;
  components: string[];
  serviceProviderId?: number;
  isPublic: boolean;
  message: string;
  notifySocieties?: boolean;
}

export type PublicStatus =
  'OPERATIONAL' | 'DEGRADED_PERFORMANCE' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE' | string;
export interface PublicStatusData {
  overall: PublicStatus;
  updatedAt: string;
  components: { key: string; name: string; status: PublicStatus }[];
  activeIncidents: {
    incidentNo: string;
    title: string;
    severity: Severity;
    status: IncidentStatus;
    startedAt: string;
    components: string[];
    updates: { at: string; status: IncidentStatus; message: string }[];
  }[];
  recentIncidents: {
    incidentNo: string;
    title: string;
    severity: Severity;
    startedAt: string;
    resolvedAt: string;
    durationMinutes: number | null;
  }[];
}

export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'CANCELLED';
export type AnnouncementKind = 'ANNOUNCEMENT' | 'MAINTENANCE' | 'INCIDENT' | 'RELEASE_NOTE' | 'BILLING';
export type AnnouncementSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AudienceType = 'ALL' | 'PLANS' | 'SOCIETY_STATUSES' | 'SOCIETIES';
export interface Announcement {
  id: number;
  title: string;
  body: string;
  kind: AnnouncementKind;
  severity: AnnouncementSeverity;
  audienceType: AudienceType;
  audiencePlanKeys: string[] | null;
  audienceSocietyStatuses: string[] | null;
  audienceSocietyIds: number[] | null;
  audienceRoleKeys: string[];
  channels: string[];
  status: AnnouncementStatus;
  publishAt: string | null;
  expiresAt: string;
  publishedAt: string | null;
  isDismissible: boolean;
  ctaLabel: string | null;
  ctaUrl: string | null;
  incidentId: number | null;
  recipientCount: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface AnnouncementInput {
  title: string;
  body: string;
  kind: AnnouncementKind;
  severity: AnnouncementSeverity;
  audienceType: AudienceType;
  audiencePlanKeys?: string[];
  audienceSocietyStatuses?: string[];
  audienceSocietyIds?: number[];
  audienceRoleKeys: string[];
  channels: string[];
  publishAt: string | null;
  expiresAt: string;
  isDismissible: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
}
export interface AudiencePreview {
  societies: number;
  recipients: number;
}
export interface BannerAnnouncement {
  id: number;
  title: string;
  body: string;
  kind: AnnouncementKind;
  severity: AnnouncementSeverity;
  isDismissible: boolean;
  ctaLabel: string | null;
  ctaUrl: string | null;
  publishedAt: string;
  expiresAt: string;
}

export interface QueueRow {
  name: string;
  description: string;
  concurrency: number;
  isPaused: boolean;
  counts: { waiting: number; active: number; delayed: number; failed: number; completed24h: number };
  throughputPerMin: number;
  oldestWaitingAgeSec: number | null;
}
export interface QueuesData {
  items: QueueRow[];
  totals: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    throughputPerMin: number;
    pausedQueues: number;
  };
}
export interface FailedJob {
  queue: string;
  jobId: string;
  name: string;
  societyId: number | null;
  attemptsMade: number;
  maxAttempts: number;
  errorName: string | null;
  failedReason: string | null;
  isPermanent: boolean;
  failedAt: string | null;
  createdAt: string;
}
export interface JobDetail extends FailedJob {
  data: unknown;
  stacktrace?: string;
}
export interface FailedJobQuery {
  queue?: string;
  jobName?: string;
  societyId?: number;
  page?: number;
  limit?: number;
}

export interface AuditRow {
  id: number;
  createdAt: string;
  society: { id: number; name: string } | null;
  actor: { userId: number | null; name: string; role: string };
  supportGrantId: number | null;
  source: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId: string | null;
}
export interface AuditQuery {
  societyId?: string;
  actorRole?: string;
  action?: string;
  entityType?: string;
  source?: string;
  q?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}
export interface AuditPage {
  items: AuditRow[];
  archivedBefore: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}
export interface AuditArchive {
  month: string;
  part: number;
  rowCount: number;
  status: string;
  archivedAt: string | null;
}
export interface AuditArchives {
  cutoff: string | null;
  archiveAfterMonths: number;
  paused: boolean;
  items: AuditArchive[];
}

export type SettingCategory =
  'GENERAL' | 'BILLING' | 'LIFECYCLE' | 'SECURITY' | 'NOTIFICATIONS' | 'SUPPORT' | 'DATA' | 'STATUS';
export interface Setting {
  key: string;
  valueType: 'STRING' | 'INTEGER' | 'BOOLEAN' | 'JSON';
  value: unknown;
  isReadOnly: boolean;
  description: string;
  version: number;
  updatedAt: string | null;
  updatedBy: { id: number; name: string } | null;
}
export type SettingsData = Partial<Record<SettingCategory, Setting[]>>;
export interface SettingChange {
  key: string;
  value: unknown;
  version: number;
}

export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export interface Organization {
  id: number;
  name: string;
  slug: string;
  status: OrgStatus;
  gstin: string | null;
  contactEmail: string | null;
  contactMobileMasked: string | null;
  societyCount: number;
  societies?: { id: number; name: string; status: string; planKey: string | null }[];
  createdAt: string;
  updatedAt: string;
}
export interface OrganizationInput {
  name: string;
  slug?: string;
  gstin?: string | null;
  contactEmail?: string | null;
  contactMobile?: string | null;
}

export interface DashboardData {
  period: string;
  generatedAt: string;
  societies: { byStatus: Record<string, number>; total: number; newInPeriod: number };
  unitsUnderManagement: number | null;
  activeUsers30d: number | null;
  mrr: { mrrPaise: number; previousMrrPaise: number; netChangePaise: number; netChangeBp: number };
  trialConversions: { converted: number; ended: number; ratePct: number | null };
  paymentSuccessRatePct: number | null;
  tickets: { open: number; unassigned: number; highPriorityOpen: number; slaBreached: number };
  jobs: { waiting: number; active: number; delayed: number; failed: number; pausedQueues: number };
  providers: { notOperational: { id: number; displayName: string; healthStatus: HealthStatus }[] };
  incidents: { open: number; openSev1Sev2: number };
  series: { labels: string[]; signups: number[]; mrrPaise: number[] };
  atRisk: {
    societyId: number;
    name: string;
    status: string;
    planKey: string | null;
    healthScore: number;
    activeUsers30d: number;
  }[];
  needsAttention: { kind: string; count: number; link: string }[];
}
export interface ActivityItem {
  id: number;
  at: string;
  tone: 'ok' | 'info' | 'warn' | 'bad';
  icon?: string;
  text: string;
  link?: string | null;
}
export interface HealthSummary {
  apiP95Ms: number;
  errorRatePct: number;
  requestsLast15Min: number;
  failedJobs: number;
  providerIssues: { id: number; displayName: string; healthStatus: HealthStatus }[];
  uptime30dPct: number;
  openIncidents: number;
}
