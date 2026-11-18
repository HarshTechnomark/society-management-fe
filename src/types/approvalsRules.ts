/** Module 14 rules, simulator, settings and delegations (spec 8.12 to 8.18). */
export type StepMode = 'ANY_OF' | 'ALL_OF' | 'N_OF';
export type RuleAction = 'REQUIRE_APPROVAL' | 'AUTO_APPROVE';

export interface RuleStep {
  stepNo: number;
  name: string;
  mode: StepMode;
  roleKeys: string[];
  userIds: number[];
  requiredCount: number | null;
}

export interface RuleWarning {
  code: string;
  message: string;
}

export interface ApprovalRule {
  id: number;
  type: string;
  name: string;
  description: string | null;
  priority: number;
  isActive: boolean;
  isDefault: boolean;
  minAmountPaise: number;
  maxAmountPaise: number | null;
  categoryKeys: string[] | null;
  requesterRoleKeys: string[] | null;
  action: RuleAction;
  steps: RuleStep[];
  fallbackRoleKeys: string[];
  slaHours: number;
  reminderEveryHours: number;
  escalateAfterHours: number | null;
  escalationRoleKeys: string[];
  escalationCanApprove: boolean;
  stepUpAbovePaise: number | null;
  openRequests: number;
  version: number;
  updatedAt: string;
  /** Warnings sent with a create, update or delete answer. */
  warnings: RuleWarning[];
}

/** The fields a create or edit sends (PATCH also sends `version`). */
export interface RuleInput {
  type?: string;
  name: string;
  description?: string;
  priority: number;
  isActive: boolean;
  minAmountPaise: number;
  maxAmountPaise: number | null;
  categoryKeys: string[] | null;
  requesterRoleKeys: string[] | null;
  action: RuleAction;
  steps: RuleStep[];
  fallbackRoleKeys: string[];
  slaHours: number;
  reminderEveryHours: number;
  escalateAfterHours: number | null;
  escalationRoleKeys: string[];
  escalationCanApprove: boolean;
  stepUpAbovePaise: number | null;
}

export interface SimulateInput {
  type: string;
  amountPaise?: number;
  categoryKey?: string;
  requesterUserId?: number;
}

export interface SimulatedPerson {
  userId: number;
  name: string;
  roleKey: string;
  via: 'ROLE' | 'USER' | 'FALLBACK' | string;
}

export interface SimulatedStep {
  stepNo: number;
  name: string;
  mode: StepMode;
  eligibleNow: SimulatedPerson[];
  vacantSlots: string[];
}

export interface SimulationResult {
  matchedRuleId: number | null;
  ruleName: string;
  routing: string;
  stepUpRequired: boolean;
  steps: SimulatedStep[];
}

export interface ApprovalSettings {
  stepUpAbovePaise: number;
  bulkApproveBelowPaise: number;
}

export type DelegationDisplayStatus = 'SCHEDULED' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface Delegation {
  id: number;
  delegatorUserId: number;
  delegatorName: string;
  delegateUserId: number;
  delegateName: string;
  source: string;
  types: string[] | null;
  maxAmountPaise: number | null;
  startsAt: string;
  endsAt: string;
  reason: string;
  revokeReason?: string | null;
  displayStatus: DelegationDisplayStatus;
  version: number;
}

export interface DelegationList {
  items: Delegation[];
  total: number;
  totalPages: number;
}

export interface DelegationInput {
  delegatorUserId?: number;
  delegateUserId: number;
  startsAt: string;
  endsAt: string;
  types: string[] | null;
  maxAmountPaise: number | null;
  reason: string;
}
