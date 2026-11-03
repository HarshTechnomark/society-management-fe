/** Raw API shapes of module 10 (spec 8.1 and 8.2), as the backend sends them. */
export const COMMITTEE_PERMS = [
  'settings.members.view',
  'settings.members.create',
  'settings.members.edit',
  'settings.members.delete',
  'residents.units.view',
];
export const COMMITTEE_FEATURES = ['governance.committee_terms', 'governance.office_bearers'];

export const seatRaw = (over: Record<string, unknown> = {}) => ({
  seatId: 'S1',
  userId: 11,
  memberId: 1101,
  name: 'Rajesh Kulkarni',
  designation: 'CHAIRMAN',
  joinMode: 'ELECTED',
  unitId: 501,
  unitLabel: 'A-501',
  portfolios: ['LEGAL'],
  mobile: '98XXXXX111',
  publicEmail: 'chairman@skyheights.in',
  photoFileId: null,
  showOnResidentPage: true,
  status: 'SEATED',
  fromDate: '2024-04-01',
  toDate: null,
  roleKey: 'chairman',
  expectedRoleKey: 'chairman',
  roleBeforeKey: null,
  replaceExistingRole: false,
  exitReason: null,
  exitNote: null,
  resolutionRef: null,
  flags: [],
  ...over,
});

