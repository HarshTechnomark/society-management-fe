import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureApiClient } from '@/lib/apiClient';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { grant, page, societyDetail } from '@/test/societyFixtures';
import { plan } from '@/test/subscriptionFixtures';
import type { SocietyDetail } from '@/types/societies';
import { SocietyDetailScreen } from './SocietyDetailScreen';

vi.mock('next/navigation', () => navigationMock());

const ALL = [
  'platform.societies.view',
  'platform.societies.edit',
  'platform.societies.export',
  'platform.societies.approve',
  'platform.societies.delete',
  'platform.support_access.view',
  'platform.support_access.create',
];

const events = ok(
  [
    {
      id: 1,
      eventType: 'CREATED',
      fromStatus: null,
      toStatus: 'TRIAL',
      triggerSource: 'PLATFORM_USER',
      triggerCode: 'ASSISTED_CREATE',
      reasonCategory: null,
      reason: null,
      actorName: 'Isha Kapoor',
      relatedEntityType: null,
      relatedEntityId: null,
      metadata: null,
      createdAt: '2026-10-30T06:30:00.000Z',
    },
  ],
  'OK',
  page(1),
);

function setup(detail: SocietyDetail | SocietyDetail[] = societyDetail(), routes = {}, perms = ALL) {
  setMe(sampleMe({ platformPermissions: perms }, { id: 7, name: 'Isha Kapoor' }));
  const api = mockApi({
    'GET /platform/societies/3': Array.isArray(detail) ? detail.map(d => ok(d)) : ok(detail),
    'GET /platform/societies/3/lifecycle-events': events,
    'GET /platform/plans': ok([plan()]),
    ...routes,
  });
  render(
    <ToastProvider>
      <SocietyDetailScreen id={3} />
    </ToastProvider>,
  );
  return api;
}

