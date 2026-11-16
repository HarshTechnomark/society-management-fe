/** Raw API shapes of the module 12 admin operations (spec 7.4, 7.6, 7.7, 8.7, 8.16 to 8.20). */
export const OPS_VIEW = ['finance.payments.view'];
export const OPS_PERMS = ['finance.payments.view', 'finance.payments.create', 'finance.payments.edit'];
export const OPS_FEATURES = [
  'payments.refunds_and_reversals',
  'payments.payment_orders',
  'payments.payment_links',
  'payments.unit_wallet',
];

export const refundRaw = (over: Record<string, unknown> = {}) => ({
  id: 12,
  refundNo: null,
  unitId: 51,
  unitLabel: 'A-1203',
  paymentId: 7781,
  amountPaise: 250000,
  mode: 'BANK_TRANSFER',
  status: 'PROCESSING',
  reason: 'Paid twice by mistake',
  payeeName: 'Rohan Sharma',
  payeeAccountMasked: 'HDFC xxxx4521',
  bankReference: null,
  paidOutOn: null,
  createdAt: '2026-11-20T05:41:12.000Z',
  version: 3,
  ...over,
});
export const orderRaw = (over: Record<string, unknown> = {}) => ({
  id: 4412,
  unitLabel: 'A-1203',
  sourceType: 'PAY_LIST',
  status: 'CREATED',
  grossAmountPaise: 910900,
  expiresAt: '2026-11-21T05:41:12.000Z',
  paidAt: null,
  attemptCount: 1,
  linkShortCode: null,
  createdAt: '2026-11-20T05:41:12.000Z',
  ...over,
});
export const mandateRaw = (over: Record<string, unknown> = {}) => ({
  id: 31,
  unitLabel: 'B-402',
  payerName: 'Meera Shah',
  mandateType: 'UPI_AUTOPAY',
  maxAmountPaise: 500000,
  status: 'ACTIVE',
  lastDebitAt: '2026-11-05T04:00:00.000Z',
  lastDebitStatus: 'SUCCESS',
  payerInstrumentMasked: 'meera@okhdfc',
  version: 2,
  ...over,
});
export const advancesRaw = () => ({
  unitId: 51,
  balancePaise: 120000,
  entries: [
    {
      id: 9,
      entryType: 'PAYMENT_EXCESS',
      amountPaise: 150000,
      balanceAfterPaise: 150000,
      narration: 'Excess of receipt RCT/2026-27/000046',
      createdAt: '2026-11-20T05:41:12.000Z',
    },
    {
      id: 10,
      entryType: 'APPLIED',
      amountPaise: -30000,
      balanceAfterPaise: 120000,
      narration: 'Applied to INV-77',
      createdAt: '2026-11-21T05:41:12.000Z',
    },
  ],
});
export const listOf = (items: unknown[], totalPages = 1) => ({
  data: items,
  message: 'OK',
  extra: { pagination: { page: 1, limit: 20, total: items.length, totalPages } },
});
