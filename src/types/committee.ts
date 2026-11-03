/** Module 10 (Committee and staff accounts) types, as the screens use them (spec sections 7.2 and 8). */

export const DESIGNATIONS = [
  'CHAIRMAN',
  'VICE_CHAIRMAN',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
  'MEMBER',
] as const;
export type Designation = (typeof DESIGNATIONS)[number];

export const PORTFOLIOS = [
  'ACCOUNTS',
  'MAINTENANCE',
  'SECURITY',
  'EVENTS',
  'LEGAL',
  'HOUSEKEEPING',
  'PARKING',
  'OTHER',
] as const;
export type Portfolio = (typeof PORTFOLIOS)[number];

export type TermStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'ENDED';
export type TermKind = 'ELECTED' | 'PROVISIONAL' | 'AD_HOC';
export type TermSource = 'MANUAL' | 'ELECTION' | 'HISTORICAL';
export type JoinMode = 'ELECTED' | 'CO_OPTED' | 'NOMINATED' | 'APPOINTED';
export type SeatStatus = 'PLANNED' | 'SEATED' | 'LEFT';
export type SeatFlag = 'ROLE_MISMATCH' | 'MEMBERSHIP_SUSPENDED' | 'NOT_OWNER';
export type ExitReason =
  'TERM_ENDED' | 'RESIGNED' | 'REMOVED' | 'DECEASED' | 'DISQUALIFIED' | 'REDESIGNATED' | 'MEMBERSHIP_ENDED';

export interface Seat {
  seatId: string;
  userId: number | null;
  memberId: number | null;
  name: string;
  designation: Designation;
  joinMode: JoinMode;
  unitId: number | null;
  unitLabel: string | null;
  portfolios: Portfolio[];
  mobile: string | null;
  publicEmail: string | null;
  photoFileId: number | null;
  showOnResidentPage: boolean;
  status: SeatStatus;
  fromDate: string | null;
  toDate: string | null;
  roleKey: string | null;
  expectedRoleKey: string | null;
  roleBeforeKey: string | null;
  replaceExistingRole: boolean;
  exitReason: ExitReason | null;
  exitNote: string | null;
  resolutionRef: string | null;
  flags: SeatFlag[];
}

export interface HandoverSummary {
  total: number;
  done: number;
  notApplicable: number;
  completedAt: string | null;
}

export interface Term {
  id: number;
  name: string;
  kind: TermKind;
  source: TermSource;
  status: TermStatus;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  tookChargeOn: string | null;
  strength: number;
  resolutionRef: string | null;
  notes: string | null;
  predecessorTermId: number | null;
  successorTermId: number | null;
  electionId: number | null;
  daysLeft: number | null;
  isOverdue: boolean;
  seats: Seat[];
  handover: HandoverSummary;
  version: number;
}

export interface TermListItem {
  id: number;
  name: string;
  kind: TermKind;
  source: TermSource;
  status: TermStatus;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  tookChargeOn: string | null;
  strength: number;
  seatedCount: number;
  officeBearers: { designation: Designation; name: string }[];
  electionId: number | null;
  version: number;
}

export interface CurrentSummary {
  id: number;
  name: string;
  kind: TermKind;
  source: TermSource;
  status: TermStatus;
  startDate: string;
  endDate: string;
  tookChargeOn: string | null;
  daysLeft: number | null;
  isOverdue: boolean;
  strength: number;
  seatedCount: number;
  vacancies: number;
  vacantDesignations: Designation[];
  handover: { total: number; done: number; completedAt: string | null };
  attentionCount: number;
  version: number;
}

export interface DraftSummary {
  id: number;
  name: string;
  source: TermSource;
  seatCount: number;
  electionId: number | null;
  version: number;
}

export type Banner =
  | { code: 'TERM_ENDING'; daysLeft: number }
  | { code: 'CARETAKER'; endedOn: string | null }
  | { code: 'DRAFT_FROM_ELECTION'; draftId: number; electionId: number | null }
  | { code: 'NO_COMMITTEE' };

