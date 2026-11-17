/** Raw API shapes of module 14 rules, settings and delegations (spec 8.12 to 8.18). */
export const ruleRaw = (over: Record<string, unknown> = {}) => ({
  id: 301,
  type: 'EXPENSE',
  name: 'Expenses above ₹25,000',
  description: null,
  priority: 30,
  isActive: true,
  isDefault: true,
  minAmountPaise: 2500001,
  maxAmountPaise: null,
  categoryKeys: null,
  requesterRoleKeys: null,
  action: 'REQUIRE_APPROVAL',
  steps: [
    {
      stepNo: 1,
      name: 'Two of Chairman, Treasurer, Secretary',
      mode: 'N_OF',
      roleKeys: ['chairman', 'treasurer', 'secretary'],
      userIds: [],
      requiredCount: 2,
    },
  ],
  fallbackRoleKeys: ['chairman'],
  slaHours: 48,
  reminderEveryHours: 24,
  escalateAfterHours: 72,
  escalationRoleKeys: ['chairman'],
  escalationCanApprove: false,
  stepUpAbovePaise: null,
  openRequests: 2,
  version: 1,
  updatedAt: '2026-10-01T04:00:00.000Z',
  ...over,
});

export const smallRuleRaw = (over: Record<string, unknown> = {}) =>
  ruleRaw({
    id: 300,
    name: 'Expenses up to ₹25,000',
    priority: 20,
    minAmountPaise: 0,
    maxAmountPaise: 2500000,
    steps: [
      {
        stepNo: 1,
        name: 'Treasurer review',
        mode: 'ANY_OF',
        roleKeys: ['treasurer'],
        userIds: [],
        requiredCount: null,
      },
    ],
    openRequests: 0,
    ...over,
  });

export const delegationRaw = (over: Record<string, unknown> = {}) => ({
  id: 88,
  delegator: { userId: 101, name: 'Rajesh Kulkarni' },
  delegate: { userId: 17, name: 'Priya Nair' },
  source: 'OUT_OF_OFFICE',
  types: null,
  maxAmountPaise: null,
  startsAt: '2026-12-01T00:00:00.000Z',
  endsAt: '2026-12-14T18:30:00.000Z',
  reason: 'On leave',
  displayStatus: 'SCHEDULED',
  version: 1,
  ...over,
});

export const rolesPage = (roles: { key: string; name: string }[]) => ({
  data: roles.map((r, i) => ({ id: i + 1, scope: 'society', ...r })),
  extra: { pagination: { page: 1, limit: 100, total: roles.length, totalPages: 1 } },
});
