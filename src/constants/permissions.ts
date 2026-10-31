/**
 * Permission keys of the whole catalogue, generated from section 7.7 of the module 03 spec
 * (ROLES_AND_PERMISSIONS.md has the same keys). Shape: PERMISSIONS.<master>.<subMaster>.<action>.
 * 300 keys: platform 39, society 211, resident 29, gate 15, work 6. Hiding a control is a convenience; the API decides.
 */
export const PERMISSIONS = {
  platform: {
    dashboard: {
      view: 'platform.dashboard.view',
    },
    societies: {
      view: 'platform.societies.view',
      create: 'platform.societies.create',
      edit: 'platform.societies.edit',
      delete: 'platform.societies.delete',
      export: 'platform.societies.export',
      approve: 'platform.societies.approve',
    },
    supportAccess: {
      view: 'platform.support_access.view',
      create: 'platform.support_access.create',
      approve: 'platform.support_access.approve',
    },
    plans: {
      view: 'platform.plans.view',
      create: 'platform.plans.create',
      edit: 'platform.plans.edit',
      approve: 'platform.plans.approve',
    },
    featureFlags: {
      view: 'platform.feature_flags.view',
      create: 'platform.feature_flags.create',
      edit: 'platform.feature_flags.edit',
    },
    billing: {
      view: 'platform.billing.view',
      edit: 'platform.billing.edit',
      export: 'platform.billing.export',
      approve: 'platform.billing.approve',
    },
    jobs: {
      view: 'platform.jobs.view',
      edit: 'platform.jobs.edit',
    },
    tickets: {
      view: 'platform.tickets.view',
      create: 'platform.tickets.create',
      edit: 'platform.tickets.edit',
    },
    health: {
      view: 'platform.health.view',
      edit: 'platform.health.edit',
    },
    announcements: {
      view: 'platform.announcements.view',
      create: 'platform.announcements.create',
      edit: 'platform.announcements.edit',
    },
    team: {
      view: 'platform.team.view',
      create: 'platform.team.create',
      edit: 'platform.team.edit',
      delete: 'platform.team.delete',
    },
    auditLog: {
      view: 'platform.audit_log.view',
      export: 'platform.audit_log.export',
    },
    settings: {
      view: 'platform.settings.view',
      edit: 'platform.settings.edit',
    },
  },
  dashboard: {
    today: {
      view: 'dashboard.today.view',
    },
  },
  approvals: {
    inbox: {
      view: 'approvals.inbox.view',
    },
  },
  finance: {
    billing: {
      view: 'finance.billing.view',
      create: 'finance.billing.create',
      edit: 'finance.billing.edit',
      delete: 'finance.billing.delete',
      import: 'finance.billing.import',
      export: 'finance.billing.export',
      approve: 'finance.billing.approve',
    },
    payments: {
      view: 'finance.payments.view',
      create: 'finance.payments.create',
      edit: 'finance.payments.edit',
      export: 'finance.payments.export',
      approve: 'finance.payments.approve',
    },
    collections: {
      view: 'finance.collections.view',
      create: 'finance.collections.create',
      edit: 'finance.collections.edit',
      delete: 'finance.collections.delete',
      export: 'finance.collections.export',
      approve: 'finance.collections.approve',
    },
    expenses: {
      view: 'finance.expenses.view',
      create: 'finance.expenses.create',
      edit: 'finance.expenses.edit',
      delete: 'finance.expenses.delete',
      export: 'finance.expenses.export',
      approve: 'finance.expenses.approve',
    },
    accounts: {
      view: 'finance.accounts.view',
      create: 'finance.accounts.create',
      edit: 'finance.accounts.edit',
      export: 'finance.accounts.export',
      approve: 'finance.accounts.approve',
    },
    bank: {
      view: 'finance.bank.view',
      edit: 'finance.bank.edit',
      import: 'finance.bank.import',
      approve: 'finance.bank.approve',
    },
  },
  residents: {
    units: {
      view: 'residents.units.view',
      create: 'residents.units.create',
      edit: 'residents.units.edit',
      delete: 'residents.units.delete',
      import: 'residents.units.import',
      export: 'residents.units.export',
    },
    people: {
      view: 'residents.people.view',
      create: 'residents.people.create',
      edit: 'residents.people.edit',
      delete: 'residents.people.delete',
      import: 'residents.people.import',
      export: 'residents.people.export',
      approve: 'residents.people.approve',
    },
    contacts: {
      view: 'residents.contacts.view',
    },
    requests: {
      view: 'residents.requests.view',
      create: 'residents.requests.create',
      edit: 'residents.requests.edit',
      approve: 'residents.requests.approve',
    },
  },
  helpdesk: {
    tickets: {
      view: 'helpdesk.tickets.view',
      create: 'helpdesk.tickets.create',
      edit: 'helpdesk.tickets.edit',
      delete: 'helpdesk.tickets.delete',
      export: 'helpdesk.tickets.export',
    },
    settings: {
      view: 'helpdesk.settings.view',
      edit: 'helpdesk.settings.edit',
    },
  },
  communication: {
    notices: {
      view: 'communication.notices.view',
      create: 'communication.notices.create',
      edit: 'communication.notices.edit',
      delete: 'communication.notices.delete',
      approve: 'communication.notices.approve',
    },
    emergency: {
      create: 'communication.emergency.create',
    },
    surveys: {
      view: 'communication.surveys.view',
      create: 'communication.surveys.create',
      edit: 'communication.surveys.edit',
      export: 'communication.surveys.export',
    },
  },
  security: {
    visitors: {
      view: 'security.visitors.view',
      edit: 'security.visitors.edit',
      export: 'security.visitors.export',
    },
    guards: {
      view: 'security.guards.view',
      create: 'security.guards.create',
      edit: 'security.guards.edit',
      delete: 'security.guards.delete',
    },
    incidents: {
      view: 'security.incidents.view',
      edit: 'security.incidents.edit',
    },
    accessCards: {
      view: 'security.access_cards.view',
      create: 'security.access_cards.create',
      edit: 'security.access_cards.edit',
      delete: 'security.access_cards.delete',
    },
  },
  amenities: {
    amenities: {
      view: 'amenities.amenities.view',
      create: 'amenities.amenities.create',
      edit: 'amenities.amenities.edit',
      delete: 'amenities.amenities.delete',
    },
    bookings: {
      view: 'amenities.bookings.view',
      create: 'amenities.bookings.create',
      edit: 'amenities.bookings.edit',
      export: 'amenities.bookings.export',
      approve: 'amenities.bookings.approve',
    },
  },
  parking: {
    slots: {
      view: 'parking.slots.view',
      create: 'parking.slots.create',
      edit: 'parking.slots.edit',
      delete: 'parking.slots.delete',
      approve: 'parking.slots.approve',
    },
    vehicles: {
      view: 'parking.vehicles.view',
      create: 'parking.vehicles.create',
      edit: 'parking.vehicles.edit',
      delete: 'parking.vehicles.delete',
      export: 'parking.vehicles.export',
    },
    violations: {
      view: 'parking.violations.view',
      create: 'parking.violations.create',
      edit: 'parking.violations.edit',
      approve: 'parking.violations.approve',
    },
  },
  staff: {
    societyStaff: {
      view: 'staff.society_staff.view',
      create: 'staff.society_staff.create',
      edit: 'staff.society_staff.edit',
      delete: 'staff.society_staff.delete',
    },
    domesticHelp: {
      view: 'staff.domestic_help.view',
      create: 'staff.domestic_help.create',
      edit: 'staff.domestic_help.edit',
      delete: 'staff.domestic_help.delete',
      approve: 'staff.domestic_help.approve',
    },
    attendance: {
      view: 'staff.attendance.view',
      edit: 'staff.attendance.edit',
      export: 'staff.attendance.export',
    },
  },
  vendors: {
    vendors: {
      view: 'vendors.vendors.view',
      create: 'vendors.vendors.create',
      edit: 'vendors.vendors.edit',
      delete: 'vendors.vendors.delete',
    },
    purchaseOrders: {
      view: 'vendors.purchase_orders.view',
      create: 'vendors.purchase_orders.create',
      edit: 'vendors.purchase_orders.edit',
      approve: 'vendors.purchase_orders.approve',
    },
    assets: {
      view: 'vendors.assets.view',
      create: 'vendors.assets.create',
      edit: 'vendors.assets.edit',
      delete: 'vendors.assets.delete',
    },
  },
  governance: {
    meetings: {
      view: 'governance.meetings.view',
      create: 'governance.meetings.create',
      edit: 'governance.meetings.edit',
      approve: 'governance.meetings.approve',
    },
    polls: {
      view: 'governance.polls.view',
      create: 'governance.polls.create',
      edit: 'governance.polls.edit',
      approve: 'governance.polls.approve',
    },
    elections: {
      view: 'governance.elections.view',
      create: 'governance.elections.create',
      edit: 'governance.elections.edit',
      approve: 'governance.elections.approve',
    },
  },
  documents: {
    documents: {
      view: 'documents.documents.view',
      create: 'documents.documents.create',
      edit: 'documents.documents.edit',
      delete: 'documents.documents.delete',
    },
    registers: {
      view: 'documents.registers.view',
      edit: 'documents.registers.edit',
      export: 'documents.registers.export',
    },
    compliance: {
      view: 'documents.compliance.view',
      create: 'documents.compliance.create',
      edit: 'documents.compliance.edit',
    },
    rules: {
      view: 'documents.rules.view',
      create: 'documents.rules.create',
      edit: 'documents.rules.edit',
      approve: 'documents.rules.approve',
    },
    certificates: {
      view: 'documents.certificates.view',
      create: 'documents.certificates.create',
      approve: 'documents.certificates.approve',
    },
  },
  community: {
    posts: {
      view: 'community.posts.view',
      edit: 'community.posts.edit',
      delete: 'community.posts.delete',
      approve: 'community.posts.approve',
    },
    events: {
      view: 'community.events.view',
      create: 'community.events.create',
      edit: 'community.events.edit',
      delete: 'community.events.delete',
    },
  },
  reports: {
    reports: {
      view: 'reports.reports.view',
      export: 'reports.reports.export',
    },
  },
  settings: {
    society: {
      view: 'settings.society.view',
      edit: 'settings.society.edit',
    },
    members: {
      view: 'settings.members.view',
      create: 'settings.members.create',
      edit: 'settings.members.edit',
      delete: 'settings.members.delete',
      export: 'settings.members.export',
    },
    roles: {
      view: 'settings.roles.view',
      create: 'settings.roles.create',
      edit: 'settings.roles.edit',
      delete: 'settings.roles.delete',
    },
    billingRules: {
      view: 'settings.billing_rules.view',
      edit: 'settings.billing_rules.edit',
    },
    approvalRules: {
      view: 'settings.approval_rules.view',
      edit: 'settings.approval_rules.edit',
    },
    integrations: {
      view: 'settings.integrations.view',
      edit: 'settings.integrations.edit',
      approve: 'settings.integrations.approve',
    },
    subscription: {
      view: 'settings.subscription.view',
      edit: 'settings.subscription.edit',
    },
    auditLog: {
      view: 'settings.audit_log.view',
      export: 'settings.audit_log.export',
    },
    supportAccess: {
      view: 'settings.support_access.view',
      approve: 'settings.support_access.approve',
    },
    dataExport: {
      view: 'settings.data_export.view',
      create: 'settings.data_export.create',
    },
    support: {
      view: 'settings.support.view',
      create: 'settings.support.create',
    },
  },
  ai: {
    assistant: {
      view: 'ai.assistant.view',
      create: 'ai.assistant.create',
    },
    copilot: {
      create: 'ai.copilot.create',
    },
    settings: {
      view: 'ai.settings.view',
      edit: 'ai.settings.edit',
    },
    usage: {
      view: 'ai.usage.view',
      export: 'ai.usage.export',
    },
    conversations: {
      view: 'ai.conversations.view',
      delete: 'ai.conversations.delete',
    },
  },
  automation: {
    rules: {
      view: 'automation.rules.view',
      create: 'automation.rules.create',
      edit: 'automation.rules.edit',
      delete: 'automation.rules.delete',
      approve: 'automation.rules.approve',
    },
  },
  resident: {
    home: {
      view: 'resident.home.view',
    },
    dues: {
      view: 'resident.dues.view',
    },
    payments: {
      view: 'resident.payments.view',
      create: 'resident.payments.create',
    },
    household: {
      view: 'resident.household.view',
      create: 'resident.household.create',
      edit: 'resident.household.edit',
      delete: 'resident.household.delete',
    },
    visitors: {
      view: 'resident.visitors.view',
      create: 'resident.visitors.create',
      approve: 'resident.visitors.approve',
    },
    helpdesk: {
      view: 'resident.helpdesk.view',
      create: 'resident.helpdesk.create',
      edit: 'resident.helpdesk.edit',
    },
    notices: {
      view: 'resident.notices.view',
      edit: 'resident.notices.edit',
    },
    amenities: {
      view: 'resident.amenities.view',
      create: 'resident.amenities.create',
    },
    polls: {
      view: 'resident.polls.view',
      create: 'resident.polls.create',
    },
    community: {
      view: 'resident.community.view',
      create: 'resident.community.create',
    },
    documents: {
      view: 'resident.documents.view',
      create: 'resident.documents.create',
    },
    requests: {
      view: 'resident.requests.view',
      create: 'resident.requests.create',
    },
    finances: {
      view: 'resident.finances.view',
    },
    assistant: {
      view: 'resident.assistant.view',
      create: 'resident.assistant.create',
    },
  },
  gate: {
    visitors: {
      view: 'gate.visitors.view',
      create: 'gate.visitors.create',
      edit: 'gate.visitors.edit',
    },
    deliveries: {
      view: 'gate.deliveries.view',
      create: 'gate.deliveries.create',
      edit: 'gate.deliveries.edit',
    },
    vehicles: {
      view: 'gate.vehicles.view',
      create: 'gate.vehicles.create',
    },
    patrol: {
      view: 'gate.patrol.view',
      create: 'gate.patrol.create',
    },
    sos: {
      create: 'gate.sos.create',
    },
    staffEntry: {
      create: 'gate.staff_entry.create',
    },
    amenities: {
      view: 'gate.amenities.view',
      edit: 'gate.amenities.edit',
    },
    buildingIssues: {
      create: 'gate.building_issues.create',
    },
  },
  work: {
    tasks: {
      view: 'work.tasks.view',
      edit: 'work.tasks.edit',
    },
    attendance: {
      create: 'work.attendance.create',
    },
    checklists: {
      view: 'work.checklists.view',
      edit: 'work.checklists.edit',
    },
    buildingIssues: {
      create: 'work.building_issues.create',
    },
  },
} as const;

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T];
export type PermissionKey = Leaves<typeof PERMISSIONS>;

