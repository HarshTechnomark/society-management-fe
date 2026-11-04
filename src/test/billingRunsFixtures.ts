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
  previewHash: 'a'.repeat(64),
  createdAt: '2026-10-28T09:10:00.000Z',
  publishedAt: null,
  approvedAt: null,
  issuedAt: null,
  progress: null,
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
  itemKey: 'U11',
  billToResidentId: 7,
  billToRelation: 'OWNER',
  billToName: 'Anita Rao',
  status: 'READY',
  exceptionCode: null,
  exceptionMessage: null,
  warningCodes: null,
  thresholdBasePaise: 458000,
  gstApplied: false,
  lines: [
    {
      lineKind: 'CHARGE',
      chargeHeadId: 1,
      headKey: 'MAINTENANCE',
      description: 'Maintenance',
      quantity: '1.0000',
      ratePaise: 368000,
      amountPaise: 368000,
      isTaxable: false,
      billingRuleVersionId: 31,
      periodFrom: '2026-11-01',
      periodTo: '2026-11-30',
      prorationDays: 30,
      periodDays: 30,
      ledgerAccountCode: '4100',
    },
    {
      lineKind: 'CHARGE',
      chargeHeadId: 2,
      headKey: 'SINKING_FUND',
      description: 'Sinking fund',
      quantity: '1.0000',
      ratePaise: 90000,
      amountPaise: 90000,
      isTaxable: false,
      billingRuleVersionId: 32,
      periodFrom: '2026-11-01',
      periodTo: '2026-11-30',
      prorationDays: 30,
      periodDays: 30,
      ledgerAccountCode: '2410',
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

const headOf = (id: number, key: string, name: string) => ({
  id,
  key,
  name,
  headType: key,
  status: 'ACTIVE',
});
const ver = (over: Record<string, unknown>) => ({
  id: 31,
  billingRuleId: 7,
  versionNo: 1,
  rateType: 'NONE',
  amountPaise: null,
  ratePerSqftPaise: null,
  unitTypeRates: null,
  meterType: null,
  slabs: null,
  minimumChargePaise: null,
  missingReadingPolicy: null,
  billSplitRuleId: null,
  percent: null,
  baseChargeHeadIds: null,
  effectiveFrom: '2026-04-01',
  effectiveTo: null,
  status: 'APPROVED',
  reason: 'AGM',
  ...over,
});

/** `GET /billing/rules` rows: the head is a nested object and the lists carry pagination next to them. */
export const rulesRaw = () => [
  {
    id: 7,
    chargeHeadId: 1,
    chargeHead: headOf(1, 'MAINTENANCE', 'Maintenance (service charges)'),
    name: 'Maintenance - all flats',
    scopeType: 'ALL_UNITS',
    scopeValues: null,
    status: 'ACTIVE',
    currentVersion: ver({ rateType: 'PER_SQFT', ratePerSqftPaise: 320 }),
    nextVersion: null,
    pendingVersion: ver({
      id: 40,
      rateType: 'PER_SQFT',
      ratePerSqftPaise: 350,
      effectiveFrom: '2027-04-01',
      status: 'PENDING_APPROVAL',
    }),
  },
  {
    id: 8,
    chargeHeadId: 2,
    chargeHead: headOf(2, 'SINKING_FUND', 'Sinking fund'),
    name: 'Sinking fund - all flats',
    scopeType: 'ALL_UNITS',
    scopeValues: null,
    status: 'ACTIVE',
    currentVersion: ver({ id: 33, billingRuleId: 8, rateType: 'FLAT_PER_UNIT', amountPaise: 90000 }),
    nextVersion: null,
    pendingVersion: null,
  },
];

/** The water tanker split rule (id 4) is used by an approved SPLIT_TOTAL rate; the lift rule (id 6) is not. */
export const splitRateRulesRaw = () => [
  ...rulesRaw(),
  {
    id: 9,
    chargeHeadId: 5,
    chargeHead: headOf(5, 'WATER', 'Water'),
    name: 'Water tanker',
    scopeType: 'ALL_UNITS',
    scopeValues: null,
    status: 'ACTIVE',
    currentVersion: ver({ id: 50, billingRuleId: 9, rateType: 'SPLIT_TOTAL', billSplitRuleId: 4 }),
    nextVersion: null,
    pendingVersion: null,
  },
];

export const splitRulesRaw = () => [
  {
    id: 4,
    name: 'Water tanker bill',
    description: 'Shared by area',
    basis: 'AREA',
    amountSource: 'RUN_INPUT',
    fixedAmountPaise: null,
    status: 'ACTIVE',
  },
  {
    id: 5,
    name: 'Fixed lift fund',
    description: null,
    amountSource: 'FIXED',
    fixedAmountPaise: 1000000,
    status: 'ACTIVE',
  },
  {
    id: 6,
    name: 'Unused input rule',
    description: null,
    amountSource: 'RUN_INPUT',
    fixedAmountPaise: null,
    status: 'ACTIVE',
  },
];

export const cycleSettings = (value = 'MONTHLY') => [
  { key: 'billing.cycle', namespace: 'billing', value, default: 'MONTHLY' },
];
