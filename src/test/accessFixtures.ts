import type { Invitation, MemberRow, RoleDetail, RoleSummary } from '@/types/accessControl';

export const roleSummary = (over: Partial<RoleSummary> = {}): RoleSummary => ({
  id: 403,
  key: 'treasurer',
  name: 'Treasurer',
  description: null,
  scope: 'society',
  isSystem: true,
  isLocked: false,
  memberCount: 1,
  pendingInvitationCount: 0,
  permissionCount: 3,
  requiresMfa: true,
  version: 1,
  updatedAt: '2026-10-28T06:12:44.120Z',
  ...over,
});

export const roleDetail = (over: Partial<RoleDetail> = {}): RoleDetail => ({
  ...roleSummary(),
  permissionKeys: ['finance.payments.create', 'finance.accounts.view', 'residents.people.view'],
  basedOnRoleId: null,
  ...over,
});

export const member = (over: Partial<MemberRow> = {}): MemberRow => ({
  id: 1201,
  userId: 55,
  name: 'Meera Iyer',
  mobile: '98XXXXX222',
  email: 'treasurer@skyheights.in',
  role: { id: 403, key: 'treasurer', name: 'Treasurer', scope: 'society' },
  status: 'ACTIVE',
  locationLabel: 'B-302',
  mfaEnabled: true,
  requiresMfa: true,
  lastLoginAt: '2026-10-30T03:15:00.000Z',
  joinedAt: '2025-04-02T05:00:00.000Z',
  activeGrantCount: 0,
  isSelf: false,
  version: 2,
  ...over,
});

export const invitation = (over: Partial<Invitation> = {}): Invitation => ({
  id: 3301,
  name: 'Asha Verma',
  mobile: '98XXXXX901',
  email: 'asha@mail.in',
  role: { id: 405, key: 'committee_member', name: 'Committee Member' },
  status: 'PENDING',
  expiresAt: '2026-11-06T09:30:00.000Z',
  resendCount: 0,
  lastSentAt: '2026-10-30T09:30:00.000Z',
  ...over,
});

export const pagination = { page: 1, limit: 100, total: 1, totalPages: 1 };

const entry = (key: string, label: string, held = true, priv = false) => ({
  key,
  action: key.split('.')[2],
  label,
  isPrivileged: priv,
  heldByMe: held,
});

/** A small slice of `GET /permissions`. `finance.expenses.approve` is not held by the caller. */
export const catalogue = {
  scope: 'society',
  masters: [
    {
      master: 'finance',
      subMasters: [
        {
          subMaster: 'expenses',
          label: 'Expenses and cash book',
          moduleNo: 13,
          permissions: [
            entry('finance.expenses.view', 'View expenses and cash book'),
            entry('finance.expenses.create', 'Create expenses and cash book', true, true),
            entry('finance.expenses.approve', 'Approve expenses and cash book', false, true),
          ],
        },
      ],
    },
    {
      master: 'helpdesk',
      subMasters: [
        {
          subMaster: 'tickets',
          label: 'Complaints and building issues',
          moduleNo: 15,
          permissions: [
            entry('helpdesk.tickets.view', 'View complaints and building issues'),
            entry('helpdesk.tickets.edit', 'Edit complaints and building issues'),
          ],
        },
      ],
    },
  ],
};
