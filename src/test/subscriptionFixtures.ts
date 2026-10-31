import type {
  Addon,
  EntitlementRow,
  FeatureFlag,
  PlanCode,
  PlanOption,
  PlanSummary,
  PlanVersionDetail,
  PlansForSociety,
  Quote,
  SubscriptionSummary,
  UsageItem,
} from '@/types/subscriptions';

const feature = (entitlementKey: string, moduleNo: number, isEnabled: boolean): EntitlementRow => ({
  entitlementKey,
  kind: 'FEATURE',
  isEnabled,
  limitValue: null,
  moduleNo,
});
const limit = (entitlementKey: string, limitValue: number | null): EntitlementRow => ({
  entitlementKey,
  kind: 'LIMIT',
  isEnabled: null,
  limitValue,
  moduleNo: null,
});

export function versionRows(plan: 'STARTER' | 'STANDARD' | 'PREMIUM'): EntitlementRow[] {
  const std = plan !== 'STARTER';
  const pre = plan === 'PREMIUM';
  return [
    feature('communication.notice_composer', 16, true),
    feature('communication.audience_targeting', 16, std),
    feature('communication.emergency_broadcast', 16, true),
    feature('communication.chat_groups', 16, false),
    feature('amenities.amenity_catalogue', 18, std),
    feature('amenities.slot_types', 18, std),
    feature('governance.polls_engine', 22, pre),
    limit('limit.flats', plan === 'STARTER' ? 300 : plan === 'STANDARD' ? 1000 : 3000),
    limit('limit.sms_per_month', plan === 'STARTER' ? 500 : plan === 'STANDARD' ? 2000 : 5000),
    limit('limit.whatsapp_per_month', std ? 5000 : 0),
    limit('limit.storage_gb', plan === 'STARTER' ? 5 : 25),
    limit('limit.guard_devices', std ? 3 : 0),
    limit('limit.ai_messages_per_month', pre ? 5000 : 0),
    limit('limit.automation_rules', pre ? 25 : 0),
  ];
}

export const plan = (over: Partial<PlanSummary> = {}): PlanSummary => ({
  id: 2,
  code: 'STANDARD',
  name: 'Standard',
  description: 'For most societies.',
  tierRank: 2,
  isPublic: true,
  isActive: true,
  version: 3,
  currentVersion: {
    id: 6,
    versionNo: 2,
    pricePerFlatPaise: 1500,
    minBillableFlats: 50,
    annualFreeMonths: 2,
    publishedAt: '2026-09-01T05:30:00.000Z',
  },
  draftVersionId: null,
  activeSubscriptions: 41,
  onOlderVersions: 7,
  mrrPaise: 11250000,
  ...over,
});

export const starterPlan = plan({
  id: 1,
  code: 'STARTER',
  name: 'Starter',
  tierRank: 1,
  currentVersion: {
    id: 5,
    versionNo: 1,
    pricePerFlatPaise: 900,
    minBillableFlats: 30,
    annualFreeMonths: 2,
    publishedAt: null,
  },
  onOlderVersions: 0,
  activeSubscriptions: 12,
  mrrPaise: 2000000,
});

export const version = (over: Partial<PlanVersionDetail> = {}): PlanVersionDetail => ({
  id: 6,
  planId: 2,
  versionNo: 2,
  status: 'PUBLISHED',
  pricePerFlatPaise: 1500,
  minBillableFlats: 50,
  annualFreeMonths: 2,
  version: 4,
  entitlements: versionRows('STANDARD'),
  ...over,
});

export const addon = (over: Partial<Addon> = {}): Addon => ({
  id: 11,
  code: 'EXTRA_STORAGE_50GB',
  name: '50 GB extra storage',
  billingType: 'RECURRING',
  grants: [{ type: 'LIMIT_INCREMENT', key: 'limit.storage_gb', amount: 50 }],
  pricePaise: 50000,
  minTierRank: 1,
  maxTierRank: 4,
  maxQuantity: 20,
  isOnSale: true,
  activeCount: 3,
  version: 2,
  ...over,
});

