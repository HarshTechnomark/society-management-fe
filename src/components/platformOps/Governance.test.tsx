import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { auditRow, failedJob, org, queue, setting } from '@/test/opsFixtures';
import { page } from '@/test/societyFixtures';
import { AuditScreen } from './audit/AuditScreen';
import { JobsScreen } from './jobs/JobsScreen';
import { OrganizationsScreen } from './organizations/OrganizationsScreen';
import { SettingsScreen } from './settings/SettingsScreen';

vi.mock('next/navigation', () => navigationMock());

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('Jobs and queues (11.6)', () => {
  beforeEach(resetAll);
  const totals = { waiting: 87, active: 12, delayed: 9, failed: 7, throughputPerMin: 1840, pausedQueues: 1 };
  const queues = {
    items: [
      queue(),
      queue({
        name: 'billing',
        isPaused: true,
        counts: { waiting: 0, active: 0, delayed: 0, failed: 0, completed24h: 5 },
      }),
    ],
    totals,
  };

  function renderJobs(
    routes: Parameters<typeof mockApi>[0] = {},
    perms = ['platform.jobs.view', 'platform.jobs.edit'],
  ) {
    setMe(sampleMe({ platformPermissions: perms }));
    const api = mockApi({
      'GET /platform/queues': ok(queues),
      'GET /platform/jobs/failed': ok([failedJob()], 'OK', page(1)),
      'GET /platform/queues/payments/jobs/4471': ok({
        ...failedJob(),
        data: { societyId: 9, email: '[redacted]' },
      }),
      ...routes,
    });
    wrap(<JobsScreen />);
    return api;
  }

  it('shows the KPI row and the queue table with states', async () => {
    renderJobs();
    const table = await screen.findByRole('table', { name: 'Queues' });
    expect(within(table).getByText('Running')).toBeInTheDocument();
    expect(within(table).getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('1,840')).toBeInTheDocument();
    expect(screen.getByText('7')).toHaveClass('text-bad');
  });

  it('opens the failed jobs drawer from the failed chip and shows card details and payload', async () => {
    renderJobs();
    await userEvent.click(await screen.findByRole('button', { name: '2 failed jobs in payments' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('payments:process-webhook')).toBeInTheDocument();
    expect(within(drawer).getByText('GatewayTimeoutError')).toBeInTheDocument();
    expect(within(drawer).getByText(/attempt 3 of 5/)).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Society 9' })).toHaveAttribute(
      'href',
      '/platform/societies/9',
    );
    await userEvent.click(within(drawer).getByRole('button', { name: 'Show payload' }));
    expect(await within(drawer).findByText(/\[redacted\]/)).toBeInTheDocument();
  });

  it('retries and discards with a reason', async () => {
    const api = renderJobs({
      'POST /platform/queues/payments/jobs/4471/retry': ok({
        jobId: '4471',
        state: 'waiting',
        warning: 'PERMANENT_ERROR_LIKELY_TO_FAIL',
      }),
      'POST /platform/queues/payments/jobs/4471/discard': { status: 204 },
    });
    await userEvent.click(await screen.findByRole('button', { name: '2 failed jobs in payments' }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/will likely fail again/)).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Discard' }));
    const reason = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(reason).getByRole('button', { name: 'Discard' }));
    expect(await within(reason).findByText(/at least 5 characters/)).toBeInTheDocument();
    await userEvent.type(within(reason).getByRole('textbox', { name: 'Reason' }), 'Duplicate webhook');
    await userEvent.click(within(reason).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(api.last('POST', '/platform/queues/payments/jobs/4471/discard')).toBeTruthy());
    expect(api.last('POST', '/platform/queues/payments/jobs/4471/discard')!.body).toEqual({
      reason: 'Duplicate webhook',
    });
  });

  it('pauses a queue with a reason, resumes another, and confirms Retry all failed', async () => {
    const api = renderJobs({
      'POST /platform/queues/payments/pause': ok(queue({ isPaused: true })),
      'POST /platform/queues/billing/resume': ok(queue({ name: 'billing' })),
      'POST /platform/queues/retry-failed': ok({ examined: 7, retried: 4, skippedPermanent: 3 }),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Pause\s*payments/ }));
    let dlg = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Reason' }), 'Gateway maintenance');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(api.last('POST', '/platform/queues/payments/pause')).toBeTruthy());
    expect(api.last('POST', '/platform/queues/payments/pause')!.body).toEqual({
      reason: 'Gateway maintenance',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Resume\s*billing/ }));
    dlg = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Reason' }), 'Maintenance over');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(api.last('POST', '/platform/queues/billing/resume')).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Retry all failed' }));
    dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/permanent error/)).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Retry all failed' }));
    expect(await screen.findByText('4 retried, 3 skipped (permanent errors).')).toBeInTheDocument();
  });

  it('polls every 5 seconds and pauses polling while a dialog is open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = renderJobs();
      await screen.findByRole('table', { name: 'Queues' });
      const count = () => api.calls.filter(c => c.path === '/platform/queues').length;
      const before = count();
      await act(() => vi.advanceTimersByTimeAsync(5100));
      expect(count()).toBeGreaterThan(before);
      await userEvent.click(screen.getByRole('button', { name: '2 failed jobs in payments' }));
      await screen.findByRole('dialog');
      const open = count();
      await act(() => vi.advanceTimersByTimeAsync(11_000));
      expect(count()).toBe(open);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides Pause, Resume and Retry all without the edit permission', async () => {
    renderJobs({}, ['platform.jobs.view']);
    await screen.findByRole('table', { name: 'Queues' });
    expect(screen.queryByRole('button', { name: /Pause/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry all failed' })).not.toBeInTheDocument();
  });
});

