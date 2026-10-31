/** Shapes of the module 03 API (spec section 8). */
import type { PermissionAction } from '@/constants/permissions';

export type RoleScope = 'society' | 'resident' | 'gate' | 'work' | 'platform';
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'ENDED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';

export interface CatalogueEntry {
  key: string;
  action: PermissionAction;
  label: string;
  isPrivileged: boolean;
  heldByMe?: boolean;
}
export interface CatalogueSubMaster {
  subMaster: string;
  label: string;
  moduleNo: number;
  permissions: CatalogueEntry[];
}
export interface CatalogueMaster {
  master: string;
  subMasters: CatalogueSubMaster[];
}
export interface Catalogue {
  scope: string;
  masters: CatalogueMaster[];
}

export interface RoleSummary {
  id: number;
  key: string;
  name: string;
  description: string | null;
  scope: RoleScope;
  isSystem: boolean;
  isLocked: boolean;
  memberCount: number;
  pendingInvitationCount: number;
  permissionCount: number;
  requiresMfa: boolean;
  version: number;
  updatedAt: string;
  /** Platform roles list only. */
  userCount?: number;
  permissionKeys?: string[];
}
export interface RoleDetail extends RoleSummary {
  permissionKeys: string[];
  basedOnRoleId: number | null;
}

export interface RoleRef {
  id: number;
  key: string;
  name: string;
  scope?: RoleScope;
}

export interface MemberRow {
  id: number;
  userId: number;
  name: string;
  mobile: string | null;
  email: string | null;
  role: RoleRef;
  status: MemberStatus;
  locationLabel: string | null;
  mfaEnabled: boolean;
  requiresMfa: boolean;
  lastLoginAt: string | null;
  joinedAt: string | null;
  activeGrantCount: number;
  isSelf: boolean;
  version: number;
}

export interface Grant {
  id: number;
  permissionKey: string;
  label: string;
  effect: 'ALLOW' | 'DENY';
  source: 'ADMIN' | 'HOUSEHOLD';
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  isInEffect: boolean;
  startsAt: string;
  endsAt: string | null;
  reason: string | null;
  grantedByName: string | null;
}

export interface MemberDetail extends MemberRow {
  unitLinks: { unitId: number; unitLabel: string; relation: string }[];
  effectivePermissionCount: number;
  grants: Grant[];
  invitation: { id: number; invitedByName: string; respondedAt: string | null } | null;
  suspendReason: string | null;
  suspendedAt: string | null;
  endReason: string | null;
  endedAt: string | null;
}

export interface Invitation {
  id: number;
  name: string;
  mobile: string | null;
  email: string | null;
  role: RoleRef;
  status: InvitationStatus;
  expiresAt: string;
  resendCount: number;
  lastSentAt: string;
  invitedByName?: string;
  respondedAt?: string | null;
  revokeReason?: string | null;
}

export interface InviteInput {
  name: string;
  mobile: string;
  email?: string;
  roleId: number;
  locationLabel?: string;
  message?: string;
}

export interface MemberQuery {
  status?: MemberStatus;
  roleId?: number;
  scope?: string;
  search?: string;
  sortBy?: 'name' | 'joinedAt' | 'lastLoginAt' | 'role';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface GrantInput {
  permissionKey: string;
  startsAt?: string;
  endsAt: string;
  reason: string;
}

export interface InvitationPreview {
  societyName: string;
  societyLogoUrl: string | null;
  roleName: string;
  scope: RoleScope;
  inviterName: string;
  inviteeName: string;
  mobileMasked: string;
  message: string | null;
  status: InvitationStatus;
  expiresAt: string;
  requiresMfa: boolean;
}

export interface AcceptResult {
  societyId: number | null;
  memberId: number | null;
  role: { key: string; name: string; scope: RoleScope };
  requiresMfa: boolean;
  reSignInRequired: boolean;
  redirectTo: string;
}

export interface HouseholdOption {
  permissionKey: string;
  label: string;
  kind: 'ALLOW' | 'DENY';
  enabled: boolean;
}
export interface HouseholdGrants {
  memberId: number;
  name: string;
  unitIds: number[];
  options: HouseholdOption[];
}

export type PlatformTeamItem =
  | {
      kind: 'USER';
      userId: number;
      name: string;
      email: string | null;
      mobile: string | null;
      role: RoleRef;
      status: 'ACTIVE' | 'DISABLED';
      mfaEnabled: boolean;
      lastLoginAt: string | null;
      isSelf: boolean;
    }
  | {
      kind: 'INVITATION';
      invitationId: number;
      name: string;
      email: string | null;
      mobile: string | null;
      role: RoleRef;
      status: 'INVITED';
      expiresAt: string;
      resendCount: number;
    };

export interface PlatformInviteInput {
  name: string;
  mobile: string;
  email: string;
  roleId: number;
}

export interface MembersExport {
  fileId: number;
  downloadUrl: string;
  expiresAt: string;
  rowCount: number;
}

export interface RoleCreateInput {
  name: string;
  description?: string;
  scope: 'society' | 'gate' | 'work';
  basedOnRoleId?: number;
  permissionKeys?: string[];
  requiresMfa?: boolean;
}
export interface RolePatchInput {
  version: number;
  name?: string;
  description?: string | null;
  permissionKeys?: string[];
  requiresMfa?: boolean;
  reason?: string;
}
