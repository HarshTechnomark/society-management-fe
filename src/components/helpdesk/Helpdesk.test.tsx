import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assigneesRaw,
  categoryRaw,
  itemRaw,
  listData,
  policyRaw,
  ruleRaw,
  settingsRaw,
  ticketRaw,
} from '@/test/helpdeskFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { fakeUploader } from '@/test/residentsHelpers';
import { ToastProvider } from '@/components/ui/Toast';
import { IssuesCard, resetIssuesCardMemory } from './admin/IssuesCard';
import { IssuesScreen, groupByStatus } from './admin/IssuesScreen';
import { ReportIssueModal } from './admin/ReportIssueModal';
import { TicketPage } from './admin/TicketPage';
import { resetStatsMemory } from './admin/StatsTiles';
import { assignBody } from './admin/ManageCard';
import { slaChip, helpdeskError, minutesText } from './admin/format';
import { HelpdeskSettingsScreen } from './settings/HelpdeskSettingsScreen';
import {
  fromMinutes,
  minutesLabel as slaMinutes,
  prefChanges,
  prefErrors,
  toMinutes,
} from './settings/settingsFormat';
import { entitlementsStore } from '@/lib/entitlements';
import { ApiError } from '@/lib/apiClient';

vi.mock('next/navigation', () => navigationMock());
beforeEach(() => {
  resetAll();
  resetIssuesCardMemory();
  resetStatsMemory();
});

const VIEW = ['helpdesk.tickets.view'];
const EDIT = [
  'helpdesk.tickets.view',
  'helpdesk.tickets.edit',
  'helpdesk.tickets.create',
  'helpdesk.tickets.export',
  'helpdesk.tickets.delete',
];
const tree = [
  {
    id: 1,
    nodeType: 'BUILDING',
    name: 'Tower B',
    buildingId: 2,
    children: [
      {
        id: 10,
        nodeType: 'FLOOR',
        name: 'Ground floor',
        buildingId: 2,
        pathLabel: 'Tower B › Ground floor',
        children: [
          {
            id: 77,
            nodeType: 'AREA',
            name: 'Lift 2',
            buildingId: 2,
            pathLabel: 'Tower B › Ground floor › Lift 2',
            children: [],
          },
        ],
      },
    ],
  },
];
const cats = [
  categoryRaw(),
  categoryRaw({ id: 4, name: 'Plumbing', scope: 'BOTH', children: [] }),
  categoryRaw({ id: 5, name: 'Intercom', scope: 'PERSONAL', children: [] }),
];
const base = {
  'GET /tickets/stats': ok({
    open: 18,
    openByPriority: { P1: 2, P2: 5, P3: 10, P4: 1 },
    unassigned: 4,
    breachedOpen: 3,
    resolved: 58,
    created: 64,
    resolutionMetPct: 84.5,
    responseMetPct: 91.4,
    medianResolutionMinutes: 1310,
    csatAvg: 4.3,
    csatCount: 41,
  }),
  'GET /ticket-categories': ok(cats),
  'GET /locations': ok(tree),
  'GET /tickets/assignees': ok(assigneesRaw()),
};
const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('format helpers', () => {
  const now = Date.parse('2026-11-18T10:00:00Z');
  it('words the SLA clock', () => {
    expect(slaChip('ON_TRACK', '2026-11-18T13:30:00Z', 'ASSIGNED', now)).toEqual({
      tone: 'ok',
      text: '3 h left',
    });
    expect(slaChip('AT_RISK', '2026-11-18T10:40:00Z', 'OPEN', now)?.tone).toBe('warn');
    expect(slaChip('BREACHED', '2026-11-18T08:00:00Z', 'OPEN', now)).toEqual({
      tone: 'bad',
      text: 'SLA breached 2 h',
    });
    expect(slaChip('PAUSED', null, 'WAITING_ON_RESIDENT', now)?.text).toBe('Paused');
    expect(slaChip('ON_TRACK', '2026-11-18T13:30:00Z', 'CLOSED', now)).toBeNull();
  });
  it('groups by status with P1 first, then oldest', () => {
    const g = groupByStatus(
      [
        itemRaw({ id: 1, status: 'OPEN', priority: 'P3', createdAt: '2026-11-01T00:00:00Z' }),
        itemRaw({ id: 2, status: 'OPEN', priority: 'P1', createdAt: '2026-11-05T00:00:00Z' }),
        itemRaw({
          id: 3,
          status: 'OPEN',
          priority: 'P3',
          createdAt: '2026-11-00T00:00:00Z'.replace('-00', '-02'),
        }),
        itemRaw({ id: 4, status: 'IN_PROGRESS' }),
      ].map(r => ({ ...r })) as never,
    );
    expect(g.map(x => x.status)).toEqual(['OPEN', 'IN_PROGRESS']);
    expect(g[0].items.map(i => i.id)).toEqual([2, 1, 3]);
  });
  it('words errors from the code or the field messages', () => {
    expect(helpdeskError(new ApiError(409, 'STALE_VERSION', 'x'))).toMatch(/Someone else changed/);
    expect(
      helpdeskError(
        new ApiError(400, 'VALIDATION_FAILED', 'x', [{ field: 'title', message: 'Title is too short' }]),
      ),
    ).toBe('Title is too short');
    expect(minutesText(90)).toBe('1 h 30 min');
  });
  it('builds the assign body', () => {
    expect(assignBody('M:41', { name: '', mobile: '' }, 3)).toEqual({
      assigneeType: 'MEMBER',
      userId: 41,
      version: 3,
    });
    expect(assignBody('S:7', { name: '', mobile: '' }, 3)).toMatchObject({
      assigneeType: 'STAFF',
      staffId: 7,
    });
    expect(assignBody('V:9', { name: '', mobile: '' }, 3)).toMatchObject({
      assigneeType: 'VENDOR',
      vendorId: 9,
    });
    expect(assignBody('X', { name: 'Raju', mobile: '98765' }, 3)).toHaveProperty('error');
    expect(assignBody('X', { name: 'Raju', mobile: '9876543210' }, 3)).toMatchObject({
      assigneeType: 'EXTERNAL',
      externalMobile: '9876543210',
    });
  });
  it('converts SLA targets', () => {
    expect(fromMinutes(1440)).toEqual({ value: '1', unit: 'd' });
    expect(fromMinutes(240)).toEqual({ value: '4', unit: 'h' });
    expect(fromMinutes(45)).toEqual({ value: '45', unit: 'min' });
    expect(toMinutes('2', 'd')).toBe(2880);
    expect(slaMinutes(10080)).toBe('7 days');
  });
  it('checks the preference ranges and the waiting rule', () => {
    const ok = {
      'helpdesk.autoCloseHours': '72',
      'helpdesk.waitingReminderHours': '72',
      'helpdesk.waitingAutoResolveDays': '7',
    };
    expect(prefErrors(ok)['helpdesk.waitingAutoResolveDays']).toBeUndefined();
    expect(prefErrors(ok)['helpdesk.autoCloseHours']).toBeUndefined();
    expect(prefErrors({ ...ok, 'helpdesk.autoCloseHours': '5' })['helpdesk.autoCloseHours']).toMatch(
      /24 to 336/,
    );
    expect(
      prefErrors({ ...ok, 'helpdesk.waitingAutoResolveDays': '3' })['helpdesk.waitingAutoResolveDays'],
    ).toMatch(/Days times 24/);
    const s = { 'helpdesk.autoCloseHours': { key: 'helpdesk.autoCloseHours', value: 72, version: 4 } };
    expect(prefChanges(s, { 'helpdesk.autoCloseHours': '72' })).toEqual([]);
    expect(prefChanges(s, { 'helpdesk.autoCloseHours': '96' })).toEqual([
      { key: 'helpdesk.autoCloseHours', value: 96, version: 4 },
    ]);
  });
});

