/** Module 16 emergency broadcast types (spec 7.8, 7.9, 8.25 to 8.30). */
export type EmergencyType =
  | 'FIRE'
  | 'GAS_LEAK'
  | 'WATER'
  | 'LIFT_STUCK'
  | 'SECURITY_THREAT'
  | 'MEDICAL'
  | 'POWER'
  | 'NATURAL_DISASTER'
  | 'OTHER';
export type EmergencyStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
export type ResponseStatus = 'SAFE' | 'NEED_HELP';
/** The three route groups: the admin app, the guard console and the resident app. */
export type EmergencyAudience = 'admin' | 'gate' | 'me';

export interface EmergencyCounts {
  units: number;
  safe: number;
  needHelp: number;
  noResponse: number;
  peopleSafe: number;
}
export interface EmergencyListItem {
  id: number;
  type: EmergencyType;
  title: string;
  status: EmergencyStatus;
  isDrill: boolean;
  startedAt: string;
  recipientCount: number;
  unitCount: number;
  safeCount: number;
  helpCount: number;
  version: number;
}
export interface NeedHelpItem {
  responseId: number;
  unitLabel: string;
  note: string | null;
  peopleCount: number;
  at: string;
  attendedBy: string | null;
}
export interface EmergencyUpdateRow {
  message: string;
  at: string;
  byName: string | null;
}
export interface EmergencyDetail extends EmergencyListItem {
  message: string;
  collectResponses: boolean;
  includeStaff: boolean;
  audienceType: 'ALL' | 'BUILDINGS';
  audienceBuildingIds: number[];
  updateCount: number;
  lastUpdateMessage: string | null;
  lastUpdateAt: string | null;
  lastRealertAt: string | null;
  resolvedAt: string | null;
  allClearMessage: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  startedByName: string | null;
  counts: EmergencyCounts;
  needHelp: NeedHelpItem[];
  updates: EmergencyUpdateRow[];
}
export interface EmergencyListQuery {
  status?: EmergencyStatus;
  type?: EmergencyType;
  isDrill?: boolean;
  from?: string;
  to?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
export interface StartEmergencyInput {
  type: EmergencyType;
  title?: string;
  message: string;
  audience: { type: 'ALL' } | { type: 'BUILDINGS'; ids: number[] };
  includeStaff: boolean;
  collectResponses: boolean;
  isDrill: boolean;
}

export interface RollCallContact {
  name: string;
  mobile: string;
}
export type RollCallStatus = ResponseStatus | 'NO_RESPONSE';
export interface RollCallUnit {
  unitId: number;
  unitLabel: string;
  buildingCode: string;
  floor: number | null;
  status: RollCallStatus;
  peopleCount: number | null;
  note: string | null;
  respondedAt: string | null;
  channel: string | null;
  contacts: RollCallContact[];
}
export interface RollCallFloor {
  buildingCode: string;
  floor: number | null;
  units: number;
  safe: number;
  needHelp: number;
}
export interface RollCall {
  items: RollCallUnit[];
  byFloor: RollCallFloor[];
  total: number;
  pages: number;
}
export interface RollCallQuery {
  status?: RollCallStatus;
  buildingId?: number;
  floor?: number;
  page?: number;
  limit?: number;
}
export interface RespondInput {
  status: ResponseStatus;
  peopleCount?: number;
  note?: string;
  unitId?: number;
}
export interface RespondResult {
  responseId: number;
  status: ResponseStatus;
  peopleCount: number;
  respondedAt: string;
  /** Flats that are safe / need help now (the live counters of the alert). */
  counts: { safe: number; needHelp: number };
}
export interface ActiveUnit {
  unitId: number;
  label: string;
  response: ResponseStatus | null;
}
export interface ActiveEmergency {
  id: number;
  type: EmergencyType;
  title: string;
  message: string;
  isDrill: boolean;
  startedAt: string;
  collectResponses: boolean;
  lastUpdateMessage: string | null;
  /** Changes whenever the alert is updated or re-alerted: a new version may take over the screen again. */
  version: string;
  myUnits: ActiveUnit[];
  /** The caller's own reply when the alert reached them as staff and not through a flat (`myUnits` is empty). */
  myResponse: ResponseStatus | null;
}