export const flag = (over: Partial<FeatureFlag> = {}): FeatureFlag => ({
  id: 1,
  flagKey: 'billing.new_invoice_layout',
  description: 'New invoice layout',
  type: 'PERCENTAGE',
  isEnabled: true,
  minPlanCode: null,
  rolloutPercent: 35,
  isClientVisible: false,
  ownerTeam: 'Billing',
  expiresOn: null,
  overrideCount: 1,
  updatedAt: '2026-10-01T00:00:00.000Z',
  version: 3,
  ...over,
});

export const subscription = (over: Partial<SubscriptionSummary> = {}): SubscriptionSummary => ({
  id: 31,
  status: 'ACTIVE',
  statusReason: 'PAID_START',
  version: 6,
  societyStatus: 'ACTIVE',
  plan: {
    code: 'STARTER',
    name: 'Starter',
    versionNo: 1,
    pricePerFlatPaise: 900,
    minBillableFlats: 30,
    annualFreeMonths: 2,
  },
  billingCycle: 'MONTHLY',
  currentPeriodStart: '2026-11-01',
  currentPeriodEnd: '2026-11-30',
  billableFlats: 96,
  chargedFlats: 96,
  periodValuePaise: 86400,
  trialEndsAt: null,
  pendingChange: null,
  pendingBillingCycle: null,
  cancelAtPeriodEnd: false,
  readOnlyFeatures: [],
  readOnlyUntil: null,
  activeAddons: [],
  activeFeatureTrial: null,
  ...over,
});

export const usageItem = (over: Partial<UsageItem> = {}): UsageItem => ({
  limitKey: 'limit.sms_per_month',
  unit: 'messages',
  period: 'MONTHLY',
  enforcement: 'SOFT',
  limit: 500,
  used: 120,
  percent: 24,
  addonIncrement: 0,
  overrideApplied: false,
  overageUnits: 0,
  ...over,
});

const option = (code: PlanCode, name: string, price: number, current: string): PlanOption => ({
  code,
  name,
  description: `${name} plan`,
  isCurrent: code === current,
  isSelfServe: true,
  pricePerFlatPaise: price,
  chargedFlats: 96,
  minBillableFlats: 30,
  periodPricePaise: 96 * price,
  monthlyEquivalentPaise: 96 * price,
  highlights: { featureCount: price / 5, limits: { 'limit.flats': 300 } },
});

export const societyPlans = (current = 'STARTER'): PlansForSociety => ({
  plans: [
    option('STARTER', 'Starter', 900, current),
    option('STANDARD', 'Standard', 1500, current),
    option('PREMIUM', 'Premium', 2500, current),
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Custom contract',
      isCurrent: false,
      isSelfServe: false,
      highlights: { featureCount: 555, limits: {} },
    },
  ],
  recommendation: { planCode: 'STANDARD', reasonCodes: ['NEAR_FLAT_LIMIT'] },
});

export const upgradeQuote: Quote = {
  planCode: 'STANDARD',
  planVersionNo: 2,
  billingCycle: 'MONTHLY',
  chargedFlats: 96,
  periodStart: '2026-12-01',
  periodEnd: '2026-12-31',
  lines: [{ type: 'PLAN', description: 'Standard, 96 flats × ₹15', amountPaise: 144000 }],
  subtotalPaise: 144000,
  tax: { mode: 'INTRA_STATE', cgstPaise: 12960, sgstPaise: 12960, igstPaise: 0 },
  totalPaise: 169920,
  proration: {
    effectiveDate: '2026-11-17',
    periodEnd: '2026-11-30',
    daysRemaining: 14,
    periodDays: 30,
    creditPaise: 40320,
    chargePaise: 67200,
    netPaise: 26880,
  },
};
