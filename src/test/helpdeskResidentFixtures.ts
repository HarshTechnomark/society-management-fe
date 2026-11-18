export const HELP_PERMS = [
  'resident.helpdesk.view',
  'resident.helpdesk.create',
  'resident.helpdesk.edit',
  'resident.home.view',
];

export const ticketRaw = (over: Record<string, unknown> = {}) => ({
  id: 124,
  ticketNo: 'TKT/2026-27/000124',
  kind: 'PERSONAL',
  title: 'Kitchen tap leaking',
  description: 'The tap drips all day',
  status: 'RESOLVED',
  waitingReason: null,
  priority: 'P3',
  category: { id: 5, name: 'Plumbing' },
  unit: { id: 12, label: 'C-0801' },
  location: null,
  reporterLabel: 'You',
  myRelation: 'REQUESTER',
  iUpvoted: false,
  csat: { score: null, avg: null, count: 0 },
  myRating: null,
  assignment: { assigneeLabel: 'Ramesh (plumber)' },
  sla: { resolutionDueAt: '2026-11-20T10:30:00.000Z', slaState: 'ON_TRACK' },
  fileIds: [9012],
  recentComments: [
    {
      id: 1,
      kind: 'COMMENT',
      authorLabel: 'Helpdesk',
      authorRole: 'ADMIN',
      body: 'Plumber will visit today',
      fileIds: [],
      createdAt: '2026-11-18T05:00:00.000Z',
    },
  ],
  allowedActions: ['CONFIRM', 'REOPEN', 'RATE', 'COMMENT'],
  version: 4,
  createdAt: '2026-11-17T05:00:00.000Z',
  ...over,
});

export const issueRowRaw = (over: Record<string, unknown> = {}) => ({
  id: 77,
  ticketNo: 'TKT/2026-27/000077',
  title: 'Lift stopped',
  status: 'IN_PROGRESS',
  priority: 'P1',
  locationLabel: 'Tower A › Lift 1',
  upvoteCount: 6,
  iUpvoted: false,
  isRequester: false,
  affectedUnitCount: 96,
  createdAt: '2026-11-18T04:00:00.000Z',
  ...over,
});

export const categoriesRaw = () => [
  {
    id: 3,
    name: 'Lift',
    isChargeable: false,
    children: [{ id: 31, name: 'Stuck between floors', children: [] }],
  },
  { id: 4, name: 'Water supply', children: [] },
];

export const locationsRaw = () => [
  {
    id: 10,
    nodeType: 'BUILDING',
    name: 'Tower A',
    pathLabel: 'Tower A',
    children: [{ id: 77, nodeType: 'AREA', name: 'Lift 1', pathLabel: 'Tower A › Lift 1', children: [] }],
  },
];
