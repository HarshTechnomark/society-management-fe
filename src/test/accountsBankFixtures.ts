/** Raw API shapes of the settlement and statement routes (module 13 spec 7.9 to 7.11, 8.15, 8.16). */
export const BANK_PERMS = ['finance.bank.view', 'finance.bank.import', 'finance.bank.approve'];
export const BANK_FEATURES = [
  'payments.settlement_reconciliation',
  'payments.bank_statement_import',
  'accounting.bank_reconciliation',
];
export const listOf = (items: unknown[], totalPages = 1) => ({
  data: items,
  message: 'OK',
  extra: { pagination: { page: 1, limit: 20, total: items.length, totalPages } },
});
export const settlementRaw = (over: Record<string, unknown> = {}) => ({
  id: 5,
  gatewayProvider: 'RAZORPAY',
  gatewaySettlementId: 'setl_001',
  settlementDate: '2026-11-05',
  utr: 'UTR1234567890',
  grossPaise: 1361800,
  refundsPaise: 0,
  feePaise: 3530,
  feeGstPaise: 635,
  adjustmentPaise: 0,
  netPaise: 1357635,
  paymentCount: 2,
  status: 'MISMATCH',
  version: 2,
  items: [
    {
      type: 'payment',
      gatewayPaymentId: 'pay_1',
      amountPaise: 1000000,
      feePaise: 2000,
      taxPaise: 360,
      matchedPaymentId: 7,
      receiptNo: 'RCT/1',
    },
    { type: 'payment', gatewayPaymentId: 'pay_2', amountPaise: 361800, feePaise: 1530, taxPaise: 275 },
  ],
  unmatchedItems: [
    {
      type: 'payment',
      gatewayPaymentId: 'pay_2',
      amountPaise: 361800,
      feePaise: 1530,
      taxPaise: 275,
      reason: 'Payment not found',
    },
  ],
  ...over,
});
export const importRaw = (over: Record<string, unknown> = {}) => ({
  id: 9,
  bankAccountId: 3,
  bankAccountLabel: 'HDFC XXXXXX4821',
  fileFormat: 'CSV',
  periodFrom: '2026-11-01',
  periodTo: '2026-11-30',
  openingBalancePaise: 10000000,
  closingBalancePaise: 11000000,
  lineCount: 142,
  duplicateCount: 0,
  creditTotalPaise: 2000000,
  debitTotalPaise: 1000000,
  matchedCount: 118,
  status: 'PARSED',
  errorMessage: null,
  createdAt: '2026-11-30T05:00:00.000Z',
  version: 4,
  ...over,
});
export const lineRaw = (over: Record<string, unknown> = {}) => ({
  id: 101,
  importId: 9,
  lineNo: 1,
  txnDate: '2026-11-03',
  description: 'NEFT from Rohan Sharma A-1203',
  reference: 'SBIN526123456789',
  creditPaise: 1250000,
  debitPaise: 0,
  matchStatus: 'UNMATCHED',
  version: 1,
  ...over,
});
export const candidateRaw = (over: Record<string, unknown> = {}) => ({
  journalLineId: 700,
  entryDate: '2026-11-03',
  voucherNo: 'RCT/26-27/0007',
  narration: 'Maintenance A-1203',
  amountPaise: 1250000,
  score: 100,
  ...over,
});
