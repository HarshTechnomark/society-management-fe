/** Module 08 response and request shapes (spec section 8). Money-free; areas are strings in sq ft. */

export interface SocietyProfileExtras {
  societyType: string | null;
  pan: string | null;
  tan: string | null;
  registrationDate: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface SocietyProfile {
  id: number;
  name: string;
  legalName: string | null;
  slug: string;
  registrationNo: string | null;
  gstin: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  timezone: string;
  locale: string;
  fyStartMonth: number;
  logoFileId: number | null;
  status: string;
  isLive: boolean;
  profile: SocietyProfileExtras;
  version: number;
}

export interface SocietyProfileInput {
  version: number;
  name?: string;
  legalName?: string | null;
  registrationNo?: string | null;
  gstin?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  timezone?: string;
  locale?: string;
  logoFileId?: number | null;
  profile?: Partial<SocietyProfileExtras>;
  reason?: string;
}

export type SettingType = 'INT' | 'STRING' | 'BOOL' | 'ENUM' | 'DECIMAL' | 'TIME' | 'JSON' | string;

export interface SettingRules {
  min?: number;
  max?: number;
  pattern?: string;
  oneOf?: (string | number)[];
  [k: string]: unknown;
}

export interface SettingItem {
  key: string;
  namespace: string;
  type: SettingType;
  value: unknown;
  default: unknown;
  isDefault: boolean;
  version: number;
  canEdit: boolean;
  requiresStepUp: boolean;
  requiresReason: boolean;
  editVia: 'SETTINGS' | 'PROFILE' | 'MODULE17' | string;
  rules?: SettingRules;
  description?: string;
  appliesFrom?: string;
}

export interface SettingChange {
  key: string;
  value: unknown;
  version: number;
}

export type BuildingKind = 'TOWER' | 'WING' | 'BLOCK' | 'COMMERCIAL' | string;
export type RecordStatus = 'ACTIVE' | 'ARCHIVED';

export interface Building {
  id: number;
  code: string;
  name: string;
  kind: BuildingKind;
  parentBuildingId: number | null;
  floorsAboveGround: number;
  basements: number;
  liftCount: number;
  sortOrder: number;
  status: RecordStatus;
  floorLabels: { min: string; max: string };
  unitCounts: { active: number; archived: number; countable: number };
  wings: Building[];
  locationNodeId: number | null;
  version: number;
  createdAt: string;
}

export interface BuildingInput {
  code?: string;
  name?: string;
  kind?: string;
  parentBuildingId?: number | null;
  floorsAboveGround?: number;
  basements?: number;
  liftCount?: number;
  sortOrder?: number;
  version?: number;
}

export interface BuildingQuery {
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  kind?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface GridUnit {
  id: number;
  label: string;
  unitNumber: string;
  positionOnFloor: number | null;
  unitType: UnitType;
  bhk: string | null;
  areaSqft: string | null;
  isBillable: boolean;
  status: RecordStatus;
}
export interface BuildingGrid {
  building: { id: number; code: string; name: string };
  floors: { floor: number; floorLabel: string; units: GridUnit[] }[];
  totals: { units: number; missingArea: number };
}

export type UnitType = 'FLAT' | 'SHOP' | 'OFFICE' | 'PARKING_ONLY';

export interface Unit {
  id: number;
  buildingId: number;
  buildingCode: string;
  buildingName: string;
  label: string;
  unitNumber: string;
  floor: number;
  floorLabel: string;
  positionOnFloor: number | null;
  unitType: UnitType;
  bhk: string | null;
  carpetAreaSqft: string | null;
  builtUpAreaSqft: string | null;
  superBuiltUpAreaSqft: string | null;
  areaSqft: string | null;
  undividedSharePct: string | null;
  isBillable: boolean;
  possessionDate: string | null;
  notes: string | null;
  status: RecordStatus;
  archivedAt: string | null;
  archivedReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnitInput {
  buildingId?: number;
  unitNumber?: string;
  floor?: number;
  positionOnFloor?: number | null;
  unitType?: UnitType;
  bhk?: string | null;
  carpetAreaSqft?: string | null;
  builtUpAreaSqft?: string | null;
  superBuiltUpAreaSqft?: string | null;
  undividedSharePct?: string | null;
  isBillable?: boolean;
  possessionDate?: string | null;
  notes?: string | null;
  version?: number;
}

export interface UnitQuery {
  buildingId?: number;
  floor?: number;
  unitType?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  bhk?: string;
  isBillable?: boolean;
  missingArea?: boolean;
  q?: string;
  sortBy?: 'position' | 'label' | 'floor' | 'areaSqft' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface BulkUpdateInput {
  unitIds?: number[];
  selector?: { buildingId: number; positions: number[]; floorFrom?: number; floorTo?: number };
  set: Partial<
    Pick<
      UnitInput,
      | 'unitType'
      | 'bhk'
      | 'carpetAreaSqft'
      | 'builtUpAreaSqft'
      | 'superBuiltUpAreaSqft'
      | 'undividedSharePct'
      | 'isBillable'
      | 'possessionDate'
    >
  >;
}

export interface GeneratorPosition {
  position: number;
  unitType?: UnitType;
  bhk?: string | null;
  carpetAreaSqft?: string | null;
  builtUpAreaSqft?: string | null;
  superBuiltUpAreaSqft?: string | null;
  isBillable?: boolean;
}
export type GeneratorBuilding =
  | { buildingId: number }
  | {
      newBuilding: {
        code: string;
        name: string;
        kind: 'TOWER' | 'WING' | 'COMMERCIAL';
        parentBuildingId?: number;
      };
    };

export interface GeneratorInput {
  buildings: GeneratorBuilding[];
  floorFrom: number;
  floorTo: number;
  positions: GeneratorPosition[];
  pattern: string;
  skipFloors?: number[];
  skipCells?: { floor: number; position: number }[];
}

export interface GeneratorPreview {
  previewHash: string;
  summary: {
    buildings: number;
    newBuildings: number;
    units: number;
    countableUnits: number;
    conflicts: number;
    limit: number;
    used: number;
    limitRemaining: number;
  };
  /** Labels (strings) or objects with a `label`; the spec does not show the conflict row shape. */
  conflicts: (string | { label: string })[];
  sample: {
    building: string;
    floor: number;
    position: number;
    unitNumber: string;
    label: string;
    unitType: UnitType;
    bhk?: string | null;
  }[];
  sampleCount: number;
}

export interface GeneratorResult {
  created: number;
  buildingsCreated: number[];
  unitIds: number[];
  used: number;
  limit: number;
}

export type ImportMode = 'CREATE_ONLY' | 'UPSERT';
export type ImportStatus =
  'VALIDATING' | 'VALIDATED' | 'COMMITTING' | 'COMMITTED' | 'COMMITTED_PARTIAL' | 'FAILED';
export type CommitPolicy = 'ALL_OR_NOTHING' | 'VALID_ROWS_ONLY';

export interface ImportErrorRow {
  row: number;
  column: string;
  value: string;
  code: string;
  message: string;
}
export interface ImportReport {
  importId: number;
  status: ImportStatus;
  mode: ImportMode;
  fileName: string;
  totalRows: number;
  counts: { create: number; update: number; unchanged: number; error: number };
  errorsPreview: ImportErrorRow[];
  reportFileId: number | null;
  commitPolicy: CommitPolicy | null;
  result: { written: number; skipped: number; failureCode: string | null } | null;
  createdAt: string;
  expiresAt: string;
}

export type LocationNodeType = 'BUILDING' | 'FLOOR' | 'AREA';
export interface LocationNode {
  id: number;
  nodeType: LocationNodeType;
  name: string;
  areaType?: string;
  buildingId?: number;
  floor?: number;
  status?: RecordStatus;
  qrToken?: string;
  pathLabel?: string;
  parentId?: number | null;
  version?: number;
  notes?: string | null;
  children: LocationNode[];
}
export interface LocationInput {
  parentId?: number | null;
  nodeType?: 'FLOOR' | 'AREA';
  floor?: number;
  areaType?: string;
  name?: string;
  sortOrder?: number;
  notes?: string | null;
  version?: number;
}

export interface Holiday {
  id: number;
  holidayDate: string;
  name: string;
  holidayType: 'NATIONAL' | 'FESTIVAL' | 'SOCIETY' | 'OTHER';
  isOfficeClosed: boolean;
  notes: string | null;
  version: number;
}
export interface HolidayInput {
  holidayDate?: string;
  name?: string;
  holidayType?: string;
  isOfficeClosed?: boolean;
  notes?: string | null;
  version?: number;
}
export interface HolidaySuggestion {
  holidayDate: string;
  name: string;
  holidayType: string;
  alreadyAdded: boolean;
}

export type StepKey =
  'PROFILE' | 'STRUCTURE' | 'UNITS' | 'RESIDENTS' | 'BILLING' | 'PAYMENTS' | 'COMMITTEE' | 'GO_LIVE';
export type StepStatus = 'PENDING' | 'DONE' | 'SKIPPED';
export type CheckState = 'PASS' | 'FAIL' | 'NOT_AVAILABLE' | 'UNKNOWN';

export interface OnboardingStep {
  stepKey: StepKey;
  stepNo: number;
  isRequired: boolean;
  skippable: boolean;
  status: StepStatus;
  completedAt?: string | null;
  checkState: CheckState;
  summary: string;
}
export interface Onboarding {
  isLive: boolean;
  progressPercent: number;
  currentStep: StepKey;
  steps: OnboardingStep[];
}
