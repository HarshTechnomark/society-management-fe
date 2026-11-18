export const rowRaw = (over: Record<string, unknown> = {}) => ({
  id: 5012,
  type: 'EXPENSE',
  typeLabel: 'Expense',
  title: 'Shree Ganesh Lift Services',
  summary: 'Lift AMC · paid from bank',
  amountPaise: 4800000,
  status: 'PENDING',
  currentStepNo: 1,
  totalSteps: 1,
  currentStepName: 'Two of Chairman, Treasurer',
  approvalsNeeded: 2,
  approvalsGiven: 1,
  round: 1,
  requester: { userId: 41, name: 'Meera Iyer' },
  createdAt: '2026-10-29T05:12:00.000Z',
  dueAt: null,
  isOverdue: false,
  stepUpRequired: false,
  bulkEligible: true,
  hasEligibleApprover: true,
  stuckAt: null,
  myAction: { canAct: true, onBehalfOf: null, reason: null },
  version: 3,
  ...over,
});

export const countsRaw = (over: Record<string, unknown> = {}) => ({
  forMe: 3,
  forMeByType: { EXPENSE: 2 },
  overdueForMe: 1,
  allPending: 5,
  submittedOpen: 2,
  stuck: 0,
  ...over,
});

export const typesRaw = () => [
  {
    type: 'EXPENSE',
    label: 'Expense',
    isMoney: true,
    allowBulk: true,
    allowsChanges: true,
    cancellable: true,
  },
  {
    type: 'MOVE_IN',
    label: 'Move-in',
    isMoney: false,
    allowBulk: true,
    allowsChanges: false,
    cancellable: true,
  },
];

export const detailRaw = (over: Record<string, unknown> = {}) => ({
  ...rowRaw(),
  entityType: 'expense',
  entityId: 77,
  ruleName: 'Expenses above ₹25,000',
  steps: [
    {
      stepNo: 1,
      name: 'Two of Chairman, Treasurer',
      mode: 'N_OF',
      requiredCount: 2,
      approvalsGiven: 1,
      approvedBy: ['Sanjay Patil'],
      slots: [
        { type: 'ROLE', ref: 'chairman', label: 'Chairman' },
        { type: 'ROLE', ref: 'treasurer', label: 'Treasurer' },
      ],
      state: 'CURRENT',
    },
  ],
  description: {
    facts: [{ label: 'Payee', value: 'Shree Ganesh Lift Services', kind: 'text' }],
    link: '/admin/money/expenses/77',
  },
  actions: [
    {
      action: 'SUBMITTED',
      actorName: 'Meera Iyer',
      actorRoleKey: 'accountant',
      stepNo: null,
      comment: null,
      at: '2026-10-29T05:12:00.000Z',
    },
    {
      action: 'APPROVED',
      actorName: 'Sanjay Patil',
      actorRoleKey: 'treasurer',
      stepNo: 1,
      comment: 'Matches contract',
      at: '2026-10-29T08:01:00.000Z',
    },
  ],
  stepUpAbovePaise: 2500000,
  myAction: {
    canApprove: true,
    canReject: true,
    canRequestChanges: true,
    canCancel: false,
    onBehalfOptions: [],
    reason: null,
  },
  ...over,
});

export const requestRaw = (over: Record<string, unknown> = {}) => ({
  id: 5101,
  type: 'MOVE_IN',
  typeLabel: 'Move-in',
  title: 'Move-in to A-1203 on 12 Nov',
  status: 'PENDING',
  statusLabel: 'Waiting for Secretary',
  submittedAt: '2026-10-28T10:00:00.000Z',
  decidedAt: null,
  reason: null,
  timeline: [{ label: 'Submitted', at: '2026-10-28T10:00:00.000Z' }],
  canCancel: true,
  version: 1,
  ...over,
});

export const listOf = (rows: unknown[], totalPages = 1) => ({
  data: rows,
  extra: { pagination: { page: 1, limit: 20, total: rows.length, totalPages }, meta: { truncated: false } },
});
