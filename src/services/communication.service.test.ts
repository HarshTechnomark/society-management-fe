import { beforeEach, describe, expect, it } from 'vitest';
import {
  noticeItemRaw,
  noticeRaw,
  notificationRaw,
  pagination,
  prefsRaw,
  previewRaw,
  receiptsRaw,
  resultsRaw,
  surveyItemRaw,
  surveyRaw,
} from '@/test/communicationFixtures';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { NOTICE_LIST_KEYS, RECEIPT_EXPORT_KEYS, RECEIPT_KEYS, noticesService } from './notices.service';
import { SURVEY_LIST_KEYS, surveysService } from './surveys.service';
import { notificationsService } from './notifications.service';
import { mapNotice } from './noticesMappers';
import { mapQuestionResult } from './surveysMappers';

beforeEach(resetAll);
const key = (c: unknown[]) => new Headers((c[1] as RequestInit).headers).get('Idempotency-Key');
const url = (api: ReturnType<typeof mockApi>, i = 0) => new URL(String(api.fn.mock.calls[i][0]));

describe('notices list', () => {
  it('maps items and pagination', async () => {
    mockApi({ 'GET /notices': { data: [noticeItemRaw()], extra: { pagination: pagination(6, 2) } } });
    const r = await noticesService.list({ status: 'ACTIVE' });
    expect(r.items[0]).toMatchObject({ id: 412, number: 'NTC-000412', readCount: 45, ackCount: 29 });
    expect(r.items[0].author?.name).toBe('Arjun Shah');
    expect(r.total).toBe(6);
    expect(r.totalPages).toBe(2);
  });
  it('sends only the strict query keys and drops a one letter search', async () => {
    const api = mockApi({ 'GET /notices': ok([]) });
    await noticesService.list({
      status: 'DRAFT',
      q: 'a',
      category: '',
      page: 2,
      limit: 20,
      bogus: 1,
    } as never);
    const u = url(api);
    for (const k of u.searchParams.keys()) expect(NOTICE_LIST_KEYS).toContain(k);
    expect(u.searchParams.get('q')).toBeNull();
    expect(u.searchParams.get('category')).toBeNull();
    expect(u.searchParams.get('status')).toBe('DRAFT');
  });
});

describe('notice writes', () => {
  it('sends an Idempotency-Key on create, publish and duplicate but not on edits', async () => {
    const api = mockApi({
      'POST /notices': ok(noticeRaw({ status: 'DRAFT' })),
      'POST /notices/412/publish': ok(noticeRaw({ status: 'PENDING_APPROVAL' })),
      'POST /notices/412/duplicate': ok(noticeRaw({ id: 413 })),
      'PATCH /notices/412': ok(noticeRaw()),
      'POST /notices/412/pin': ok(noticeRaw()),
    });
    await noticesService.create({ title: 'Water cut' });
    const r = await noticesService.publish(412, { version: 3 });
    expect(r.notice.status).toBe('PENDING_APPROVAL');
    await noticesService.duplicate(412);
    await noticesService.update(412, { title: 'x', version: 3 });
    await noticesService.pin(412, 3);
    const byPath = (p: string) => api.fn.mock.calls.find(c => String(c[0]).endsWith(p))!;
    expect(key(byPath('/notices'))).toBeTruthy();
    expect(key(byPath('/notices/412/publish'))).toBeTruthy();
    expect(key(byPath('/notices/412/duplicate'))).toBeTruthy();
    expect(key(byPath('/notices/412/pin'))).toBeNull();
    expect(api.last('POST', '/notices/412/publish')?.body).toEqual({ version: 3 });
    expect(api.last('POST', '/notices/412/pin')?.body).toEqual({ version: 3 });
  });
  it('deletes a draft with the version in the query', async () => {
    const api = mockApi({ 'DELETE /notices/412': ok(null) });
    await noticesService.remove(412, 5);
    expect(url(api).searchParams.get('version')).toBe('5');
  });
  it('recall sends reason and notifyRecall; remind returns queuedFor', async () => {
    const api = mockApi({
      'POST /notices/412/recall': ok(noticeRaw({ status: 'RECALLED' })),
      'POST /notices/412/remind': ok({ queuedFor: 35 }),
    });
    await noticesService.recall(412, { version: 3, reason: 'Wrong date', notifyRecall: true });
    expect(api.last('POST', '/notices/412/recall')?.body).toEqual({
      version: 3,
      reason: 'Wrong date',
      notifyRecall: true,
    });
    expect((await noticesService.remind(412, 3)).queuedFor).toBe(35);
  });
});

