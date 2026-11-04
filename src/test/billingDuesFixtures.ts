/**
 * Raw shapes as the backend sends them (spec 8.12, 8.18, 8.21, 8.22): `billing.dues.queries.ts`,
 * `billing.dues.controller.ts`, `billing.resident.dto.ts` and `billing.resident.service.ts`.
 */
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
  month: '2026-11',
  billedPaise: 33363100,
  collectedPaise: 25022325,
  efficiencyPct: '75.0',
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
  billToNames: 'Anil Deshmukh',
  overduePaise: 1250000,
  oldestDueDate: '2026-07-10',
  daysOverdue: 117,
  invoiceCount: 3,
  ...over,
});
/** `data` of `GET /billing/defaulters`: `{ items, totals }` (the pagination sits next to `data`). */
export const defaultersRaw = (
  items: Record<string, unknown>[] = defaulterItems(),
  totals = {
    flats: items.length,
    overduePaise: items.reduce((a, d) => a + Number(d.overduePaise), 0),
  },
) => ({ items, totals });
export const defaultersPagination = (over: Record<string, unknown> = {}) => ({
  pagination: { page: 1, limit: 50, total: 2, totalPages: 1, ...over },
});
export const defaulterItems = () => [
  defaulterRaw(),
  defaulterRaw({
    unitId: 102,
    unitLabel: 'B-0402',
    ownerName: 'Meera Shah',
    billToNames: 'Meera Shah, Ravi Nair',
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

/** `GET /me/invoices/:id`: the 8.12 detail without settledOn, financialYear, allocations or ledger, plus `pdfUrl`. */
export const invoiceDetailRaw = (over: Record<string, unknown> = {}) => ({
  id: 5123,
  invoiceNo: 'INV/2026-27/000201',
  invoiceType: 'REGULAR',
  status: 'PARTIALLY_PAID',
  unit: { id: 312, label: 'C-0801' },
  billTo: { residentId: 77, name: 'Anil Deshmukh', relation: 'OWNER' },
  periodStart: '2026-11-01',
  periodEnd: '2026-11-30',
  periodLabel: 'Nov 2026',
  invoiceDate: '2026-11-01',
  dueDate: '2026-11-10',
  isOverdue: false,
  isDisputed: false,
  gstApplied: true,
  societyGstin: '27AAAAS1234A1Z5',
  thresholdBasePaise: 823000,
  taxableValuePaise: 823000,
  subtotalPaise: 858000,
  cgstPaise: 74070,
  sgstPaise: 74070,
  taxPaise: 148140,
  roundOffPaise: -40,
  totalPaise: 1006100,
  debitedPaise: 0,
  creditedPaise: 0,
  paidPaise: 500000,
  outstandingPaise: 506100,
  previousDuesPaise: 250000,
  lines: [
    {
      id: 90121,
      lineNo: 1,
      lineKind: 'CHARGE',
      headKey: 'MAINTENANCE',
      description: 'Maintenance: 2,150 sq ft × ₹3.20 (Nov 2026)',
      amountPaise: 688000,
      quantity: '2150.0000',
      ratePaise: 320,
      isTaxable: true,
      creditedPaise: 0,
      periodFrom: '2026-11-01',
      periodTo: '2026-11-30',
      prorationDays: null,
      periodDays: null,
      computation: {
        method: 'PER_SQFT',
        formula: 'roundHalfUp(areaMilli × ratePerSqftPaise × months, 1000)',
        inputs: {
          areaSqft: '2150.000',
          areaMilli: '2150000',
          areaBasis: 'CARPET',
          ratePerSqftPaise: 320,
          months: 1,
        },
        text: '2,150 sq ft × ₹3.20 = ₹6,880.00',
        areaBasis: 'CARPET',
        ruleVersionId: 28,
        ruleVersionNo: 3,
        ruleEffectiveFrom: '2026-04-01',
      },
    },
    {
      id: 90122,
      lineNo: 2,
      lineKind: 'CHARGE',
      headKey: 'PARKING',
      description: 'Parking',
      amountPaise: 170000,
      quantity: null,
      ratePaise: 170000,
      isTaxable: false,
      creditedPaise: 0,
      periodFrom: '2026-11-01',
      periodTo: '2026-11-30',
      prorationDays: null,
      periodDays: null,
    },
    {
      id: 90126,
      lineNo: 6,
      lineKind: 'CGST',
      headKey: null,
      description: 'CGST 9% on ₹8,230.00',
      amountPaise: 74070,
    },
  ],
  notes: [],
  pdfStatus: 'READY',
  version: 4,
  pdfUrl: '/me/invoices/5123/pdf-url',
  ...over,
});
