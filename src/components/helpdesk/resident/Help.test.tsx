import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router } from '@/test/helpers';
import { ToastProvider } from '@/components/ui/Toast';
import { configureFileUploader } from '@/lib/fileUpload';
import { duesRaw } from '@/test/paymentsResidentFixtures';
import {
  HELP_PERMS,
  categoriesRaw,
  issueRowRaw,
  locationsRaw,
  ticketRaw,
} from '@/test/helpdeskResidentFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { FieldIssueScreen } from '../field/FieldIssueScreen';
import { HelpHome } from './HelpHome';
import { QrLandingScreen, ReportIssueScreen } from './ReportIssueScreen';
import { ReportComplaintScreen } from './ReportComplaintScreen';
import { TicketDetailScreen } from './TicketDetailScreen';
import { TransparencyScreen } from './TransparencyScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const BOARD = ['helpdesk.committee_transparency_board', 'helpdesk.public_community_issue_board'];
function show(ui: React.ReactElement, routes: Routes, perms = HELP_PERMS, features: string[] = BOARD) {
  signInAs(perms, features);
  const api = mockApi(routes);
  render(<ToastProvider>{ui}</ToastProvider>);
  return api;
}
beforeEach(resetAll);

describe('Help home', () => {
  const base: Routes = {
    'GET /me/building-issues': ok({ items: [issueRowRaw()] }),
    'GET /me/tickets': ok([ticketRaw({ status: 'IN_PROGRESS' })]),
  };

  it('shows the report buttons, issues near me and my open complaints', async () => {
    show(<HelpHome />, base);
    expect(await screen.findByText('Lift stopped')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Raise a complaint' })).toHaveAttribute(
      'href',
      '/resident/help/new',
    );
    expect(screen.getByRole('link', { name: 'Report a building issue' })).toHaveAttribute(
      'href',
      '/resident/help/issue',
    );
    expect(await screen.findByText('Kitchen tap leaking')).toBeInTheDocument();
  });

  it('asks for closed complaints on the Closed tab', async () => {
    const api = show(<HelpHome />, base);
    await screen.findByText('Kitchen tap leaking');
    await userEvent.click(screen.getByRole('tab', { name: 'Closed' }));
    await waitFor(() => expect(api.calls.filter(c => c.path === '/me/tickets')).toHaveLength(2));
    const urls = api.fn.mock.calls.map(c => String(c[0]));
    expect(urls.some(u => u.includes('/me/tickets') && u.includes('tab=CLOSED'))).toBe(true);
  });

  it('adds and undoes Me too on a building issue', async () => {
    const api = show(<HelpHome />, {
      ...base,
      'POST /me/tickets/77/upvote': ok({ ticketId: 77, upvoteCount: 7, iUpvoted: true }),
      'DELETE /me/tickets/77/upvote': ok({ ticketId: 77, upvoteCount: 6, iUpvoted: false }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Me too' }));
    expect(await screen.findByRole('button', { name: 'Undo Me too' })).toBeInTheDocument();
    expect(screen.getByText(/7 Me too/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo Me too' }));
    await screen.findByRole('button', { name: 'Me too' });
    expect(api.calls.map(c => c.method)).toContain('DELETE');
  });

  it('hides the report buttons without the create permission', async () => {
    show(<HelpHome />, base, ['resident.helpdesk.view']);
    await screen.findByText('Lift stopped');
    expect(screen.queryByRole('link', { name: 'Raise a complaint' })).toBeNull();
  });

  it('shows an access message without the view permission', async () => {
    show(<HelpHome />, base, ['resident.home.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('Ticket detail', () => {
  const detail = (over = {}): Routes => ({ 'GET /me/tickets/124': ok(ticketRaw(over)) });

  it('shows the timeline, due time and the confirm action for a fixed complaint', async () => {
    show(<TicketDetailScreen id={124} />, detail());
    expect(await screen.findByText('Plumber will visit today')).toBeInTheDocument();
    expect(screen.getByText('Ramesh (plumber)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm fixed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('says on hold when waiting for the resident', async () => {
    show(<TicketDetailScreen id={124} />, detail({ status: 'WAITING_ON_RESIDENT' }));
    expect(await screen.findByText('On hold: waiting for you')).toBeInTheDocument();
  });

  it('confirms with stars and sends the version', async () => {
    const api = show(<TicketDetailScreen id={124} />, {
      ...detail(),
      'POST /me/tickets/124/confirm': ok(ticketRaw({ status: 'CLOSED' })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm fixed' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('radio', { name: '4 stars' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Confirm fixed' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/tickets/124/confirm')?.body).toEqual({ version: 4, score: 4 }),
    );
  });

  it('refetches after confirming and shows the closed ticket buttons', async () => {
    let closed = false;
    const api = show(<TicketDetailScreen id={124} />, {
      'GET /me/tickets/124': () =>
        closed ? ok(ticketRaw({ status: 'CLOSED', version: 5, allowedActions: ['RATE'] })) : ok(ticketRaw()),
      'POST /me/tickets/124/confirm': () => {
        closed = true;
        return ok(ticketRaw({ status: 'CLOSED', version: 5, allowedActions: ['RATE'] }));
      },
    } as Routes);
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm fixed' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Confirm fixed' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm fixed' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Rate' })).toBeEnabled();
    expect(api.calls.filter(c => c.method === 'GET' && c.path === '/me/tickets/124').length).toBeGreaterThan(
      1,
    );
  });

  it('reopens with a reason', async () => {
    const api = show(<TicketDetailScreen id={124} />, {
      ...detail(),
      'POST /me/tickets/124/reopen': ok(ticketRaw({ status: 'OPEN' })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox'), 'The tap still leaks');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reopen' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/tickets/124/reopen')?.body).toEqual({
        version: 4,
        reason: 'The tap still leaks',
      }),
    );
  });

  it('cancels an open complaint and shows the API error in plain words', async () => {
    show(<TicketDetailScreen id={124} />, {
      ...detail({ status: 'OPEN', myRelation: 'REQUESTER', allowedActions: ['CANCEL', 'COMMENT'] }),
      'POST /me/tickets/124/cancel': err(422, 'TICKET_HAS_UPVOTES'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox'), 'Not needed now');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel complaint' }));
    expect(await screen.findByText(/cannot be cancelled/)).toBeInTheDocument();
  });

  it('offers Escalate only when the due time passed', async () => {
    const { unmount } = render(<div />);
    unmount();
    show(
      <TicketDetailScreen id={124} />,
      detail({ status: 'IN_PROGRESS', sla: { slaState: 'ON_TRACK' }, allowedActions: ['COMMENT'] }),
    );
    await screen.findByText('Kitchen tap leaking');
    expect(screen.queryByRole('button', { name: /Ask the committee/ })).toBeNull();
  });

  it('shows Escalate when overdue and sends the reason', async () => {
    const api = show(<TicketDetailScreen id={124} />, {
      ...detail({
        status: 'IN_PROGRESS',
        sla: { slaState: 'BREACHED' },
        allowedActions: ['ESCALATE', 'COMMENT'],
      }),
      'POST /me/tickets/124/escalate': ok({ escalationRequestedAt: '2026-11-18T06:00:00.000Z' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Ask the committee/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox'), 'Waiting for three days now');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send to committee' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/tickets/124/escalate')?.body).toEqual({
        reason: 'Waiting for three days now',
      }),
    );
  });

  it('approves an estimate', async () => {
    const api = show(<TicketDetailScreen id={124} />, {
      ...detail({
        status: 'WAITING_ON_RESIDENT',
        waitingReason: 'ESTIMATE_APPROVAL',
        allowedActions: ['COMMENT'],
        charge: { status: 'ESTIMATE_SENT', estimatePaise: 65000 },
      }),
      'POST /me/tickets/124/estimate-decision': ok(ticketRaw({ status: 'IN_PROGRESS' })),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Approve/ }));
    await waitFor(() =>
      expect(api.last('POST', '/me/tickets/124/estimate-decision')?.body).toEqual({
        decision: 'APPROVE',
        version: 4,
      }),
    );
  });

  it('adds a comment', async () => {
    const api = show(<TicketDetailScreen id={124} />, {
      ...detail({ status: 'IN_PROGRESS', allowedActions: ['COMMENT'] }),
      'POST /me/tickets/124/comments': ok({ id: 9, body: 'Thanks', kind: 'COMMENT' }),
    });
    await userEvent.type(await screen.findByLabelText('Add a message'), 'Thanks');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/tickets/124/comments')?.body).toEqual({ body: 'Thanks' }),
    );
  });

  it('shows Me too on a building issue of someone else', async () => {
    show(
      <TicketDetailScreen id={124} />,
      detail({ kind: 'BUILDING', status: 'OPEN', myRelation: 'AFFECTED', allowedActions: ['COMMENT'] }),
    );
    expect(await screen.findByRole('button', { name: 'Me too' })).toBeInTheDocument();
  });

  it('shows a not found message', async () => {
    show(<TicketDetailScreen id={124} />, { 'GET /me/tickets/124': err(404, 'TICKET_NOT_FOUND') });
    expect(await screen.findByText('Back to Help')).toBeInTheDocument();
  });
});

describe('Raise a complaint', () => {
  const routes: Routes = {
    'GET /me/dues': ok(duesRaw()),
    'GET /me/ticket-categories': ok(categoriesRaw()),
  };

  it('checks the fields before sending', async () => {
    const api = show(<ReportComplaintScreen />, routes);
    await userEvent.click(await screen.findByRole('button', { name: 'Send complaint' }));
    expect(await screen.findByText('Choose your flat.')).toBeInTheDocument();
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('sends the complaint for the chosen flat and opens it', async () => {
    const api = show(<ReportComplaintScreen />, {
      ...routes,
      'POST /me/tickets': ok(ticketRaw({ id: 200 })),
    });
    await userEvent.selectOptions(await screen.findByLabelText('Flat'), '313');
    await userEvent.click(screen.getByRole('button', { name: 'Water supply' }));
    await userEvent.type(screen.getByLabelText('Title'), 'No water in kitchen');
    await userEvent.type(screen.getByLabelText('Describe the problem'), 'There is no water since morning');
    await userEvent.click(screen.getByRole('button', { name: 'Urgent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/help/200'));
    expect(api.last('POST', '/me/tickets')?.body).toEqual({
      unitId: 313,
      categoryId: 4,
      title: 'No water in kitchen',
      description: 'There is no water since morning',
      urgency: 'URGENT',
    });
    const calls = api.fn.mock.calls as unknown as [string, RequestInit?][];
    const post = calls.find(c => c[1]?.method === 'POST');
    expect(JSON.stringify(post?.[1]?.headers)).toMatch(/Idempotency-Key/i);
  });

  it('uploads photos as ticket photos and sends their ids', async () => {
    const upload = vi.fn(async (_f: File, _p: string) => ({ fileId: 9100 }));
    configureFileUploader({ upload });
    const api = show(<ReportComplaintScreen />, {
      ...routes,
      'POST /me/tickets': ok(ticketRaw({ id: 201 })),
    });
    await userEvent.selectOptions(await screen.findByLabelText('Flat'), '312');
    await userEvent.click(screen.getByRole('button', { name: 'Water supply' }));
    await userEvent.type(screen.getByLabelText('Title'), 'No water in kitchen');
    await userEvent.type(screen.getByLabelText('Describe the problem'), 'There is no water since morning');
    await userEvent.upload(
      screen.getByTestId('photo-input'),
      new File(['x'], 'tap.jpg', { type: 'image/jpeg' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/help/201'));
    expect(upload.mock.calls[0][1]).toBe('TICKET_PHOTO');
    expect((api.last('POST', '/me/tickets')?.body as { fileIds: number[] }).fileIds).toEqual([9100]);
  });

  it('shows the charges notice for a chargeable category', async () => {
    show(<ReportComplaintScreen />, {
      ...routes,
      'GET /me/ticket-categories': ok([{ id: 8, name: 'Carpentry', isChargeable: true, children: [] }]),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Carpentry' }));
    expect(screen.getByText(/Charges may apply/)).toBeInTheDocument();
  });
});

describe('Report a building issue', () => {
  const routes: Routes = {
    'GET /me/ticket-categories': ok(categoriesRaw()),
    'GET /locations': ok(locationsRaw()),
    'GET /me/building-issues/similar': ok({ items: [] }),
  };

  async function fill() {
    await userEvent.selectOptions(await screen.findByLabelText(/Building/), '10');
    await userEvent.selectOptions(await screen.findByLabelText('Spot'), '77');
    await userEvent.click(await screen.findByRole('button', { name: 'Lift' }));
  }

  it('walks building to spot, sends the report and opens it', async () => {
    const api = show(<ReportIssueScreen />, {
      ...routes,
      'POST /me/building-issues': ok(ticketRaw({ id: 300, kind: 'BUILDING', affectedUnitCount: 96 })),
    });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Emergency' }));
    await userEvent.click(screen.getByRole('button', { name: 'Report the issue' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/help/300'));
    expect(api.last('POST', '/me/building-issues')?.body).toEqual({
      locationNodeId: 77,
      categoryId: 3,
      urgency: 'EMERGENCY',
    });
  });

  it('shows similar issues and blocks the duplicate until Me too or a reason', async () => {
    const api = show(<ReportIssueScreen />, {
      ...routes,
      'GET /me/building-issues/similar': ok({ items: [issueRowRaw()] }),
      'POST /me/tickets/77/upvote': ok({ ticketId: 77, upvoteCount: 7, iUpvoted: true }),
      'POST /me/building-issues': ok(ticketRaw({ id: 301 })),
    });
    await fill();
    expect(await screen.findByText('Already reported here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report the issue' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Me too' }));
    expect(await screen.findByText('You added Me too')).toBeInTheDocument();
    expect(api.calls.some(c => c.path === '/me/tickets/77/upvote')).toBe(true);
    await userEvent.click(screen.getByLabelText('My problem is different from these'));
    await userEvent.type(screen.getByLabelText('How is it different?'), 'This is the other lift');
    await userEvent.click(screen.getByRole('button', { name: 'Report the issue' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/help/301'));
    expect(api.last('POST', '/me/building-issues')?.body).toMatchObject({
      duplicateReason: 'This is the other lift',
    });
  });

  it('asks for a reason when the server finds a similar issue the check missed', async () => {
    show(<ReportIssueScreen />, {
      ...routes,
      'POST /me/building-issues': err(409, 'SIMILAR_ISSUE_EXISTS'),
    });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Report the issue' }));
    expect(await screen.findByText(/similar issue is already open/)).toBeInTheDocument();
  });
});

describe('QR landing', () => {
  const qrRoutes: Routes = {
    'GET /me/building-issues/qr/abcdefABCDEF': ok({
      location: { id: 77, pathLabel: 'Tower A › Lift 1', nodeType: 'AREA', areaType: 'LIFT' },
      suggestedAffectedLevel: 'BUILDING',
      suggestedCategoryIds: [3],
      openIssuesHere: [],
    }),
    'GET /me/ticket-categories': ok(categoriesRaw()),
    'GET /me/building-issues/similar': ok({ items: [] }),
  };

  it('pre-fills the place and the suggested category and sends the qrToken', async () => {
    const api = show(<QrLandingScreen qrToken="abcdefABCDEF" />, {
      ...qrRoutes,
      'POST /me/building-issues': ok(ticketRaw({ id: 310 })),
    });
    expect(await screen.findByText('Tower A › Lift 1')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Lift' })).toHaveAttribute('aria-pressed', 'true'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Report the issue' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/help/310'));
    expect(api.last('POST', '/me/building-issues')?.body).toMatchObject({
      locationNodeId: 77,
      qrToken: 'abcdefABCDEF',
      categoryId: 3,
      urgency: 'NORMAL',
    });
  });

  it('falls back to the normal form when the plan has no QR', async () => {
    show(<QrLandingScreen qrToken="abcdefABCDEF" />, {
      ...qrRoutes,
      'GET /me/building-issues/qr/abcdefABCDEF': err(402, 'FEATURE_NOT_IN_PLAN'),
      'GET /locations': ok(locationsRaw()),
    });
    expect(await screen.findByText(/QR reporting is not part of your plan/)).toBeInTheDocument();
    expect(await screen.findByLabelText(/Building/)).toBeInTheDocument();
  });

  it('says so when the QR code is unknown', async () => {
    show(<QrLandingScreen qrToken="abcdefABCDEF" />, {
      ...qrRoutes,
      'GET /me/building-issues/qr/abcdefABCDEF': err(404, 'QR_NOT_FOUND'),
    });
    expect(await screen.findByText(/QR code is not valid/)).toBeInTheDocument();
  });
});

describe('Transparency', () => {
  it('shows only a calm plan notice on Starter', async () => {
    const api = show(<TransparencyScreen />, {}, HELP_PERMS, []);
    expect(await screen.findByText(/not part of your society’s plan/)).toBeInTheDocument();
    expect(screen.queryByText(/went wrong/i)).toBeNull();
    expect(api.calls.some(c => c.path.includes('transparency'))).toBe(false);
  });

  it('lists the months', async () => {
    show(<TransparencyScreen />, {
      'GET /me/helpdesk/transparency': ok({
        months: [
          {
            month: '2026-10',
            buildingIssuesRaised: 9,
            resolved: 7,
            medianResolutionHours: 5,
            resolutionMetPct: 80,
          },
        ],
      }),
    });
    expect(await screen.findByText('October 2026')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});

describe('Field report (guard and staff)', () => {
  const f = (a: string): Routes => ({
    [`GET /${a}/ticket-categories`]: ok(categoriesRaw()),
    'GET /locations': ok(locationsRaw()),
    [`GET /${a}/building-issues/similar`]: ok({ items: [issueRowRaw()] }),
    [`POST /${a}/building-issues`]: ok({
      id: 5,
      ticketNo: 'TKT/5',
      status: 'OPEN',
      priority: 'P1',
      affectedUnitCount: 40,
    }),
  });

  it.each(['gate', 'work'] as const)('reports from the %s app without Me too', async a => {
    const api = mockApi(f(a));
    signInAs([], []);
    render(
      <ToastProvider>
        <FieldIssueScreen audience={a} />
      </ToastProvider>,
    );
    await userEvent.selectOptions(await screen.findByLabelText(/Building/), '10');
    await userEvent.selectOptions(await screen.findByLabelText('Spot'), '77');
    await userEvent.click(await screen.findByRole('button', { name: 'Lift' }));
    expect(await screen.findByText('Already reported here')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Me too' })).toBeNull();
    await userEvent.click(screen.getByLabelText('My problem is different from these'));
    await userEvent.type(screen.getByLabelText('How is it different?'), 'A different lift again');
    await userEvent.click(screen.getByRole('button', { name: 'Report the issue' }));
    expect(await screen.findByText(/TKT\/5/)).toBeInTheDocument();
    expect(screen.getByText(/committee has been told/)).toBeInTheDocument();
    expect(api.last('POST', `/${a}/building-issues`)?.body).toMatchObject({
      locationNodeId: 77,
      categoryId: 3,
    });
    expect(screen.getByRole('button', { name: 'Report another issue' })).toBeInTheDocument();
  });
});
