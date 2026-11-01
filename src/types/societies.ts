/** Shapes of the module 05 API (spec section 8). */
export type SocietyStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CLOSED';
export type HealthBand = 'HEALTHY' | 'WATCH' | 'AT_RISK';
export type SocietyPlanKey = 'STARTER' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type LifecycleAction = 'CONVERT' | 'EXTEND_TRIAL' | 'SUSPEND' | 'REACTIVATE' | 'CLOSE' | 'REOPEN';
export type SuspensionCause = 'NON_PAYMENT' | 'TRIAL_EXPIRED' | 'MANUAL';
export type FirstAdminRole = 'chairman' | 'society_admin';

/** 8.2 list row. */
export interface SocietyListItem {
  id: number;
  name: string;
  slug: string;
  city: string;
  state: string;
  status: SocietyStatus;
  planKey: SocietyPlanKey | null;
  units: number;
  activeUsers30: number;
  mrrPaise: number;
  healthScore: number | null;
  healthBand: HealthBand | null;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface SocietyListQuery {
  q?: string;
  status?: string;
  planKey?: string;
  state?: string;
  city?: string;
  organizationId?: number;
  healthBand?: string;
  createdVia?: string;
  trialEndingWithinDays?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SlugAvailability {
  slug: string;
  available: boolean;
  reason: 'TAKEN' | 'RESERVED' | null;
  suggestions: string[];
}

/** 8.4 request body. */
export interface CreateSocietyInput {
  society: {
    name: string;
    legalName?: string;
    slug?: string;
    registrationNo?: string;
    gstin?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    approxFlats: number;
    organizationId?: number;
    requiresSupportConsent?: boolean;
  };
  firstAdmin: { name: string; mobile: string; email: string; roleKey: FirstAdminRole };
  plan: {
    planKey: SocietyPlanKey;
    billingCycle: BillingCycle;
    startAs: 'TRIAL' | 'ACTIVE';
    customPricePerFlatPaise?: number;
  };
  confirmNotDuplicate?: boolean;
}

export interface CreatedSociety {
  id: number;
  name: string;
  slug: string;
  status: SocietyStatus;
  trialEndsAt: string | null;
  planKey: SocietyPlanKey;
  invitationId: number | null;
  version: number;
}

export interface SocietyLifecycle {
  status: SocietyStatus;
  statusChangedAt: string;
  trialEndsAt: string | null;
  trialExtendedCount: number;
  trialExtensionsLeft: number;
  pastDueSince: string | null;
  suspendedAt: string | null;
  suspensionCause: SuspensionCause | null;
  suspensionHoldUntil: string | null;
  closedAt: string | null;
  closureReason: string | null;
  purgeAfter: string | null;
  purgeHoldReason: string | null;
  purgedAt: string | null;
  allowedActions: string[];
}

export interface HealthBreakdown {
  adoption: number | null;
  onboarding: number | null;
  collections: number | null;
  adminActivity: number | null;
  billing: number | null;
}

/** 8.5 detail. */
export interface SocietyDetail {
  id: number;
  name: string;
  legalName: string | null;
  slug: string;
  registrationNo: string | null;
  gstin: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  timezone: string;
  locale: string;
  organization: { id: number; name: string } | null;
  createdVia: 'ASSISTED' | 'SELF_SERVE';
  approxFlats: number;
  lifecycle: SocietyLifecycle;
  requiresSupportConsent: boolean;
  health: {
    score: number | null;
    band: HealthBand | null;
    computedAt: string | null;
    breakdown: HealthBreakdown | null;
  } | null;
  stats: { units: number; activeUsers30: number };
  subscription: { planKey: SocietyPlanKey; billingCycle: BillingCycle; mrrPaise: number } | null;
  openSupportGrant: SupportGrant | null;
  version: number;
  createdAt: string;
}

export type SocietyPatch = Partial<
  Pick<
    SocietyDetail,
    | 'name'
    | 'legalName'
    | 'registrationNo'
    | 'gstin'
    | 'addressLine1'
    | 'addressLine2'
    | 'city'
    | 'state'
    | 'pincode'
    | 'approxFlats'
  >
> & { version: number };

export interface LifecycleEvent {
  id: number;
  eventType: string;
  fromStatus: SocietyStatus | null;
  toStatus: SocietyStatus | null;
  triggerSource: string;
  triggerCode: string | null;
  reasonCategory: string | null;
  reason: string | null;
  actorName: string | null;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type NoteCategory = 'GENERAL' | 'BILLING' | 'SUPPORT' | 'ONBOARDING' | 'RISK';

export interface SocietyNote {
  id: number;
  category: NoteCategory;
  body: string;
  isPinned: boolean;
  author: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
  version: number;
}

export type GrantStatus =
  'PENDING_CONSENT' | 'ACTIVE' | 'DENIED' | 'CANCELLED' | 'CONSENT_EXPIRED' | 'EXPIRED' | 'ENDED' | 'REVOKED';
export type GrantScope = 'READ_ONLY' | 'READ_WRITE';

/** 8.18 grant item (society routes drop `requester.id` and add `canDecide`). */
export interface SupportGrant {
  id: number;
  code: string;
  society: { id: number; name: string };
  requester: { id?: number; name: string };
  scope: GrantScope;
  reason: string;
  ticketRef: string | null;
  durationMinutes: number;
  isEmergency: boolean;
  status: GrantStatus;
  consentStatus: string | null;
  consentExpiresAt?: string | null;
  decidedBy: { id: number; name: string } | null;
  startedAt: string | null;
  endsAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  requestCount: number;
  writeCount: number;
  version: number;
  createdAt?: string;
  canDecide?: boolean;
}

export interface ReadLogEntry {
  at: string;
  method: string;
  route: string;
  action: string | null;
  entityType: string | null;
  entityId: number | string | null;
}

export interface SupportGrantDetail extends SupportGrant {
  readLog: ReadLogEntry[];
}

export interface SupportGrantQuery {
  societyId?: number;
  platformUserId?: number;
  status?: string;
  scope?: string;
  page?: number;
  limit?: number;
}

export interface SupportGrantInput {
  societyId: number;
  scope: GrantScope;
  durationMinutes: number;
  reason: string;
  ticketRef?: string;
  isEmergency?: boolean;
}

/** `GET /platform/support-access/current`. */
export interface CurrentGrant {
  grant: SupportGrant | null;
  secondsLeft: number | null;
}

export interface HandoffTicket {
  token: string;
  expiresAt: string;
  adminUrl: string;
}

/** 8.24 export item. */
export interface DataExport {
  id: number;
  kind: 'FULL' | 'CLOSURE';
  requestedVia: 'SOCIETY' | 'PLATFORM' | 'SYSTEM';
  requestedBy: { id: number; name: string } | null;
  status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'EXPIRED';
  progressPercent: number;
  includeDocuments: boolean;
  partCount: number;
  totalSizeBytes: number | null;
  manifestSummary: { tables: number; rows: number; documents: number } | null;
  completedAt: string | null;
  expiresAt: string | null;
  downloadCount: number;
  createdAt?: string;
}

export interface DownloadUrl {
  url: string;
  expiresAt: string;
  fileName: string;
  sizeBytes: number;
}

/** 8.22 `GET /society-status`. */
export interface SocietyStatusInfo {
  societyId: number;
  societyName?: string;
  status: SocietyStatus;
  readOnly: boolean;
  banner: { tone: 'info' | 'warn' | 'bad'; key: string; text: string } | null;
  trialEndsAt: string | null;
  suspensionCause: SuspensionCause | null;
  closedAt: string | null;
  closureExportId: number | null;
  supportAccess: {
    active: boolean;
    scope: GrantScope;
    endsAt: string;
    staffFirstName: string;
  } | null;
  viewerIsSupport?: boolean;
  pendingSupportRequests?: number;
}

/** 8.1 request body. */
export interface SignupInput {
  signupToken: string;
  person: { name: string; email?: string; role: FirstAdminRole };
  society: {
    name: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    approxFlats: number;
  };
  planKey?: Exclude<SocietyPlanKey, 'ENTERPRISE'>;
  acceptTerms: boolean;
  confirmNotDuplicate?: boolean;
}

export interface SignupResult {
  societyId: number;
  slug: string;
  status: SocietyStatus;
  trialEndsAt: string;
  role: FirstAdminRole;
  redirectUrl: string;
}
