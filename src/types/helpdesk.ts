/** Module 15 (helpdesk and building issues), admin side. Shapes follow spec sections 8.1 to 8.21. */

export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_ON_RESIDENT'
  | 'REOPENED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';
export type TicketKind = 'PERSONAL' | 'BUILDING';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'PAUSED' | 'MET' | 'NONE';
export type TicketAction =
  'START' | 'WAIT_ON_RESIDENT' | 'RESUME' | 'RESOLVE' | 'CLOSE' | 'REOPEN' | 'CANCEL';
export type TicketView =
  'OPEN' | 'BUILDING' | 'FLATS' | 'URGENT' | 'RESOLVED' | 'UNASSIGNED' | 'BREACHED' | 'ALL';
export type AssigneeType = 'MEMBER' | 'STAFF' | 'VENDOR' | 'EXTERNAL';
export type AffectedLevel = 'SOCIETY' | 'BUILDING' | 'FLOOR';
export type WaitingReason = 'INFORMATION' | 'ACCESS_TO_FLAT' | 'CONFIRMATION' | 'OTHER';
/** What a ticket can show: the transition choices plus the one the estimate sets. */
export type TicketWaitingReason = WaitingReason | 'ESTIMATE_APPROVAL';

export interface TicketListQuery {
  view?: TicketView;
  status?: string;
  kind?: TicketKind;
  priority?: string;
  categoryId?: number;
  assigneeUserId?: number;
  assigneeType?: AssigneeType;
  unitId?: number;
  buildingId?: number;
  locationNodeId?: number;
  isRecurring?: boolean;
  createdFrom?: string;
  createdTo?: string;
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TicketListItem {
  id: number;
  ticketNo: string;
  kind: TicketKind;
  title: string;
  status: TicketStatus;
  priority: Priority;
  categoryName: string;
  locationLabel: string;
  affectedUnitCount: number;
  upvoteCount: number;
  assigneeLabel: string | null;
  assigneeInactive: boolean;
  slaState: SlaState;
  resolutionDueAt: string | null;
  createdAt: string;
  lastActivityAt: string;
}

export interface TicketCounts {
  OPEN: number;
  BUILDING: number;
  FLATS: number;
  URGENT: number;
  RESOLVED: number;
  ALL: number;
}

export interface TicketList {
  items: TicketListItem[];
  counts: TicketCounts;
  total: number;
  totalPages: number;
}

export interface Named {
  id: number;
  name: string;
}

export interface TicketAssignment {
  id: number;
  assigneeType: AssigneeType;
  assigneeLabel: string;
  externalMobile: string | null;
  workOrderId: number | null;
  assignedAt: string;
}

export interface TicketSla {
  policyId: number | null;
  calendar: string;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  pausedMinutes: number;
  responseBreached: boolean;
  resolutionBreached: boolean;
  escalationLevel: number;
  slaState: SlaState;
}

export interface TicketCharge {
  status: string;
  estimatePaise: number;
  estimateNote: string | null;
  finalPaise: number;
  invoiceId: number | null;
  decidedAt: string | null;
}

export interface TicketComment {
  id: number;
  kind: string;
  visibility: 'PUBLIC' | 'INTERNAL';
  authorRole: string;
  authorLabel: string;
  body: string;
  fromStatus: string | null;
  toStatus: string | null;
  fileIds: number[];
  notifyAffected: boolean;
  createdAt: string;
  canDelete: boolean;
  metadata: Record<string, unknown>;
}

export interface SimilarTicket {
  id: number;
  ticketNo: string;
  title: string;
  status: string;
  priority: Priority;
  locationLabel: string | null;
  upvoteCount: number;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNo: string;
  kind: TicketKind;
  title: string;
  description: string;
  status: TicketStatus;
  waitingReason: TicketWaitingReason | null;
  priority: Priority;
  category: Named | null;
  subCategory: Named | null;
  unit: { id: number; label: string } | null;
  locationLabel: string | null;
  affectedLevel: AffectedLevel | null;
  affectedBuildingName: string | null;
  affectedUnitCount: number;
  channel: string;
  requesterName: string | null;
  reporterRole: string | null;
  assignment: TicketAssignment | null;
  sla: TicketSla;
  upvoteCount: number;
  isRecurring: boolean;
  isChargeable: boolean;
  mergedIntoTicketId: number | null;
  /** The ticket number of the issue it was merged into, when the API says so. */
  mergedIntoTicketNo?: string | null;
  reopenCount: number;
  charge: TicketCharge | null;
  invoiceId: number | null;
  preferredSlot: { from: string; to: string } | null;
  fileIds: number[];
  requiresAfterPhoto: boolean;
  allowedActions: TicketAction[];
  version: number;
  createdAt: string;
  lastActivityAt: string;
  comments: TicketComment[];
  similarOpen: SimilarTicket[];
}

export interface TicketStats {
  open: number;
  openByPriority: Record<Priority, number>;
  urgent: number;
  unassigned: number;
  breachedOpen: number;
  created: number;
  resolved: number;
  responseMetPct: number | null;
  resolutionMetPct: number | null;
  medianFirstResponseMinutes: number | null;
  medianResolutionMinutes: number | null;
  reopenRatePct: number | null;
  csatAvg: number | null;
  csatCount: number;
}

export interface Assignees {
  members: { userId: number; name: string; roleName: string; openCount: number }[];
  staff: { staffId: number; name: string; category: string; openCount: number }[];
  vendors: { vendorId: number; name: string; category: string }[];
}

export interface AssignInput {
  assigneeType: AssigneeType;
  userId?: number;
  staffId?: number;
  vendorId?: number;
  createWorkOrder?: boolean;
  externalName?: string;
  externalMobile?: string;
  note?: string;
  noteInternal?: boolean;
  version: number;
}

export interface TransitionInput {
  action: TicketAction;
  note?: string;
  reason?: string;
  waitingReason?: WaitingReason;
  fileIds?: number[];
  chargeFinalPaise?: number;
  waiveReason?: string;
  version: number;
}

export interface TicketPatch {
  title?: string;
  description?: string;
  categoryId?: number;
  subCategoryId?: number;
  priority?: Priority;
  priorityReason?: string;
  affectedLevel?: AffectedLevel;
  isChargeable?: boolean;
  version: number;
}

export interface PersonalTicketInput {
  unitId: number;
  requesterResidentId?: number;
  channel: 'PHONE' | 'WALK_IN';
  categoryId: number;
  subCategoryId?: number;
  title: string;
  description: string;
  priority?: Priority;
  fileIds?: number[];
}

export interface BuildingIssueInput {
  locationNodeId: number;
  affectedLevel?: AffectedLevel;
  categoryId: number;
  subCategoryId?: number;
  urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  title?: string;
  description?: string;
  duplicateReason?: string;
  fileIds?: number[];
}

export interface CreatedTicket {
  id: number;
  ticketNo: string;
  kind: TicketKind;
  affectedUnitCount: number;
  similarOpenTicketIds: number[];
}

export interface CommentInput {
  body: string;
  visibility?: 'PUBLIC' | 'INTERNAL';
  notifyAffected?: boolean;
  fileIds?: number[];
}

/** Settings > Helpdesk (spec 8.1 to 8.6). */
export type CategoryScope = 'PERSONAL' | 'BUILDING' | 'BOTH';
export type DefaultAssigneeType = 'NONE' | 'INHERIT' | 'ROLE' | 'MEMBER' | 'STAFF' | 'VENDOR';

export interface Category {
  id: number;
  name: string;
  scope: CategoryScope;
  icon: string | null;
  defaultPriority: Priority | null;
  slaPolicyId: number | null;
  defaultAssigneeType: DefaultAssigneeType;
  defaultRoleKey: string | null;
  defaultAssigneeUserId: number | null;
  defaultStaffId: number | null;
  defaultVendorId: number | null;
  isChargeable: boolean;
  requiresAfterPhoto: boolean;
  isSafety: boolean;
  linksInvoice: boolean;
  sortOrder: number;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  children: Category[];
}

export interface CategoryInput {
  parentId?: number;
  name?: string;
  scope?: CategoryScope;
  icon?: string;
  defaultPriority?: Priority | null;
  slaPolicyId?: number | null;
  defaultAssigneeType?: DefaultAssigneeType;
  defaultRoleKey?: string;
  defaultAssigneeUserId?: number;
  defaultStaffId?: number;
  defaultVendorId?: number;
  isChargeable?: boolean;
  requiresAfterPhoto?: boolean;
  isSafety?: boolean;
  linksInvoice?: boolean;
  sortOrder?: number;
}

export type Calendar = 'TWENTY_FOUR_SEVEN' | 'BUSINESS_HOURS';

export interface SlaPolicy {
  id: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  /** Minutes per priority: p1..p4 response and resolution. */
  p1ResponseMinutes: number;
  p1ResolutionMinutes: number;
  p2ResponseMinutes: number;
  p2ResolutionMinutes: number;
  p3ResponseMinutes: number;
  p3ResolutionMinutes: number;
  p4ResponseMinutes: number;
  p4ResolutionMinutes: number;
  p2Calendar: Calendar;
  p3Calendar: Calendar;
  p4Calendar: Calendar;
  version: number;
}

export type SlaPolicyInput = Partial<Omit<SlaPolicy, 'id' | 'status' | 'version'>>;

export type TriggerType = 'RESPONSE_SLA' | 'RESOLUTION_SLA' | 'RESIDENT_REQUEST' | 'LOW_CSAT';
export type TargetType = 'ROLE' | 'DESIGNATION' | 'MEMBER';

export interface EscalationRule {
  id: number;
  name: string;
  triggerType: TriggerType;
  thresholdPercent: number | null;
  level: number;
  categoryId: number | null;
  priority: Priority | null;
  targetType: TargetType;
  targetRoleKey: string | null;
  targetDesignation: string | null;
  targetUserId: number | null;
  targetLabel: string | null;
  categoryName: string | null;
  notifyAssignee: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export interface EscalationInput {
  name?: string;
  triggerType?: TriggerType;
  thresholdPercent?: number | null;
  level?: number;
  categoryId?: number | null;
  priority?: Priority | null;
  targetType?: TargetType;
  targetRoleKey?: string;
  targetDesignation?: string;
  targetUserId?: number;
  notifyAssignee?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface HelpdeskSetting {
  key: string;
  value: number | boolean;
  version: number;
}
export type HelpdeskSettings = Record<string, HelpdeskSetting>;
