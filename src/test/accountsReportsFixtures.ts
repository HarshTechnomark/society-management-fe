/** Raw API shapes of module 13 reports and periods (spec 8.18, 8.19). */
export const REPORT_PERMS = ['finance.accounts.view', 'finance.accounts.export'];
export const PERIOD_PERMS = ['finance.accounts.view', 'finance.accounts.create', 'finance.accounts.approve'];
export const ACCOUNT_FEATURES = [
  'accounting.financial_reports',
  'accounting.periods_and_locking',
  'accounting.year_end_closing',
  'accounting.gst_summary',
  'accounting.tds',
];

export const trialBalanceRaw = (over: Record<string, unknown> = {}) => ({
  asOf: '2026-10-31',
  financialYear: '2026-27',
  balanced: true,
  rows: [
    {
      ledgerAccountId: 11,
      code: '1110-001',
      name: 'Bank - HDFC Current',
      debitPaise: 123030900,
      creditPaise: 0,
    },
    { ledgerAccountId: 12, code: '2410', name: 'Sinking fund', debitPaise: 0, creditPaise: 96000000 },
  ],
  totals: { debitPaise: 143270900, creditPaise: 143270900 },
  ...over,
});
export const glRaw = () => ({
  from: '2026-04-01',
  to: '2026-10-31',
  account: { id: 11, code: '1110-001', name: 'Bank - HDFC Current' },
  openingPaise: 100000,
  rows: [
    {
      date: '2026-05-02',
      voucherNo: 'RV/26-27/0007',
      journalId: 77,
      narration: 'Maintenance A-101',
      debitPaise: 250000,
      creditPaise: 0,
      balancePaise: 350000,
    },
  ],
  closingPaise: 350000,
});
export const periodsRaw = (over: Record<string, unknown> = {}) => ({
  booksLockedThrough: '2026-09-30',
  unlock: null,
  lastClosedFinancialYear: '2024-25',
  version: 6,
  years: [
    {
      financialYear: '2025-26',
      start: '2025-04-01',
      end: '2026-03-31',
      status: 'OPEN',
      canClose: true,
      blockers: [],
    },
    {
      financialYear: '2026-27',
      start: '2026-04-01',
      end: '2027-03-31',
      status: 'OPEN',
      canClose: false,
      blockers: ['The year has not ended yet.'],
    },
    {
      financialYear: '2024-25',
      start: '2024-04-01',
      end: '2025-03-31',
      status: 'CLOSED',
      canClose: false,
      blockers: [],
    },
  ],
  ...over,
});
