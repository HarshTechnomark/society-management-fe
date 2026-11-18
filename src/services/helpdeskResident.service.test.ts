import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { categoriesRaw, issueRowRaw, ticketRaw } from '@/test/helpdeskResidentFixtures';
import { canDo, estimateOpen } from '@/components/helpdesk/resident/format';
import { mapQr, mapTicket, mapTransparency } from './helpdeskResidentMappers';
import { helpdeskResidentService as svc } from './helpdeskResident.service';

beforeEach(resetAll);

describe('mappers', () => {
  it('maps a resident ticket with nested assignment, sla and recent comments', () => {
    const t = mapTicket(ticketRaw());
    expect(t).toMatchObject({
      id: 124,
      kind: 'PERSONAL',
      assigneeLabel: 'Ramesh (plumber)',
      slaState: 'ON_TRACK',
      resolutionDueAt: '2026-11-20T10:30:00.000Z',
      fileIds: [9012],
      version: 4,
    });
    expect(t.comments).toHaveLength(1);
    expect(t.comments[0].body).toBe('Plumber will visit today');
  });

  it('survives missing fields', () => {
    expect(mapTicket(null)).toMatchObject({
      id: 0,
      kind: 'PERSONAL',
      comments: [],
      allowedActions: [],
      charge: null,
    });
  });

  it('upper-cases allowedActions and reads the estimate', () => {
    const t = mapTicket(
      ticketRaw({ allowedActions: ['confirm'], charge: { status: 'ESTIMATE_SENT', estimatePaise: '65000' } }),
    );
    expect(t.allowedActions).toEqual(['CONFIRM']);
    expect(t.charge?.estimatePaise).toBe(65000);
  });

  it('maps the QR landing', () => {
    const q = mapQr({
      location: { id: 77, pathLabel: 'Tower A › Lift 1', nodeType: 'AREA', areaType: 'LIFT' },
      suggestedAffectedLevel: 'BUILDING',
      suggestedCategoryIds: [3],
      openIssuesHere: [issueRowRaw()],
    });
    expect(q.location.id).toBe(77);
    expect(q.suggestedCategoryIds).toEqual([3]);
    expect(q.openIssuesHere[0].upvoteCount).toBe(6);
  });

  it('maps transparency months', () => {
    const m = mapTransparency({
      months: [
        {
          month: '2026-10',
          buildingIssuesRaised: 9,
          resolved: 7,
          medianResolutionHours: 5.5,
          resolutionMetPct: 80,
        },
      ],
    });
    expect(m[0]).toMatchObject({ month: '2026-10', resolved: 7, resolutionMetPct: 80 });
  });
});

describe('real backend shapes', () => {
  const page = { page: 2, limit: 20, total: 41, totalPages: 3 };
  it('reads my tickets as a data array with the pagination beside it', async () => {
    mockApi({ 'GET /me/tickets': ok([ticketRaw()], 'OK', { pagination: page }) });
    const r = await svc.myTickets();
    expect(r).toMatchObject({ total: 41, page: 2, pages: 3 });
    expect(r.items[0]).toMatchObject({ categoryName: 'Plumbing', unitLabel: 'C-0801' });
  });
  it('reads building issues from data.items', async () => {
    mockApi({ 'GET /me/building-issues': ok({ items: [issueRowRaw()] }, 'OK', { pagination: page }) });
    expect((await svc.buildingIssues())[0].title).toBe('Lift stopped');
  });
  it('reads comments as a plain array', async () => {
    mockApi({
      'GET /me/tickets/124/comments': ok([
        { id: 3, kind: 'STATUS_CHANGE', body: null, toStatus: 'RESOLVED' },
      ]),
    });
    const c = await svc.comments(124);
    expect(c[0]).toMatchObject({ id: 3, body: '', toStatus: 'RESOLVED' });
  });
  it('keeps the waiting reason and the estimate of a ticket', () => {
    const t = mapTicket(
      ticketRaw({
        status: 'WAITING_ON_RESIDENT',
        waitingReason: 'ESTIMATE_APPROVAL',
        charge: {
          status: 'ESTIMATE_SENT',
          estimatePaise: 65000,
          estimateNote: 'Parts',
          finalPaise: 0,
          decidedAt: null,
        },
      }),
    );
    expect(estimateOpen(t)).toBe(true);
    expect(estimateOpen({ ...t, waitingReason: 'INFORMATION' })).toBe(false);
  });
  it('lets only allowedActions decide what a resident can do', () => {
    const t = mapTicket(ticketRaw({ status: 'RESOLVED', allowedActions: [] }));
    expect(canDo(t, 'CONFIRM')).toBe(false);
    expect(canDo({ allowedActions: ['RATE'] }, 'RATE')).toBe(true);
  });
});