describe('SocietyDetailScreen (P-03, P-04)', () => {
  beforeEach(resetAll);

  it('shows header actions from allowedActions, the trial banner, KPIs and the lifecycle timeline', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Tulip Gardens CHS' })).toBeInTheDocument();
    for (const name of [
      'Convert to paid',
      'Extend trial',
      'Change plan',
      'Suspend',
      'Close society',
      'Request support access',
      'Export data',
    ])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
    expect(screen.getByText(/Trial ends .* \(14 days left\)\./)).toBeInTheDocument();
    expect(screen.getByText('tulip-gardens.societyapp.in · #3', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('10% of units')).toBeInTheDocument();
    expect(await screen.findByText('Society created')).toBeInTheDocument();
  });

  it('hides lifecycle buttons the API does not allow', async () => {
    setup(societyDetail({}, { allowedActions: [] }), {}, ['platform.societies.view']);
    await screen.findByRole('heading', { name: 'Tulip Gardens CHS' });
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request support access' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export data' })).not.toBeInTheDocument();
  });

  it('suspends with a reason category, version and step-up retry (US-05-05)', async () => {
    const stepUp = vi.fn(async () => true);
    const api = setup(undefined, {
      'POST /platform/societies/3/suspend': [
        err(401, 'REAUTH_REQUIRED'),
        ok({
          id: 3,
          status: 'SUSPENDED',
          suspendedAt: '2026-11-01T05:00:00.000Z',
          suspensionCause: 'MANUAL',
          version: 5,
        }),
      ],
    });
    configureApiClient({ stepUp });
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    const dialog = screen.getByRole('dialog', { name: 'Suspend Tulip Gardens CHS?' });
    expect(within(dialog).getByText(/SOS and emergency alerts keep working/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Reason$|^Reason \*/), 'too short');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend society' }));
    expect(within(dialog).getByText('Enter at least 10 characters.')).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Reason category/), 'FRAUD_SUSPECTED');
    await userEvent.type(within(dialog).getByLabelText(/^Reason \*/), ' and more detail here');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend society' }));
    await waitFor(() => expect(screen.getByText('Tulip Gardens CHS suspended')).toBeInTheDocument());
    expect(stepUp).toHaveBeenCalledTimes(1);
    expect(api.calls.filter(c => c.path === '/platform/societies/3/suspend')).toHaveLength(2);
    expect(api.last('POST', '/platform/societies/3/suspend')!.body).toEqual({
      reasonCategory: 'FRAUD_SUSPECTED',
      reason: 'too short and more detail here',
      version: 4,
    });
  });

  it('closes only after the society name is typed exactly', async () => {
    const api = setup(undefined, {
      'POST /platform/societies/3/close': ok({ id: 3, status: 'CLOSED', version: 5 }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Close society' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Reason \*/), 'Customer asked to close the account');
    await userEvent.type(
      within(dialog).getByLabelText(/Type the society name to confirm/),
      'tulip gardens chs',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close society' }));
    expect(within(dialog).getByText('Type the society name exactly as shown.')).toBeInTheDocument();
    expect(within(dialog).getByRole('switch', { name: 'Notify residents' })).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText(/Type the society name to confirm/));
    await userEvent.type(
      within(dialog).getByLabelText(/Type the society name to confirm/),
      'Tulip Gardens CHS',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close society' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/societies/3/close')?.body).toEqual({
        closureReason: 'CUSTOMER_REQUEST',
        reason: 'Customer asked to close the account',
        confirmName: 'Tulip Gardens CHS',
        notifyResidents: true,
        version: 4,
      }),
    );
  });

  it('extends a trial and shows extensions left', async () => {
    const api = setup(undefined, {
      'POST /platform/societies/3/extend-trial': ok({
        id: 3,
        status: 'TRIAL',
        trialEndsAt: '2026-11-27T06:30:00.000Z',
        trialExtendedCount: 1,
        version: 5,
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Extend trial' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Extensions left: 2')).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Extend by/), '14');
    await userEvent.type(within(dialog).getByLabelText(/^Reason \*/), 'Committee needs two more weeks');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Extend trial' }));
    expect(await screen.findByText('Trial extended to 27 Nov 2026')).toBeInTheDocument();
    expect(api.last('POST', '/platform/societies/3/extend-trial')!.body).toEqual({
      days: 14,
      reason: 'Committee needs two more weeks',
      version: 4,
    });
  });

  it('asks for a grace date when reactivation finds overdue invoices', async () => {
    const suspended = societyDetail(
      {},
      {
        status: 'SUSPENDED',
        trialEndsAt: null,
        suspendedAt: '2026-10-20T05:00:00.000Z',
        suspensionCause: 'NON_PAYMENT',
        allowedActions: ['REACTIVATE', 'CLOSE'],
      },
    );
    const api = setup(suspended, {
      'POST /platform/societies/3/reactivate': [
        err(422, 'GRACE_DATE_REQUIRED'),
        ok({ id: 3, status: 'PAST_DUE', version: 5 }),
      ],
    });
    expect(
      await screen.findByText(/Suspended: residents can still sign in, pay dues and export data/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText(/^Grace until/)).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Reason \*/), 'Paid half, rest promised this week');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }));
    const date = await within(dialog).findByLabelText(/^Grace until/);
    await userEvent.type(date, '2099-01-10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/societies/3/reactivate')!.body).toMatchObject({
        graceUntil: new Date('2099-01-10T23:59:59+05:30').toISOString(),
        version: 4,
      }),
    );
  });

  it('shows the closed banner and sets a purge hold', async () => {
    const closed = societyDetail(
      {},
      {
        status: 'CLOSED',
        trialEndsAt: null,
        closedAt: '2026-10-30T06:30:00.000Z',
        purgeAfter: '2027-01-28T06:30:00.000Z',
        allowedActions: ['REOPEN'],
      },
    );
    const api = setup(closed, {
      'PUT /platform/societies/3/purge-hold': ok({ id: 3, purgeHoldReason: 'x', version: 5 }),
    });
    expect(
      await screen.findByText(
        /Closed on 30 Oct 2026\. Personal data will be purged on 28 Jan 2027 unless a purge hold is set\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request support access' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hold purge' }));
    await userEvent.type(screen.getByLabelText(/^Reason \*/), 'Legal dispute with a vendor pending');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hold purge' }));
    await waitFor(() => expect(api.last('PUT', '/platform/societies/3/purge-hold')).toBeTruthy());
  });

  it('requests support access with consent and shows the waiting toast (P-05)', async () => {
    const api = setup(undefined, {
      'POST /platform/support-access': ok(
        grant({ status: 'PENDING_CONSENT', society: { id: 3, name: 'Tulip Gardens CHS' } }),
      ),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Request support access' }));
    const dialog = screen.getByRole('dialog', { name: 'Request support access to Tulip Gardens CHS' });
    expect(within(dialog).getByText(/requires consent/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('switch', { name: 'Emergency access' })).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Reason \*/), 'Too short');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request access' }));
    expect(within(dialog).getByText('Enter at least 20 characters.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Reason \*/), ' to explain the import error');
    await userEvent.type(within(dialog).getByLabelText(/^Ticket reference/), 'tkt-2041');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request access' }));
    expect(await screen.findByText('Waiting for Tulip Gardens CHS to approve…')).toBeInTheDocument();
    expect(api.last('POST', '/platform/support-access')!.body).toEqual({
      societyId: 3,
      scope: 'READ_ONLY',
      durationMinutes: 60,
      reason: 'Too short to explain the import error',
      ticketRef: 'TKT-2041',
    });
  });

  it('opens the admin app through the 60-second hand-off while my grant is active', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const mine = grant({
      requester: { id: 7, name: 'Isha Kapoor' },
      society: { id: 3, name: 'Tulip Gardens CHS' },
    });
    const api = setup(societyDetail({ openSupportGrant: mine }), {
      'POST /auth/support-handoff': ok({
        token: 'tok_123',
        expiresAt: '2026-11-01T05:01:00.000Z',
        adminUrl: 'https://admin.societyapp.in/support-handoff',
      }),
    });
    expect(await screen.findByRole('button', { name: 'End support access' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open as society admin' }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://admin.societyapp.in/support-handoff#token=tok_123',
        '_blank',
        'noopener',
      ),
    );
    expect(api.last('POST', '/auth/support-handoff')!.body).toEqual({ grantId: 43 });
  });

  it('starts a platform data export with a reason (P-08)', async () => {
    const api = setup(undefined, {
      'POST /platform/societies/3/data-exports': ok({ id: 9, status: 'QUEUED' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Export data' }));
    const dialog = screen.getByRole('dialog', { name: 'Export all data?' });
    expect(within(dialog).getByText(/platform staff cannot download it/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Reason \*/), 'Customer asked for a copy');
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Include documents' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start export' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/societies/3/data-exports')!.body).toEqual({
        reason: 'Customer asked for a copy',
        includeDocuments: false,
      }),
    );
  });

  it('shows Society not found for an unknown id', async () => {
    setup(undefined, { 'GET /platform/societies/3': err(404, 'SOCIETY_NOT_FOUND') });
    expect(await screen.findByText('Society not found')).toBeInTheDocument();
  });

  it('mounts the module 04 plan tab under Subscription', async () => {
    const api = setup(undefined, { 'GET /platform/subscriptions': ok([], 'OK', page(0)) });
    await userEvent.click(await screen.findByRole('tab', { name: 'Subscription' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/platform/subscriptions')).toBe(true));
  });
});
