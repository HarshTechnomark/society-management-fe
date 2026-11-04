/** Raw API shapes of module 11 billing runs (spec 7.5, 7.6, 8.2, 8.5 to 8.10), as the backend sends them. */
export const RUN_VIEW_PERMS = ['finance.billing.view'];
export const RUN_PERMS = [
  'finance.billing.view',
  'finance.billing.create',
  'finance.billing.edit',
  'settings.billing_rules.view',
];
export const RUN_FEATURES = [
  'billing.billing_run_pipeline',
  'billing.exceptions_report',
  'billing.bill_change_diff',
  'billing.supplementary_and_ad_hoc_invoices',
];

export const runRaw = (over: Record<string, unknown> = {}) => ({
  id: 88,
  runLabel: 'BR-2026-11',
  runType: 'REGULAR',
  status: 'PREVIEW',
  cycle: 'MONTHLY',
  periodStart: '2026-11-01',
  periodEnd: '2026-11-30',
  billDate: '2026-11-01',
  scopeType: 'ALL_UNITS',
  scopeValues: null,
  counts: { items: 73, ready: 71, exceptions: 0, excluded: 2, warnings: 4, skipped: 0, issued: 0 },
  subtotalPaise: 33215000,
  taxPaise: 148140,
  roundOffPaise: -40,
  totalPaise: 33363100,
  previousRunTotalPaise: 32980000,
  changePct: '1.1613',
  byHead: [
    { headKey: 'MAINTENANCE', name: 'Maintenance (service charges)', amountPaise: 26496000 },
    { headKey: 'SINKING_FUND', name: 'Sinking fund', amountPaise: 6719000 },
  ],
  computedAt: '2026-10-28T09:12:00.000Z',
  isStale: false,
  approvalRequestId: null,
  computeError: null,
  lastError: null,
  cancelReason: null,
  notes: null,
  splitInputs: [],
  version: 3,
  ...over,
});

export const itemRaw = (over: Record<string, unknown> = {}) => ({
  id: 501,
  unitId: 11,
  unitLabel: 'A-101',
  billToResidentId: 7,
  billToRelation: 'OWNER',
  billToName: 'Anita Rao',
  status: 'READY',
  exceptionCode: null,
  exceptionMessage: null,
  warningCodes: '',
  lines: [
    {
      headKey: 'MAINTENANCE',
      description: 'Maintenance',
      amountPaise: 368000,
      prorationDays: null,
      periodDays: null,
    },
    {
      headKey: 'SINKING_FUND',
      description: 'Sinking fund',
      amountPaise: 90000,
      prorationDays: null,
      periodDays: null,
    },
  ],
  subtotalPaise: 458000,
  taxPaise: 0,
  roundOffPaise: 0,
  totalPaise: 458000,
  previousTotalPaise: 450000,
  variancePct: '1.7778',
  excludedReason: null,
  invoiceId: null,
  version: 1,
  ...over,
});

export const exceptionItemRaw = (over: Record<string, unknown> = {}) =>
  itemRaw({
    id: 502,
    unitId: 12,
    unitLabel: 'A-102',
    billToName: 'Dev Shah',
    status: 'EXCEPTION',
    exceptionCode: 'MISSING_AREA',
    exceptionMessage: 'A-102 has no area.',
    lines: [],
    totalPaise: 0,
    subtotalPaise: 0,
    previousTotalPaise: null,
    variancePct: null,
    ...over,
  });

export const excludedItemRaw = (over: Record<string, unknown> = {}) =>
  itemRaw({
    id: 503,
    unitLabel: 'B-201',
    billToName: 'Kiran Patel',
    status: 'EXCLUDED',
    excludedReason: 'Flat is under dispute',
    ...over,
  });

export const rulesRaw = () => [
  {
    id: 7,
    chargeHeadName: 'Maintenance (service charges)',
    scopeType: 'ALL_UNITS',
    status: 'ACTIVE',
    currentVersion: { rateType: 'PER_SQFT', ratePerSqftPaise: 320, effectiveFrom: '2026-04-01' },
    nextVersion: null,
    pendingVersion: { rateType: 'PER_SQFT', ratePerSqftPaise: 350, effectiveFrom: '2027-04-01' },
  },
  {
    id: 8,
    chargeHeadName: 'Sinking fund',
    scopeType: 'ALL_UNITS',
    status: 'ACTIVE',
    currentVersion: { rateType: 'FLAT_PER_UNIT', amountPaise: 90000, effectiveFrom: '2026-04-01' },
    nextVersion: null,
    pendingVersion: null,
  },
];

export const splitRulesRaw = () => [
  {
    id: 4,
    name: 'Water tanker bill',
    description: 'Shared by area',
    amountSource: 'RUN_INPUT',
    status: 'ACTIVE',
  },
  { id: 5, name: 'Fixed lift fund', description: '', amountSource: 'FIXED', status: 'ACTIVE' },
];

export const cycleSettings = (value = 'MONTHLY') => [
  { key: 'billing.cycle', namespace: 'billing', value, default: 'MONTHLY' },
];
