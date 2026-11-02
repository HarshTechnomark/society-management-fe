import type {
  Building,
  Holiday,
  ImportReport,
  LocationNode,
  Onboarding,
  OnboardingStep,
  SettingItem,
  SocietyProfile,
  StepKey,
  Unit,
} from '@/types/societySetup';

export const FEATURES = [
  'property.society_profile',
  'property.society_settings',
  'property.property_hierarchy',
  'property.unit_registry',
  'property.bulk_unit_generator',
  'property.spreadsheet_import',
  'property.export_structure',
  'property.common_areas_registry',
  'property.gates_registry',
  'property.unit_qr_codes',
];

export const ALL_PERMS = [
  'settings.society.view',
  'settings.society.edit',
  'residents.units.view',
  'residents.units.create',
  'residents.units.edit',
  'residents.units.delete',
  'residents.units.import',
  'residents.units.export',
];

export const society = (over: Partial<SocietyProfile> = {}): SocietyProfile => ({
  id: 12,
  name: 'Sky Heights CHS',
  legalName: 'Sky Heights Co-operative Housing Society Ltd',
  slug: 'sky-heights',
  registrationNo: 'PNA/1234/2009',
  gstin: '27AAAAS1234C1Z5',
  addressLine1: 'S. No. 45, Baner Road',
  addressLine2: null,
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411045',
  timezone: 'Asia/Kolkata',
  locale: 'en-IN',
  fyStartMonth: 4,
  logoFileId: null,
  status: 'ACTIVE',
  isLive: false,
  profile: {
    societyType: 'COOPERATIVE_HOUSING_SOCIETY',
    pan: 'AAAAS1234C',
    tan: null,
    registrationDate: '2009-06-15',
    contactEmail: 'office@skyheights.in',
    contactPhone: '98XXXXX111',
  },
  version: 7,
  ...over,
});

export const building = (over: Partial<Building> = {}): Building => ({
  id: 31,
  code: 'A',
  name: 'Tower A',
  kind: 'TOWER',
  parentBuildingId: null,
  floorsAboveGround: 20,
  basements: 1,
  liftCount: 2,
  sortOrder: 1,
  status: 'ACTIVE',
  floorLabels: { min: 'B1', max: '20' },
  unitCounts: { active: 76, archived: 0, countable: 76 },
  wings: [],
  locationNodeId: 501,
  version: 3,
  createdAt: '2026-10-30T06:30:00.000Z',
  ...over,
});

export const unit = (over: Partial<Unit> = {}): Unit => ({
  id: 9105,
  buildingId: 31,
  buildingCode: 'A',
  buildingName: 'Tower A',
  label: 'A-201',
  unitNumber: '201',
  floor: 2,
  floorLabel: '2',
  positionOnFloor: 1,
  unitType: 'FLAT',
  bhk: '3BHK',
  carpetAreaSqft: '1150.000',
  builtUpAreaSqft: '1380.000',
  superBuiltUpAreaSqft: '1610.000',
  areaSqft: '1150.000',
  undividedSharePct: '1.2500',
  isBillable: true,
  possessionDate: '2010-04-01',
  notes: null,
  status: 'ACTIVE',
  archivedAt: null,
  archivedReason: null,
  version: 4,
  createdAt: '2026-10-30T06:31:00.000Z',
  updatedAt: '2026-10-30T07:02:00.000Z',
  ...over,
});

const ORDER: StepKey[] = [
  'PROFILE',
  'STRUCTURE',
  'UNITS',
  'RESIDENTS',
  'BILLING',
  'PAYMENTS',
  'COMMITTEE',
  'GO_LIVE',
];
const REQUIRED = ['PROFILE', 'STRUCTURE', 'UNITS', 'BILLING', 'GO_LIVE'];

export const step = (key: StepKey, over: Partial<OnboardingStep> = {}): OnboardingStep => ({
  stepKey: key,
  stepNo: ORDER.indexOf(key) + 1,
  isRequired: REQUIRED.includes(key),
  skippable: !REQUIRED.includes(key),
  status: 'PENDING',
  checkState: 'FAIL',
  summary: `${key} summary`,
  ...over,
});

/** `done` lists the steps that are DONE, `skipped` the SKIPPED ones. */
export const onboarding = (
  done: StepKey[] = [],
  skipped: StepKey[] = [],
  over: Partial<Onboarding> = {},
): Onboarding => {
  const steps = ORDER.map(k =>
    step(k, {
      status: done.includes(k) ? 'DONE' : skipped.includes(k) ? 'SKIPPED' : 'PENDING',
      checkState: done.includes(k) ? 'PASS' : 'FAIL',
    }),
  );
  const finished = steps.filter(s => s.status !== 'PENDING').length;
  return {
    isLive: false,
    progressPercent: Math.floor((100 * finished) / 8),
    currentStep: steps.find(s => s.status === 'PENDING')?.stepKey ?? 'GO_LIVE',
    steps,
    ...over,
  };
};

export const setting = (key: string, over: Partial<SettingItem> = {}): SettingItem => ({
  key,
  namespace: key.split('.')[0],
  type: 'INT',
  value: 9,
  default: 15,
  isDefault: false,
  version: 2,
  canEdit: true,
  requiresStepUp: false,
  requiresReason: false,
  editVia: 'SETTINGS',
  rules: { min: 0, max: 60 },
  description: 'Days to pay after the bill date',
  ...over,
});

export const holiday = (over: Partial<Holiday> = {}): Holiday => ({
  id: 1,
  holidayDate: '2026-11-08',
  name: 'Diwali (Lakshmi Puja)',
  holidayType: 'FESTIVAL',
  isOfficeClosed: true,
  notes: null,
  version: 1,
  ...over,
});

export const tree = (): LocationNode[] => [
  {
    id: 501,
    nodeType: 'BUILDING',
    name: 'Tower A',
    buildingId: 31,
    status: 'ACTIVE',
    version: 1,
    children: [
      {
        id: 640,
        nodeType: 'FLOOR',
        name: 'Floor 3',
        floor: 3,
        version: 1,
        children: [
          {
            id: 641,
            nodeType: 'AREA',
            areaType: 'LOBBY',
            name: 'Lift lobby',
            qrToken: 'Q7k2Lm9Pa0Zx',
            pathLabel: 'Tower A › Floor 3 › Lift lobby',
            version: 1,
            children: [],
          },
        ],
      },
    ],
  },
  { id: 520, nodeType: 'AREA', areaType: 'GATE', name: 'Main Gate', version: 1, children: [] },
];

export const importReport = (over: Partial<ImportReport> = {}): ImportReport => ({
  importId: 4411,
  status: 'VALIDATED',
  mode: 'UPSERT',
  fileName: 'flats.csv',
  totalRows: 312,
  counts: { create: 280, update: 24, unchanged: 3, error: 5 },
  errorsPreview: [
    {
      row: 47,
      column: 'Carpet',
      value: 'eight fifty',
      code: 'INVALID_NUMBER',
      message: 'Carpet area must be a number',
    },
    {
      row: 102,
      column: 'Flat No',
      value: '1203',
      code: 'DUPLICATE_IN_FILE',
      message: 'Same as row 98 in building A',
    },
  ],
  reportFileId: 77120,
  commitPolicy: null,
  result: null,
  createdAt: '2026-10-30T07:00:00.000Z',
  expiresAt: '2026-10-31T07:00:00.000Z',
  ...over,
});