export type PermissionScope = 'platform' | 'society' | 'resident' | 'gate' | 'work';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'import' | 'export' | 'approve';
/** One row per sub-master: [subMaster, actions, moduleNo, label]. */
export type CatalogueRow = readonly [
  subMaster: string,
  actions: readonly PermissionAction[],
  moduleNo: number,
  label: string,
];

export const CATALOGUE: Record<PermissionScope, readonly CatalogueRow[]> = {
  platform: [
    ['platform.dashboard', ['view'], 7, 'Platform overview'],
    ['platform.societies', ['view', 'create', 'edit', 'delete', 'export', 'approve'], 5, 'Societies'],
    ['platform.support_access', ['view', 'create', 'approve'], 5, 'Support access'],
    ['platform.plans', ['view', 'create', 'edit', 'approve'], 4, 'Plans and add-ons'],
    ['platform.feature_flags', ['view', 'create', 'edit'], 4, 'Feature flags'],
    ['platform.billing', ['view', 'edit', 'export', 'approve'], 6, 'Platform billing'],
    ['platform.jobs', ['view', 'edit'], 7, 'Jobs and queues'],
    ['platform.tickets', ['view', 'create', 'edit'], 7, 'Support tickets'],
    ['platform.health', ['view', 'edit'], 7, 'Platform health'],
    ['platform.announcements', ['view', 'create', 'edit'], 7, 'Announcements'],
    ['platform.team', ['view', 'create', 'edit', 'delete'], 3, 'Platform team'],
    ['platform.audit_log', ['view', 'export'], 7, 'Platform audit trail'],
    ['platform.settings', ['view', 'edit'], 7, 'Platform settings'],
  ],
  society: [
    ['dashboard.today', ['view'], 24, 'Today dashboard'],
    ['approvals.inbox', ['view'], 14, 'Approvals inbox'],
    [
      'finance.billing',
      ['view', 'create', 'edit', 'delete', 'import', 'export', 'approve'],
      11,
      'Billing and invoices',
    ],
    ['finance.payments', ['view', 'create', 'edit', 'export', 'approve'], 12, 'Payments and receipts'],
    ['finance.collections', ['view', 'create', 'edit', 'delete', 'export', 'approve'], 12, 'Collections'],
    [
      'finance.expenses',
      ['view', 'create', 'edit', 'delete', 'export', 'approve'],
      13,
      'Expenses and cash book',
    ],
    ['finance.accounts', ['view', 'create', 'edit', 'export', 'approve'], 13, 'Society balance and accounts'],
    ['finance.bank', ['view', 'edit', 'import', 'approve'], 13, 'Bank and reconciliation'],
    ['residents.units', ['view', 'create', 'edit', 'delete', 'import', 'export'], 8, 'Flats'],
    ['residents.people', ['view', 'create', 'edit', 'delete', 'import', 'export', 'approve'], 9, 'Residents'],
    ['residents.contacts', ['view'], 9, 'Unmasked phones and emails'],
    ['residents.requests', ['view', 'create', 'edit', 'approve'], 9, 'Resident requests'],
    [
      'helpdesk.tickets',
      ['view', 'create', 'edit', 'delete', 'export'],
      15,
      'Complaints and building issues',
    ],
    ['helpdesk.settings', ['view', 'edit'], 15, 'Helpdesk settings'],
    ['communication.notices', ['view', 'create', 'edit', 'delete', 'approve'], 16, 'Notices'],
    ['communication.emergency', ['create'], 16, 'Emergency alerts'],
    ['communication.surveys', ['view', 'create', 'edit', 'export'], 16, 'Surveys'],
    ['security.visitors', ['view', 'edit', 'export'], 17, 'Visitors and deliveries'],
    ['security.guards', ['view', 'create', 'edit', 'delete'], 17, 'Guards, devices and patrol'],
    ['security.incidents', ['view', 'edit'], 17, 'SOS and incidents'],
    ['security.access_cards', ['view', 'create', 'edit', 'delete'], 17, 'Access cards and keys'],
    ['amenities.amenities', ['view', 'create', 'edit', 'delete'], 18, 'Amenities'],
    ['amenities.bookings', ['view', 'create', 'edit', 'export', 'approve'], 18, 'Bookings'],
    ['parking.slots', ['view', 'create', 'edit', 'delete', 'approve'], 19, 'Parking slots'],
    ['parking.vehicles', ['view', 'create', 'edit', 'delete', 'export'], 19, 'Vehicles'],
    ['parking.violations', ['view', 'create', 'edit', 'approve'], 19, 'Parking violations'],
    ['staff.society_staff', ['view', 'create', 'edit', 'delete'], 20, 'Society staff'],
    ['staff.domestic_help', ['view', 'create', 'edit', 'delete', 'approve'], 20, 'Domestic help'],
    ['staff.attendance', ['view', 'edit', 'export'], 20, 'Staff attendance'],
    ['vendors.vendors', ['view', 'create', 'edit', 'delete'], 21, 'Vendors'],
    ['vendors.purchase_orders', ['view', 'create', 'edit', 'approve'], 21, 'Purchase orders'],
    ['vendors.assets', ['view', 'create', 'edit', 'delete'], 21, 'Assets and maintenance'],
    ['governance.meetings', ['view', 'create', 'edit', 'approve'], 22, 'Meetings'],
    ['governance.polls', ['view', 'create', 'edit', 'approve'], 22, 'Polls'],
    ['governance.elections', ['view', 'create', 'edit', 'approve'], 22, 'Elections'],
    ['documents.documents', ['view', 'create', 'edit', 'delete'], 23, 'Documents'],
    ['documents.registers', ['view', 'edit', 'export'], 23, 'Statutory registers'],
    ['documents.compliance', ['view', 'create', 'edit'], 23, 'Compliance calendar'],
    ['documents.rules', ['view', 'create', 'edit', 'approve'], 23, 'Rule book and fines'],
    ['documents.certificates', ['view', 'create', 'approve'], 23, 'Certificates'],
    ['community.posts', ['view', 'edit', 'delete', 'approve'], 26, 'Community posts'],
    ['community.events', ['view', 'create', 'edit', 'delete'], 26, 'Community events'],
    ['reports.reports', ['view', 'export'], 24, 'Reports'],
    ['settings.society', ['view', 'edit'], 8, 'Society profile'],
    ['settings.members', ['view', 'create', 'edit', 'delete', 'export'], 3, 'Committee and team'],
    ['settings.roles', ['view', 'create', 'edit', 'delete'], 3, 'Roles'],
    ['settings.billing_rules', ['view', 'edit'], 11, 'Billing rules'],
    ['settings.approval_rules', ['view', 'edit'], 14, 'Approval rules'],
    ['settings.integrations', ['view', 'edit', 'approve'], 29, 'Integrations'],
    ['settings.subscription', ['view', 'edit'], 4, 'Subscription'],
    ['settings.audit_log', ['view', 'export'], 7, 'Audit trail'],
    ['settings.support_access', ['view', 'approve'], 5, 'Support access requests'],
    ['settings.data_export', ['view', 'create'], 5, 'Data export'],
    ['settings.support', ['view', 'create'], 7, 'Support tickets'],
    ['ai.assistant', ['view', 'create'], 30, 'AI assistant'],
    ['ai.copilot', ['create'], 30, 'AI copilot drafts'],
    ['ai.settings', ['view', 'edit'], 30, 'AI settings'],
    ['ai.usage', ['view', 'export'], 30, 'AI usage'],
    ['ai.conversations', ['view', 'delete'], 30, 'AI conversations review'],
    ['automation.rules', ['view', 'create', 'edit', 'delete', 'approve'], 30, 'Automation rules'],
  ],
  resident: [
    ['resident.home', ['view'], 25, 'Home'],
    ['resident.dues', ['view'], 11, 'Dues and statement'],
    ['resident.payments', ['view', 'create'], 12, 'Pay and receipts'],
    ['resident.household', ['view', 'create', 'edit', 'delete'], 9, 'Household'],
    ['resident.visitors', ['view', 'create', 'approve'], 17, 'Visitors'],
    ['resident.helpdesk', ['view', 'create', 'edit'], 15, 'Help'],
    ['resident.notices', ['view', 'edit'], 16, 'Notices'],
    ['resident.amenities', ['view', 'create'], 18, 'Amenity bookings'],
    ['resident.polls', ['view', 'create'], 22, 'Polls and voting'],
    ['resident.community', ['view', 'create'], 26, 'Community'],
    ['resident.documents', ['view', 'create'], 23, 'Documents and certificates'],
    ['resident.requests', ['view', 'create'], 9, 'Requests'],
    ['resident.finances', ['view'], 13, 'Society finances'],
    ['resident.assistant', ['view', 'create'], 30, 'Assistant'],
  ],
  gate: [
    ['gate.visitors', ['view', 'create', 'edit'], 17, 'Gate visitors'],
    ['gate.deliveries', ['view', 'create', 'edit'], 17, 'Gate deliveries'],
    ['gate.vehicles', ['view', 'create'], 19, 'Vehicle lookup and guest parking'],
    ['gate.patrol', ['view', 'create'], 17, 'Patrol'],
    ['gate.sos', ['create'], 17, 'SOS'],
    ['gate.staff_entry', ['create'], 20, 'Staff entry'],
    ['gate.amenities', ['view', 'edit'], 18, 'Amenity check-in'],
    ['gate.building_issues', ['create'], 15, 'Report a building issue'],
  ],
  work: [
    ['work.tasks', ['view', 'edit'], 28, 'My tasks'],
    ['work.attendance', ['create'], 20, 'Attendance'],
    ['work.checklists', ['view', 'edit'], 28, 'Checklists'],
    ['work.building_issues', ['create'], 15, 'Report a building issue'],
  ],
};

