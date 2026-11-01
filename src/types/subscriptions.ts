/** Shapes of the module 04 API (spec section 8). Money is integer paise. */
export type PlanCode = 'STARTER' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export interface PlanCurrentVersion {
  id: number;
  versionNo: number;
  pricePerFlatPaise: number;
  minBillableFlats: number;
  annualFreeMonths: number;
  publishedAt: string | null;
}

export interface PlanSummary {
  id: number;
  code: PlanCode;
  name: string;
  description?: string | null;
  tierRank: number;
  isPublic: boolean;
  isActive: boolean;
  version: number;
  currentVersion: PlanCurrentVersion;
  draftVersionId: number | null;
  activeSubscriptions: number;
  onOlderVersions: number;
  mrrPaise: number;
}

export interface EntitlementRow {
  entitlementKey: string;
  kind: 'FEATURE' | 'LIMIT';
  isEnabled: boolean | null;
  limitValue: number | null;
  limitPerFlats?: number | null;
  overageUnitSize?: number | null;
  overagePricePaise?: number | null;
  moduleNo: number | null;
  catalogueMinPlan?: string | null;
}

export interface PlanVersionDetail {
  id: number;
  planId?: number;
  versionNo: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  pricePerFlatPaise: number;
  minBillableFlats: number;
  annualFreeMonths: number;
  notes?: string | null;
  version: number;
  entitlements: EntitlementRow[];
}

export interface PlanDetail extends PlanSummary {
  versions: {
    id: number;
    versionNo: number;
    status: string;
    pricePerFlatPaise: number;
    minBillableFlats: number;
    publishedAt: string | null;
    subscriptions: number;
  }[];
}

export interface CatalogueItem {
  key: string;
  kind: 'FEATURE' | 'LIMIT';
  title: string;
  moduleNo: number | null;
  minPlan: string;
  isAlwaysOn: boolean;
  catalogueStatus: 'LIVE' | 'PLANNED';
  unit?: string;
  period?: string;
  enforcement?: 'HARD' | 'SOFT';
}

export interface MigrationResult {
  status: 'DONE' | 'QUEUED';
  matched: number;
  scheduled: number;
  skippedPendingDowngrade: number;
  trialsSwitched: number;
  mrrBeforePaise: number;
  mrrAfterPaise: number;
  earliestChangeAt: string | null;
}

export type GrantInput =
  | { type: 'FEATURE'; key: string }
  | { type: 'LIMIT_INCREMENT'; key: string; amount: number }
  | { type: 'FEATURE_CHOICE' };

export interface Addon {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  billingType: 'ONE_TIME' | 'RECURRING';
  grants: GrantInput[];
  pricePaise: number;
  minTierRank: number;
  maxTierRank: number;
  maxQuantity: number;
  isOnSale: boolean;
  sortOrder?: number;
  activeCount?: number;
  revenueThisMonthPaise?: number;
  version: number;
}

export interface Pending {
  type: string;
  planCode?: string;
  at: string;
}

export interface SubscriptionSummary {
  id: number;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | string;
  statusReason?: string;
  version: number;
  societyStatus: string;
  plan: {
    code: PlanCode;
    name: string;
    versionNo: number;
    pricePerFlatPaise: number;
    minBillableFlats: number;
    annualFreeMonths: number;
  };
  billingCycle: BillingCycle;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  billableFlats: number;
  chargedFlats: number;
  periodValuePaise: number;
  trialEndsAt: string | null;
  pendingChange: Pending | null;
  pendingBillingCycle: BillingCycle | null;
  cancelAtPeriodEnd: boolean;
  readOnlyFeatures: string[];
  readOnlyUntil: string | null;
  activeAddons: { id: number; code: string; quantity: number; status: string }[];
  activeFeatureTrial: { featureKey: string; expiresAt: string } | null;
  autopay?: { status: string; method: string | null };
}

/** One row of `GET /platform/subscriptions` (8.4.1). */
export interface PlatformSubscriptionListItem {
  id: number;
  society: { id: number; name: string; city?: string | null };
  planCode: PlanCode;
  planVersionNo: number;
  status: string;
  billingCycle: BillingCycle;
  billableFlats: number;
  chargedFlats: number;
  monthlyEquivalentPaise: number;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  pendingChange: Pending | null;
  version: number;
}

export interface EntitlementOverride {
  id: number;
  targetType: 'KEY' | 'MODULE';
  entitlementKey: string | null;
  moduleNo: number | null;
  isEnabled: boolean | null;
  limitValue: number | null;
  isUnlimited: boolean;
  source: 'CONTRACT' | 'SUPPORT' | 'PROMOTION' | 'PREMIUM_TRIAL';
  reason: string;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
  revokedAt: string | null;
  createdBy?: { id: number; name: string } | null;
  version: number;
}

