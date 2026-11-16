export const PAY_PERMS = [
  'resident.payments.view',
  'resident.payments.create',
  'resident.dues.view',
  'resident.home.view',
];

export const duesRaw = () => ({
  units: [
    {
      unitId: 312,
      unitLabel: 'C-0801',
      relation: 'OWNER',
      outstandingPaise: 800900,
      overduePaise: 800900,
      nextDueDate: '2026-10-10',
      openInvoiceCount: 2,
    },
    {
      unitId: 313,
      unitLabel: 'C-0802',
      relation: 'OWNER',
      outstandingPaise: 0,
      overduePaise: 0,
      nextDueDate: null,
      openInvoiceCount: 0,
    },
  ],
});

export const payablesRaw = (over: Record<string, unknown> = {}) => ({
  unit: { id: 312, label: 'C-0801' },
  items: [
    {
      type: 'COLLECTION_REQUEST',
      id: 2201,
      label: 'Ganesh Utsav 2026 (optional)',
      dueDate: '2026-11-26',
      suggestedPaise: 110000,
      minPaise: 50100,
      maxPaise: 10000000,
      paidPaise: 0,
    },
    {
      type: 'INVOICE',
      id: 123,
      label: 'INV/2026-27/000123 · Oct 2026',
      dueDate: '2026-10-10',
      outstandingPaise: 680900,
      isOverdue: true,
      isDisputed: false,
      minPaise: 100,
      maxPaise: 680900,
    },
    {
      type: 'INVOICE',
      id: 87,
      label: 'INV/2026-27/000087 · Aug 2026',
      dueDate: '2026-08-10',
      outstandingPaise: 120000,
      isOverdue: true,
      isDisputed: false,
      minPaise: 100,
      maxPaise: 120000,
    },
  ],
  totalDuesPaise: 800900,
  advanceBalancePaise: 2500,
  payListVersion: 'a'.repeat(64),
  allowPartial: true,
  allowAdvance: true,
  fee: { mode: 'PASS_TO_PAYER', methods: { UPI: 0, CARD: 180, NETBANKING: 120, WALLET: 190 } },
  gatewayReady: true,
  offlineInstructions: 'Pay by NEFT to Sky Heights CHS, HDFC Bank xxxx4521, IFSC HDFC0001234',
  liveOrder: null,
  ...over,
});

export const fakeOrderRaw = (over: Record<string, unknown> = {}) => ({
  orderId: 4412,
  status: 'CREATED',
  basePaise: 800900,
  convenienceFeePaise: 0,
  convenienceFeeGstPaise: 0,
  grossAmountPaise: 800900,
  expiresAt: '2026-11-20T06:10:00.000Z',
  lines: [
    { label: 'INV/2026-27/000087', amountPaise: 120000 },
    { label: 'INV/2026-27/000123', amountPaise: 680900 },
  ],
  checkout: { order_id: 'order_fake1', amount: 800900, currency: 'INR' },
  ...over,
});

export const paidOrderRaw = (over: Record<string, unknown> = {}) => ({
  orderId: 4412,
  status: 'PAID',
  payment: { id: 7781, receiptNo: 'RCT/2026-27/000046', amountPaise: 800900, paymentDate: '2026-11-20' },
  message: '₹8,009 added to Sky Heights CHS account',
  lines: [
    { label: 'INV/2026-27/000087', amountPaise: 120000 },
    { label: 'INV/2026-27/000123', amountPaise: 680900 },
  ],
  ...over,
});

export const paymentRaw = (over: Record<string, unknown> = {}) => ({
  id: 7781,
  unitId: 312,
  unitLabel: 'C-0801',
  method: 'UPI',
  status: 'CAPTURED',
  amountPaise: 800900,
  convenienceFeePaise: 0,
  grossAmountPaise: 800900,
  toInvoicesPaise: 800900,
  toCollectionsPaise: 0,
  toAdvancePaise: 0,
  paymentDate: '2026-11-20',
  receiptNo: 'RCT/2026-27/000046',
  receiptStatus: 'ISSUED',
  ...over,
});

export const collectionRaw = (over: Record<string, unknown> = {}) => ({
  id: 9,
  title: 'Ganesh Utsav 2026',
  kind: 'EVENT',
  purpose: 'Decoration and prasad',
  isMandatory: false,
  amountMode: 'SUGGESTED',
  amountPerUnitPaise: 110000,
  minAmountPaise: 50100,
  dueDate: '2026-11-26',
  status: 'PUBLISHED',
  targetPaise: 20000000,
  collectedPaise: 5000000,
  percent: 25,
  contributorCount: 12,
  requestCount: 48,
  myRequests: [
    { id: 2201, unitId: 312, unitLabel: 'C-0801', status: 'OPEN', amountPaise: 110000, paidPaise: 0 },
  ],
  ...over,
});

export const mandateRaw = (over: Record<string, unknown> = {}) => ({
  id: 31,
  unitId: 312,
  unitLabel: 'C-0801',
  mandateType: 'UPI_AUTOPAY',
  status: 'ACTIVE',
  maxAmountPaise: 1000000,
  startDate: '2026-12-01',
  endDate: '2027-11-30',
  debitDaysBeforeDue: 2,
  version: 3,
  ...over,
});
