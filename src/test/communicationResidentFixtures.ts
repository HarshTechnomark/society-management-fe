export const EMERGENCY_ADMIN_PERMS = ['communication.emergency.create', 'dashboard.today.view'];
export const RESIDENT_COMM_PERMS = ['resident.notices.view', 'resident.notices.edit', 'resident.home.view'];
export const GATE_PERMS = ['gate.sos.create'];
export const PLATFORM_COMM_PERMS = [
  'platform.settings.view',
  'platform.settings.edit',
  'platform.health.view',
];

export const broadcastRaw = (over: Record<string, unknown> = {}) => ({
  id: 31,
  type: 'FIRE',
  title: 'Fire',
  message: 'Smoke on the 4th floor of Tower A. Use the stairs.',
  status: 'ACTIVE',
  isDrill: false,
  collectResponses: true,
  includeStaff: true,
  audience: { type: 'ALL' },
  unitCount: 64,
  recipientCount: 152,
  safeCount: 20,
  helpCount: 1,
  startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  startedByName: 'Rajesh Kulkarni',
  updateCount: 0,
  lastUpdateMessage: null,
  counts: { units: 64, safe: 20, needHelp: 1, noResponse: 43, peopleSafe: 52 },
  needHelp: [
    {
      responseId: 900,
      unitLabel: 'A-402',
      note: 'Grandmother cannot use the stairs',
      peopleCount: 2,
      at: '2026-11-18T09:00:00.000Z',
      attendedBy: null,
    },
  ],
  updates: [
    { message: 'Fire brigade has arrived.', at: '2026-11-18T09:05:00.000Z', byName: 'Rajesh Kulkarni' },
  ],
  version: 2,
  ...over,
});

export const rollCallRaw = () => ({
  data: [
    {
      unitId: 1,
      unitLabel: 'A-402',
      buildingCode: 'A',
      floor: 4,
      status: 'NEED_HELP',
      peopleCount: 2,
      note: 'Stairs',
      respondedAt: '2026-11-18T09:00:00.000Z',
      channel: 'APP',
      contacts: [{ name: 'Meera', mobile: '98XXXXX111' }],
    },
    {
      unitId: 2,
      unitLabel: 'A-403',
      buildingCode: 'A',
      floor: 4,
      status: 'NO_RESPONSE',
      peopleCount: null,
      note: null,
      respondedAt: null,
      channel: null,
      contacts: [],
    },
  ],
  byFloor: [{ buildingCode: 'A', floor: 4, units: 8, safe: 3, needHelp: 1 }],
  pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
});

export const activeRaw = (over: Record<string, unknown> = {}) => ({
  id: 31,
  type: 'FIRE',
  title: 'Fire',
  message: 'Smoke on the 4th floor. Use the stairs.',
  isDrill: false,
  startedAt: new Date().toISOString(),
  collectResponses: true,
  lastUpdateMessage: null,
  myUnits: [{ unitId: 12, label: 'C-0801', response: null }],
  ...over,
});

export const noticeRaw = (over: Record<string, unknown> = {}) => ({
  id: 412,
  title: 'Water cut Tower A, Saturday',
  excerpt: 'Water tank cleaning.',
  category: 'MAINTENANCE',
  priority: 'NORMAL',
  kind: 'STANDARD',
  status: 'PUBLISHED',
  isPinned: false,
  requiresAck: true,
  acknowledgedAt: null,
  readAt: null,
  publishedAt: '2026-11-17T04:30:00.000Z',
  actions: [],
  attachmentCount: 1,
  ...over,
});

export const noticeDetailRaw = (over: Record<string, unknown> = {}) => ({
  ...noticeRaw(),
  body: '<p>Please store water.</p><script>alert(1)</script><img src=x onerror=alert(2)>',
  locale: 'en-IN',
  attachments: [{ fileId: 9031, name: 'schedule.pdf', sizeBytes: 41200 }],
  utility: null,
  actions: [
    { type: 'PAY_COLLECTION', label: 'Pay', refId: 2, state: 'OPEN', amountPaise: 110000 },
    { type: 'PAY_COLLECTION', label: 'Pay', refId: 3, state: 'PAID', receiptNo: 'RCT/2026-27/000046' },
    { type: 'PAY_COLLECTION', label: 'Pay', refId: 4, state: 'CLOSED' },
  ],
  revisionNo: 1,
  ...over,
});

export const surveyRaw = (over: Record<string, unknown> = {}) => ({
  id: 9,
  title: 'Gym timings',
  description: 'Help us choose.',
  status: 'OPEN',
  isAnonymous: true,
  responseScope: 'PERSON',
  closesAt: '2026-12-01T10:00:00.000Z',
  responded: false,
  questions: [
    {
      id: 51,
      type: 'SINGLE_CHOICE',
      prompt: 'Preferred gym hours?',
      isRequired: true,
      options: [
        { key: 'o1', label: '6-9 am' },
        { key: 'o2', label: '6-9 pm' },
      ],
    },
    { id: 52, type: 'RATING', prompt: 'Rate the gym', isRequired: true },
    { id: 53, type: 'TEXT', prompt: 'Anything else?', isRequired: false, maxLength: 100 },
  ],
  ...over,
});

export const templateRaw = (over: Record<string, unknown> = {}) => ({
  id: 5,
  templateKey: 'payments.receipt',
  locale: 'en-IN',
  module: '12',
  category: 'PAYMENTS',
  deliveryClass: 'TRANSACTIONAL',
  defaultChannels: ['IN_APP', 'SMS'],
  allowedChannels: ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP', 'EMAIL'],
  variablesSchema: { amount: { type: 'money', required: true } },
  smsDltTemplateId: null,
  whatsappTemplateName: null,
  whatsappStatus: null,
  isActive: true,
  textEditedAt: null,
  inAppTitle: 'Payment received',
  inAppBody: 'We received {{amount}}.',
  smsBody: 'Received {{amount}}.',
  version: 3,
  ...over,
});
