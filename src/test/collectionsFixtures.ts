/** Raw API shapes of module 12 collections (spec 7.8, 7.9, 8.21 to 8.23), as the backend sends them. */
export const COL_VIEW_PERMS = ['finance.collections.view'];
export const COL_PERMS = [
  'finance.collections.view',
  'finance.collections.create',
  'finance.collections.edit',
  'finance.collections.delete',
  'finance.collections.export',
  'finance.payments.create',
];
export const COL_FEATURES = ['billing.festival_and_event_collections'];

export const colRaw = (over: Record<string, unknown> = {}) => ({
  id: 12,
  title: 'Ganesh Utsav 2026',
  kind: 'FESTIVAL',
  purpose: 'Decoration, prasad and the aarti for ten days of the festival in the society garden.',
  isMandatory: false,
  amountMode: 'FIXED_PER_UNIT',
  amountPerUnitPaise: 100000,
  minAmountPaise: 0,
  targetPaise: 7300000,
  collectedPaise: 1825000,
  percent: 25,
  contributorCount: 18,
  requestCount: 73,
  paidCount: 18,
  dueDate: '2026-12-10',
  status: 'PUBLISHED',
  fundId: 4,
  fundName: 'Festival fund',
  createdByName: 'Asha Rao',
  approvedByName: 'Vikram Shah',
  audienceType: 'ALL',
  audienceIds: null,
  includeVacant: false,
  payListVisibility: 'COUNT_ONLY',
  sendNotice: true,
  reminderCount: 1,
  lastReminderAt: null,
  approval: { requestId: 5, status: 'APPROVED', reason: null },
  spentPaise: null,
  version: 3,
  ...over,
});

export const reqRaw = (over: Record<string, unknown> = {}) => ({
  id: 301,
  unitId: 51,
  unitLabel: 'A-1203',
  billToName: 'Rohan Sharma',
  amountPaise: 100000,
  paidPaise: 0,
  status: 'OPEN',
  invoiceId: null,
  lastPaidAt: null,
  version: 1,
  ...over,
});