export interface CommitteeOverview {
  current: CurrentSummary | null;
  draft: DraftSummary | null;
  banner: Banner | null;
}

/* the term form */
export interface SeatInput {
  seatId?: string;
  userId?: number;
  name?: string;
  designation: Designation;
  joinMode?: Exclude<JoinMode, 'CO_OPTED'>;
  unitId?: number;
  portfolios?: Portfolio[];
  publicEmail?: string;
  showOnResidentPage?: boolean;
  replaceExistingRole?: boolean;
}

export interface TermInput {
  name: string;
  kind: TermKind;
  source: 'MANUAL' | 'HISTORICAL';
  startDate: string;
  endDate: string;
  strength: number;
  notes?: string;
  resolutionRef?: string;
  seats: SeatInput[];
}

export interface TermPatch {
  version: number;
  name?: string;
  kind?: TermKind;
  startDate?: string;
  endDate?: string;
  strength?: number;
  notes?: string | null;
  seats?: SeatInput[];
  reason?: string;
}

export interface SeatPatch {
  version: number;
  portfolios?: Portfolio[];
  publicEmail?: string | null;
  showOnResidentPage?: boolean;
  unitId?: number;
}

export interface TermQuery {
  status?: TermStatus;
  source?: TermSource;
  sortBy?: 'startDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/* activation and changes preview (spec 8.7 and 8.9) */
export type PlanAction =
  | {
      kind: 'CHANGE_ROLE';
      step: string;
      userId: number;
      memberId: number;
      name: string;
      fromRoleKey: string;
      toRoleKey: string;
      seatDelta: number;
      reason: 'INCOMING' | 'OUTGOING' | 'CONTINUING';
    }
  | {
      kind: 'END_MEMBERSHIP';
      step: string;
      userId: number;
      memberId: number;
      name: string;
      fromRoleKey: string;
      seatDelta: number;
    }
  | {
      kind: 'NONE';
      userId: number;
      memberId: number;
      name: string;
      roleKey: string;
      reason: 'INCOMING' | 'CONTINUING';
    };

export interface PlanIssue {
  code: string;
  message: string;
  seatIds: string[];
  userIds: number[];
}

export interface Delegation {
  designation: string;
  fromName: string;
  toName: string;
  days: number;
}

export interface Plan {
  termId: number;
  termVersion: number;
  actions: PlanAction[];
  staffSeats: { limit: number | null; used: number; delta: number };
  handoverDelegations: Delegation[];
  warnings: PlanIssue[];
  blockers: PlanIssue[];
  previewHash: string;
}

export interface ActivationInput {
  version: number;
  previewHash: string;
  tookChargeOn?: string;
  resolutionRef: string;
  reason: string;
  announceToResidents: boolean;
}

export interface ChangeSummary {
  roleChanges: number;
  membershipsEnded: number;
  handoverDelegationsCreated: number;
  handoverDelegationsSkipped: string[];
}

export type VacateReason = 'RESIGNED' | 'REMOVED' | 'DECEASED' | 'DISQUALIFIED';

export type Change =
  | {
      op: 'ADD';
      userId: number;
      designation: Designation;
      joinMode: Exclude<JoinMode, 'ELECTED'>;
      unitId: number;
      resolutionRef?: string;
      portfolios?: Portfolio[];
      publicEmail?: string;
      replaceExistingRole?: boolean;
    }
  | { op: 'REDESIGNATE'; seatId: string; designation: Designation }
  | { op: 'VACATE'; seatId: string; exitReason: VacateReason; note?: string };

export interface ChangesInput {
  version: number;
  effectiveDate?: string;
  changes: Change[];
}

export interface ActivationResult {
  term: { id: number; status: string; tookChargeOn: string | null; version: number } | null;
  endedTerm: { id: number; status: string; actualEndDate: string | null } | null;
  summary: ChangeSummary;
}
