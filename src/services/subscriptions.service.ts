/** Every module 04 network call (spec section 8). Screens import from here and never call `fetch` themselves. */
import { api, apiList, type Pagination } from '@/lib/apiClient';
import type {
  Addon,
  BillingCycle,
  CatalogueItem,
  ChangePlanResult,
  DowngradePreview,
  Entitlements,
  EntitlementOverride,
  EntitlementRow,
  FeatureFlag,
  FlagCreateInput,
  FlagDetail,
  FlagEvaluation,
  FlagOverride,
  MigrationResult,
  OwnedAddon,
  PlanDetail,
  PlanSummary,
  PlanVersionDetail,
  PlatformSubscription,
  PlatformSubscriptionListItem,
  PlansForSociety,
  Quote,
  StoreAddon,
  SubscriptionSummary,
  UsageItem,
} from '@/types/subscriptions';

const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });

export const subscriptionsService = {
  // platform: plans and versions
  plans: () => api<PlanSummary[]>('/platform/plans'),
  plan: (id: number) => api<PlanDetail>(`/platform/plans/${id}`),
  updatePlan: (
    id: number,
    body: {
      name?: string;
      description?: string | null;
      isPublic?: boolean;
      isActive?: boolean;
      reason: string;
      version: number;
    },
  ) => api<PlanSummary>(`/platform/plans/${id}`, { method: 'PATCH', body }),
  planVersion: (id: number) => api<PlanVersionDetail>(`/platform/plan-versions/${id}`),
  createDraft: (planId: number, reason: string) =>
    post<PlanVersionDetail>(`/platform/plans/${planId}/versions`, { reason }, true),
  updateDraft: (
    id: number,
    body: {
      pricePerFlatPaise?: number;
      minBillableFlats?: number;
      annualFreeMonths?: number;
      notes?: string | null;
      version: number;
    },
  ) => api<PlanVersionDetail>(`/platform/plan-versions/${id}`, { method: 'PATCH', body }),
  setEntitlements: (id: number, body: { items: Partial<EntitlementRow>[]; version: number }) =>
    api<{ updated: number; version: number }>(`/platform/plan-versions/${id}/entitlements`, {
      method: 'PUT',
      body,
    }),
  publish: (id: number, body: { reason: string; version: number }) =>
    post<PlanVersionDetail & { subscriptionsOnOlderVersions: number }>(
      `/platform/plan-versions/${id}/publish`,
      body,
    ),
  deleteDraft: (id: number, version: number) =>
    api<null>(`/platform/plan-versions/${id}`, { method: 'DELETE', query: { version } }),
  migrate: (
    planId: number,
    body: { fromVersionIds?: number[]; noticeDays?: number; dryRun?: boolean; reason: string },
  ) => post<MigrationResult>(`/platform/plans/${planId}/migrations`, body, !body.dryRun),
  catalogue: (query: { moduleNo?: number; kind?: string; status?: string; q?: string } = {}) =>
    api<CatalogueItem[]>('/platform/entitlement-catalogue', { query }),

  // platform: add-ons
  platformAddons: () => api<Addon[]>('/platform/addons'),
  createAddon: (body: Partial<Addon> & { reason: string }) => post<Addon>('/platform/addons', body, true),
  updateAddon: (id: number, body: Partial<Addon> & { reason: string; version: number }) =>
    api<Addon>(`/platform/addons/${id}`, { method: 'PATCH', body }),

  // platform: one society's subscription
  platformSubscriptions: (
    query: {
      societyId?: number;
      planCode?: string;
      status?: string;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => apiList<PlatformSubscriptionListItem>('/platform/subscriptions', { query }),
  platformSubscription: (id: number) => api<PlatformSubscription>(`/platform/subscriptions/${id}`),
  platformChangePlan: (
    id: number,
    body: {
      planCode: string;
      timing?: 'IMMEDIATE' | 'PERIOD_END';
      customPricePerFlatPaise?: number;
      customMinFlats?: number;
      reason: string;
      version: number;
    },
  ) => post<ChangePlanResult>(`/platform/subscriptions/${id}/change-plan`, body, true),
  platformUpdateSubscription: (
    id: number,
    body: { pendingBillingCycle?: BillingCycle | null; reason: string; version: number },
  ) => api<unknown>(`/platform/subscriptions/${id}`, { method: 'PATCH', body }),

  overrides: (subscriptionId: number, includeHistory = false) =>
    api<EntitlementOverride[]>(`/platform/subscriptions/${subscriptionId}/overrides`, {
      query: { includeHistory },
    }),
  addOverride: (
    subscriptionId: number,
    body: {
      targetType: 'KEY' | 'MODULE';
      entitlementKey?: string;
      moduleNo?: number;
      isEnabled?: boolean;
      limitValue?: number;
      isUnlimited?: boolean;
      source: 'CONTRACT' | 'SUPPORT' | 'PROMOTION';
      expiresAt?: string | null;
      reason: string;
    },
  ) =>
    post<EntitlementOverride & { warnings?: { limitKey: string; used: number; newLimit: number }[] }>(
      `/platform/subscriptions/${subscriptionId}/overrides`,
      body,
      true,
    ),
  revokeOverride: (subscriptionId: number, overrideId: number, body: { reason: string; version: number }) =>
    post<EntitlementOverride>(
      `/platform/subscriptions/${subscriptionId}/overrides/${overrideId}/revoke`,
      body,
    ),

  // platform: feature flags
  flags: (
    query: { type?: string; q?: string; includeArchived?: boolean; page?: number; limit?: number } = {},
  ) => apiList<FeatureFlag>('/platform/feature-flags', { query: { limit: 100, ...query } }),
  flag: (id: number) => api<FlagDetail>(`/platform/feature-flags/${id}`),
  createFlag: (body: FlagCreateInput) => post<FeatureFlag>('/platform/feature-flags', body, true),
  updateFlag: (
    id: number,
    body: {
      description?: string;
      minPlanCode?: string;
      rolloutPercent?: number;
      isClientVisible?: boolean;
      ownerTeam?: string | null;
      expiresOn?: string | null;
      reason: string;
      version: number;
    },
  ) => api<FeatureFlag>(`/platform/feature-flags/${id}`, { method: 'PATCH', body }),
  toggleFlag: (id: number, body: { isEnabled: boolean; reason: string; version: number }) =>
    post<FeatureFlag>(`/platform/feature-flags/${id}/toggle`, body),
  archiveFlag: (id: number, version: number, reason: string) =>
    api<null>(`/platform/feature-flags/${id}`, { method: 'DELETE', query: { version }, body: { reason } }),
  evaluateFlag: (id: number, societyId: number) =>
    api<FlagEvaluation>(`/platform/feature-flags/${id}/evaluate`, { query: { societyId } }),
  addFlagOverride: (
    id: number,
    body: { societyId: number; value: boolean; reason: string; expiresAt?: string },
  ) => post<FlagOverride>(`/platform/feature-flags/${id}/overrides`, body),
  removeFlagOverride: (id: number, overrideId: number, reason: string) =>
    api<null>(`/platform/feature-flags/${id}/overrides/${overrideId}`, {
      method: 'DELETE',
      body: { reason },
    }),

  // society
  subscription: () => api<SubscriptionSummary>('/subscription'),
  entitlements: (opts: { activity?: boolean } = {}) => api<Entitlements>('/subscription/entitlements', opts),
  usage: () => api<{ items: UsageItem[] }>('/subscription/usage'),
  societyPlans: (billingCycle: BillingCycle = 'MONTHLY') =>
    api<PlansForSociety | PlansForSociety['items']>('/subscription/plans', { query: { billingCycle } }),
  quote: (query: { planCode: string; billingCycle?: BillingCycle; addons?: string }) =>
    api<Quote>('/subscription/quote', { query, plan: false }),
  downgradePreview: (planCode: string) =>
    api<DowngradePreview>('/subscription/downgrade-preview', { query: { planCode }, plan: false }),
  activate: (body: { planCode: string; billingCycle: BillingCycle; version: number }) =>
    post<{
      subscription: SubscriptionSummary;
      invoice: { id: number; invoiceNo: string; totalPaise: number; dueDate: string };
    }>('/subscription/activate', body, true),
  changePlan: (body: { planCode: string; version: number }) =>
    post<ChangePlanResult>('/subscription/change-plan', body, true),
  changeCycle: (body: { billingCycle: BillingCycle; version: number }) =>
    post<{ pendingBillingCycle: BillingCycle; effectiveDate: string; version: number }>(
      '/subscription/billing-cycle',
      body,
    ),
  cancelPending: (type: 'PLAN' | 'CYCLE', version: number) =>
    api<null>('/subscription/pending-change', { method: 'DELETE', query: { type, version } }),
  addons: () => api<{ store: StoreAddon[]; owned: OwnedAddon[] }>('/subscription/addons'),
  buyAddon: (body: { addonCode: string; quantity?: number; featureKey?: string }) =>
    post<{ subscriptionAddon: OwnedAddon; invoiceId: number | null }>('/subscription/addons', body, true),
  cancelAddon: (id: number, version: number) =>
    api<unknown>(`/subscription/addons/${id}`, { method: 'DELETE', query: { version } }),
  resumeAddon: (id: number, version: number) =>
    post<unknown>(`/subscription/addons/${id}/resume`, { version }),
  startFeatureTrial: (featureKey: string) =>
    post<{ featureKey: string; startsAt: string; expiresAt: string }>(
      '/subscription/feature-trials',
      { featureKey },
      true,
    ),
  cancelSubscription: (body: { reason: string; version: number }) =>
    post<{ approvalRequestId: number }>('/subscription/cancel', body, true),
  withdrawCancel: (version: number) => post<unknown>('/subscription/cancel/withdraw', { version }),
};

export type { Pagination };
