import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureApiClient } from '@/lib/apiClient';
import { setMe } from '@/lib/auth';
import { err, futureIso, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { dataExport, grant, page, societyStatus } from '@/test/societyFixtures';
import { AdminShell } from './AdminShell';
import { ConsentApproval } from './ConsentApproval';
import { DataExportSettings } from './DataExportSettings';
import { SupportAccessSettings } from './SupportAccessSettings';

vi.mock('next/navigation', () => navigationMock());

const chairman = (perms: string[]) =>
  setMe(
    sampleMe({
      permissions: perms,
      memberships: [
        {
          societyId: 1,
          societyName: 'Sky Heights CHS',
          city: 'Pune',
          societyStatus: 'ACTIVE',
          memberId: 1,
          roleKey: 'chairman',
          roleName: 'Chairman',
          roleScope: 'society',
          status: 'ACTIVE',
        },
      ],
    }),
  );

const wrap = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe('Settings › Support access (A-01)', () => {
  beforeEach(resetAll);

  const pending = grant({
    id: 50,
    code: 'G-0050',
    status: 'PENDING_CONSENT',
    requester: { name: 'Isha Kapoor' },
    startedAt: null,
    endsAt: null,
    version: 1,
    canDecide: true,
  });
  const active = grant({ id: 51, code: 'G-0051', requester: { name: 'Ravi Nair' }, canDecide: true });

  it('lists requests with Approve, Deny, Revoke and the countdown', async () => {
    chairman(['settings.support_access.view', 'settings.support_access.approve']);
    const api = mockApi({
      'GET /support-access/settings': ok({ requiresSupportConsent: true, version: 7 }),
      'GET /support-access': ok([pending, active], 'OK', page(2)),
      'POST /support-access/50/approve': ok({ ...pending, status: 'ACTIVE' }),
      'POST /support-access/51/revoke': ok({ ...active, status: 'REVOKED' }),
    });
    wrap(<SupportAccessSettings />);
    const table = await screen.findByRole('table', { name: 'Support access requests' });
    expect(within(table).getByText('Isha')).toBeInTheDocument();
    expect(within(table).getAllByText('SocietyApp Support')).toHaveLength(2);
    expect(within(table).getByText(/left$/)).toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.last('POST', '/support-access/50/approve')!.body).toEqual({ version: 1 }));
    await userEvent.click(within(table).getByRole('button', { name: 'Revoke' }));
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Work is done');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(api.last('POST', '/support-access/51/revoke')!.body).toEqual({
        reason: 'Work is done',
        version: 2,
      }),
    );
  });

  it('changes the consent setting with its version', async () => {
    chairman(['settings.support_access.view', 'settings.support_access.approve']);
    const api = mockApi({
      'GET /support-access/settings': ok({ requiresSupportConsent: true, version: 7 }),
      'GET /support-access': ok([], 'OK', page(0)),
      'PATCH /support-access/settings': ok({ requiresSupportConsent: false, version: 8 }),
    });
    wrap(<SupportAccessSettings />);
    expect(await screen.findByText('No support requests yet.')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('switch', { name: 'Require our consent before SocietyApp support can view our data' }),
    );
    await waitFor(() =>
      expect(api.last('PATCH', '/support-access/settings')!.body).toEqual({
        requiresSupportConsent: false,
        version: 7,
      }),
    );
  });

  it('shows the read log of an ended grant in a drawer', async () => {
    chairman(['settings.support_access.view']);
    const ended = grant({ id: 41, code: 'G-0041', status: 'EXPIRED', requester: { name: 'Isha Kapoor' } });
    mockApi({
      'GET /support-access/settings': ok({ requiresSupportConsent: true, version: 7 }),
      'GET /support-access': ok([ended], 'OK', page(1)),
      'GET /support-access/41': ok({
        ...ended,
        readLog: [
          {
            at: '2026-10-30T05:50:00.000Z',
            method: 'GET',
            route: '/api/v1/billing/invoices',
            action: null,
            entityType: null,
            entityId: null,
          },
        ],
      }),
    });
    wrap(<SupportAccessSettings />);
    // No approve permission: the switch is disabled and no decision buttons.
    expect(await screen.findByRole('switch')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'What they viewed' }));
    expect(await screen.findByText(/^Viewed Billing › Invoices at/)).toBeInTheDocument();
  });
});

