/** Raw shapes as the module 12 admin routes send them (spec 8.1, 8.10 to 8.13). */
export const PAY_PERMS = [
  'settings.society.view',
  'finance.payments.view',
  'finance.payments.create',
  'finance.payments.edit',
  'finance.payments.export',
  'finance.payments.approve',
];
export const PAY_VIEW_PERMS = ['settings.society.view', 'finance.payments.view'];
export const PAY_FEATURES = [
  'payments.cash_and_bank_transfer_entry',
  'payments.cheque_lifecycle',
  'payments.receipts',
  'payments.refunds_and_reversals',
  'payments.allocation_engine',
  'payments.instant_payment_to_society_balance',
  'payments.collection_efficiency_analytics',
];

export const paymentRaw = (over: Record<string, unknown> = {}) => ({
  id: 7781,
  unitId: 51,
  unitLabel: 'A-1203',
  payerName: 'Rohan Sharma',
  source: 'ONLINE',
  method: 'UPI',
  status: 'CAPTURED',
  amountPaise: 910900,
  convenienceFeePaise: 0,
  convenienceFeeGstPaise: 0,
  grossAmountPaise: 910900,
  toInvoicesPaise: 800900,
  toCollectionsPaise: 110000,
  toAdvancePaise: 0,
  refundedPaise: 0,
  paymentDate: '2026-11-20',
  capturedAt: '2026-11-20T05:41:12.000Z',
  receiptNo: 'RCT/2026-27/000046',
  receiptStatus: 'ISSUED',
  referenceNo: null,
  needsReview: false,
  isDuplicateSuspect: false,
  version: 2,
  ...over,
});

export const chequeRaw = (over: Record<string, unknown> = {}) =>
  paymentRaw({
    id: 7790,
    source: 'OFFLINE',
    method: 'CHEQUE',
    status: 'RECEIVED',
    unitLabel: 'B-402',
    payerName: 'Meera Iyer',
    amountPaise: 680900,
    toInvoicesPaise: 680900,
    toCollectionsPaise: 0,
    receiptNo: 'RCT/2026-27/000047',
    referenceNo: '123456',
    ...over,
  });

export const detailRaw = (over: Record<string, unknown> = {}) => ({
  ...paymentRaw(),
  allocations: [
    {
      id: 1,
      source: 'PAYMENT',
      targetType: 'INVOICE',
      invoiceId: 900,
      invoiceNo: 'INV/2026-27/0900',
      collectionRequestId: null,
      collectionTitle: null,
      amountPaise: 800900,
      reasonCode: null,
      reversalOfId: null,
      allocatedOn: '2026-11-20',
    },
    {
      id: 2,
      source: 'PAYMENT',
      targetType: 'COLLECTION_REQUEST',
      invoiceId: null,
      invoiceNo: null,
      collectionRequestId: 33,
      collectionTitle: 'Diwali',
      amountPaise: 110000,
      reasonCode: null,
      reversalOfId: null,
      allocatedOn: '2026-11-20',
    },
  ],
  cheque: null,
  refunds: [],
  proofFiles: [],
  approval: null,
  timeline: [{ at: '2026-11-20T05:41:12.000Z', event: 'Payment received', by: 'Gateway' }],
  receiptRevision: 1,
  notes: 'Paid at the gate',
  recordedBy: null,
  ...over,
});

export const chequeBlock = {
  bankName: 'HDFC Bank',
  chequeNo: '123456',
  chequeDate: '2026-11-18',
  depositedOn: null as string | null,
  depositBankAccountId: null,
  clearedOn: null,
  bouncedOn: null,
  bounceReason: null,
  bounceChargeInvoiceId: null,
};

export const chequeDetailRaw = (over: Record<string, unknown> = {}) =>
  detailRaw({
    ...chequeRaw(),
    allocations: [],
    cheque: chequeBlock,
    recordedBy: 'Asha Kulkarni',
    ...over,
  });

export const summaryRaw = (over: Record<string, unknown> = {}) => ({
  today: { collectedPaise: 2172700, count: 4 },
  month: {
    collectedPaise: 41850000,
    count: 61,
    byMethod: { UPI: 30210000, CASH: 4100000, CHEQUE: 5040000, NEFT: 2500000 },
  },
  efficiency: { billedPaise: 49024800, collectedAgainstBilledPaise: 41850000, percent: 85 },
  pendingApprovalCount: 2,
  chequesInClearing: { count: 2, amountPaise: 1361800 },
  needsReviewCount: 1,
  generatedAt: '2026-11-20T06:00:00.000Z',
  ...over,
});

export const liveItemRaw = (over: Record<string, unknown> = {}) => ({
  id: 7800,
  unitLabel: 'A-1203',
  amountPaise: 680900,
  method: 'UPI',
  what: 'maintenance',
  receiptNo: 'RCT/2026-27/000050',
  at: '2026-11-20T05:41:12.000Z',
  ...over,
});

export const pagination = (over: object = {}) => ({
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1, ...over },
});