/** `GET /platform/subscriptions/:id` (8.4.2): the society summary plus resolution, usage and overrides. */
export interface PlatformSubscription extends SubscriptionSummary {
  society?: { id: number; name: string };
  customPricePerFlatPaise?: number | null;
  customMinFlats?: number | null;
  monthlyEquivalentPaise?: number;
  entitlements?: { key: string; on?: boolean; isEnabled?: boolean; source: string }[];
  usage?: { items: UsageItem[] } | UsageItem[];
  addons?: OwnedAddon[];
  overrides?: EntitlementOverride[];
  history?: { action: string; createdAt: string; reason?: string | null }[];
}

export interface Entitlements {
  planCode: string;
  status: string;
  generation: number;
  features: string[];
  readOnlyFeatures: string[];
  flags: Record<string, boolean>;
  limits?: Record<string, { limit: number | null; used: number; period?: string }>;
}

export interface UsageItem {
  limitKey: string;
  unit: string;
  period: 'MONTHLY' | 'ABSOLUTE';
  periodKey?: string;
  enforcement: 'HARD' | 'SOFT';
  limit: number | null;
  limitBytes?: number | null;
  used: number;
  percent: number | null;
  addonIncrement: number;
  overrideApplied: boolean;
  overageUnits: number;
}

export interface PlanOption {
  code: PlanCode;
  name: string;
  description?: string;
  isCurrent: boolean;
  isSelfServe: boolean;
  pricePerFlatPaise?: number;
  chargedFlats?: number;
  minBillableFlats?: number;
  periodPricePaise?: number;
  monthlyEquivalentPaise?: number;
  highlights: { featureCount: number; limits: Record<string, number | null> };
}

export interface PlanAdvisor {
  planCode: string;
  reasonCodes: string[];
  annualSavingPaise?: number;
}

export interface PlansForSociety {
  billingCycle: 'MONTHLY' | 'ANNUAL';
  items: PlanOption[];
  recommendation?: PlanAdvisor;
}

export interface Proration {
  effectiveDate: string;
  periodEnd: string;
  daysRemaining: number;
  periodDays: number;
  creditPaise: number;
  chargePaise: number;
  netPaise: number;
}

export interface Quote {
  planCode: string;
  planVersionNo: number;
  billingCycle: BillingCycle;
  chargedFlats: number;
  periodStart: string;
  periodEnd: string;
  lines: { type: string; description: string; amountPaise: number }[];
  subtotalPaise: number;
  tax: { mode: string; cgstPaise: number; sgstPaise: number; igstPaise: number } | null;
  totalPaise: number;
  proration: Proration | null;
}

export interface DowngradePreview {
  targetPlan: string;
  effectiveDate: string;
  readOnlyUntil: string | null;
  featuresLost: {
    key: string;
    moduleNo: number;
    title: string;
    recordsInUse: number | null;
    stopsJobs: boolean;
  }[];
  limitConflicts: { limitKey: string; used: number; targetLimit: number }[];
  limitChanges: { limitKey: string; current: number | null; target: number | null }[];
  addonsEnding: { code: string; reason: string }[];
  canSchedule: boolean;
}

export interface ChangePlanResult {
  effect: 'IMMEDIATE' | 'SCHEDULED';
  planCode: string;
  effectiveDate: string;
  proration?: Proration | null;
  invoiceId?: number | null;
  version: number;
}

export interface StoreAddon {
  code: string;
  name: string;
  description?: string;
  billingType: 'ONE_TIME' | 'RECURRING';
  pricePaise: number;
  grants: GrantInput[];
  availableForPlan: boolean;
  remainingQuantity: number;
}

export interface OwnedAddon {
  id: number;
  code: string;
  quantity: number;
  unitPricePaise: number;
  status: 'ACTIVE' | 'PENDING_PAYMENT' | 'CANCEL_SCHEDULED' | 'ENDED' | string;
  startsAt: string | null;
  endsAt: string | null;
  featureKey: string | null;
  periodKey?: string | null;
  version: number;
}

export type FlagType = 'GLOBAL' | 'PLAN' | 'TENANT' | 'PERCENTAGE' | 'KILL_SWITCH';

export interface FeatureFlag {
  id: number;
  flagKey: string;
  description: string;
  type: FlagType;
  isEnabled: boolean;
  minPlanCode: string | null;
  rolloutPercent: number | null;
  isClientVisible: boolean;
  ownerTeam: string | null;
  expiresOn: string | null;
  overrideCount: number;
  updatedAt: string;
  version: number;
}

export interface FlagOverride {
  id: number;
  societyId: number;
  societyName?: string;
  value: boolean;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface FlagDetail extends FeatureFlag {
  overrides: FlagOverride[];
}

export interface FlagEvaluation {
  on: boolean;
  step: string;
  why: string;
  bucket?: number;
}

export interface FlagCreateInput {
  flagKey: string;
  description: string;
  type: FlagType;
  isEnabled?: boolean;
  minPlanCode?: string;
  rolloutPercent?: number;
  isClientVisible?: boolean;
  ownerTeam?: string;
  expiresOn?: string;
  reason: string;
}

export interface PlanLimitKeyMeta {
  key: string;
  label: string;
}