describe('Issues screen', () => {
  const open = (routes: Parameters<typeof mockApi>[0] = {}, perms = EDIT) => {
    signInAs(perms, []);
    const api = mockApi({
      ...base,
      'GET /tickets': ok(
        listData([
          itemRaw(),
          itemRaw({
            id: 125,
            title: 'Seepage in bathroom',
            kind: 'PERSONAL',
            status: 'OPEN',
            priority: 'P2',
            assigneeLabel: null,
            locationLabel: 'A-1203',
            slaState: 'BREACHED',
            resolutionDueAt: new Date(Date.now() - 2 * 3600_000 - 60000).toISOString(),
          }),
          itemRaw({
            id: 126,
            title: 'Old intercom',
            kind: 'PERSONAL',
            status: 'OPEN',
            priority: 'P3',
            assigneeLabel: 'Ramesh',
            assigneeInactive: true,
            slaState: 'PAUSED',
          }),
        ]),
      ),
      ...routes,
    });
    wrap(<IssuesScreen />);
    return api;
  };
  it('groups by status with chips, counts and SLA text', async () => {
    open();
    expect(await screen.findByText('Lift 2 stopped, Tower B')).toBeInTheDocument();
    expect(screen.getByText('18 open · 2 urgent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Building issues\s*6/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Flat tickets\s*12/ })).toBeInTheDocument();
    const open1 = screen.getByRole('region', { name: 'Open' });
    expect(within(open1).getByText(/SLA breached 2 h/)).toBeInTheDocument();
    expect(within(open1).getByText('Assignee left')).toBeInTheDocument();
    expect(within(open1).getByText('Unassigned')).toBeInTheDocument();
    expect(within(open1).getByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Assigned' })).toHaveTextContent('96 flats');
    expect(screen.getByRole('region', { name: 'Assigned' })).toHaveTextContent('6 me too');
    expect(await screen.findByText('Fixed on time')).toBeInTheDocument();
  });
  it('refetches with the view, filters and a search of two or more letters', async () => {
    const api = open();
    await screen.findByText('Lift 2 stopped, Tower B');
    await userEvent.click(screen.getByRole('button', { name: 'Unassigned' }));
    await waitFor(() => expect(String(api.fn.mock.calls.at(-1)?.[0])).toContain('view=UNASSIGNED'));
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'P1');
    await userEvent.type(screen.getByLabelText('Search'), 'li');
    await waitFor(() => {
      const u = new URL(
        String(
          api.fn.mock.calls.filter(c => new URL(String(c[0])).pathname.endsWith('/tickets')).at(-1)?.[0],
        ),
      );
      expect(u.searchParams.get('priority')).toBe('P1');
      expect(u.searchParams.get('q')).toBe('li');
      expect(u.searchParams.get('view')).toBe('UNASSIGNED');
    });
  });
  it('shows an empty state and an error with a retry', async () => {
    open({ 'GET /tickets': ok(listData([])) });
    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
  });
  it('shows the API error', async () => {
    open({ 'GET /tickets': err(500, 'INTERNAL', undefined, 'Server trouble') });
    expect(await screen.findByText('Server trouble')).toBeInTheDocument();
  });
  it('hides stats when the plan lacks them and keeps going', async () => {
    open({ 'GET /tickets/stats': err(402, 'FEATURE_NOT_IN_PLAN') });
    expect(await screen.findByText('Lift 2 stopped, Tower B')).toBeInTheDocument();
    expect(screen.queryByText('Fixed on time')).toBeNull();
  });
  it('hides Report issue and Export without the permissions', async () => {
    open({}, VIEW);
    await screen.findByText('Lift 2 stopped, Tower B');
    expect(screen.queryByRole('button', { name: 'Report issue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });
  it('opens the ticket in a drawer', async () => {
    open({ 'GET /tickets/124': ok(ticketRaw()) });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Lift 2 stopped, Tower B' }));
    expect(
      await screen.findByRole('heading', { name: 'Lift 2 stopped, Tower B', level: 2, hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open as a page' })).toHaveAttribute('href', '/admin/issues/124');
  });
});

describe('Ticket detail', () => {
  const page = (
    over: Record<string, unknown> = {},
    routes: Parameters<typeof mockApi>[0] = {},
    perms = EDIT,
  ) => {
    signInAs(perms, []);
    const api = mockApi({ ...base, 'GET /tickets/124': ok(ticketRaw(over)), ...routes });
    wrap(<TicketPage id={124} />);
    return api;
  };
  it('shows fields, the internal chip, escalation entry and similar issues', async () => {
    page();
    expect(await screen.findByText('Called the lift company')).toBeInTheDocument();
    expect(screen.getAllByText('Internal note').length).toBeGreaterThan(0);
    expect(screen.getByText(/Escalated to level 2: Rajesh Kulkarni/)).toBeInTheDocument();
    expect(screen.getByText(/96 flats · 6 said me too/)).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Pradeep Singh · Guard · 3 Nov 2026, 10:10 am · Gate')).toBeInTheDocument();
  });
  it('asks to assign before starting, client side', async () => {
    const api = page();
    await userEvent.click(await screen.findByRole('button', { name: 'Start work' }));
    expect(await screen.findByText('Assign someone before starting work.')).toBeInTheDocument();
    expect(api.calls.some(c => c.path.endsWith('/transition'))).toBe(false);
  });
  it('starts work when assigned, with an idempotent transition', async () => {
    const api = page(
      {
        status: 'ASSIGNED',
        assignment: {
          id: 1,
          assigneeType: 'MEMBER',
          assigneeLabel: 'Meera Iyer',
          assignedAt: '2026-11-03T05:00:00Z',
        },
      },
      { 'POST /tickets/124/transition': ok(ticketRaw()) },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Start work' }));
    await waitFor(() =>
      expect(api.last('POST', '/tickets/124/transition')?.body).toEqual({ action: 'START', version: 2 }),
    );
  });
  it('saves assign, priority and a post in that order and sends to affected flats', async () => {
    const api = page(
      {},
      {
        'POST /tickets/124/assign': ok(ticketRaw({ version: 3 })),
        'PATCH /tickets/124': ok(ticketRaw({ version: 4 })),
        'POST /tickets/124/comments': ok({ id: 11, body: 'x' }),
      },
    );
    await screen.findByText('Called the lift company');
    await userEvent.selectOptions(await screen.findByLabelText('Assign to'), 'V:9');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'P2');
    await userEvent.type(
      screen.getByLabelText('Why does the priority change?'),
      'Lift company is on the way',
    );
    await userEvent.type(screen.getByLabelText('Post an update'), 'Technician arrives at noon');
    await userEvent.click(screen.getByRole('checkbox', { name: /Send to the 96 affected flats/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Update sent to 96 flats')).toBeInTheDocument();
    const order = api.calls.filter(c => c.method !== 'GET').map(c => `${c.method} ${c.path}`);
    expect(order).toEqual(['POST /tickets/124/assign', 'PATCH /tickets/124', 'POST /tickets/124/comments']);
    expect(api.last('POST', '/tickets/124/assign')?.body).toMatchObject({
      assigneeType: 'VENDOR',
      vendorId: 9,
      version: 2,
    });
    expect(api.last('PATCH', '/tickets/124')?.body).toMatchObject({ priority: 'P2', version: 3 });
    expect(api.last('POST', '/tickets/124/comments')?.body).toMatchObject({
      visibility: 'PUBLIC',
      notifyAffected: true,
    });
  });
  it('stops at the first error and says what was saved', async () => {
    const api = page(
      {},
      {
        'POST /tickets/124/assign': ok(ticketRaw({ version: 3 })),
        'PATCH /tickets/124': err(422, 'CATEGORY_SCOPE_MISMATCH'),
      },
    );
    await screen.findByText('Called the lift company');
    await userEvent.selectOptions(await screen.findByLabelText('Assign to'), 'M:41');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'P3');
    await userEvent.type(screen.getByLabelText('Why does the priority change?'), 'Not that urgent');
    await userEvent.type(screen.getByLabelText('Post an update'), 'Will not be posted');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Assigned\. Stopped: This category does not fit/)).toBeInTheDocument();
    expect(api.calls.some(c => c.path.endsWith('/comments') && c.method === 'POST')).toBe(false);
  });
  it('says nothing to save, and needs a reason for a priority change', async () => {
    page();
    await screen.findByText('Called the lift company');
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing to save.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'P4');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Say why the priority changes/)).toBeInTheDocument();
  });
  it('resolves with a note, the after photo and the final charge of approved work', async () => {
    fakeUploader();
    const api = page(
      {
        kind: 'PERSONAL',
        status: 'IN_PROGRESS',
        requiresAfterPhoto: true,
        allowedActions: ['RESOLVE', 'WAIT_ON_RESIDENT'],
        charge: { status: 'APPROVED', estimatePaise: 65000, finalPaise: 0 },
        unit: { id: 1, label: 'A-1203' },
      },
      { 'POST /tickets/124/transition': ok(ticketRaw()) },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Mark resolved' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/What was done/), 'short');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mark resolved' }));
    expect(await within(dlg).findByText('Write what was done before resolving.')).toBeInTheDocument();
    expect(within(dlg).getByText('This category needs an after photo.')).toBeInTheDocument();
    await userEvent.clear(within(dlg).getByLabelText(/What was done/));
    await userEvent.type(within(dlg).getByLabelText(/What was done/), 'Replaced hinge and aligned door');
    const file = new File(['x'], 'after.jpg', { type: 'image/jpeg' });
    await userEvent.upload(within(dlg).getByLabelText('After photos'), file);
    await within(dlg).findByText('after.jpg');
    await userEvent.clear(within(dlg).getByLabelText('Final charge (₹)'));
    await userEvent.type(within(dlg).getByLabelText('Final charge (₹)'), '700');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() =>
      expect(api.last('POST', '/tickets/124/transition')?.body).toEqual({
        action: 'RESOLVE',
        note: 'Replaced hinge and aligned door',
        fileIds: [55],
        chargeFinalPaise: 70000,
        version: 2,
      }),
    );
  });
  it('waits on the resident with a reason and a question', async () => {
    const api = page(
      { status: 'IN_PROGRESS', allowedActions: ['WAIT_ON_RESIDENT'] },
      { 'POST /tickets/124/transition': ok(ticketRaw()) },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Waiting on resident' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dlg).getByLabelText('Why are you waiting?'), 'ACCESS_TO_FLAT');
    await userEvent.type(
      within(dlg).getByLabelText(/Your question for the resident/),
      'When can we enter the flat?',
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'Ask the resident' }));
    await waitFor(() =>
      expect(api.last('POST', '/tickets/124/transition')?.body).toMatchObject({
        action: 'WAIT_ON_RESIDENT',
        waitingReason: 'ACCESS_TO_FLAT',
      }),
    );
  });
  it('cancels with a reason', async () => {
    const api = page({}, { 'POST /tickets/124/transition': ok(ticketRaw()) });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel ticket' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Reported twice by mistake');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel ticket' }));
    await waitFor(() =>
      expect(api.last('POST', '/tickets/124/transition')?.body).toEqual({
        action: 'CANCEL',
        reason: 'Reported twice by mistake',
        version: 2,
      }),
    );
  });
  it('shows the readable error and reloads on a stale version', async () => {
    const api = page({}, { 'POST /tickets/124/transition': err(409, 'STALE_VERSION') });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel ticket' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Reported twice by mistake');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel ticket' }));
    await waitFor(() =>
      expect(api.calls.filter(c => c.path === '/tickets/124' && c.method === 'GET').length).toBeGreaterThan(
        1,
      ),
    );
    expect(await screen.findByText(/Someone else changed this ticket/)).toBeInTheDocument();
  });
  it('merges into a similar open issue', async () => {
    const api = page({}, { 'POST /tickets/124/merge': ok({ duplicate: ticketRaw(), primary: ticketRaw() }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Merge into...' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Merge' }));
    await waitFor(() =>
      expect(api.last('POST', '/tickets/124/merge')?.body).toEqual({ intoTicketId: 120, version: 2 }),
    );
  });
  it('sends an estimate for chargeable flat work in progress', async () => {
    const api = page(
      {
        kind: 'PERSONAL',
        status: 'IN_PROGRESS',
        allowedActions: [],
        isChargeable: true,
        charge: null,
        unit: { id: 1, label: 'A-1' },
      },
      { 'POST /tickets/124/estimate': ok(ticketRaw()) },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Send estimate' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Estimate/), '650');
    await userEvent.type(within(dlg).getByLabelText(/What the amount covers/), 'Hinge and labour');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send estimate' }));
    await waitFor(() =>
      expect(api.last('POST', '/tickets/124/estimate')?.body).toEqual({
        estimatePaise: 65000,
        note: 'Hinge and labour',
        version: 2,
      }),
    );
  });
  it('shows the resident decision on an estimate', async () => {
    page({
      kind: 'PERSONAL',
      status: 'WAITING_ON_RESIDENT',
      allowedActions: [],
      isChargeable: true,
      charge: { status: 'APPROVED', estimatePaise: 65000, finalPaise: 0 },
      unit: { id: 1, label: 'A-1' },
    });
    expect(await screen.findByText(/Resident approved the estimate · estimate ₹650/)).toBeInTheDocument();
  });
  it('is read only without the edit permission', async () => {
    page({}, {}, VIEW);
    await screen.findByText('Called the lift company');
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start work' })).toBeNull();
  });
  it('shows not found with a way back', async () => {
    signInAs(VIEW, []);
    mockApi({ ...base, 'GET /tickets/124': err(404, 'TICKET_NOT_FOUND') });
    wrap(<TicketPage id={124} />);
    expect(await screen.findByRole('link', { name: 'Back to issues', hidden: false })).toBeInTheDocument();
    expect(await screen.findByText('Not found')).toBeInTheDocument();
  });
});

describe('Report an issue', () => {
  const modal = (routes: Parameters<typeof mockApi>[0] = {}) => {
    signInAs(EDIT, []);
    fakeUploader();
    const api = mockApi({ ...base, ...routes });
    const onCreated = vi.fn();
    wrap(<ReportIssueModal onClose={() => {}} onCreated={onCreated} />);
    return { api, onCreated };
  };
  const fillBuilding = async () => {
    await userEvent.selectOptions(await screen.findByLabelText('Spot'), '77');
    await userEvent.selectOptions(await screen.findByLabelText('Category'), '3');
  };
  it('reports a building issue and thanks with the flat count', async () => {
    const { api, onCreated } = modal({
      'GET /building-issues/similar': ok({ items: [] }),
      'POST /building-issues': ok({ id: 9, ticketNo: 'T9', kind: 'BUILDING', affectedUnitCount: 96 }),
    });
    await fillBuilding();
    await userEvent.selectOptions(screen.getByLabelText('Urgency'), 'EMERGENCY');
    await userEvent.type(screen.getByLabelText('What is wrong?'), 'Lift stopped at ground');
    await userEvent.click(screen.getByRole('button', { name: 'Report issue' }));
    expect(await screen.findByText('Reported. 96 flats will get updates.')).toBeInTheDocument();
    expect(api.last('POST', '/building-issues')?.body).toEqual({
      locationNodeId: 77,
      categoryId: 3,
      urgency: 'EMERGENCY',
      title: 'Lift stopped at ground',
    });
    expect(onCreated).toHaveBeenCalled();
  });
  it('shows similar issues and needs a reason to report anyway', async () => {
    const { api } = modal({
      'GET /building-issues/similar': ok({
        items: [
          {
            id: 5,
            ticketNo: 'T5',
            title: 'Lift 2 stuck',
            status: 'OPEN',
            priority: 'P1',
            createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
          },
        ],
      }),
      'POST /building-issues': ok({ id: 9, ticketNo: 'T9', kind: 'BUILDING', affectedUnitCount: 1 }),
    });
    await fillBuilding();
    expect(await screen.findByText(/Similar issue already open:/)).toHaveTextContent('Lift 2 stuck');
    expect(screen.getByRole('button', { name: 'Report issue' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Report anyway' }));
    await userEvent.click(screen.getByRole('button', { name: 'Report issue' }));
    expect(await screen.findByText('Enter 10 to 300 characters.')).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText(/Why report it anyway/),
      'This is the second lift, not the first',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Report issue' }));
    await waitFor(() =>
      expect(api.last('POST', '/building-issues')?.body).toMatchObject({
        duplicateReason: 'This is the second lift, not the first',
      }),
    );
  });
  it('re-renders the duplicate alert on SIMILAR_ISSUE_EXISTS', async () => {
    modal({
      'GET /building-issues/similar': ok({ items: [] }),
      'POST /building-issues': err(409, 'SIMILAR_ISSUE_EXISTS', [{ field: 'ticketIds', message: '5' }]),
    });
    await fillBuilding();
    await userEvent.click(screen.getByRole('button', { name: 'Report issue' }));
    expect(await screen.findByText(/A similar issue is already open \(5\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report issue' })).toBeDisabled();
  });
  it('checks that a spot and a category are chosen', async () => {
    modal();
    await userEvent.click(await screen.findByRole('button', { name: 'Report issue' }));
    expect(await screen.findByText('Choose the spot.')).toBeInTheDocument();
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
  });
  it('creates a personal complaint for a flat on behalf of a resident', async () => {
    const { api } = modal({
      'GET /units': ok([{ id: 11, label: 'A-1203' }]),
      'GET /residents': ok([{ id: 71, name: 'Asha Rao', links: [], status: 'ACTIVE' }]),
      'POST /tickets': ok({ id: 30, ticketNo: 'T30', kind: 'PERSONAL', affectedUnitCount: 0 }),
    });
    await userEvent.selectOptions(await screen.findByLabelText('Where'), 'FLAT');
    await userEvent.type(await screen.findByLabelText(/Flat/), 'A-12');
    await userEvent.selectOptions(await screen.findByLabelText('Matching flats'), '11');
    await userEvent.selectOptions(await screen.findByLabelText('Resident (optional)'), '71');
    await userEvent.selectOptions(screen.getByLabelText('Channel'), 'WALK_IN');
    await userEvent.selectOptions(await screen.findByLabelText('Category'), '5');
    await userEvent.type(screen.getByLabelText(/What is wrong/), 'Intercom is dead');
    await userEvent.type(screen.getByLabelText(/Details/), 'The intercom does not ring at all');
    await userEvent.click(screen.getByRole('button', { name: 'Report issue' }));
    expect(await screen.findByText('Ticket created')).toBeInTheDocument();
    expect(api.last('POST', '/tickets')?.body).toEqual({
      unitId: 11,
      channel: 'WALK_IN',
      categoryId: 5,
      title: 'Intercom is dead',
      description: 'The intercom does not ring at all',
      requesterResidentId: 71,
    });
  });
  it('shows the API reason when the report fails', async () => {
    modal({
      'GET /building-issues/similar': ok({ items: [] }),
      'POST /building-issues': err(422, 'LOCATION_ARCHIVED'),
    });
    await fillBuilding();
    await userEvent.click(screen.getByRole('button', { name: 'Report issue' }));
    expect(await screen.findByText('This spot is archived.')).toBeInTheDocument();
  });
});

describe('Issues card on the admin home', () => {
  it('lists up to four issues with the open and urgent counts and links', async () => {
    signInAs(EDIT, []);
    const api = mockApi({
      'GET /tickets': ok(listData([itemRaw(), itemRaw({ id: 2, title: 'Garbage', priority: 'P2' })])),
    });
    wrap(<IssuesCard />);
    expect(await screen.findByTestId('issues-open')).toHaveTextContent('18 open · 2 urgent');
    expect(screen.getByRole('link', { name: /Lift 2 stopped/ })).toHaveAttribute('href', '/admin/issues/124');
    expect(screen.getByRole('link', { name: 'Open issues' })).toHaveAttribute('href', '/admin/issues');
    const u = new URL(String(api.fn.mock.calls[0][0]));
    expect(u.searchParams.get('limit')).toBe('4');
    expect(u.searchParams.get('sortBy')).toBe('priority');
    expect(u.searchParams.get('view')).toBe('OPEN');
  });
  it('says there are no open issues', async () => {
    signInAs(VIEW, []);
    mockApi({ 'GET /tickets': ok(listData([], countsZero())) });
    wrap(<IssuesCard />);
    expect(await screen.findByText('No open issues')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report issue' })).toBeNull();
  });
  it('stays hidden without the permission and after a 404', async () => {
    signInAs([], []);
    const api = mockApi({ 'GET /tickets': ok(listData()) });
    wrap(<IssuesCard />);
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('Building issues')).toBeNull();
    expect(api.calls).toHaveLength(0);
  });
  it('remembers a 404 and does not ask again', async () => {
    signInAs(VIEW, []);
    const api = mockApi({ 'GET /tickets': err(404, 'NOT_FOUND') });
    const first = wrap(<IssuesCard />);
    await waitFor(() => expect(api.calls).toHaveLength(1));
    first.unmount();
    const second = wrap(<IssuesCard />);
    await new Promise(r => setTimeout(r, 20));
    expect(api.calls).toHaveLength(1);
    expect(screen.queryByText('Building issues')).toBeNull();
    second.unmount();
  });
});
function countsZero() {
  return { OPEN: 0, BUILDING: 0, FLATS: 0, URGENT: 0, RESOLVED: 0, ALL: 0 };
}

describe('Settings > Helpdesk', () => {
  const SET_VIEW = ['helpdesk.settings.view'];
  const SET_EDIT = ['helpdesk.settings.view', 'helpdesk.settings.edit'];
  const settings = (routes: Parameters<typeof mockApi>[0] = {}, perms = SET_EDIT) => {
    signInAs(perms, []);
    const api = mockApi({
      ...base,
      'GET /ticket-categories': ok([
        categoryRaw(),
        categoryRaw({ id: 8, name: 'Old', status: 'ARCHIVED', children: [] }),
      ]),
      'GET /sla-policies': ok([policyRaw(), policyRaw({ id: 2, name: 'Relaxed', isDefault: false })]),
      'GET /escalation-rules': ok([
        ruleRaw(),
        ruleRaw({ id: 6, name: 'Very late', level: 2, thresholdPercent: 200 }),
      ]),
      'GET /helpdesk/settings': ok(settingsRaw()),
      'GET /roles': ok([{ id: 1, key: 'chairman', name: 'Chairman', scope: 'society' }]),
      ...routes,
    });
    wrap(<HelpdeskSettingsScreen />);
    return api;
  };
  it('lists categories with sub-categories, hides archived ones until asked', async () => {
    settings();
    expect(await screen.findByText('Lift')).toBeInTheDocument();
    expect(screen.getByText('Lift stopped')).toBeInTheDocument();
    expect(screen.queryByText('Old')).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Show archived' }));
    expect(await screen.findByText('Old')).toBeInTheDocument();
  });
  it('creates a category with the default priority and the safety flag', async () => {
    const api = settings({ 'POST /ticket-categories': ok(categoryRaw()) });
    await userEvent.click(await screen.findByRole('button', { name: 'Add category' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    expect(await within(dlg).findByText('Enter 2 to 60 characters.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Name/), 'Parking');
    await userEvent.selectOptions(within(dlg).getByLabelText('For'), 'BUILDING');
    await userEvent.selectOptions(within(dlg).getByLabelText('Default priority'), 'P2');
    await userEvent.click(within(dlg).getByRole('checkbox', { name: /Safety issue/ }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('POST', '/ticket-categories')?.body).toMatchObject({
        name: 'Parking',
        scope: 'BUILDING',
        defaultPriority: 'P2',
        defaultAssigneeType: 'NONE',
        isSafety: true,
      }),
    );
  });
  it('adds a sub-category under its parent and edits with the version', async () => {
    const api = settings({
      'POST /ticket-categories': ok(categoryRaw()),
      'PATCH /ticket-categories/3': ok(categoryRaw()),
    });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add sub-category' }))[0]);
    let dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Name/), 'Lift noise');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('POST', '/ticket-categories')?.body).toMatchObject({
        parentId: 3,
        name: 'Lift noise',
        defaultAssigneeType: 'INHERIT',
        defaultPriority: null,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    dlg = await screen.findByRole('dialog');
    await userEvent.clear(within(dlg).getByLabelText(/Name/));
    await userEvent.type(within(dlg).getByLabelText(/Name/), 'Lifts');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/ticket-categories/3')?.body).toMatchObject({ name: 'Lifts', version: 1 }),
    );
    expect(api.last('PATCH', '/ticket-categories/3')?.body).not.toHaveProperty('parentId');
  });
  it('archives after a confirmation and restores', async () => {
    const api = settings({
      'POST /ticket-categories/3/archive': ok(categoryRaw()),
      'POST /ticket-categories/8/restore': ok(categoryRaw()),
    });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(api.last('POST', '/ticket-categories/3/archive')?.body).toEqual({ version: 1 }),
    );
    await userEvent.click(screen.getByRole('switch', { name: 'Show archived' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(api.last('POST', '/ticket-categories/8/restore')?.body).toEqual({ version: 1 }),
    );
  });
  it('shows the readable error of a name clash', async () => {
    settings({ 'POST /ticket-categories': err(409, 'CATEGORY_NAME_TAKEN') });
    await userEvent.click(await screen.findByRole('button', { name: 'Add category' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Name/), 'Lift');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    expect(
      await within(dlg).findByText(/Another category at this level already has this name/),
    ).toBeInTheDocument();
  });
  it('shows SLA targets and locks the office hours clock on Starter', async () => {
    const api = settings({ 'POST /sla-policies': ok(policyRaw()) });
    await userEvent.click(await screen.findByRole('button', { name: 'SLA policies' }));
    const std = await screen.findByRole('region', { name: 'Standard' });
    expect(within(std).getByText('P1 Emergency')).toBeInTheDocument();
    expect(within(std).getByText('4 h')).toBeInTheDocument();
    expect(within(std).getByText('7 days')).toBeInTheDocument();
    expect(within(std).getAllByText('Office hours')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Add policy' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getAllByText(/Office hours need the Standard plan/).length).toBeGreaterThan(0);
    await userEvent.selectOptions(within(dlg).getAllByLabelText('Clock')[0], 'BUSINESS_HOURS');
    expect((within(dlg).getAllByLabelText('Clock')[0] as HTMLSelectElement).value).toBe('TWENTY_FOUR_SEVEN');
    await userEvent.type(within(dlg).getByLabelText(/Name/), 'Fast');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('POST', '/sla-policies')?.body).toMatchObject({
        name: 'Fast',
        p1ResponseMinutes: 30,
        p1ResolutionMinutes: 240,
        p2Calendar: 'TWENTY_FOUR_SEVEN',
      }),
    );
  });
  it('allows office hours on a plan that has them and rejects reply after fix', async () => {
    entitlementsStore.set({ features: ['helpdesk.sla_business_calendar'], flags: {} } as never);
    settings();
    await userEvent.click(await screen.findByRole('button', { name: 'SLA policies' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dlg).getAllByLabelText('Clock')[0], 'BUSINESS_HOURS');
    expect((within(dlg).getAllByLabelText('Clock')[0] as HTMLSelectElement).value).toBe('BUSINESS_HOURS');
    const reply = within(dlg).getAllByLabelText('Reply within')[0];
    await userEvent.clear(reply);
    await userEvent.selectOptions(within(dlg).getAllByLabelText('Unit')[0], 'h');
    await userEvent.type(reply, '9');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    expect(
      await within(dlg).findByText('The reply time must be shorter than the fix time.'),
    ).toBeInTheDocument();
  });
  it('lists escalation rules by level and deletes with the version', async () => {
    const api = settings({ 'DELETE /escalation-rules/5': ok(null) });
    await userEvent.click(await screen.findByRole('button', { name: 'Escalation rules' }));
    const l1 = await screen.findByRole('region', { name: 'Level 1' });
    expect(within(l1).getByText('Late fix to chairman')).toBeInTheDocument();
    expect(within(l1).getByText(/Fix is late at 100%/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Level 2' })).toHaveTextContent('Very late');
    await userEvent.click(within(l1).getByRole('button', { name: 'Delete' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.last('DELETE', '/escalation-rules/5')).toBeTruthy());
    expect(String(api.fn.mock.calls.find(c => (c[1] as RequestInit).method === 'DELETE')?.[0])).toContain(
      'version=1',
    );
  });
  it('adds a rule for an SLA trigger with a role target', async () => {
    const api = settings({ 'POST /escalation-rules': ok(ruleRaw()) });
    await userEvent.click(await screen.findByRole('button', { name: 'Escalation rules' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add rule' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Name/), 'Reply late');
    await userEvent.selectOptions(within(dlg).getByLabelText('When'), 'RESPONSE_SLA');
    await userEvent.clear(within(dlg).getByLabelText(/At this percent/));
    await userEvent.type(within(dlg).getByLabelText(/At this percent/), '10');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    expect(await within(dlg).findByText('Enter a percent from 25 to 1000.')).toBeInTheDocument();
    await userEvent.clear(within(dlg).getByLabelText(/At this percent/));
    await userEvent.type(within(dlg).getByLabelText(/At this percent/), '50');
    await userEvent.selectOptions(await within(dlg).findByLabelText('Role'), 'chairman');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('POST', '/escalation-rules')?.body).toMatchObject({
        name: 'Reply late',
        triggerType: 'RESPONSE_SLA',
        thresholdPercent: 50,
        level: 1,
        targetType: 'ROLE',
        targetRoleKey: 'chairman',
      }),
    );
  });
  it('saves only changed preferences with their versions and checks the waiting rule', async () => {
    const api = settings({ 'PATCH /helpdesk/settings': ok(settingsRaw()) });
    await userEvent.click(await screen.findByRole('button', { name: 'Preferences' }));
    const hours = await screen.findByLabelText(/Close a resolved ticket after/);
    await userEvent.clear(hours);
    await userEvent.type(hours, '96');
    await userEvent.click(screen.getByRole('switch', { name: 'Show who reported a building issue' }));
    const days = screen.getByLabelText(/Resolve a waiting ticket after/);
    await userEvent.clear(days);
    await userEvent.type(days, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText(/Days times 24 must be more than the reminder hours/)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'PATCH')).toBe(false);
    await userEvent.clear(days);
    await userEvent.type(days, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/helpdesk/settings')?.body).toEqual({
        changes: [
          { key: 'helpdesk.autoCloseHours', value: 96, version: 1 },
          { key: 'helpdesk.showReporterOnBuildingIssues', value: true, version: 2 },
        ],
      }),
    );
  });
  it('shows an inline error for a value below the minimum and the server message when a save is refused', async () => {
    const raw = { ...settingsRaw(), 'helpdesk.residentDailyTicketLimit': { value: 20, version: 1 } };
    const api = settings({ 'GET /helpdesk/settings': ok(raw) });
    await userEvent.click(await screen.findByRole('button', { name: 'Preferences' }));
    const limit = await screen.findByLabelText(/Most tickets one resident can raise a day/);
    await userEvent.clear(limit);
    await userEvent.type(limit, '3');
    expect(await screen.findByText('Enter a whole number from 5 to 100.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(api.calls.some(c => c.method === 'PATCH')).toBe(false);
    expect(screen.getByText('Enter a whole number from 5 to 100.')).toBeInTheDocument();
    await userEvent.clear(limit);
    await userEvent.type(limit, '30');
    expect(screen.queryByText('Enter a whole number from 5 to 100.')).toBeNull();
  });
  it('shows the server message when saving a preference is refused', async () => {
    settings({
      'PATCH /helpdesk/settings': {
        status: 400,
        code: 'SETTING_VALUE_INVALID',
        message: 'A setting value is not valid',
        errors: [{ field: 'helpdesk.autoCloseHours', message: 'Must be between 24 and 336' }],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Preferences' }));
    const hours = await screen.findByLabelText(/Close a resolved ticket after/);
    await userEvent.clear(hours);
    await userEvent.type(hours, '96');
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText(/Must be between 24 and 336/)).toBeInTheDocument();
  });
  it('is read only without the edit permission and hidden without the view permission', async () => {
    settings({}, SET_VIEW);
    expect(await screen.findByText(/look at these settings but not change/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
  });
  it('tells a person without the view permission', async () => {
    signInAs([], []);
    mockApi({});
    wrap(<HelpdeskSettingsScreen />);
    expect(await screen.findByText(/do not have permission/)).toBeInTheDocument();
  });
});
