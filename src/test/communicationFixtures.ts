/** Raw API shapes of module 16 (spec 8.1 to 8.33, 8.20 to 8.24) for the admin screens and services. */
export const noticeItemRaw = (over: Record<string, unknown> = {}) => ({
  id: 412,
  number: 'NTC-000412',
  kind: 'STANDARD',
  category: 'MAINTENANCE',
  priority: 'NORMAL',
  title: 'Water cut Tower A, Saturday 10am to 2pm',
  excerpt: 'Water tank cleaning. Please store water…',
  status: 'PUBLISHED',
  isPinned: false,
  requiresAck: true,
  audienceLabel: 'Tower A',
  actions: [],
  publishedAt: '2026-10-30T04:30:00.000Z',
  scheduledAt: null,
  recipientCount: 64,
  readCount: 45,
  ackCount: 29,
  author: { id: 21, name: 'Arjun Shah' },
  version: 3,
  ...over,
});

export const noticeRaw = (over: Record<string, unknown> = {}) => ({
  id: 412,
  number: 'NTC-000412',
  kind: 'STANDARD',
  category: 'MAINTENANCE',
  priority: 'NORMAL',
  title: 'Water cut Tower A, Saturday 10am to 2pm',
  body: '<p>Water tank cleaning. <strong>Store water</strong>.</p><script>alert(1)</script>',
  locale: 'en-IN',
  status: 'PUBLISHED',
  audience: { type: 'BUILDINGS', relation: 'ANY', ids: [11], roleKeys: null, label: 'Tower A' },
  channels: ['SMS'],
  actions: [],
  requiresAck: true,
  ackDueAt: null,
  isPinned: false,
  scheduledAt: null,
  publishedAt: '2026-10-30T04:30:00.000Z',
  expiresAt: null,
  attachments: [],
  approval: null,
  lastDecisionReason: null,
  revisionNo: 1,
  version: 3,
  author: { id: 21, name: 'Arjun Shah' },
  createdAt: '2026-10-30T03:10:00.000Z',
  ...over,
});

export const receiptsRaw = (over: Record<string, unknown> = {}) => ({
  summary: {
    recipients: 141,
    units: 64,
    reached: 132,
    read: 101,
    acknowledged: 64,
    unitsAcknowledged: 52,
    byBuilding: [{ buildingId: 11, code: 'A', units: 64, unitsRead: 51 }],
    byChannel: { IN_APP: 118, PUSH: 92, SMS: 21, WHATSAPP: 0, EMAIL: 0 },
  },
  items: [
    {
      receiptId: 88001,
      unitId: 3001,
      unitLabel: 'A-101',
      name: 'Rohan Mehta',
      relation: 'OWNER',
      mobile: '98XXXXX111',
      reachedVia: 'PUSH',
      firstReadAt: '2026-10-30T05:02:00.000Z',
      acknowledgedAt: null,
      remindersSent: 1,
    },
  ],
  ...over,
});
export const pagination = (total = 1, totalPages = 1) => ({ page: 1, limit: 20, total, totalPages });

export const previewRaw = () => ({
  units: 64,
  people: 141,
  withLogin: 118,
  withoutLogin: 23,
  withPush: 92,
  sample: [{ unitId: 3001, unitLabel: 'A-101' }],
});

export const surveyItemRaw = (over: Record<string, unknown> = {}) => ({
  id: 9,
  title: 'Gym timings',
  status: 'OPEN',
  isAnonymous: true,
  closesAt: '2026-11-30T12:00:00.000Z',
  recipientCount: 141,
  responseCount: 100,
  questionCount: 4,
  version: 2,
  ...over,
});

export const surveyRaw = (over: Record<string, unknown> = {}) => ({
  ...surveyItemRaw({ status: 'DRAFT', responseCount: 0, recipientCount: 0 }),
  description: 'Help us pick the hours',
  responseScope: 'PERSON',
  resultsVisibility: 'ADMINS',
  audience: { type: 'ALL', relation: 'ANY', ids: null, label: 'All residents' },
  questions: [
    {
      id: 51,
      type: 'SINGLE_CHOICE',
      prompt: 'Preferred gym hours?',
      isRequired: true,
      options: [
        { key: 'o1', label: '6–9 am' },
        { key: 'o2', label: '6–9 pm' },
      ],
    },
  ],
  ...over,
});

export const resultsRaw = () => ({
  surveyId: 9,
  status: 'OPEN',
  responses: 100,
  recipients: 141,
  isAnonymous: true,
  questions: [
    {
      questionId: 51,
      type: 'SINGLE_CHOICE',
      prompt: 'Preferred gym hours?',
      answered: 98,
      options: [
        { key: 'o1', label: '6–9 am', count: 61, pct: '62.2' },
        { key: 'o2', label: '6–9 pm', count: 37, pct: '37.8' },
      ],
    },
    {
      questionId: 52,
      type: 'RATING',
      prompt: 'Rate the gym',
      answered: 100,
      average: '3.90',
      distribution: { '1': 4, '2': 6, '3': 18, '4': 40, '5': 32 },
    },
    {
      questionId: 53,
      type: 'NPS',
      prompt: 'Recommend?',
      answered: 90,
      nps: 22,
      promoters: 40,
      passives: 30,
      detractors: 20,
    },
    { questionId: 54, type: 'TEXT', prompt: 'Any ideas?', answered: 3, samples: [], hidden: true },
  ],
});

export const notificationRaw = (over: Record<string, unknown> = {}) => ({
  id: 77120,
  templateKey: 'approvals.pending',
  category: 'APPROVALS',
  tone: 'warn',
  title: 'Approval needed: Notice',
  body: 'Arjun Shah wrote a notice for all residents.',
  deepLink: '/approvals/77',
  readAt: null,
  createdAt: '2026-10-30T05:40:00.000Z',
  ...over,
});

export const prefsRaw = (over: Record<string, unknown> = {}) => ({
  locale: null,
  effectiveLocale: 'hi-IN',
  categories: [
    { key: 'PAYMENTS', locked: false, channels: { PUSH: true, SMS: true, WHATSAPP: true, EMAIL: true } },
    { key: 'NOTICES', locked: false, channels: { PUSH: true, SMS: false, WHATSAPP: true, EMAIL: true } },
    { key: 'EMERGENCY', locked: true, channels: { PUSH: true, SMS: true, WHATSAPP: true, EMAIL: true } },
  ],
  quietHours: { mode: 'SOCIETY_DEFAULT', start: '22:00', end: '07:00' },
  whatsapp: { optIn: false, optInAt: null, available: true },
  email: { address: 'r****@mail.in', bounced: false },
  version: 4,
  ...over,
});

export const COMM_PERMS = [
  'communication.notices.view',
  'communication.notices.create',
  'communication.notices.edit',
  'communication.notices.delete',
  'communication.surveys.view',
  'communication.surveys.create',
  'communication.surveys.edit',
  'communication.surveys.export',
];
export const COMM_FEATURES = [
  'communication.notice_composer',
  'communication.audience_targeting',
  'communication.scheduling',
  'communication.notice_template_library',
  'communication.utility_shutdown_alerts',
  'communication.read_receipt_dashboard',
  'communication.unreached_residents_follow_up',
  'communication.surveys_with_analytics',
];