describe('Consent approval page (A-02)', () => {
  beforeEach(resetAll);

  it('describes the request in plain words and approves it', async () => {
    chairman(['settings.support_access.view', 'settings.support_access.approve']);
    const g = grant({ id: 50, status: 'PENDING_CONSENT', startedAt: null, endsAt: null, version: 1 });
    const api = mockApi({
      'GET /support-access/50': ok({ ...g, readLog: [] }),
      'POST /support-access/50/approve': ok({ ...g, status: 'ACTIVE', endsAt: '2026-11-01T06:42:00.000Z' }),
    });
    wrap(<ConsentApproval id={50} />);
    expect(await screen.findByText('Isha can view but not change your society’s data')).toBeInTheDocument();
    expect(screen.getByText('Sky Heights CHS')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(/Approved\. SocietyApp support has access until/)).toBeInTheDocument();
    expect(api.last('POST', '/support-access/50/approve')!.body).toEqual({ version: 1 });
  });

  it('says a decided request is no longer waiting', async () => {
    chairman(['settings.support_access.approve']);
    mockApi({ 'GET /support-access/50': ok({ ...grant({ status: 'DENIED' }), readLog: [] }) });
    wrap(<ConsentApproval id={50} />);
    expect(await screen.findByText('This request is no longer waiting for a decision.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('shows the consent-window error when approval is too late', async () => {
    chairman(['settings.support_access.approve']);
    const g = grant({ id: 50, status: 'PENDING_CONSENT', startedAt: null, endsAt: null });
    mockApi({
      'GET /support-access/50': ok({ ...g, readLog: [] }),
      'POST /support-access/50/approve': err(409, 'CONSENT_WINDOW_EXPIRED'),
    });
    wrap(<ConsentApproval id={50} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('This request expired before it was approved.')).toBeInTheDocument();
  });
});

describe('Settings › Data export (A-06)', () => {
  beforeEach(resetAll);

  it('shows the empty state and requests an export after step-up', async () => {
    chairman(['settings.data_export.view', 'settings.data_export.create']);
    const stepUp = vi.fn(async () => true);
    const api = mockApi({
      'GET /data-exports': [
        ok([], 'OK', page(0)),
        ok([dataExport({ status: 'QUEUED', progressPercent: 0 })], 'OK', page(1)),
      ],
      'POST /data-exports': [err(401, 'REAUTH_REQUIRED'), ok(dataExport({ status: 'QUEUED' }))],
    });
    configureApiClient({ stepUp });
    wrap(<DataExportSettings />);
    expect(
      await screen.findByText(
        'You have not exported data yet. Your data belongs to your society; export it any time.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Request export' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Request export' }));
    expect(await screen.findByRole('progressbar', { name: 'Export progress' })).toBeInTheDocument();
    expect(stepUp).toHaveBeenCalledTimes(1);
    expect(api.last('POST', '/data-exports')!.body).toEqual({ includeDocuments: true });
  });

  it('downloads a ready part through a short-lived URL', async () => {
    chairman(['settings.data_export.view']);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const api = mockApi({
      'GET /data-exports': ok([dataExport()], 'OK', page(1)),
      'GET /data-exports/77/download-url': ok({
        url: 'https://files.example/part-2.zip',
        expiresAt: futureIso(300),
        fileName: 'sky-heights-export-20261030-1240-part-002.zip',
        sizeBytes: 1,
      }),
    });
    wrap(<DataExportSettings />);
    expect(await screen.findByText('700 MB')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request export' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download part 2 of 2' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://files.example/part-2.zip'));
    expect(new URL(String(api.fn.mock.calls.at(-1)![0])).searchParams.get('part')).toBe('2');
    vi.unstubAllGlobals();
  });
});

describe('Admin shell banners (A-03, A-04, A-05, P-07)', () => {
  beforeEach(resetAll);

  it('shows the red suspended banner with Pay now and Export data', async () => {
    chairman(['settings.subscription.view', 'settings.data_export.create']);
    mockApi({
      'GET /society-status': ok(
        societyStatus({
          status: 'SUSPENDED',
          readOnly: true,
          banner: {
            tone: 'bad',
            key: 'SUSPENDED',
            text: "Your society's SocietyApp account is suspended. You can view and export data. Pay the platform invoice to restore access.",
          },
        }),
      ),
    });
    wrap(<AdminShell>Today</AdminShell>);
    expect(
      await screen.findByText(/account is suspended\. You can view and export data/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute(
      'href',
      '/admin/settings/subscription',
    );
    expect(screen.getByRole('link', { name: 'Export data' })).toHaveAttribute(
      'href',
      '/admin/settings/data-export',
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('tells every admin user that support has access', async () => {
    chairman(['settings.support_access.approve']);
    mockApi({
      'GET /society-status': ok(
        societyStatus({
          supportAccess: {
            active: true,
            scope: 'READ_ONLY',
            endsAt: '2026-11-01T06:42:00.000Z',
            staffFirstName: 'Isha',
          },
        }),
      ),
    });
    wrap(<AdminShell>Today</AdminShell>);
    expect(
      await screen.findByText(
        /SocietyApp support \(Isha\) has read-only access until .*\. Everything they do is recorded\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/admin/settings/support-access',
    );
  });

  it('shows the closed page with the closure export download', async () => {
    chairman(['settings.data_export.view']);
    mockApi({
      'GET /society-status': ok(
        societyStatus({ status: 'CLOSED', closedAt: '2026-10-30T06:30:00.000Z', closureExportId: 90 }),
      ),
      'GET /data-exports/90': ok(
        dataExport({ id: 90, kind: 'CLOSURE', partCount: 1, expiresAt: '2026-11-29T06:30:00.000Z' }),
      ),
    });
    wrap(<AdminShell>Today</AdminShell>);
    expect(
      await screen.findByText('Sky Heights CHS closed its SocietyApp account on 30 Oct 2026.'),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Available until 29 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  it('tells members without export permission to ask the committee', async () => {
    chairman([]);
    mockApi({
      'GET /society-status': ok(societyStatus({ status: 'CLOSED', closedAt: '2026-10-30T06:30:00.000Z' })),
    });
    wrap(<AdminShell>Today</AdminShell>);
    expect(await screen.findByText('Contact your committee for a copy of your records.')).toBeInTheDocument();
  });

  it('shows the support bar with Leave in a hand-off tab, then Support access ended', async () => {
    setMe(
      sampleMe({
        supportGrant: { id: 43, scope: 'READ_ONLY', endsAt: futureIso(600) },
        memberships: [],
      }),
    );
    const api = mockApi({
      'GET /society-status': ok(
        societyStatus({
          societyName: 'Lake View CHS',
          viewerIsSupport: true,
          supportAccess: { active: true, scope: 'READ_ONLY', endsAt: futureIso(600), staffFirstName: 'Isha' },
        }),
      ),
      'POST /auth/logout': ok(null),
    });
    wrap(<AdminShell>Today</AdminShell>);
    expect(
      await screen.findByText(/Support access active · Lake View CHS · read only · expires/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Support access ended' })).toBeInTheDocument();
    expect(api.last('POST', '/auth/logout')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the platform console' })).toHaveAttribute(
      'href',
      'https://platform.societyapp.in/platform/support',
    );
  });

  it('shows Support access ended when the hand-off session is revoked', async () => {
    setMe(sampleMe({ supportGrant: { id: 43, scope: 'READ_ONLY', endsAt: futureIso(600) } }));
    mockApi({ 'GET /society-status': err(401, 'SESSION_REVOKED') });
    wrap(<AdminShell>Today</AdminShell>);
    expect(await screen.findByRole('heading', { name: 'Support access ended' })).toBeInTheDocument();
  });
});
