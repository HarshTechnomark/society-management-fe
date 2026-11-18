/** Module 15 resident and field types (spec 8.10, 8.11, 8.22 to 8.28). */
export type TicketKind = 'PERSONAL' | 'BUILDING';
export type TabKey = 'OPEN' | 'CLOSED';
export type Urgency = 'NORMAL' | 'URGENT' | 'EMERGENCY';

export interface TicketCategory {
  id: number;
  name: string;
  icon: string | null;
  isChargeable: boolean;
  requiresAfterPhoto: boolean;
  linksInvoice: boolean;
  children: TicketCategory[];
}

export interface TicketComment {
  id: number;
  kind: string;
  authorLabel: string;
  authorRole: string;
  body: string;
  fromStatus: string | null;
  toStatus: string | null;
  fileIds: number[];
  createdAt: string;
}

export interface TicketCharge {
  status: string;
  estimatePaise: number;
  estimateNote: string | null;
}

/** One ticket for the resident: list rows and detail share the shape; detail adds comments, files and actions. */
export interface ResidentTicket {
  id: number;
  ticketNo: string;
  kind: TicketKind;
  title: string;
  description: string;
  status: string;
  waitingReason: string | null;
  priority: string;
  categoryName: string;
  locationLabel: string | null;
  unitLabel: string | null;
  affectedLevel: string | null;
  affectedUnitCount: number;
  upvoteCount: number;
  iUpvoted: boolean;
  myRelation: string | null;
  reporterLabel: string | null;
  assigneeLabel: string | null;
  slaState: string | null;
  resolutionDueAt: string | null;
  fileIds: number[];
  comments: TicketComment[];
  allowedActions: string[];
  /** From the API when sent: false hides the estimate buttons / the rating (absent: use allowedActions). */
  canDecideEstimate?: boolean | null;
  canRate?: boolean | null;
  charge: TicketCharge | null;
  myRating: number | null;
  version: number;
  createdAt: string;
  lastActivityAt: string | null;
  resolvedAt: string | null;
  escalationRequestedAt: string | null;
}

export interface TicketList {
  items: ResidentTicket[];
  total: number;
  page: number;
  pages: number;
}

export interface MyTicketQuery {
  tab?: TabKey | 'ALL';
  kind?: TicketKind;
  unitId?: number;
  page?: number;
  limit?: number;
}

export interface BuildingIssueRow {
  id: number;
  ticketNo: string;
  title: string;
  status: string;
  priority: string;
  locationLabel: string | null;
  affectedLevel: string | null;
  affectedUnitCount: number;
  upvoteCount: number;
  iUpvoted: boolean;
  isRequester: boolean;
  assigneeLabel: string | null;
  slaState: string | null;
  resolutionDueAt: string | null;
  createdAt: string;
}

export interface BuildingIssueQuery {
  scope?: 'NEAR_ME' | 'ALL';
  status?: 'OPEN' | 'RESOLVED';
  buildingId?: number;
  page?: number;
  limit?: number;
}

export interface QrLocation {
  location: { id: number; pathLabel: string; nodeType: string; areaType: string | null };
  suggestedAffectedLevel: string | null;
  suggestedCategoryIds: number[];
  openIssuesHere: BuildingIssueRow[];
}

export interface TransparencyMonth {
  month: string;
  buildingIssuesRaised: number;
  resolved: number;
  medianResolutionHours: number | null;
  resolutionMetPct: number | null;
}

export interface PersonalComplaintInput {
  unitId: number;
  categoryId: number;
  subCategoryId?: number;
  title: string;
  description: string;
  urgency?: 'NORMAL' | 'URGENT';
  fileIds?: number[];
}

export interface BuildingIssueInput {
  locationNodeId: number;
  qrToken?: string;
  affectedLevel?: string;
  categoryId: number;
  subCategoryId?: number;
  urgency: Urgency;
  title?: string;
  description?: string;
  duplicateReason?: string;
  fileIds?: number[];
}

export interface SimilarQuery {
  locationNodeId: number;
  categoryId: number;
  q?: string;
}

export type Audience = 'me' | 'gate' | 'work';

export interface IssueReported {
  id: number;
  ticketNo: string;
  status: string;
  priority: string;
  affectedUnitCount: number;
  message: string;
}

export interface UpvoteResult {
  ticketId: number;
  upvoteCount: number;
  iUpvoted: boolean;
}
