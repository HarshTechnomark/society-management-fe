import { PERMISSIONS as P } from '@/constants/permissions';

export interface Capability {
  label: string;
  /** The role has the capability when it holds every one of these keys. */
  keys: readonly string[];
}

/** Rows of the society "What each role can do" card (spec 11.1; the prototype's seven rows). */
export const SOCIETY_CAPABILITIES: readonly Capability[] = [
  {
    label: 'View finances, residents and issues',
    keys: [P.finance.accounts.view, P.residents.people.view, P.helpdesk.tickets.view],
  },
  { label: 'Record payments and cash book', keys: [P.finance.payments.create] },
  {
    label: 'Create collections and billing runs',
    keys: [P.finance.collections.create, P.finance.billing.create],
  },
  { label: 'Approve expenses and collections', keys: [P.finance.expenses.approve] },
  { label: 'Write notices and send emergency alerts', keys: [P.communication.notices.create] },
  { label: 'Manage issues and assign staff', keys: [P.helpdesk.tickets.edit] },
  { label: 'Manage team and settings', keys: [P.settings.members.edit] },
];

/** Rows of the platform "What each role can do" card (spec 11.10; the prototype's eight rows). */
export const PLATFORM_CAPABILITIES: readonly Capability[] = [
  {
    label: 'View societies, billing, audit and health',
    keys: [
      P.platform.societies.view,
      P.platform.billing.view,
      P.platform.auditLog.view,
      P.platform.health.view,
    ],
  },
  { label: 'Create societies (assisted onboarding)', keys: [P.platform.societies.create] },
  {
    label: 'Raise tickets and request support access',
    keys: [P.platform.tickets.create, P.platform.supportAccess.create],
  },
  { label: 'Change plan, suspend, reactivate societies', keys: [P.platform.societies.approve] },
  {
    label: 'Edit plans, add-ons and feature flags',
    keys: [P.platform.plans.edit, P.platform.featureFlags.edit],
  },
  { label: 'Retry, discard jobs and pause queues', keys: [P.platform.jobs.edit] },
  { label: 'Mark invoices paid, apply credits', keys: [P.platform.billing.edit] },
  {
    label: 'Export audit trail, manage team and settings',
    keys: [P.platform.auditLog.export, P.platform.team.edit, P.platform.settings.edit],
  },
];

export const hasCapability = (keys: readonly string[], c: Capability) => c.keys.every(k => keys.includes(k));

/** Roles whose members take an admin seat (spec BR-03-33; custom roles are decided by the server). */
export const SEAT_ROLE_KEYS = [
  'society_admin',
  'accountant',
  'facility_manager',
  'security_supervisor',
  'auditor',
];
