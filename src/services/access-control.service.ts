/** Every module 03 network call (spec section 8). Screens import from here and never call `fetch` themselves. */
import { api, apiList, type Pagination } from '@/lib/apiClient';
import type {
  AcceptResult,
  Catalogue,
  Grant,
  GrantInput,
  HouseholdGrants,
  Invitation,
  InvitationPreview,
  InviteInput,
  MemberDetail,
  MemberQuery,
  MemberRow,
  MembersExport,
  PlatformInviteInput,
  PlatformTeamItem,
  RoleCreateInput,
  RoleDetail,
  RolePatchInput,
  RoleSummary,
} from '@/types/accessControl';

type List<T> = Promise<{ data: T[]; pagination: Pagination }>;
const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });

export const accessControlService = {
  // catalogue and roles
  catalogue: (scope: 'society' | 'gate' | 'work' | 'resident' = 'society') =>
    api<Catalogue>('/permissions', { query: { scope } }),
  roles: (
    query: { scope?: string; type?: 'system' | 'custom'; search?: string; limit?: number } = {},
  ): List<RoleSummary> => apiList<RoleSummary>('/roles', { query: { limit: 100, ...query } }),
  role: (id: number) => api<RoleDetail>(`/roles/${id}`),
  createRole: (body: RoleCreateInput) =>
    api<RoleDetail>('/roles', { method: 'POST', body, idempotent: true }),
  updateRole: (id: number, body: RolePatchInput) =>
    api<RoleDetail>(`/roles/${id}`, { method: 'PATCH', body }),
  resetRole: (id: number, body: { version: number; reason: string }) =>
    post<RoleDetail>(`/roles/${id}/reset`, body),
  deleteRole: (id: number, body: { version: number; reason: string }) =>
    api<null>(`/roles/${id}`, { method: 'DELETE', body }),

  // members
  members: (query: MemberQuery = {}): List<MemberRow> =>
    apiList<MemberRow>('/members', { query: { ...query } }),
  member: (id: number) => api<MemberDetail>(`/members/${id}`),
  exportMembers: (query: MemberQuery = {}) => api<MembersExport>('/members/export', { query: { ...query } }),
  invite: (body: InviteInput) =>
    api<Invitation>('/members/invite', { method: 'POST', body, idempotent: true }),
  changeRole: (
    id: number,
    body: { version: number; roleId?: number; locationLabel?: string | null; reason?: string },
  ) => api<MemberDetail>(`/members/${id}`, { method: 'PATCH', body }),
  suspend: (id: number, body: { version: number; reason: string }) =>
    post<null>(`/members/${id}/suspend`, body),
  reactivate: (id: number, body: { version: number; reason: string }) =>
    post<null>(`/members/${id}/reactivate`, body),
  endMembership: (id: number, body: { version: number; reason: string }) =>
    api<null>(`/members/${id}`, { method: 'DELETE', body }),
  resetMfa: (id: number, reason: string) => post<null>(`/members/${id}/reset-mfa`, { reason }),
  revokeSessions: (id: number, reason: string) =>
    post<{ revokedCount: number }>(`/members/${id}/revoke-sessions`, { reason }),

  // grants (admin)
  grants: (memberId: number, status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ALL' = 'ALL') =>
    api<Grant[]>(`/members/${memberId}/grants`, { query: { status } }),
  addGrant: (memberId: number, body: GrantInput) =>
    api<Grant>(`/members/${memberId}/grants`, { method: 'POST', body, idempotent: true }),
  revokeGrant: (memberId: number, grantId: number, reason: string) =>
    api<null>(`/members/${memberId}/grants/${grantId}`, { method: 'DELETE', body: { reason } }),

  // invitations
  invitations: (query: { status?: string; limit?: number } = {}): List<Invitation> =>
    apiList<Invitation>('/invitations', { query: { status: 'PENDING', limit: 100, ...query } }),
  resendInvitation: (id: number) => post<Invitation>(`/invitations/${id}/resend`, {}, true),
  revokeInvitation: (id: number, reason: string) => post<Invitation>(`/invitations/${id}/revoke`, { reason }),
  invitationPreview: (token: string) =>
    api<InvitationPreview>(`/public/invitations/${encodeURIComponent(token)}`, { recover: false }),
  declineInvitation: (token: string, reason?: string) =>
    api<null>(`/public/invitations/${encodeURIComponent(token)}/decline`, {
      method: 'POST',
      body: reason ? { reason } : {},
      recover: false,
    }),
  acceptInvitation: (token: string) =>
    post<AcceptResult>(`/invitations/${encodeURIComponent(token)}/accept`, {}, true),

  // household (resident app)
  household: (memberId: number) => api<HouseholdGrants>(`/me/household/${memberId}/grants`),
  saveHousehold: (memberId: number, body: { unitId: number; allow: string[]; deny: string[] }) =>
    api<HouseholdGrants>(`/me/household/${memberId}/grants`, { method: 'PATCH', body }),

  // platform
  platformCatalogue: () => api<Catalogue>('/platform/permissions'),
  platformRoles: () => api<RoleSummary[]>('/platform/roles'),
  platformTeam: (query: { status?: string; search?: string; limit?: number } = {}): List<PlatformTeamItem> =>
    apiList<PlatformTeamItem>('/platform/team', { query: { limit: 100, ...query } }),
  platformInvite: (body: PlatformInviteInput) =>
    api<Invitation>('/platform/team/invite', { method: 'POST', body, idempotent: true }),
  platformResend: (id: number) => post<Invitation>(`/platform/invitations/${id}/resend`, {}, true),
  platformRevoke: (id: number, reason: string) =>
    post<Invitation>(`/platform/invitations/${id}/revoke`, { reason }),
  platformChangeRole: (userId: number, body: { roleId: number; reason: string }) =>
    api<unknown>(`/platform/team/${userId}`, { method: 'PATCH', body }),
  platformDisable: (userId: number, reason: string) =>
    post<null>(`/platform/team/${userId}/disable`, { reason }),
  platformEnable: (userId: number, reason: string) =>
    post<null>(`/platform/team/${userId}/enable`, { reason }),
  platformResetMfa: (userId: number, reason: string) =>
    post<null>(`/platform/team/${userId}/reset-mfa`, { reason }),
  platformRemove: (userId: number, reason: string) =>
    api<null>(`/platform/team/${userId}`, { method: 'DELETE', body: { reason } }),
};
