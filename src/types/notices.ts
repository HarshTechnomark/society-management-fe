/** Module 16 admin notice shapes (spec 8.1 to 8.16). The mappers in `services/noticesMappers.ts` produce these. */
export type NoticeStatus =
  'DRAFT' | 'PENDING_APPROVAL' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'RECALLED' | 'ARCHIVED';
export type NoticeKind = 'STANDARD' | 'UTILITY_SHUTDOWN' | 'SYSTEM';
export type NoticeCategory =
  'GENERAL' | 'MAINTENANCE' | 'FINANCE' | 'GOVERNANCE' | 'FESTIVAL' | 'SAFETY' | 'COMMUNITY';
export type NoticePriority = 'NORMAL' | 'HIGH';
export type AudienceType = 'ALL' | 'BUILDINGS' | 'UNITS' | 'ROLES';
export type AudienceRelation = 'ANY' | 'OWNERS' | 'TENANTS';
export type NoticeChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';
export type ActionType = 'PAY_COLLECTION' | 'PAY_DUES' | 'RSVP' | 'VOTE' | 'LINK';

export interface NoticeAudience {
  type: AudienceType;
  relation: AudienceRelation;
  ids: number[] | null;
  roleKeys: string[] | null;
  label: string;
}

export interface NoticeAction {
  type: ActionType;
  refId: number | null;
  url: string | null;
  label: string;
  target: { title: string; status: string } | null;
}

export interface NoticeAttachment {
  fileId: number;
  name: string;
  sizeBytes: number;
  status: string;
}

export interface NoticeListItem {
  id: number;
  number: string;
  kind: NoticeKind;
  category: NoticeCategory;
  priority: NoticePriority;
  title: string;
  excerpt: string;
  status: NoticeStatus;
  isPinned: boolean;
  requiresAck: boolean;
  audienceLabel: string;
  actions: NoticeAction[];
  publishedAt: string | null;
  scheduledAt: string | null;
  recipientCount: number;
  readCount: number;
  ackCount: number;
  author: { id: number; name: string } | null;
  version: number;
}

export interface NoticeList {
  items: NoticeListItem[];
  total: number;
  totalPages: number;
}

export interface Notice {
  id: number;
  number: string;
  kind: NoticeKind;
  category: NoticeCategory;
  priority: NoticePriority;
  title: string;
  body: string;
  locale: string;
  status: NoticeStatus;
  audience: NoticeAudience;
  channels: NoticeChannel[];
  actions: NoticeAction[];
  requiresAck: boolean;
  ackDueAt: string | null;
  isPinned: boolean;
  scheduledAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  attachments: NoticeAttachment[];
  approval: { requestId: number; status: string; statusLabel: string } | null;
  approvedBy: string | null;
  lastDecisionReason: string | null;
  recalledReason: string | null;
  utility: { type: string; startsAt: string | null; endsAt: string | null; restoredAt: string | null } | null;
  revisionNo: number;
  version: number;
  author: { id: number; name: string } | null;
  createdAt: string;
}

export interface NoticeListQuery {
  status?: string;
  category?: string;
  kind?: string;
  pinned?: boolean;
  q?: string;
  createdBy?: number;
  from?: string;
  to?: string;
  sortBy?: 'publishedAt' | 'createdAt' | 'title' | 'readPct' | 'ackPct';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AudienceInput {
  type: AudienceType;
  relation?: AudienceRelation;
  ids?: number[];
  roleKeys?: string[];
}
export interface ActionInput {
  type: ActionType;
  refId?: number;
  url?: string;
  label?: string;
}

/** Body of POST /notices and PATCH /notices/:id (patch adds `version` and, after publish, `editNote`). */
export interface NoticeInput {
  kind?: NoticeKind;
  title?: string;
  body?: string;
  category?: NoticeCategory;
  priority?: NoticePriority;
  locale?: string;
  audience?: AudienceInput;
  channels?: NoticeChannel[];
  actions?: ActionInput[];
  requiresAck?: boolean;
  ackDueAt?: string | null;
  isPinned?: boolean;
  expiresAt?: string | null;
  utilityType?: string;
  outageStartsAt?: string;
  outageEndsAt?: string;
  fileIds?: number[];
  version?: number;
  editNote?: string;
}

export interface AudiencePreview {
  units: number;
  people: number;
  withLogin: number;
  withoutLogin: number;
  withPush: number;
  sample: { unitId: number; unitLabel: string }[];
}

export interface NoticeTemplate {
  key: string;
  locale: string;
  title: string;
  body: string;
  category: NoticeCategory;
  kind: NoticeKind;
  utilityType: string | null;
}

export type ReceiptFilter = 'ALL' | 'NOT_READ' | 'NOT_ACKED' | 'ACKED' | 'UNREACHED';
export interface ReceiptQuery {
  filter?: ReceiptFilter;
  buildingId?: number;
  q?: string;
  sortBy?: 'unitLabel' | 'firstReadAt' | 'acknowledgedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ReceiptSummary {
  recipients: number;
  units: number;
  reached: number;
  read: number;
  acknowledged: number;
  unitsAcknowledged: number;
  byBuilding: { buildingId: number; code: string; units: number; unitsRead: number }[];
  byChannel: Record<string, number>;
}
export interface ReceiptItem {
  receiptId: number;
  unitId: number | null;
  unitLabel: string;
  name: string;
  relation: string;
  mobile: string;
  reachedVia: string | null;
  firstReadAt: string | null;
  acknowledgedAt: string | null;
  remindersSent: number;
}
export interface Receipts {
  summary: ReceiptSummary;
  items: ReceiptItem[];
  total: number;
  totalPages: number;
}
