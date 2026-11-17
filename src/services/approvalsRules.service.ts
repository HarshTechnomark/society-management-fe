/** Module 14 calls for rules, the simulator, settings and delegations (spec 8.12 to 8.18). */
import { api, apiList } from '@/lib/apiClient';
import {
  mapDelegation,
  mapRule,
  mapRules,
  mapSettings,
  mapSimulation,
  mapWarnings,
} from './approvalsRulesMappers';
import type {
  ApprovalRule,
  ApprovalSettings,
  DelegationInput,
  DelegationList,
  RuleInput,
  RuleWarning,
  SimulateInput,
} from '@/types/approvalsRules';

const clean = (q: object) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Record<
    string,
    string | number | boolean | undefined
  >;

export const approvalsRulesService = {
  /** GET /approvals/rules: every rule (or one type), inactive ones included. */
  rules: (type?: string) =>
    api<unknown>('/approvals/rules', { query: clean({ type, includeInactive: true }) }).then(mapRules),
  /** POST /approvals/rules (step-up, idempotent): the rule with its warnings. */
  create: (body: RuleInput & { type: string }) =>
    api<unknown>('/approvals/rules', { method: 'POST', body, idempotent: true }).then(mapRule),
  /** PATCH /approvals/rules/:id (step-up): `type` cannot change. */
  update: (id: number, body: Partial<Omit<RuleInput, 'type'>> & { version: number }) =>
    api<unknown>(`/approvals/rules/${id}`, { method: 'PATCH', body }).then(mapRule),
  /** DELETE /approvals/rules/:id (step-up): coverage warnings come back. */
  remove: (id: number, body: { version: number; reason: string }): Promise<RuleWarning[]> =>
    api<unknown>(`/approvals/rules/${id}`, { method: 'DELETE', body }).then(r =>
      mapWarnings((r as { warnings?: unknown } | null)?.warnings),
    ),
  /** POST /approvals/rules/reset-defaults (step-up): returns the new rules of the type. */
  resetDefaults: (body: { type: string; reason: string }): Promise<ApprovalRule[]> =>
    api<unknown>('/approvals/rules/reset-defaults', { method: 'POST', body, idempotent: true }).then(
      mapRules,
    ),
  /** POST /approvals/rules/simulate: which rule matches and who would approve. No writes. */
  simulate: (body: SimulateInput) =>
    api<unknown>('/approvals/rules/simulate', { method: 'POST', body }).then(mapSimulation),

  /** GET /approvals/settings */
  settings: () => api<unknown>('/approvals/settings').then(mapSettings),
  /** PATCH /approvals/settings (step-up). */
  saveSettings: (body: Partial<ApprovalSettings>) =>
    api<unknown>('/approvals/settings', { method: 'PATCH', body }).then(mapSettings),

  /** GET /approvals/delegations (scope MINE or ALL). */
  delegations: async (
    q: { scope?: 'MINE' | 'ALL'; status?: string; page?: number; limit?: number } = {},
  ): Promise<DelegationList> => {
    const r = await apiList<unknown>('/approvals/delegations', { query: clean({ scope: 'MINE', ...q }) });
    return {
      items: r.data.map(mapDelegation),
      total: r.pagination?.total ?? r.data.length,
      totalPages: Math.max(1, r.pagination?.totalPages ?? 1),
    };
  },
  /** POST /approvals/delegations (step-up, idempotent, plan feature iam.approval_delegation). */
  createDelegation: (body: DelegationInput) =>
    api<unknown>('/approvals/delegations', { method: 'POST', body, idempotent: true }).then(mapDelegation),
  /** POST /approvals/delegations/:id/revoke */
  revokeDelegation: (id: number, body: { version: number; reason: string }) =>
    api<unknown>(`/approvals/delegations/${id}/revoke`, { method: 'POST', body }).then(mapDelegation),
};
