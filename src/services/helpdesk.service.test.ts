import { beforeEach, describe, expect, it } from 'vitest';
import { assigneesRaw, itemRaw, listData, ticketRaw } from '@/test/helpdeskFixtures';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { helpdeskService, TICKET_LIST_KEYS } from './helpdesk.service';
import { helpdeskSettingsService } from './helpdeskSettings.service';
import { categoryRaw, policyRaw, ruleRaw, settingsRaw } from '@/test/helpdeskFixtures';

beforeEach(resetAll);

const key = (c: unknown[]) => new Headers((c[1] as RequestInit).headers).get('Idempotency-Key');

describe('helpdesk list', () => {
  it('reads items, counts and pagination from the data object', async () => {
    mockApi({ 'GET /tickets': ok(listData([itemRaw(), itemRaw({ id: 125 })])) });
    const r = await helpdeskService.list({ view: 'OPEN' });
    expect(r.items.map(i => i.id)).toEqual([124, 125]);
    expect(r.counts.OPEN).toBe(18);
    expect(r.totalPages).toBe(1);
  });
  it('also accepts a plain array of rows', async () => {
    mockApi({ 'GET /tickets': ok([itemRaw()]) });
    const r = await helpdeskService.list();
    expect(r.items).toHaveLength(1);
    expect(r.counts.ALL).toBe(0);
  });
  it('sends only allowed fields and drops a one letter search', async () => {
    const api = mockApi({ 'GET /tickets': ok(listData([])) });
    await helpdeskService.list({
      view: 'URGENT',
      q: 'a',
      priority: 'P1',
      page: 2,
      limit: 20,
      bogus: 1,
      status: '',
    } as never);
    const u = new URL(String(api.fn.mock.calls[0][0]));
    for (const k of u.searchParams.keys()) expect(TICKET_LIST_KEYS).toContain(k);
    expect(u.searchParams.get('q')).toBeNull();
    expect(u.searchParams.get('status')).toBeNull();
    expect(u.searchParams.get('view')).toBe('URGENT');
  });
  it('exports with the same filters but no paging', async () => {
    const api = mockApi({ 'GET /tickets/export': ok('x') });
    await helpdeskService.exportCsv({ view: 'OPEN', page: 3, limit: 20 }).catch(() => undefined);
    const u = new URL(String(api.fn.mock.calls[0][0]));
    expect(u.searchParams.get('page')).toBeNull();
    expect(u.searchParams.get('view')).toBe('OPEN');
  });
});

describe('helpdesk detail and writes', () => {
  it('maps the ticket with its timeline and similar issues', async () => {
    mockApi({ 'GET /tickets/124': ok(ticketRaw()) });
    const t = await helpdeskService.get(124);
    expect(t.locationLabel).toContain('Lift 2');
    expect(t.comments[0].visibility).toBe('INTERNAL');
    expect(t.similarOpen[0].id).toBe(120);
    expect(t.allowedActions).toEqual(['START', 'CANCEL']);
  });
  it('maps assignees and stats', async () => {
    mockApi({
      'GET /tickets/assignees': ok(assigneesRaw()),
      'GET /tickets/stats': ok({ open: 4, openByPriority: { P1: 1 }, resolutionMetPct: 84.5 }),
    });
    const a = await helpdeskService.assignees();
    expect(a.staff[0].staffId).toBe(7);
    const s = await helpdeskService.stats({ from: '2026-11-01', bogus: 1 } as never);
    expect(s.openByPriority).toEqual({ P1: 1, P2: 0, P3: 0, P4: 0 });
    expect(s.responseMetPct).toBeNull();
  });
  it('sends create, transition, estimate and comment with an Idempotency-Key', async () => {
    const api = mockApi({
      'POST /tickets': ok({ id: 1, ticketNo: 'T', kind: 'PERSONAL', similarOpenTicketIds: [3] }),
      'POST /building-issues': ok({ id: 2, ticketNo: 'T2', affectedUnitCount: 96 }),
      'POST /tickets/1/transition': ok(ticketRaw()),
      'POST /tickets/1/estimate': ok(ticketRaw()),
      'POST /tickets/1/comments': ok({ id: 1, body: 'x' }),
    });
    const c = await helpdeskService.createPersonal({
      unitId: 1,
      channel: 'PHONE',
      categoryId: 2,
      title: 'Leak in bath',
      description: 'Water is leaking in the bathroom',
    });
    expect(c.similarOpenTicketIds).toEqual([3]);
    const b = await helpdeskService.createBuilding({ locationNodeId: 7, categoryId: 3, urgency: 'URGENT' });
    expect(b.affectedUnitCount).toBe(96);
    await helpdeskService.transition(1, { action: 'START', version: 2 });
    await helpdeskService.estimate(1, { estimatePaise: 65000, note: 'Hinge and labour', version: 3 });
    await helpdeskService.addComment(1, { body: 'hello' });
    for (const call of api.fn.mock.calls) expect(key(call), String(call[0])).toBeTruthy();
    expect(api.last('POST', '/tickets/1/transition')?.body).toEqual({ action: 'START', version: 2 });
  });
  it('assign, unassign, merge and patch carry the version', async () => {
    const api = mockApi({
      'POST /tickets/1/assign': ok(ticketRaw()),
      'POST /tickets/1/unassign': ok(ticketRaw()),
      'POST /tickets/1/merge': ok({ duplicate: ticketRaw({ id: 1 }), primary: ticketRaw({ id: 2 }) }),
      'PATCH /tickets/1': ok(ticketRaw()),
    });
    await helpdeskService.assign(1, { assigneeType: 'MEMBER', userId: 41, version: 2 });
    await helpdeskService.unassign(1, { reason: 'Wrong person', version: 3 });
    const m = await helpdeskService.merge(1, { intoTicketId: 2, version: 4 });
    expect(m.primary.id).toBe(2);
    await helpdeskService.update(1, { priority: 'P2', priorityReason: 'Not urgent now', version: 5 });
    expect(api.last('PATCH', '/tickets/1')?.body).toMatchObject({ version: 5 });
  });
  it('checks for similar building issues with only the allowed fields', async () => {
    const api = mockApi({
      'GET /building-issues/similar': ok({ items: [{ id: 5, title: 'Lift', priority: 'P1' }] }),
    });
    const r = await helpdeskService.similar({ locationNodeId: 7, categoryId: 3, q: 'l' });
    expect(r[0].id).toBe(5);
    const u = new URL(String(api.fn.mock.calls[0][0]));
    expect(u.searchParams.get('locationNodeId')).toBe('7');
    expect(u.searchParams.get('q')).toBeNull();
  });
});

