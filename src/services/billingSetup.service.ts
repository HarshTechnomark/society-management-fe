/** Every module 11.1 network call (spec 8.1 to 8.4). Screens import from here and never call `fetch` themselves. */
import { api, apiList } from '@/lib/apiClient';
import {
  normaliseChargeHead,
  normalisePolicy,
  normaliseRule,
  normaliseSimulation,
  normaliseSplitRule,
  normaliseVersion,
} from './billingSetupMappers';
import type {
  BillingRule,
  ChargeHead,
  ChargeHeadInput,
  ChargeHeadQuery,
  LateFeeInput,
  LateFeePolicy,
  RuleInput,
  RuleVersion,
  SimulateItem,
  SplitRule,
  SplitRuleInput,
  VersionInput,
} from '@/types/billingSetup';

type Query = Record<string, string | number | boolean | undefined>;

const rows = async <T>(path: string, query: Query, map: (raw: unknown) => T): Promise<T[]> => {
  const r = await apiList<unknown>(path, { query });
  return (Array.isArray(r.data) ? r.data : []).map(map);
};

export const billingSetupService = {
  // charge heads
  chargeHeads: (q: ChargeHeadQuery = {}) =>
    rows<ChargeHead>('/billing/charge-heads', { limit: 100, ...q } as Query, normaliseChargeHead),
  createChargeHead: (body: ChargeHeadInput) =>
    api<unknown>('/billing/charge-heads', { method: 'POST', body, idempotent: true }).then(
      normaliseChargeHead,
    ),
  updateChargeHead: (id: number, body: Partial<ChargeHeadInput> & { version: number }) =>
    api<unknown>(`/billing/charge-heads/${id}`, { method: 'PATCH', body }).then(normaliseChargeHead),
  archiveChargeHead: (id: number, reason: string, version: number) =>
    api<unknown>(`/billing/charge-heads/${id}`, { method: 'DELETE', body: { reason, version } }),

  // billing rules and versions
  rules: (q: { chargeHeadId?: number; status?: 'ACTIVE' | 'ARCHIVED' | 'ALL' } = {}) =>
    rows<BillingRule>('/billing/rules', { limit: 100, ...q } as Query, normaliseRule),
  rule: (id: number) => api<unknown>(`/billing/rules/${id}`).then(normaliseRule),
  createRule: (body: RuleInput) =>
    api<unknown>('/billing/rules', { method: 'POST', body, idempotent: true }).then(normaliseRule),
  updateRule: (id: number, body: { name?: string; sortOrder?: number; version: number }) =>
    api<unknown>(`/billing/rules/${id}`, { method: 'PATCH', body }).then(normaliseRule),
  archiveRule: (id: number, reason: string, version: number) =>
    api<unknown>(`/billing/rules/${id}`, { method: 'DELETE', body: { reason, version } }),
  addVersion: (ruleId: number, body: VersionInput): Promise<RuleVersion | null> =>
    api<unknown>(`/billing/rules/${ruleId}/versions`, { method: 'POST', body, idempotent: true }).then(
      normaliseVersion,
    ),
  simulate: (body: {
    chargeHeadId: number;
    version: Omit<VersionInput, 'reason' | 'resolutionRef'>;
    unitIds: number[];
    periodStart: string;
  }): Promise<SimulateItem[]> =>
    api<unknown>('/billing/rules/simulate', { method: 'POST', body }).then(normaliseSimulation),

  // bill split rules
  splitRules: (status: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE') =>
    rows<SplitRule>('/billing/split-rules', { limit: 100, status }, normaliseSplitRule),
  createSplitRule: (body: SplitRuleInput) =>
    api<unknown>('/billing/split-rules', { method: 'POST', body, idempotent: true }).then(normaliseSplitRule),
  updateSplitRule: (id: number, body: Partial<SplitRuleInput> & { version: number }) =>
    api<unknown>(`/billing/split-rules/${id}`, { method: 'PATCH', body }).then(normaliseSplitRule),
  archiveSplitRule: (id: number, reason: string, version: number) =>
    api<unknown>(`/billing/split-rules/${id}`, { method: 'DELETE', body: { reason, version } }),

  // late fee policies, newest first
  lateFeePolicies: () => rows<LateFeePolicy>('/billing/late-fee-policies', { limit: 100 }, normalisePolicy),
  createLateFeePolicy: (body: LateFeeInput) =>
    api<unknown>('/billing/late-fee-policies', { method: 'POST', body, idempotent: true }).then(
      normalisePolicy,
    ),
};
