/** Module 12 collections, admin side (spec 7.8, 7.9, 8.21 to 8.23). Money is integer paise. */
export type CollectionKind = 'FESTIVAL' | 'EVENT' | 'REPAIR_CALL' | 'DONATION' | 'OTHER';
export type AmountMode = 'FIXED_PER_UNIT' | 'MIN_PER_UNIT' | 'VOLUNTARY';
export type AudienceType = 'ALL' | 'BUILDINGS' | 'UNITS';
export type PayListVisibility = 'HIDDEN' | 'COUNT_ONLY' | 'FLATS_ONLY' | 'FLATS_AND_AMOUNTS';
export type CollectionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'CLOSED'
  | 'CANCELLED';
export type RequestStatus = 'OPEN' | 'PART_PAID' | 'PAID' | 'WAIVED' | 'CANCELLED';
export type CollectionFilter = 'ALL' | 'LIVE' | 'AWAITING' | 'DRAFTS' | 'CLOSED';

export interface Collection {
  id: number;
  title: string;
  kind: CollectionKind;
  isMandatory: boolean;
  amountMode: AmountMode;
  amountPerUnitPaise: number;
  minAmountPaise: number;
  targetPaise: number;
  collectedPaise: number;
  percent: number;
  contributorCount: number;
  requestCount: number;
  paidCount: number;
  dueDate: string;
  status: CollectionStatus;
  fundId: number | null;
  fundName: string;
  createdByName: string;
  approvedByName: string;
  purpose: string;
  version: number;
}

export interface SpentLine {
  title: string;
  category: string;
  date: string;
  amountPaise: number;
}

export interface CollectionDetail extends Collection {
  audienceType: AudienceType;
  audienceIds: number[];
  includeVacant: boolean;
  payListVisibility: PayListVisibility;
  sendNotice: boolean;
  reminderCount: number;
  lastReminderAt: string | null;
  rejectedReason: string;
  approvalStatus: string;
  /** null when module 13 sends nothing. */
  spentPaise: number | null;
  expenses: SpentLine[];
  timeline: { at: string; event: string; by: string }[];
}

export interface CollectionRequest {
  id: number;
  unitId: number;
  unitLabel: string;
  billToName: string;
  amountPaise: number;
  paidPaise: number;
  status: RequestStatus;
  invoiceId: number | null;
  lastPaidAt: string | null;
  version: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CollectionQuery {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RequestQuery {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

/** Body of POST and PATCH `/collections` (8.21). */
export interface CollectionInput {
  title: string;
  kind: CollectionKind;
  purpose: string;
  amountMode: AmountMode;
  amountPerUnitPaise: number;
  minAmountPaise?: number;
  isMandatory: boolean;
  audienceType: AudienceType;
  audienceIds?: number[];
  includeVacant: boolean;
  dueDate: string;
  fundId: number;
  targetPaise?: number;
  payListVisibility: PayListVisibility;
  sendNotice: boolean;
}

export interface Option {
  id: number;
  label: string;
  count?: number;
}

export interface OfflineContributionInput {
  unitId: number;
  collectionRequestId: number;
  method: 'CASH' | 'CHEQUE' | 'NEFT' | 'IMPS' | 'RTGS' | 'UPI_TO_BANK';
  amountPaise: number;
  paymentDate: string;
  referenceNo?: string;
  cheque?: { bankName: string; chequeNo: string; chequeDate: string };
  payerName?: string;
  notes?: string;
  confirmDuplicate?: boolean;
}