describe('notice detail people', () => {
  it('maps approvedBy and author as { id, name }', () => {
    const n = mapNotice(noticeRaw({ approvedBy: { id: 4, name: 'Sanjay Patil' } }));
    expect(n.approvedBy).toEqual({ id: 4, name: 'Sanjay Patil' });
    expect(n.author).toEqual({ id: 21, name: 'Arjun Shah' });
    expect(mapNotice(noticeRaw()).approvedBy).toBeNull();
  });
  it('acknowledges a role notice on the admin route', async () => {
    const api = mockApi({
      'POST /notices/412/acknowledge': ok({ noticeId: 412, acknowledgedAt: 'x', revisionNo: 1 }),
    });
    expect((await noticesService.acknowledge(412)).acknowledgedAt).toBe('x');
    expect(api.last('POST', '/notices/412/acknowledge')).toBeTruthy();
  });
});

describe('notice detail, preview, templates', () => {
  it('maps the 8.5 shape and sanitises nothing itself', () => {
    const n = mapNotice(
      noticeRaw({
        status: 'PENDING_APPROVAL',
        approval: { requestId: 77, status: 'PENDING', statusLabel: 'Waiting for Chairman' },
        actions: [
          {
            type: 'PAY_COLLECTION',
            refId: 2,
            label: 'Pay',
            target: { title: 'Terrace', status: 'PUBLISHED' },
          },
        ],
        attachments: [{ fileId: 9031, name: 'quotes.pdf', sizeBytes: 412000, status: 'CLEAN' }],
      }),
    );
    expect(n.approval).toEqual({ requestId: 77, status: 'PENDING', statusLabel: 'Waiting for Chairman' });
    expect(n.actions[0]).toMatchObject({
      type: 'PAY_COLLECTION',
      refId: 2,
      target: { title: 'Terrace', status: 'PUBLISHED' },
    });
    expect(n.audience).toMatchObject({ type: 'BUILDINGS', ids: [11], label: 'Tower A' });
    expect(n.attachments[0].name).toBe('quotes.pdf');
    expect(n.utility).toBeNull();
  });
  it('reads the utility block of a shutdown notice', () => {
    const n = mapNotice(
      noticeRaw({ kind: 'UTILITY_SHUTDOWN', utilityType: 'WATER', outageStartsAt: 'a', outageEndsAt: 'b' }),
    );
    expect(n.utility).toMatchObject({ type: 'WATER', startsAt: 'a', endsAt: 'b', restoredAt: null });
  });
  it('posts the audience for a preview and maps the counts', async () => {
    const api = mockApi({ 'POST /notices/audience-preview': ok(previewRaw()) });
    const p = await noticesService.audiencePreview({ type: 'ALL', relation: 'ANY' });
    expect(api.last('POST', '/notices/audience-preview')?.body).toEqual({
      audience: { type: 'ALL', relation: 'ANY' },
    });
    expect(p).toMatchObject({ units: 64, people: 141, withoutLogin: 23 });
  });
  it('loads templates as a plain array', async () => {
    mockApi({
      'GET /notices/templates': ok([
        {
          key: 'water_cut',
          locale: 'en-IN',
          title: 'Water cut',
          body: '<p>x</p>',
          category: 'MAINTENANCE',
          kind: 'UTILITY_SHUTDOWN',
          utilityType: 'WATER',
        },
      ]),
    });
    expect((await noticesService.templates())[0]).toMatchObject({ key: 'water_cut', utilityType: 'WATER' });
  });
});