export const ACTIONS: readonly PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'import',
  'export',
  'approve',
];

/** Every key of one scope, in catalogue order. */
export const keysOfScope = (scope: PermissionScope): PermissionKey[] =>
  CATALOGUE[scope].flatMap(([sub, acts]) => acts.map(a => `${sub}.${a}` as PermissionKey));

/** Keys that need MFA when put in a role (spec section 5.1). */
export function isPrivilegedKey(key: string): boolean {
  const [master, sub, action] = key.split('.');
  if (master === 'platform') return true;
  const scope = (Object.keys(CATALOGUE) as PermissionScope[]).find(s =>
    CATALOGUE[s].some(r => r[0] === `${master}.${sub}`),
  );
  if (master === 'finance') return action !== 'view';
  if (scope === 'society' && (action === 'import' || action === 'export')) return true;
  return PRIVILEGED_EXTRA.has(key);
}
const PRIVILEGED_EXTRA = new Set<string>([
  'settings.roles.create',
  'settings.roles.edit',
  'settings.roles.delete',
  'settings.members.create',
  'settings.members.edit',
  'settings.members.delete',
  'settings.integrations.edit',
  'settings.subscription.edit',
  'settings.billing_rules.edit',
  'settings.approval_rules.edit',
  'settings.support_access.approve',
  'settings.data_export.create',
  'residents.contacts.view',
]);
