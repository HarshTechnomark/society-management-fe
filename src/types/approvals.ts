/** Module 14 approvals: the inbox, the detail and the resident view (spec 8.1 to 8.19). */
export type ApprovalStatus =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'CANCELLED' | 'EXPIRED';
export type InboxView = 'FOR_ME' | 'ALL_PENDING' | 'DECIDED';
export type ApprovalSort = 'createdAt' | 'amountPaise' | 'dueAt';
/** Why I cannot act (spec 8.1). */
export type NoActReason = 'MAKER_CHECKER' | 'ALREADY_ACTED' | 'NOT_IN_STEP' | 'NO_PERMISSION' | string;

export interface ApprovalRow {
  id: number;
  type: string;
  typeLabel: string;
  title: string;
  summary: string;
  amountPaise: number | null;
  status: ApprovalStatus;
  currentStepNo: number;
  totalSteps: number;
  currentStepName: string | null;
  approvalsNeeded: number;
  approvalsGiven: number;
  requesterName: string;
  requesterId: number | null;
  /** Who decided, when and the note: shown in History when the list sends them. */
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  createdAt: string;
  dueAt: string | null;
  isOverdue: boolean;
  stepUpRequired: boolean;
  bulkEligible: boolean;
  stuck: boolean;
  canAct: boolean;
  onBehalfOfName: string | null;
  reason: string | null;
  version: number;
}

export interface ApprovalList {
  items: ApprovalRow[];
  total: number;
  totalPages: number;
  truncated: boolean;
}

export interface ApprovalListQuery {
  view?: InboxView;
  type?: string;
  status?: string;
  overdue?: boolean;
  /** `all_pending`: every open request of the society (people who may view approval rules). */
  scope?: 'all_pending';
  q?: string;
  sortBy?: ApprovalSort;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ApprovalCounts {
  forMe: number;
  forMeByType: Record<string, number>;
  overdueForMe: number;
  allPending: number;
  submittedOpen: number;
  stuck: number;
}

export interface ApprovalTypeInfo {
  type: string;
  label: string;
  isMoney: boolean;
  allowBulk: boolean;
  allowsChanges: boolean;
  cancellable: boolean;
  residentVisible: boolean;
}

export interface ApprovalAction {
  action: string;
  actorName: string | null;
  onBehalfOfName: string | null;
  actorRoleKey: string | null;
  stepNo: number | null;
  comment: string | null;
  at: string;
}

export interface ApprovalSlot {
  type: string;
  ref: string;
  label: string;
}

export interface ApprovalStep {
  stepNo: number;
  name: string;
  mode: 'ANY_OF' | 'ALL_OF' | 'N_OF' | string;
  requiredCount: number;
  approvalsGiven: number;
  approvedBy: string[];
  slots: ApprovalSlot[];
  state: 'DONE' | 'CURRENT' | 'UPCOMING' | 'STOPPED' | string;
}

export interface ApprovalFact {
  label: string;
  value: string;
  kind: 'text' | 'money' | 'date' | 'unit' | 'file' | string;
}

export interface MyAction {
  canApprove: boolean;
  canReject: boolean;
  canRequestChanges: boolean;
  canCancel: boolean;
  onBehalfOptions: { userId: number; name: string }[];
  reason: string | null;
}

export interface ApprovalDetail {
  id: number;
  type: string;
  typeLabel: string;
  entityType: string;
  entityId: number;
  title: string;
  summary: string;
  amountPaise: number | null;
  status: ApprovalStatus;
  round: number;
  ruleName: string | null;
  /** The person who sent the request (never a valid reassign target). */
  requesterId: number | null;
  steps: ApprovalStep[];
  facts: ApprovalFact[];
  link: string | null;
  actions: ApprovalAction[];
  dueAt: string | null;
  stepUpRequired: boolean;
  stepUpAbovePaise: number | null;
  myAction: MyAction;
  version: number;
}

export interface DecisionResult {
  id: number;
  status: ApprovalStatus;
  stepCompleted: boolean;
  version: number;
  message: string;
}

export interface BulkItemResult {
  id: number;
  ok: boolean;
  status: ApprovalStatus | null;
  code: string | null;
  message: string | null;
}
export interface BulkResult {
  approved: number;
  skipped: number;
  results: BulkItemResult[];
  message: string;
}

export interface ResidentRequest {
  id: number;
  type: string;
  typeLabel: string;
  title: string;
  status: ApprovalStatus;
  statusLabel: string;
  submittedAt: string;
  decidedAt: string | null;
  reason: string | null;
  timeline: { label: string; at: string }[];
  canCancel: boolean;
  version: number;
}
export interface ResidentRequestList {
  items: ResidentRequest[];
  total: number;
  totalPages: number;
}
