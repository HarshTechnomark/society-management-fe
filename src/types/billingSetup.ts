/** Module 11.1 types: charge heads, billing rules and versions, bill split rules, late fee policies (spec section 7 and 8). */

export type HeadType =
  | 'MAINTENANCE'
  | 'SINKING_FUND'
  | 'REPAIR_FUND'
  | 'PARKING'
  | 'WATER'
  | 'ELECTRICITY'
  | 'NON_OCCUPANCY'
  | 'FESTIVAL'
  | 'COLLECTION'
  | 'BOUNCE_CHARGE'
  | 'MEMBERSHIP'
  | 'DEPOSIT'
  | 'AMENITY'
  | 'FINE'
  | 'SERVICE'
  | 'TRANSFER'
  | 'INTEREST'
  | 'LATE_FEE'
  | 'OPENING_ARREARS'
  | 'OTHER';
export type PayerRouting = 'OWNER' | 'BILL_TO';
export type GstTreatment = 'NONE' | 'THRESHOLD' | 'ALWAYS' | 'FOLLOW_SOURCE';
export type RecordStatus = 'ACTIVE' | 'ARCHIVED';

export interface ChargeHead {
  id: number;
  key: string;
  name: string;
  description: string | null;
  headType: HeadType;
  payerRouting: PayerRouting;
  gstTreatment: GstTreatment;
  sacCode: string | null;
  prorate: boolean;
  interestBearing: boolean;
  ledgerAccountCode: string;
  fundId: number | null;
  isSystem: boolean;
  status: RecordStatus;
  sortOrder: number;
  version: number;
}

export interface ChargeHeadInput {
  key?: string;
  name: string;
  description?: string;
  headType?: HeadType;
  payerRouting: PayerRouting;
  gstTreatment: GstTreatment;
  sacCode?: string | null;
  prorate: boolean;
  interestBearing: boolean;
  ledgerAccountCode: string;
  sortOrder?: number;
}

export type ScopeType = 'ALL_UNITS' | 'BUILDINGS' | 'UNIT_TYPES' | 'UNITS';
export type RateType =
  'FLAT_PER_UNIT' | 'PER_SQFT' | 'PER_UNIT_TYPE' | 'METERED' | 'SPLIT_TOTAL' | 'PERCENT_OF_HEADS' | 'NONE';
export type VersionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type ScopeValue = string | number;
export type CycleKey = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';

export interface RuleVersion {
  id: number;
  billingRuleId: number;
  versionNo: number;
  rateType: RateType;
  amountPaise: number | null;
  ratePerSqftPaise: number | null;
  unitTypeRates: Record<string, number> | null;
  meterType: string | null;
  slabs: { uptoMilli: number | null; ratePaise: number }[] | null;
  minimumChargePaise: number | null;
  missingReadingPolicy: string | null;
  billSplitRuleId: number | null;
  /** A decimal text such as "7.5000". */
  percent: string | null;
  baseChargeHeadIds: number[] | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: VersionStatus;
  reason: string;
  resolutionRef: string | null;
  approvalRequestId: number | null;
  approvedAt: string | null;
  rejectedReason: string | null;
}

export interface BillingRule {
  id: number;
  chargeHeadId: number;
  chargeHeadKey: string | null;
  chargeHeadName: string | null;
  name: string;
  scopeType: ScopeType;
  scopeValues: ScopeValue[];
  status: RecordStatus;
  sortOrder: number;
  version: number;
  currentVersion: RuleVersion | null;
  nextVersion: RuleVersion | null;
  pendingVersion: RuleVersion | null;
  /** Only on `GET /billing/rules/:id`. */
  versions: RuleVersion[];
}

/** The fields of a version that belong to the rate type (spec 8.2). */
export interface VersionInput {
  rateType: RateType;
  effectiveFrom: string;
  amountPaise?: number;
  ratePerSqftPaise?: number;
  unitTypeRates?: Record<string, number>;
  billSplitRuleId?: number;
  percent?: string;
  baseChargeHeadIds?: number[];
  reason: string;
  resolutionRef?: string;
}

export interface RuleInput {
  chargeHeadId: number;
  name: string;
  scopeType: ScopeType;
  scopeValues?: ScopeValue[];
  firstVersion: VersionInput;
}

export interface SimulateItem {
  unitId: number;
  unitLabel: string;
  amountPaise: number | null;
  exceptionCode: string | null;
}

export type SplitBasis = 'EQUAL' | 'AREA' | 'UNIT_TYPE_WEIGHT' | 'CUSTOM_WEIGHT';
export type AmountSource = 'FIXED' | 'RUN_INPUT';

export interface SplitRule {
  id: number;
  name: string;
  description: string | null;
  basis: SplitBasis;
  amountSource: AmountSource;
  fixedAmountPaise: number | null;
  scopeType: ScopeType;
  scopeValues: ScopeValue[];
  weights: Record<string, number>;
  status: RecordStatus;
  version: number;
}

export interface SplitRuleInput {
  name: string;
  description?: string;
  basis: SplitBasis;
  amountSource: AmountSource;
  fixedAmountPaise?: number | null;
  scopeType: ScopeType;
  scopeValues?: ScopeValue[];
  weights?: Record<string, number>;
}

export type PolicyType = 'NONE' | 'SIMPLE_INTEREST' | 'FLAT';
export type PolicyStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED';
export type InterestFrom = 'DUE_DATE' | 'GRACE_END';

export interface LateFeePolicy {
  id: number;
  policyType: PolicyType;
  /** A decimal text such as "18.0000". */
  interestRatePct: string | null;
  interestFrom: InterestFrom | null;
  flatFeePaise: number | null;
  graceDays: number;
  minChargePaise: number;
  effectiveFrom: string;
  status: PolicyStatus;
  reason: string;
  resolutionRef: string | null;
  approvalRequestId: number | null;
  approvedAt: string | null;
  rejectedReason: string | null;
}

export interface LateFeeInput {
  policyType: PolicyType;
  interestRatePct?: string;
  interestFrom?: InterestFrom;
  flatFeePaise?: number;
  graceDays: number;
  minChargePaise?: number;
  effectiveFrom: string;
  reason: string;
  resolutionRef?: string;
}

export interface ChargeHeadQuery {
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  headType?: HeadType;
  q?: string;
}
