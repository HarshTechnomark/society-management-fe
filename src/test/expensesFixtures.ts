/** Raw shapes as the module 13 expense routes send them (spec 8.4 to 8.8). */
export const EXP_PERMS = [
  'settings.society.view',
  'finance.expenses.view',
  'finance.expenses.create',
  'finance.expenses.edit',
  'finance.expenses.delete',
  'finance.expenses.export',
  'finance.expenses.approve',
];
export const EXP_FEATURES = ['accounting.simple_cash_book'];

export const expenseRaw = (over: Record<string, unknown> = {}) => ({
  id: 412,
  displayId: 'EXP-412',
  status: 'POSTED',
  voucherNo: 'VCH/2026-27/000046',
  expenseType: 'DIRECT',
  expenseDate: '2026-10-30',
  payee: 'Shree Ganesh Gardeners',
  ledgerAccount: { id: 81, code: '5350', name: 'Garden and landscaping' },
  grossAmountPaise: 180000,
  gstPaise: 0,
  tdsPaise: 0,
  netPaidPaise: 180000,
  paidFrom: { id: 12, code: '1120', name: 'Cash in hand' },
  paymentMode: 'CASH',
  fundId: null,
  billFileCount: 0,
  approvalRequestId: null,
  createdBy: { id: 4, name: 'Anita Rao' },
  version: 2,
  ...over,
});

export const detailRaw = (over: Record<string, unknown> = {}) =>
  expenseRaw({
    files: [
      { id: 9, name: 'bill.jpg', mimeType: 'image/jpeg', status: 'LINKED', url: 'https://f.test/bill.jpg' },
    ],
    approval: {
      status: 'APPROVED',
      levels: [{}, {}],
      actions: [{ action: 'APPROVED', by: { name: 'Meera' }, at: '2026-10-31T05:00:00Z' }],
    },
    journal: { voucherNo: 'VCH/1', lines: [{ account: 'Garden', debitPaise: 180000, creditPaise: 0 }] },
    ...over,
  });

export const ledgerTree = [
  {
    id: 1,
    code: '5000',
    name: 'Expenses',
    accountType: 'EXPENSE',
    isGroup: true,
    children: [
      {
        id: 81,
        code: '5350',
        name: 'Garden and landscaping',
        accountType: 'EXPENSE',
        subtype: 'OTHER',
        isGroup: false,
        isActive: true,
        isCashBookCategory: true,
      },
      {
        id: 82,
        code: '5330',
        name: 'Lift AMC',
        accountType: 'EXPENSE',
        subtype: 'OTHER',
        isGroup: false,
        isActive: true,
        isCashBookCategory: false,
      },
    ],
  },
  {
    id: 2,
    code: '1000',
    name: 'Assets',
    accountType: 'ASSET',
    isGroup: true,
    children: [
      {
        id: 12,
        code: '1120',
        name: 'Cash in hand',
        accountType: 'ASSET',
        subtype: 'CASH',
        isGroup: false,
        isActive: true,
        balancePaise: 500000,
      },
      {
        id: 13,
        code: '1110-001',
        name: 'HDFC Current',
        accountType: 'ASSET',
        subtype: 'BANK',
        isGroup: false,
        isActive: true,
        balancePaise: 9000000,
      },
    ],
  },
];