describe('Audit trail (11.7)', () => {
  beforeEach(resetAll);
  const list = (items: object[], extra: object, p: object) => ({
    ...ok({ items, ...extra }),
    extra: { pagination: p },
  });

  it('lists platform rows, loads more by cursor, shows the archive note and exports', async () => {
    setMe(sampleMe({ platformPermissions: ['platform.audit_log.view', 'platform.audit_log.export'] }));
    const api = mockApi({
      'GET /platform/audit-logs': [
        list([auditRow()], { archivedBefore: '2024-10-01' }, { limit: 20, nextCursor: 'abc', hasMore: true }),
        list(
          [auditRow({ id: 905112, action: 'platform.plan.updated', entityLabel: 'Premium' })],
          { archivedBefore: null },
          { limit: 20, nextCursor: null, hasMore: false },
        ),
      ],
    });
    wrap(<AuditScreen scope="platform" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    expect(within(table).getByText('platform.society.suspended')).toBeInTheDocument();
    expect(within(table).getByText('203.0.113.24')).toBeInTheDocument();
    expect(screen.getByText(/Older entries are archived/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await within(table).findByText('platform.plan.updated')).toBeInTheDocument();
    const second = api.fn.mock.calls
      .map(c => new URL(String(c[0])))
      .filter(u => u.pathname.endsWith('/audit-logs'))[1];
    expect(second.searchParams.get('cursor')).toBe('abc');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('opens a row with a Changes table that highlights changed fields', async () => {
    setMe(sampleMe({ platformPermissions: ['platform.audit_log.view'] }));
    mockApi({
      'GET /platform/audit-logs': list(
        [auditRow()],
        { archivedBefore: null },
        { limit: 20, nextCursor: null, hasMore: false },
      ),
      'GET /platform/audit-logs/905113': ok(auditRow()),
    });
    wrap(<AuditScreen scope="platform" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open entry 905113' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('req_7Q2M9X4K1B3D')).toBeInTheDocument();
    expect(within(drawer).getByText('Unpaid for 45 days')).toBeInTheDocument();
    const status = within(drawer).getByRole('rowheader', { name: 'status' }).closest('tr')!;
    const plan = within(drawer).getByRole('rowheader', { name: 'plan' }).closest('tr')!;
    expect(status).toHaveAttribute('data-changed');
    expect(plan).not.toHaveAttribute('data-changed');
  });

  it('shows the Archives tab and downloads one part', async () => {
    setMe(sampleMe({ platformPermissions: ['platform.audit_log.view', 'platform.audit_log.export'] }));
    const api = mockApi({
      'GET /platform/audit-logs': list(
        [],
        { archivedBefore: null },
        { limit: 20, nextCursor: null, hasMore: false },
      ),
      'GET /platform/audit-logs/archives': ok({
        cutoff: '2024-10-01',
        archiveAfterMonths: 24,
        paused: false,
        items: [
          {
            month: '2024-09',
            part: 1,
            rowCount: 182340,
            status: 'COMPLETED',
            archivedAt: '2024-10-02T21:00:00.000Z',
          },
        ],
      }),
      'POST /platform/audit-logs/archives/download-url': ok({
        url: 'https://files.example/a.zip',
        expiresAt: 'x',
      }),
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    wrap(<AuditScreen scope="platform" />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Archives' }));
    expect(await screen.findByText('1,82,340')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Download/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://files.example/a.zip'));
    expect(api.last('POST', '/platform/audit-logs/archives/download-url')!.body).toEqual({
      month: '2024-09',
      part: 1,
    });
    vi.unstubAllGlobals();
  });

  it('the society screen has no Society or IP column, shows platform rows as SocietyApp Support and uses its own API', async () => {
    setMe(sampleMe({ permissions: ['settings.audit_log.view', 'settings.audit_log.export'] }));
    const api = mockApi({
      'GET /audit-logs': list(
        [auditRow()],
        { archivedBefore: null },
        { limit: 20, nextCursor: null, hasMore: false },
      ),
    });
    wrap(<AuditScreen scope="society" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    expect(within(table).queryByRole('columnheader', { name: 'IP' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Society' })).not.toBeInTheDocument();
    expect(within(table).getByText('SocietyApp Support · Platform')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Archives' })).not.toBeInTheDocument();
    expect(api.calls.every(c => c.path === '/audit-logs')).toBe(true);
  });

  it('explains AUDIT_RANGE_TOO_LARGE', async () => {
    setMe(sampleMe({ platformPermissions: ['platform.audit_log.view'] }));
    mockApi({ 'GET /platform/audit-logs': err(400, 'AUDIT_RANGE_TOO_LARGE') });
    wrap(<AuditScreen scope="platform" />);
    expect(await screen.findByText(/at most 366 days/)).toBeInTheDocument();
  });
});

describe('Settings (11.8)', () => {
  beforeEach(resetAll);
  const data = {
    categories: {
      GENERAL: [
        setting('company.platformName', 'SocietyApp'),
        setting('company.supportEmail', 'help@societyapp.in'),
        setting('company.legalName', 'SocietyApp Technologies Pvt Ltd'),
        setting('company.gstin', '27ABCDE1234F1Z5'),
        setting('company.stateCode', '27'),
        setting('company.pan', 'ABCDE1234F'),
        setting('company.address', 'Office 401, Baner Road, Pune'),
      ],
      BILLING: [
        setting('billing.sacCode', '998314'),
        setting('billing.gstRatePct', '18.0000'),
        setting('billing.netTermsDays', 15),
        setting('billing.reminderOffsetsDays', [-7, 0, 3, 7], { valueType: 'JSON' }),
        setting('billing.pastDueAfterDays', 1, { version: 2 }),
        setting('billing.suspendAfterDays', 15, { version: 5 }),
        setting('billing.dunningMinDuePaise', 10000),
        setting('billing.maxGoodwillCreditPaise', 50000000),
        setting('billing.tdsMaxRatePct', '10.0000'),
        setting('billing.pendingOrderMinutes', 30),
      ],
      SECURITY: [
        setting('security.idleMinutes', 30),
        setting('security.stepUpMinutes', 5),
        setting('security.ipAllowlist', [], { valueType: 'JSON' }),
      ],
      NOTIFICATIONS: [
        setting('alerts.pastDue', true),
        setting('alerts.jobFailed', true),
        setting('alerts.trialEnding', true),
        setting('alerts.providerDown', false),
      ],
      SUPPORT: [
        setting(
          'support.slaHours',
          {
            HIGH: { firstResponse: 2, resolution: 24 },
            MEDIUM: { firstResponse: 8, resolution: 72 },
            LOW: { firstResponse: 24, resolution: 120 },
          },
          { valueType: 'JSON' },
        ),
        setting('support.autoCloseDays', 7),
        setting('support.waitingAutoResolveDays', 14),
        setting('support.maxOpenTicketsPerSociety', 25),
      ],
    },
  };
  function renderIt(
    routes: Parameters<typeof mockApi>[0] = {},
    perms = ['platform.settings.view', 'platform.settings.edit'],
  ) {
    setMe(sampleMe({ platformPermissions: perms }));
    const api = mockApi({ 'GET /platform/settings': ok(data), ...routes });
    wrap(<SettingsScreen />);
    return api;
  }

  it('shows the tabs of the spec and the General fields', async () => {
    renderIt();
    expect(await screen.findByRole('textbox', { name: 'Platform name' })).toHaveValue('SocietyApp');
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'General',
      'Billing defaults',
      'Lifecycle',
      'Security',
      'Notifications',
      'Support',
      'Data',
      'Status',
    ]);
    expect(screen.getByRole('combobox', { name: 'GST state code' })).toHaveValue('27');
  });

  it('saves only the changed keys with their versions', async () => {
    const api = renderIt({ 'PATCH /platform/settings': ok({}) });
    await userEvent.click(await screen.findByRole('tab', { name: 'Billing defaults' }));
    const suspend = await screen.findByRole('textbox', { name: 'Suspend after (days)' });
    await userEvent.clear(suspend);
    await userEvent.type(suspend, '21');
    await userEvent.click(screen.getByRole('button', { name: 'Save billing defaults' }));
    await waitFor(() => expect(api.last('PATCH', '/platform/settings')).toBeTruthy());
    expect(api.last('PATCH', '/platform/settings')!.body).toEqual({
      changes: [{ key: 'billing.suspendAfterDays', value: 21, version: 5 }],
    });
  });

  it('shows inline errors from the API per field', async () => {
    renderIt({
      'PATCH /platform/settings': err(422, 'SUSPEND_NOT_AFTER_PAST_DUE', [
        { field: 'billing.suspendAfterDays', message: 'Must be after past due' },
      ]),
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Billing defaults' }));
    const suspend = await screen.findByRole('textbox', { name: 'Suspend after (days)' });
    await userEvent.clear(suspend);
    await userEvent.type(suspend, '1');
    await userEvent.click(screen.getByRole('button', { name: 'Save billing defaults' }));
    expect(await screen.findByText('Must be after past due')).toBeInTheDocument();
    expect(screen.getByText(/at least one day after past due/)).toBeInTheDocument();
  });

  it('asks for a reason when a security key changes, and sends it', async () => {
    const api = renderIt({ 'PATCH /platform/settings': ok({}) });
    await userEvent.click(await screen.findByRole('tab', { name: 'Security' }));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Idle sign-out' }), '15');
    await userEvent.click(screen.getByRole('button', { name: 'Save security' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save security settings' }));
    expect(await within(dlg).findByText(/at least 5 characters/)).toBeInTheDocument();
    expect(api.last('PATCH', '/platform/settings')).toBeUndefined();
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Reason' }), 'Shorter sessions');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save security settings' }));
    await waitFor(() => expect(api.last('PATCH', '/platform/settings')).toBeTruthy());
    expect(api.last('PATCH', '/platform/settings')!.body).toEqual({
      changes: [{ key: 'security.idleMinutes', value: 15, version: 3 }],
      reason: 'Shorter sessions',
    });
  });

  it('does not send a reason for non-security tabs and refuses an empty save', async () => {
    const api = renderIt();
    await userEvent.click(await screen.findByRole('tab', { name: 'Notifications' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save notifications' }));
    expect(await screen.findByText(/Nothing to save/)).toBeInTheDocument();
    expect(api.last('PATCH', '/platform/settings')).toBeUndefined();
  });

  it('disables every field without the edit permission', async () => {
    renderIt({}, ['platform.settings.view']);
    expect(await screen.findByRole('textbox', { name: 'Platform name' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
  });

  it('edits the SLA grid', async () => {
    const api = renderIt({ 'PATCH /platform/settings': ok({}) });
    await userEvent.click(await screen.findByRole('tab', { name: 'Support' }));
    const box = await screen.findByRole('spinbutton', { name: 'High first response hours' });
    await userEvent.clear(box);
    await userEvent.type(box, '1');
    await userEvent.click(screen.getByRole('button', { name: 'Save support' }));
    await waitFor(() => expect(api.last('PATCH', '/platform/settings')).toBeTruthy());
    expect(api.last('PATCH', '/platform/settings')!.body).toMatchObject({
      changes: [
        {
          key: 'support.slaHours',
          value: {
            HIGH: { firstResponse: 1, resolution: 24 },
            MEDIUM: { firstResponse: 8, resolution: 72 },
            LOW: { firstResponse: 24, resolution: 120 },
          },
        },
      ],
    });
  });
});

describe('Organizations (11.9)', () => {
  beforeEach(resetAll);
  function renderIt(
    routes: Parameters<typeof mockApi>[0] = {},
    perms = [
      'platform.societies.view',
      'platform.societies.create',
      'platform.societies.edit',
      'platform.societies.delete',
    ],
  ) {
    setMe(sampleMe({ platformPermissions: perms }));
    const api = mockApi({
      'GET /platform/organizations': ok([org()], 'OK', page(1)),
      'GET /platform/organizations/5': ok(org()),
      ...routes,
    });
    wrap(<OrganizationsScreen />);
    return api;
  }

  it('lists organizations and opens the drawer with linked societies', async () => {
    renderIt();
    const table = await screen.findByRole('table', { name: 'Organizations' });
    expect(within(table).getByText('lodha-group')).toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'Open Lodha Group' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByRole('link', { name: 'Sky Heights CHS' })).toHaveAttribute(
      'href',
      '/platform/societies/1',
    );
    expect(within(drawer).getByText(/Saved: 98XXXXX111/)).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Close organization' })).toBeInTheDocument();
  });

  it('suspends with a reason', async () => {
    const api = renderIt({ 'POST /platform/organizations/5/status': ok(org({ status: 'SUSPENDED' })) });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Lodha Group' }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Suspend' }));
    const dlg = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Reason' }), 'Payment dispute');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Suspend' }));
    await waitFor(() => expect(api.last('POST', '/platform/organizations/5/status')).toBeTruthy());
    expect(api.last('POST', '/platform/organizations/5/status')!.body).toEqual({
      status: 'SUSPENDED',
      reason: 'Payment dispute',
    });
  });

  it('hides Close organization without the delete permission', async () => {
    renderIt({}, ['platform.societies.view', 'platform.societies.edit']);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Lodha Group' }));
    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByRole('button', { name: 'Suspend' });
    expect(within(drawer).queryByRole('button', { name: 'Close organization' })).toBeNull();
  });

  it('creates an organization with a slug taken from the name and explains a taken slug', async () => {
    const api = renderIt({ 'POST /platform/organizations': err(409, 'ORGANIZATION_SLUG_TAKEN') });
    await userEvent.click(await screen.findByRole('button', { name: 'Add organization' }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.type(within(drawer).getByRole('textbox', { name: 'Name' }), 'Godrej Properties');
    expect(within(drawer).getByRole('textbox', { name: 'Web address' })).toHaveValue('godrej-properties');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Create' }));
    expect(await within(drawer).findByText(/already used by another organization/)).toBeInTheDocument();
    expect(api.last('POST', '/platform/organizations')!.body).toMatchObject({
      name: 'Godrej Properties',
      slug: 'godrej-properties',
    });
  });
});