describe('helpdesk settings service', () => {
  it('maps categories, policies, rules and settings', async () => {
    mockApi({
      'GET /ticket-categories': ok([categoryRaw()]),
      'GET /sla-policies': ok([policyRaw()]),
      'GET /escalation-rules': ok([ruleRaw()]),
      'GET /helpdesk/settings': ok(settingsRaw()),
    });
    const c = await helpdeskSettingsService.categories();
    expect(c[0].children[0].defaultAssigneeType).toBe('INHERIT');
    const p = await helpdeskSettingsService.policies();
    expect(p[0].p3Calendar).toBe('BUSINESS_HOURS');
    const r = await helpdeskSettingsService.rules();
    expect(r[0].targetLabel).toBe('Chairman');
    const s = await helpdeskSettingsService.settings();
    expect(s['helpdesk.showReporterOnBuildingIssues']).toEqual({
      key: 'helpdesk.showReporterOnBuildingIssues',
      value: false,
      version: 2,
    });
  });
  it('keeps version 0 of a setting that is still the default and the user name of a rule target', async () => {
    mockApi({
      'GET /helpdesk/settings': ok({ 'helpdesk.maxReopens': { value: 2, version: 0 } }),
      'GET /escalation-rules': ok([{ ...ruleRaw(), targetUserName: 'Asha', categoryName: 'Lift' }]),
    });
    expect((await helpdeskSettingsService.settings())['helpdesk.maxReopens']).toMatchObject({
      value: 2,
      version: 0,
    });
    const r = (await helpdeskSettingsService.rules())[0];
    expect(r).toMatchObject({ targetLabel: 'Asha', categoryName: 'Lift' });
  });
  it('reads settings given as a list of key, value, version', async () => {
    mockApi({ 'GET /helpdesk/settings': ok([{ key: 'helpdesk.maxReopens', value: '3', version: 4 }]) });
    const s = await helpdeskSettingsService.settings();
    expect(s['helpdesk.maxReopens'].value).toBe(3);
  });
  it('creates with an Idempotency-Key, patches with a version, deletes with the version in the query', async () => {
    const api = mockApi({
      'POST /ticket-categories': ok(categoryRaw()),
      'PATCH /ticket-categories/3': ok(categoryRaw()),
      'POST /ticket-categories/3/archive': ok(categoryRaw()),
      'POST /sla-policies': ok(policyRaw()),
      'POST /escalation-rules': ok(ruleRaw()),
      'DELETE /escalation-rules/5': ok(null),
      'PATCH /helpdesk/settings': ok(settingsRaw()),
    });
    await helpdeskSettingsService.createCategory({ name: 'Lift', scope: 'BUILDING' });
    await helpdeskSettingsService.updateCategory(3, { name: 'Lifts', version: 1 });
    await helpdeskSettingsService.archiveCategory(3, 2);
    await helpdeskSettingsService.createPolicy({ name: 'Fast' });
    await helpdeskSettingsService.createRule({ name: 'Late', triggerType: 'RESPONSE_SLA' });
    await helpdeskSettingsService.deleteRule(5, 3);
    await helpdeskSettingsService.saveSettings([{ key: 'helpdesk.maxReopens', value: 4, version: 1 }]);
    const posts = api.fn.mock.calls.filter(c => (c[1] as RequestInit).method === 'POST');
    expect(key(posts[0])).toBeTruthy();
    expect(new URL(String(api.fn.mock.calls[5][0])).searchParams.get('version')).toBe('3');
    expect(api.last('PATCH', '/helpdesk/settings')?.body).toEqual({
      changes: [{ key: 'helpdesk.maxReopens', value: 4, version: 1 }],
    });
  });
});