describe('receipts', () => {
  it('reads summary, items and paging', async () => {
    mockApi({
      'GET /notices/412/receipts': { data: receiptsRaw(), extra: { pagination: pagination(141, 8) } },
    });
    const r = await noticesService.receipts(412, { filter: 'NOT_READ' });
    expect(r.summary).toMatchObject({ recipients: 141, reached: 132, acknowledged: 64 });
    expect(r.summary.byBuilding[0]).toMatchObject({ code: 'A', unitsRead: 51 });
    expect(r.summary.byChannel.PUSH).toBe(92);
    expect(r.items[0]).toMatchObject({ unitLabel: 'A-101', mobile: '98XXXXX111', reachedVia: 'PUSH' });
    expect(r.totalPages).toBe(8);
  });
  it('sends strict keys, and the export has no paging', async () => {
    const api = mockApi({
      'GET /notices/412/receipts': { data: receiptsRaw(), extra: { pagination: pagination() } },
      'GET /notices/412/receipts/export': ok('x'),
    });
    await noticesService.receipts(412, { filter: 'UNREACHED', page: 2, limit: 20, q: 'a', zzz: 1 } as never);
    for (const k of url(api).searchParams.keys()) expect(RECEIPT_KEYS).toContain(k);
    expect(url(api).searchParams.get('q')).toBeNull();
    await noticesService
      .exportReceipts(412, { filter: 'NOT_ACKED', page: 3, limit: 20 })
      .catch(() => undefined);
    const u = url(api, 1);
    for (const k of u.searchParams.keys()) expect(RECEIPT_EXPORT_KEYS).toContain(k);
    expect(u.searchParams.get('page')).toBeNull();
    expect(u.searchParams.get('filter')).toBe('NOT_ACKED');
  });
});

describe('surveys', () => {
  it('lists with strict keys and maps counts', async () => {
    const api = mockApi({ 'GET /surveys': { data: [surveyItemRaw()], extra: { pagination: pagination() } } });
    const r = await surveysService.list({ status: 'OPEN', q: 'g', sortBy: 'closesAt' });
    for (const k of url(api).searchParams.keys()) expect(SURVEY_LIST_KEYS).toContain(k);
    expect(url(api).searchParams.get('q')).toBeNull();
    expect(r.items[0]).toMatchObject({ id: 9, responseCount: 100, recipientCount: 141, isAnonymous: true });
  });
  it('maps a draft with questions and options', async () => {
    mockApi({ 'GET /surveys/9': ok(surveyRaw()) });
    const s = await surveysService.get(9);
    expect(s.questions[0].options).toEqual([
      { key: 'o1', label: '6–9 am' },
      { key: 'o2', label: '6–9 pm' },
    ]);
    expect(s.audience.type).toBe('ALL');
  });
  it('creates with an Idempotency-Key and publishes with closesAt', async () => {
    const api = mockApi({
      'POST /surveys': ok(surveyRaw()),
      'POST /surveys/9/publish': ok(surveyRaw({ status: 'OPEN' })),
    });
    await surveysService.create({ title: 'Gym timings' });
    await surveysService.publish(9, { version: 2, closesAt: '2026-12-01T00:00:00.000Z' });
    expect(key(api.fn.mock.calls[0])).toBeTruthy();
    expect(key(api.fn.mock.calls[1])).toBeTruthy();
    expect(api.last('POST', '/surveys/9/publish')?.body).toEqual({
      version: 2,
      closesAt: '2026-12-01T00:00:00.000Z',
    });
  });
  it('maps results for every question type', async () => {
    mockApi({ 'GET /surveys/9/results': ok(resultsRaw()) });
    const r = await surveysService.results(9);
    expect(r).toMatchObject({ responses: 100, recipients: 141 });
    expect(r.questions[0].options[0]).toMatchObject({ count: 61, pct: '62.2' });
    expect(r.questions[1]).toMatchObject({ average: '3.90' });
    expect(r.questions[1].distribution['4']).toBe(40);
    expect(r.questions[2]).toMatchObject({ nps: 22, promoters: 40 });
    expect(mapQuestionResult(r.questions[3])).toMatchObject({ hidden: true, samples: [] });
  });
});