export const termRaw = (over: Record<string, unknown> = {}) => ({
  id: 12,
  name: 'Managing Committee 2024-2029',
  kind: 'ELECTED',
  source: 'MANUAL',
  status: 'ACTIVE',
  startDate: '2024-04-01',
  endDate: '2029-03-31',
  actualEndDate: null,
  tookChargeOn: '2024-04-01',
  strength: 5,
  resolutionRef: 'CM/2024-25/01',
  notes: null,
  predecessorTermId: null,
  successorTermId: null,
  electionId: null,
  daysLeft: 882,
  isOverdue: false,
  seats: [
    seatRaw(),
    seatRaw({
      seatId: 'S2',
      userId: 12,
      name: 'Arjun Shah',
      designation: 'SECRETARY',
      unitLabel: 'B-101',
      portfolios: [],
      roleKey: 'secretary',
      flags: ['ROLE_MISMATCH'],
    }),
    seatRaw({
      seatId: 'S3',
      userId: 13,
      name: 'Meera Iyer',
      designation: 'MEMBER',
      joinMode: 'CO_OPTED',
      unitLabel: 'B-302',
      publicEmail: null,
      portfolios: ['ACCOUNTS', 'EVENTS'],
    }),
  ],
  handover: { total: 10, done: 9, notApplicable: 0, completedAt: null },
  version: 4,
  createdAt: '2024-03-20T09:30:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

export const currentRaw = (over: Record<string, unknown> = {}) => ({
  id: 12,
  name: 'Managing Committee 2024-2029',
  kind: 'ELECTED',
  source: 'MANUAL',
  status: 'ACTIVE',
  startDate: '2024-04-01',
  endDate: '2029-03-31',
  tookChargeOn: '2024-04-01',
  daysLeft: 882,
  isOverdue: false,
  strength: 5,
  seatedCount: 3,
  vacancies: 2,
  vacantDesignations: ['TREASURER'],
  handover: { total: 10, done: 9, completedAt: null },
  attentionCount: 0,
  version: 4,
  ...over,
});

export const overviewRaw = (over: Record<string, unknown> = {}) => ({
  current: currentRaw(),
  draft: null,
  banner: null,
  ...over,
});

export const draftTermRaw = (over: Record<string, unknown> = {}) =>
  termRaw({
    id: 20,
    name: 'Managing Committee 2029-2034',
    status: 'DRAFT',
    startDate: '2029-04-01',
    endDate: '2034-03-31',
    tookChargeOn: null,
    daysLeft: null,
    version: 2,
    seats: [
      seatRaw({
        seatId: 'S1',
        name: 'Farhan Qureshi',
        userId: 21,
        status: 'PLANNED',
        fromDate: null,
        designation: 'CHAIRMAN',
        unitId: 601,
        unitLabel: 'C-601',
      }),
    ],
    handover: { total: 0, done: 0, notApplicable: 0, completedAt: null },
    ...over,
  });

export const draftRaw = (over: Record<string, unknown> = {}) => ({
  id: 20,
  name: 'Managing Committee 2029-2034',
  kind: 'ELECTED',
  source: 'MANUAL',
  startDate: '2029-04-01',
  endDate: '2034-03-31',
  strength: 5,
  seatCount: 1,
  electionId: null,
  version: 2,
  ...over,
});

export const listItemRaw = (over: Record<string, unknown> = {}) => ({
  id: 11,
  name: 'Managing Committee 2019-2024',
  kind: 'ELECTED',
  source: 'MANUAL',
  status: 'ENDED',
  startDate: '2019-04-01',
  endDate: '2024-03-31',
  actualEndDate: '2024-03-31',
  tookChargeOn: '2019-04-01',
  strength: 5,
  seatedCount: 5,
  officeBearers: [
    { designation: 'TREASURER', name: 'Lata Menon' },
    { designation: 'CHAIRMAN', name: 'Suresh Rao' },
  ],
  electionId: null,
  version: 3,
  ...over,
});

/** Raw activation preview (spec 8.7) and changes preview (8.9). */
export const planRaw = (over: Record<string, unknown> = {}) => ({
  termId: 20,
  termVersion: 2,
  currentTermId: 12,
  currentTermVersion: 4,
  actions: [
    {
      kind: 'CHANGE_ROLE',
      step: 'A',
      userId: 22,
      memberId: 1202,
      name: 'Meera Iyer',
      fromRoleKey: 'treasurer',
      toRoleKey: 'owner',
      seatDelta: 0,
      reason: 'OUTGOING',
    },
    {
      kind: 'CHANGE_ROLE',
      step: 'B',
      userId: 61,
      memberId: 1361,
      name: 'Farhan Qureshi',
      fromRoleKey: 'owner',
      toRoleKey: 'chairman',
      seatDelta: 0,
      reason: 'INCOMING',
    },
    {
      kind: 'NONE',
      userId: 33,
      memberId: 1203,
      name: 'Arjun Shah',
      roleKey: 'secretary',
      reason: 'CONTINUING',
    },
  ],
  staffSeats: { limit: 8, used: 2, delta: 0 },
  handoverDelegations: [
    {
      designation: 'TREASURER',
      fromUserId: 22,
      fromName: 'Meera Iyer',
      toUserId: 64,
      toName: 'Lata Menon',
      days: 30,
    },
  ],
  seats: [
    {
      seatId: 'S1',
      name: 'Farhan Qureshi',
      designation: 'CHAIRMAN',
      status: 'SEATED',
      fromDate: '2029-04-02',
      toDate: null,
    },
  ],
  warnings: [],
  blockers: [],
  previewHash: 'a'.repeat(64),
  ...over,
});

/** `summary` of `POST .../changes` (8.9): the term detail plus this key at the same level. */
export const changesSummaryRaw = (over: Record<string, unknown> = {}) => ({
  roleChanges: 1,
  membershipsEnded: 0,
  handoverDelegationsCreated: 1,
  handoverDelegationsSkipped: [],
  ...over,
});

export const activationRaw = (over: Record<string, unknown> = {}) => ({
  term: { id: 20, status: 'ACTIVE', tookChargeOn: '2029-04-02', version: 3 },
  endedTerm: { id: 12, status: 'ENDED', actualEndDate: '2029-04-01' },
  summary: {
    roleChanges: 4,
    membershipsEnded: 0,
    handoverDelegationsCreated: 2,
    handoverDelegationsSkipped: [],
  },
  ...over,
});
