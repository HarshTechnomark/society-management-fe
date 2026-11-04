/** Raw shapes as the backend sends them (spec 8.20 and 8.23). */
export const LEDGER_PERMS = [
  'settings.society.view',
  'finance.billing.view',
  'finance.billing.import',
  'finance.billing.export',
];
export const LEDGER_FEATURES = ['billing.opening_balances', 'billing.statement_of_account'];

export const obRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  unitId: 101,
  unitLabelInput: 'A-1203',
  unitLabel: 'A-1203',
  importRowNo: 2,
  asOfDate: '2026-03-31',
  arrearsPrincipalPaise: 1250000,
  arrearsInterestPaise: 35050,
  advancePaise: 0,
  status: 'DRAFT',
  validationError: null,
  invoiceId: null,
  postedAt: null,
  version: 1,
  ...over,
});

export const obTotals = (over: Record<string, unknown> = {}) => ({
  draftArrearsPaise: 1285050,
  draftAdvancePaise: 200000,
  invalidCount: 0,
  postedCount: 0,
  ...over,
});

export const obList = (
  rows: unknown[] = [
    obRow(),
    obRow({
      id: 2,
      unitId: 102,
      unitLabel: 'A-1204',
      unitLabelInput: 'A-1204',
      importRowNo: 3,
      arrearsPrincipalPaise: 0,
      arrearsInterestPaise: 0,
      advancePaise: 200000,
    }),
  ],
  totals = obTotals(),
) => ({
  items: rows,
  totals,
});

export const statement = (over: Record<string, unknown> = {}) => ({
  unit: { id: 101, label: 'A-1203' },
  from: '2026-04-01',
  to: '2026-11-30',
  openingBalancePaise: 0,
  entries: [
    {
      id: 7001,
      entryDate: '2026-11-01',
      entryType: 'INVOICE',
      refType: 'invoice',
      refId: 5101,
      narration: 'Bill INV/2026-27/000150 (Nov 2026)',
      debitPaise: 538000,
      creditPaise: 0,
      balancePaise: 538000,
    },
    {
      id: 7044,
      entryDate: '2026-11-08',
      entryType: 'PAYMENT',
      refType: 'payment',
      refId: 3120,
      narration: 'Receipt RCT/2026-27/000046 (UPI)',
      debitPaise: 0,
      creditPaise: 638000,
      balancePaise: -100000,
    },
  ],
  closingBalancePaise: -100000,
  ...over,
});
