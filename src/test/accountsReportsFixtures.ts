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
  ledgerAccount: { id: 11, code: '1110-001', name: 'Bank - HDFC Current', accountType: 'ASSET' },
  from: '2026-04-01',
  to: '2026-10-31',
  normalSide: 'DEBIT',
  openingPaise: 100000,
  rows: [
    {
      entryId: 77,
      date: '2026-05-02',
      voucherNo: 'RV/26-27/0007',
      narration: 'Maintenance A-101',
      debitPaise: 250000,
      creditPaise: 0,
      runningPaise: 350000,
    },
  ],
  closingPaise: 350000,
  totals: { debitPaise: 250000, creditPaise: 0 },
});
export const ieRaw = () => ({
  from: '2026-04-01',
  to: '2026-10-31',
  rows: [
    {
      ledgerAccountId: 5,
      code: '4100',
      name: 'Maintenance income',
      section: 'INCOME',
      isGroup: false,
      amountPaise: 3225000,
    },
    {
      ledgerAccountId: 6,
      code: '5330',
      name: 'Lift AMC',
      section: 'EXPENDITURE',
      isGroup: false,
      amountPaise: 118000,
    },
  ],
  totals: { incomePaise: 3225000, expenditurePaise: 118000, surplusPaise: 3107000 },
});
export const bsRaw = () => ({
  asOf: '2026-10-31',
  balanced: true,
  rows: [
    {
      ledgerAccountId: 1,
      code: '1120',
      name: 'Cash',
      section: 'ASSETS',
      isGroup: false,
      amountPaise: 500000,
    },
    {
      ledgerAccountId: 2,
      code: '2410',
      name: 'Sinking fund',
      section: 'FUNDS',
      isGroup: false,
      amountPaise: 400000,
    },
    {
      code: null,
      name: 'Surplus (deficit) of the current year',
      section: 'RESERVES',
      isGroup: false,
      amountPaise: 100000,
    },
  ],
  totals: {
    assetsPaise: 500000,
    liabilitiesPaise: 0,
    fundsPaise: 400000,
    reservesPaise: 100000,
    liabilitiesAndFundsPaise: 500000,
  },
});
export const rpRaw = () => ({
  from: '2026-04-01',
  to: '2026-10-31',
  rows: [
    { side: 'RECEIPT', code: '4100', name: 'Maintenance income', amountPaise: 900000 },
    { side: 'PAYMENT', code: '5330', name: 'Lift AMC', amountPaise: 118000 },
  ],
  totals: { openingPaise: 100000, receiptsPaise: 900000, paymentsPaise: 118000, closingPaise: 882000 },
});
export const gstRaw = () => ({
  rows: [
    {
      month: '2026-05',
      outputCgstPaise: 900,
      outputSgstPaise: 900,
      outputIgstPaise: 0,
      outputTotalPaise: 1800,
      inputCreditPaise: 500,
      netPayablePaise: 1300,
    },
  ],
  totals: {
    outputCgstPaise: 900,
    outputSgstPaise: 900,
    outputIgstPaise: 0,
    outputTotalPaise: 1800,
    inputCreditPaise: 500,
    netPayablePaise: 1300,
  },
});
export const tdsRaw = () => ({
  rows: [
    {
      date: '2026-05-04',
      voucherNo: 'PV/1',
      entryId: 41,
      payee: 'Lift Co',
      tdsSection: '194C',
      deductedPaise: 20000,
      depositedPaise: 0,
      challanNo: null,
    },
  ],
  totals: { deductedPaise: 20000, depositedPaise: 0 },
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