describe('notifications, preferences and push', () => {
  it('lists the inbox with strict keys and reads the unread count', async () => {
    const api = mockApi({
      'GET /notifications': {
        data: [notificationRaw()],
        extra: { pagination: pagination(12, 1), unreadCount: 3 },
      },
      'GET /notifications/unread-count': ok({ count: 3 }),
    });
    const r = await notificationsService.list({ unread: true, limit: 15, bogus: 1 } as never);
    expect(r.items[0]).toMatchObject({ id: 77120, tone: 'warn', deepLink: '/approvals/77', readAt: null });
    expect([...url(api).searchParams.keys()].sort()).toEqual(['limit', 'unread']);
    expect(r.unreadCount).toBe(3);
    expect(r.total).toBe(12);
    expect(await notificationsService.unreadCount()).toBe(3);
  });
  it('uses the platform routes for the platform bell', async () => {
    const api = mockApi({
      'GET /platform/notifications': { data: [], extra: { pagination: pagination(0), unreadCount: 0 } },
      'GET /platform/notifications/unread-count': ok({ count: 2 }),
      'POST /platform/notifications/read-all': ok({ updated: 0 }),
    });
    await notificationsService.list({}, 'platform');
    expect(await notificationsService.unreadCount('platform')).toBe(2);
    await notificationsService.markAllRead(undefined, 'platform');
    expect(api.calls.map(c => c.path)).toEqual([
      '/platform/notifications',
      '/platform/notifications/unread-count',
      '/platform/notifications/read-all',
    ]);
  });
  it('marks one and all read', async () => {
    const api = mockApi({
      'POST /notifications/5/read': ok(null),
      'POST /notifications/read-all': ok({ updated: 4 }),
    });
    await notificationsService.markRead(5);
    expect(await notificationsService.markAllRead('APPROVALS')).toBe(4);
    expect(api.last('POST', '/notifications/read-all')?.body).toEqual({ category: 'APPROVALS' });
  });
  it('maps preferences and puts them back as sent', async () => {
    const api = mockApi({
      'GET /me/notification-preferences': ok(prefsRaw()),
      'PUT /me/notification-preferences': ok(prefsRaw()),
    });
    const p = await notificationsService.preferences();
    expect(p.categories[2]).toMatchObject({ key: 'EMERGENCY', locked: true });
    expect(p.whatsapp).toMatchObject({ optIn: false, available: true });
    expect(p.version).toBe(4);
    await notificationsService.savePreferences({
      version: 4,
      locale: null,
      categories: { PAYMENTS: { PUSH: true, SMS: true, WHATSAPP: true, EMAIL: true } },
      quietHours: { mode: 'OFF' },
      whatsappOptIn: false,
    });
    expect((api.last('PUT', '/me/notification-preferences')?.body as { version: number }).version).toBe(4);
  });
  it('registers, tests and removes a push subscription', async () => {
    const api = mockApi({
      'GET /me/push-subscriptions': ok([
        {
          id: 3,
          app: 'ADMIN',
          deviceLabel: 'Chrome',
          status: 'ACTIVE',
          createdAt: 'x',
          lastSuccessAt: null,
          isThisDevice: true,
        },
      ]),
      'POST /me/push-subscriptions': ok({ id: 3, status: 'ACTIVE' }),
      'POST /me/push-subscriptions/3/test': ok(null),
      'DELETE /me/push-subscriptions/3': ok(null),
      'GET /public/push/vapid-public-key': ok({ publicKey: 'BKEY' }),
    });
    expect((await notificationsService.pushList())[0]).toMatchObject({ id: 3, isThisDevice: true });
    expect(
      await notificationsService.pushRegister({
        endpoint: 'https://fcm.googleapis.com/x',
        keys: { p256dh: 'a', auth: 'b' },
        app: 'ADMIN',
      }),
    ).toEqual({ id: 3, status: 'ACTIVE' });
    await notificationsService.pushTest(3);
    await notificationsService.pushRemove(3);
    expect(await notificationsService.vapidKey()).toBe('BKEY');
    expect(api.last('POST', '/me/push-subscriptions')?.body).toMatchObject({ app: 'ADMIN' });
  });
});
