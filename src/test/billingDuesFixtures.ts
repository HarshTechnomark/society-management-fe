/** Raw shapes as the backend sends them (spec 8.12, 8.18, 8.21, 8.22). */
export const DUES_PERMS = [
  'settings.society.view',
  'finance.billing.view',
  'finance.billing.create',
  'finance.billing.edit',
  'finance.billing.export',
];
export const DUES_VIEW_PERMS = ['settings.society.view', 'finance.billing.view'];
export const DUES_FEATURES = ['billing.defaulter_list', 'billing.statement_of_account'];

export const RESIDENT_DUES_PERMS = ['resident.dues.view', 'resident.home.view'];
export const RESIDENT_DUES_FEATURES = ['billing.statement_of_account', 'billing.explain_my_bill'];

export const summaryRaw = (over: Record<string, unknown> = {}) => ({
  billedPaise: 33363100,
  collectedPaise: 25022325,
  efficiencyPct: 75.0,
  outstandingPaise: 9400000,
  overdueFlats: 12,
  ageing: [
    { bucket: '0_30', amountPaise: 4000000 },
    { bucket: '31_60', amountPaise: 2500000 },
    { bucket: '61_90', amountPaise: 1900000 },
    { bucket: '90_PLUS', amountPaise: 1000000 },
  ],
  ...over,
});

export const defaulterRaw = (over: Record<string, unknown> = {}) => ({
  unitId: 101,
  unitLabel: 'A-1203',
  ownerName: 'Anil Deshmukh',
  billToNames: ['Anil Deshmukh'],
  overduePaise: 1250000,
  oldestDueDate: '2026-07-10',
  daysOverdue: 117,
  invoiceCount: 3,
  ...over,
});
export const defaultersRaw = () => [
  defaulterRaw(),
  defaulterRaw({
    unitId: 102,
    unitLabel: 'B-0402',
    ownerName: 'Meera Shah',
    billToNames: ['Meera Shah', 'Ravi Nair'],
    overduePaise: 640000,
    oldestDueDate: '2026-06-10',
    daysOverdue: 147,
    invoiceCount: 4,
  }),
];

export const invoiceItemRaw = (over: Record<string, unknown> = {}) => ({
  id: 5123,
  invoiceNo: 'INV/2026-27/000201',
  invoiceType: 'REGULAR',
  unitId: 312,
  unitLabel: 'C-0801',
  billToName: 'Anil Deshmukh',
  billToRelation: 'OWNER',
  periodLabel: 'Nov 2026',
  invoiceDate: '2026-11-01',
  dueDate: '2026-11-10',
  totalPaise: 1006100,
  paidPaise: 500000,
  outstandingPaise: 506100,
  status: 'PARTIALLY_PAID',
  isOverdue: false,
  isDisputed: false,
  ...over,
});

export const myDuesRaw = () => ({
  units: [
    {
      unitId: 312,
      unitLabel: 'C-0801',
      relation: 'OWNER',
      outstandingPaise: 506100,
      overduePaise: 0,
      nextDueDate: '2026-11-10',
      openInvoiceCount: 1,
    },
    {
      unitId: 313,
      unitLabel: 'C-0802',
      relation: 'TENANT',
      outstandingPaise: 0,
      overduePaise: 0,
      nextDueDate: null,
      openInvoiceCount: 0,
    },
  ],
});

export const invoiceDetailRaw = (over: Record<string, unknown> = {}) => ({
  ...invoiceItemRaw(),
  billTo: { residentId: 77, name: 'Anil Deshmukh', relation: 'OWNER' },
  periodStart: '2026-11-01',
  periodEnd: '2026-11-30',
  gstApplied: true,
  societyGstin: '27AAAAS1234A1Z5',
  subtotalPaise: 858000,
  cgstPaise: 74070,
  sgstPaise: 74070,
  taxPaise: 148140,
  roundOffPaise: -40,
  debitedPaise: 0,
  creditedPaise: 0,
  previousDuesPaise: 250000,
  lines: [
    {
      id: 90121,
      lineNo: 1,
      lineKind: 'CHARGE',
      headKey: 'MAINTENANCE',
      description: 'Maintenance: 2,150 sq ft × ₹3.20 (Nov 2026)',
      quantity: '2150.0000',
      ratePaise: 320,
      amountPaise: 688000,
      creditedPaise: 0,
      computation: {
        method: 'PER_SQFT',
        ruleVersionId: 28,
        inputs: { areaSqft: '2150.000', areaBasis: 'CARPET', ratePerSqftPaise: 320, months: 1 },
        formula: 'roundHalfUp(2150000 × 320 × 1, 1000)',
        text: '2,150 sq ft × ₹3.20 = ₹6,880.00',
      },
    },
    { id: 90122, lineNo: 2, lineKind: 'CHARGE', description: 'Parking', amountPaise: 170000 },
    { id: 90126, lineNo: 6, lineKind: 'CGST', description: 'CGST 9% on ₹8,230.00', amountPaise: 74070 },
  ],
  pdfStatus: 'READY',
  ...over,
});