describe('calls', () => {
  it('lists my tickets with only the fields the API allows', async () => {
    const api = mockApi({ 'GET /me/tickets': ok([ticketRaw()]) });
    const r = await svc.myTickets({ tab: 'OPEN', page: 2, limit: 30, unitId: undefined, kind: undefined });
    expect(api.calls[0].path).toBe('/me/tickets');
    expect(r.items).toHaveLength(1);
    const url = (globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(new URL(url).searchParams.get('tab')).toBe('OPEN');
    expect(new URL(url).searchParams.has('unitId')).toBe(false);
  });

  it('asks for categories of one kind', async () => {
    mockApi({ 'GET /me/ticket-categories': ok(categoriesRaw()) });
    const c = await svc.categories('BUILDING');
    expect(c[0].children[0].name).toBe('Stuck between floors');
    const url = (globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(new URL(url).searchParams.get('kind')).toBe('BUILDING');
  });

  it('drops a one-letter q from the similar check and picks the audience route', async () => {
    const api = mockApi({ 'GET /gate/building-issues/similar': ok({ items: [issueRowRaw()] }) });
    const rows = await svc.similar('gate', { locationNodeId: 77, categoryId: 3, q: 'a' });
    expect(api.calls[0].path).toBe('/gate/building-issues/similar');
    expect(rows[0].title).toBe('Lift stopped');
    const url = (globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(new URL(url).searchParams.has('q')).toBe(false);
  });

  it('sends the report to the right audience route', async () => {
    const api = mockApi({
      'POST /work/building-issues': ok({
        id: 5,
        ticketNo: 'T5',
        status: 'OPEN',
        priority: 'P1',
        affectedUnitCount: 40,
      }),
    });
    const r = await svc.reportIssue('work', { locationNodeId: 77, categoryId: 3, urgency: 'URGENT' });
    expect(api.calls[0].body).toMatchObject({ locationNodeId: 77, urgency: 'URGENT' });
    expect(r.affectedUnitCount).toBe(40);
  });

  it('posts Me too with a note and removes it with DELETE', async () => {
    const api = mockApi({
      'POST /me/tickets/77/upvote': ok({ ticketId: 77, upvoteCount: 7, iUpvoted: true }),
      'DELETE /me/tickets/77/upvote': ok({ ticketId: 77, upvoteCount: 6, iUpvoted: false }),
    });
    expect((await svc.upvote(77, ' same here ')).upvoteCount).toBe(7);
    expect(api.calls[0].body).toEqual({ note: 'same here' });
    expect((await svc.removeUpvote(77)).iUpvoted).toBe(false);
  });

  it('sends the resident actions with the version', async () => {
    const api = mockApi({
      'POST /me/tickets/124/confirm': ok(ticketRaw({ status: 'CLOSED' })),
      'POST /me/tickets/124/estimate-decision': ok(ticketRaw()),
    });
    expect((await svc.confirm(124, { version: 4, score: 5 })).status).toBe('CLOSED');
    await svc.decideEstimate(124, { decision: 'APPROVE', version: 4 });
    expect(api.calls[0].body).toEqual({ version: 4, score: 5 });
    expect(api.calls[1].body).toEqual({ decision: 'APPROVE', version: 4 });
  });

  it('keeps the error code of a duplicate report', async () => {
    mockApi({
      'POST /me/building-issues': err(409, 'SIMILAR_ISSUE_EXISTS', [{ field: 'ticketIds', message: '77' }]),
    });
    await expect(
      svc.reportIssueResident({ locationNodeId: 77, categoryId: 3, urgency: 'NORMAL' }),
    ).rejects.toMatchObject({
      code: 'SIMILAR_ISSUE_EXISTS',
    });
  });
});
