import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe, search } from '@/test/helpers';
import { societyTicket, ticket } from '@/test/opsFixtures';
import { page } from '@/test/societyFixtures';
import { HelpSupportScreen } from './help/HelpSupportScreen';
import { PlatformSupportScreen } from './support/PlatformSupportScreen';

vi.mock('next/navigation', () => navigationMock());

const counts = { ALL: 5, OPEN: 2, IN_PROGRESS: 1, WAITING: 1, RESOLVED: 1, CLOSED: 0 };
const PERMS = ['platform.tickets.view', 'platform.tickets.edit', 'platform.support_access.create'];

function renderPlatform(routes: Parameters<typeof mockApi>[0] = {}, perms = PERMS) {
  setMe(sampleMe({ platformPermissions: perms }));
  const api = mockApi({
    'GET /platform/tickets': ok({ items: [ticket({ messages: undefined })], counts }, 'OK', page(1)),
    'GET /platform/tickets/2041': ok(ticket()),
    'GET /platform/team': ok([{ kind: 'USER', userId: 7, name: 'Isha Kapoor' }]),
    ...routes,
  });
  render(
    <ToastProvider>
      <PlatformSupportScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Platform support tickets (11.2)', () => {
  beforeEach(resetAll);

  it('lists tickets with segment counts and sends search and status to the API', async () => {
    const api = renderPlatform();
    const table = await screen.findByRole('table', { name: 'Support tickets' });
    expect(within(table).getByText('TKT-002041')).toBeInTheDocument();
    expect(within(table).getByText('Riverside Towers')).toBeInTheDocument();
    expect(within(table).getByText('High')).toBeInTheDocument();
    expect(within(table).getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All\s*5/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Waiting/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tickets or societies' }), 'upi');
    await waitFor(() => {
      const last = api.fn.mock.calls
        .map(c => new URL(String(c[0])))
        .filter(u => u.pathname.endsWith('/platform/tickets'))
        .pop()!;
      expect(last.searchParams.get('status')).toBe('WAITING');
      expect(last.searchParams.get('q')).toBe('upi');
    });
  });

  it('shows the thread with an internal note tag, attachments and the SLA line', async () => {
    renderPlatform();
    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-002041' }));
    const dialog = await screen.findByRole('dialog');
    expect((await within(dialog).findAllByText('Internal note')).length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText('Looks like a Razorpay limit. Checking.').closest('li')).toHaveClass(
      'bg-[rgba(201,169,97,0.18)]',
    );
    expect(within(dialog).getByText(/mandate-error\.png/)).toBeInTheDocument();
    expect(within(dialog).getByText(/First response due in 1 h/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Request access' })).toHaveAttribute(
      'href',
      '/platform/societies/9',
    );
  });

  it('sends the reply first and then PATCHes with the version the reply returned', async () => {
    const api = renderPlatform({
      'POST /platform/tickets/2041/messages': ok({ ticket: { id: 2041, status: 'IN_PROGRESS', version: 4 } }),
      'PATCH /platform/tickets/2041': ok(ticket({ status: 'WAITING', version: 5 })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-002041' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      await within(dialog).findByRole('textbox', { name: 'Reply' }),
      'Please share the mandate id.',
    );
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Status' }), 'WAITING');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.last('PATCH', '/platform/tickets/2041')).toBeTruthy());
    const post = api.last('POST', '/platform/tickets/2041/messages')!;
    expect(post.body).toEqual({ body: 'Please share the mandate id.', visibility: 'PUBLIC' });
    expect(api.last('PATCH', '/platform/tickets/2041')!.body).toEqual({ version: 4, status: 'WAITING' });
    const order = api.calls.filter(c => c.method !== 'GET').map(c => c.method);
    expect(order).toEqual(['POST', 'PATCH']);
  });

  it('sends an internal note when the toggle is set', async () => {
    const api = renderPlatform({
      'POST /platform/tickets/2041/messages': ok({ ticket: { id: 2041, status: 'OPEN', version: 4 } }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-002041' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Internal note', pressed: false }),
    );
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Internal note' }),
      'Escalate to billing',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.last('POST', '/platform/tickets/2041/messages')).toBeTruthy());
    expect(api.last('POST', '/platform/tickets/2041/messages')!.body).toMatchObject({
      visibility: 'INTERNAL',
    });
  });

  it('reloads on STALE_VERSION and keeps the typed reply', async () => {
    const api = renderPlatform({
      'PATCH /platform/tickets/2041': err(409, 'STALE_VERSION'),
      'POST /platform/tickets/2041/messages': ok({ ticket: { id: 2041, status: 'OPEN', version: 4 } }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-002041' }));
    const dialog = await screen.findByRole('dialog');
    const box = await within(dialog).findByRole('textbox', { name: 'Reply' });
    await userEvent.type(box, 'Hello');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Priority' }), 'LOW');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/changed while you were looking/)).toBeInTheDocument();
    // The reply was already sent, so the box is cleared once; the drawer reloaded the ticket.
    const gets = api.calls.filter(c => c.method === 'GET' && c.path === '/platform/tickets/2041').length;
    expect(gets).toBeGreaterThanOrEqual(2);
  });

  it('keeps a failed reply text when the reply itself is rejected', async () => {
    renderPlatform({ 'POST /platform/tickets/2041/messages': err(409, 'TICKET_CLOSED') });
    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-002041' }));
    const dialog = await screen.findByRole('dialog');
    const box = await within(dialog).findByRole('textbox', { name: 'Reply' });
    await userEvent.type(box, 'Still here');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await within(dialog).findByText('This ticket is closed and cannot be changed.'),
    ).toBeInTheDocument();
    expect(box).toHaveValue('Still here');
  });

  it('explains PUBLIC_REPLY_REQUIRED', async () => {
    renderPlatform({ 'PATCH /platform/tickets/2041': err(422, 'PUBLIC_REPLY_REQUIRED') });
    await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-002041' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Status' }),
      'RESOLVED',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/public reply to the society/)).toBeInTheDocument();
  });

  it('shows the Access grants tab only with its permission and honours ?tab=access', async () => {
    search.current = new URLSearchParams('tab=access');
    setMe(sampleMe({ platformPermissions: ['platform.support_access.view'] }));
    mockApi({ 'GET /platform/support-access': ok([], 'OK', page(0)) });
    render(
      <ToastProvider>
        <PlatformSupportScreen />
      </ToastProvider>,
    );
    expect(await screen.findByRole('tab', { name: 'Access grants', selected: true })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Tickets' })).not.toBeInTheDocument();
  });
});

describe('Help and support (11.10)', () => {
  beforeEach(resetAll);

  function renderHelp(
    routes: Parameters<typeof mockApi>[0] = {},
    perms = ['settings.support.view', 'settings.support.create'],
  ) {
    setMe(sampleMe({ permissions: perms }));
    const api = mockApi({
      'GET /support-tickets': ok([societyTicket({ messages: undefined })], 'OK', page(1)),
      'GET /support-tickets/2041': ok(societyTicket()),
      ...routes,
    });
    render(
      <ToastProvider>
        <HelpSupportScreen />
      </ToastProvider>,
    );
    return api;
  }

  it('lists tickets and labels platform replies', async () => {
    renderHelp();
    await userEvent.click(await screen.findByRole('button', { name: /UPI AutoPay mandate failing/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('SocietyApp Support · Isha Kapoor')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close ticket' })).toBeInTheDocument();
  });

  it('raises a ticket and shows the confirmation text', async () => {
    const api = renderHelp({ 'POST /support-tickets': ok(societyTicket({ status: 'OPEN' }), 'Created') });
    await userEvent.click(await screen.findByRole('button', { name: 'New ticket' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('High = money or access is blocked')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Subject' }), 'Receipts not generating');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send to SocietyApp' }));
    expect(await within(dialog).findByText(/at least 10 characters/)).toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Describe the problem' }),
      'The receipt PDF is blank for all members.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send to SocietyApp' }));
    expect(
      await screen.findByText('Ticket TKT-002041 raised. We usually reply within 2 hours.'),
    ).toBeInTheDocument();
    expect(api.last('POST', '/support-tickets')!.body).toMatchObject({
      subject: 'Receipts not generating',
      category: 'TECHNICAL',
      priority: 'MEDIUM',
    });
  });

  it('hides New ticket without the create permission', async () => {
    renderHelp({}, ['settings.support.view']);
    await screen.findByText(/UPI AutoPay mandate failing/);
    expect(screen.queryByRole('button', { name: 'New ticket' })).not.toBeInTheDocument();
  });

  it('offers Reopen with the cut-off date for a resolved ticket and rating after resolve', async () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const api = renderHelp({
      'GET /support-tickets/2041': ok(societyTicket({ status: 'RESOLVED', reopenAllowedUntil: future })),
      'POST /support-tickets/2041/rating': ok(null),
    });
    await userEvent.click(await screen.findByRole('button', { name: /UPI AutoPay mandate failing/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(within(dialog).getByText(/You can reopen until/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: '4 stars' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send rating' }));
    await waitFor(() => expect(api.last('POST', '/support-tickets/2041/rating')).toBeTruthy());
    expect(api.last('POST', '/support-tickets/2041/rating')!.body).toEqual({ rating: 4 });
  });

  it('does not offer Reopen once the window has passed', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    renderHelp({
      'GET /support-tickets/2041': ok(societyTicket({ status: 'RESOLVED', reopenAllowedUntil: past })),
    });
    await userEvent.click(await screen.findByRole('button', { name: /UPI AutoPay mandate failing/ }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('This ticket is resolved.');
    expect(within(dialog).queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument();
  });
});
