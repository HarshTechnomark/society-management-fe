/** Module 15 Settings > Helpdesk calls: categories, SLA policies, escalation rules, preferences (spec 8.1 to 8.6). */
import { api } from '@/lib/apiClient';
import {
  mapCategories,
  mapCategory,
  mapPolicies,
  mapPolicy,
  mapRule,
  mapRules,
  mapSettings,
} from './helpdeskSettingsMappers';
import type {
  Category,
  CategoryInput,
  EscalationInput,
  EscalationRule,
  HelpdeskSettings,
  SlaPolicy,
  SlaPolicyInput,
} from '@/types/helpdesk';

type Status = 'ACTIVE' | 'ARCHIVED' | 'ALL';

export const helpdeskSettingsService = {
  /** GET /ticket-categories (tree, not paginated). */
  categories: (status: Status = 'ALL', scope?: 'PERSONAL' | 'BUILDING'): Promise<Category[]> =>
    api<unknown>('/ticket-categories', { query: { status, scope } }).then(mapCategories),
  /** POST /ticket-categories */
  createCategory: (body: CategoryInput & { name: string; scope: string }): Promise<Category> =>
    api<unknown>('/ticket-categories', { method: 'POST', body, idempotent: true }).then(mapCategory),
  /** PATCH /ticket-categories/:id (`parentId` cannot change). */
  updateCategory: (
    id: number,
    body: Omit<CategoryInput, 'parentId'> & { version: number },
  ): Promise<Category> =>
    api<unknown>(`/ticket-categories/${id}`, { method: 'PATCH', body }).then(mapCategory),
  archiveCategory: (id: number, version: number): Promise<Category> =>
    api<unknown>(`/ticket-categories/${id}/archive`, { method: 'POST', body: { version } }).then(mapCategory),
  restoreCategory: (id: number, version: number): Promise<Category> =>
    api<unknown>(`/ticket-categories/${id}/restore`, { method: 'POST', body: { version } }).then(mapCategory),

  /** GET /sla-policies */
  policies: (status: Status = 'ACTIVE'): Promise<SlaPolicy[]> =>
    api<unknown>('/sla-policies', { query: { status } }).then(mapPolicies),
  createPolicy: (body: SlaPolicyInput & { name: string }): Promise<SlaPolicy> =>
    api<unknown>('/sla-policies', { method: 'POST', body, idempotent: true }).then(mapPolicy),
  updatePolicy: (id: number, body: SlaPolicyInput & { version: number }): Promise<SlaPolicy> =>
    api<unknown>(`/sla-policies/${id}`, { method: 'PATCH', body }).then(mapPolicy),
  archivePolicy: (id: number, version: number): Promise<SlaPolicy> =>
    api<unknown>(`/sla-policies/${id}/archive`, { method: 'POST', body: { version } }).then(mapPolicy),

  /** GET /escalation-rules */
  rules: (status?: 'ACTIVE' | 'INACTIVE'): Promise<EscalationRule[]> =>
    api<unknown>('/escalation-rules', { query: { status } }).then(mapRules),
  createRule: (body: EscalationInput & { name: string }): Promise<EscalationRule> =>
    api<unknown>('/escalation-rules', { method: 'POST', body, idempotent: true }).then(mapRule),
  updateRule: (
    id: number,
    body: Omit<EscalationInput, 'triggerType'> & { version: number },
  ): Promise<EscalationRule> =>
    api<unknown>(`/escalation-rules/${id}`, { method: 'PATCH', body }).then(mapRule),
  /** DELETE /escalation-rules/:id?version= */
  deleteRule: (id: number, version: number) =>
    api<unknown>(`/escalation-rules/${id}`, { method: 'DELETE', query: { version } }),

  /** GET /helpdesk/settings */
  settings: (): Promise<HelpdeskSettings> => api<unknown>('/helpdesk/settings').then(mapSettings),
  /** PATCH /helpdesk/settings: `{ changes: [{ key, value, version? }] }`. */
  saveSettings: (
    changes: { key: string; value: number | boolean; version?: number }[],
  ): Promise<HelpdeskSettings> =>
    api<unknown>('/helpdesk/settings', { method: 'PATCH', body: { changes } }).then(mapSettings),
};
