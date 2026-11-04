/** Screen shapes of the billing run screens (module 11, sub-module 11.3). Built by `services/billingRunsMappers.ts`. */

export type RunStatus =
  | 'DRAFT'
  | 'COMPUTING'
  | 'PREVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ISSUING'
  | 'ISSUED'
  | 'CANCELLED'
  | 'FAILED';
export type RunType = 'REGULAR' | 'SUPPLEMENTARY';
export type RunCycle = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';
export type ScopeType = 'ALL_UNITS' | 'BUILDINGS' | 'UNITS';
export type ItemStatus = 'READY' | 'EXCEPTION' | 'EXCLUDED' | 'ISSUED';
export type ExceptionCode =
  'MISSING_AREA' | 'MISSING_UNIT_TYPE_RATE' | 'MISSING_READING' | 'NO_BILL_TO' | 'ALREADY_BILLED';
export type WarningCode = 'LARGE_VARIANCE' | 'ESTIMATED_READING' | 'MINIMUM_CHARGE_APPLIED' | 'PRORATED';

export interface RunCounts {
  items: number;
  ready: number;
  exceptions: number;
  excluded: number;
  warnings: number;
  skipped: number;
  issued: number;
}

export interface HeadTotal {
  headKey: string;
  name: string;
  amountPaise: number;
}

export interface SplitInput {
  billSplitRuleId: number;
  amountPaise: number;
}

export interface Run {
  id: number;
  runLabel: string;
  runType: RunType;
  status: RunStatus;
  cycle: RunCycle;
  periodStart: string;
  periodEnd: string;
  billDate: string;
  scopeType: ScopeType;
  scopeValues: number[];
  counts: RunCounts;
  subtotalPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  previousRunTotalPaise: number | null;
  /** Percent change against the last issued regular run, as a number (1.1613 means 1.1613 %). */
  changePct: number | null;
  byHead: HeadTotal[];
  computedAt: string | null;
  isStale: boolean;
  /** Hash of the preview, sent back to publish (only while the run is in PREVIEW). */
  previewHash: string | null;
  approvalRequestId: number | null;
  computeError: string | null;
  lastError: string | null;
  cancelReason: string | null;
  notes: string | null;
  splitInputs: SplitInput[];
  createdAt: string | null;
  publishedAt: string | null;
  approvedAt: string | null;
  issuedAt: string | null;
  version: number;
}

export interface RunLine {
  headKey: string;
  description: string;
  amountPaise: number;
  prorationDays: number | null;
  periodDays: number | null;
}

export interface RunItem {
  id: number;
  unitId: number;
  unitLabel: string;
  billToName: string | null;
  billToRelation: 'OWNER' | 'CO_OWNER' | 'TENANT' | null;
  status: ItemStatus;
  exceptionCode: ExceptionCode | string | null;
  exceptionMessage: string | null;
  warningCodes: (WarningCode | string)[];
  lines: RunLine[];
  subtotalPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  previousTotalPaise: number | null;
  variancePct: number | null;
  excludedReason: string | null;
  invoiceId: number | null;
  version: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RunQuery {
  status?: string;
  runType?: string;
  periodFrom?: string;
  periodTo?: string;
  sortBy?: 'periodStart' | 'createdAt' | 'totalPaise';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ItemQuery {
  status?: string;
  exceptionCode?: string;
  warningCode?: string;
  q?: string;
  sortBy?: 'unitLabel' | 'totalPaise' | 'variancePct';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateRunInput {
  runType: RunType;
  periodStart: string;
  scopeType?: ScopeType;
  scopeValues?: number[];
  splitInputs?: SplitInput[];
  notes?: string;
}

/** One approved rate shown read-only in step 1. */
export interface RateRow {
  ruleId: number;
  headName: string;
  scopeText: string;
  rateText: string;
  pendingText: string | null;
}

/** A split rule that needs an amount for every run (`amountSource = RUN_INPUT`). */
export interface SplitRuleInput {
  id: number;
  name: string;
  description: string;
}
