import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { incident, provider } from '@/test/opsFixtures';
import { page } from '@/test/societyFixtures';
import { HealthScreen } from './health/HealthScreen';
import { StatusPage } from './status/StatusPage';

vi.mock('next/navigation', () => navigationMock());

const ALL = ['platform.health.view', 'platform.health.edit', 'platform.settings.edit'];
const wa = provider({
  id: 2,
  providerKey: 'wa_gupshup',
  channel: 'WHATSAPP',
  vendor: 'GUPSHUP',
  displayName: 'WhatsApp Business API',
  priority: 1,
  health: { ...provider().health, status: 'DEGRADED', mode: 'MANUAL', reason: 'Slow deliveries' },
});

function renderHealth(routes: Parameters<typeof mockApi>[0] = {}, perms = ALL) {
  setMe(sampleMe({ platformPermissions: perms }));
  const api = mockApi({
    'GET /platform/providers': ok([provider(), wa]),
    'GET /platform/incidents': ok([incident()], 'OK', page(1)),
    ...routes,
  });
  render(
    <ToastProvider>
      <HealthScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Platform health (11.3)', () => {
  beforeEach(resetAll);

  it('shows provider cards with status, Manual tag, latency and uptime', async () => {
    renderHealth();
    const sms = await screen.findByRole('region', { name: 'SMS gateway (DLT)' });
    expect(within(sms).getByText('Operational')).toBeInTheDocument();
    expect(within(sms).getByText('820 ms')).toBeInTheDocument();
    expect(within(sms).getByText('99.95%')).toBeInTheDocument();
    const w = screen.getByRole('region', { name: 'WhatsApp Business API' });
    expect(within(w).getByText('Degraded')).toBeInTheDocument();
    expect(within(w).getByText('Manual')).toBeInTheDocument();
    expect(await screen.findByText('Delivery delays of about 4 minutes')).toBeInTheDocument();
  });

  it('hides Set status, Add provider and Open incident without the permissions', async () => {
    renderHealth({}, ['platform.health.view']);
    await screen.findByRole('region', { name: 'SMS gateway (DLT)' });
    expect(screen.queryByRole('button', { name: 'Set status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add provider' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open incident' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Details' })).toHaveLength(2);
  });

  it('runs all checks and reports failures', async () => {
    const api = renderHealth({
      'POST /platform/providers/check-all': ok({
        results: [{ providerId: 1, ok: false, latencyMs: null, error: 'x', healthStatus: 'OUTAGE' }],
      }),
    });
    await screen.findByRole('region', { name: 'SMS gateway (DLT)' });
    await userEvent.click(screen.getByRole('button', { name: 'Run all checks' }));
    expect(await screen.findByText('1 check failed.')).toBeInTheDocument();
    expect(api.last('POST', '/platform/providers/check-all')).toBeTruthy();
  });

  it('sets a manual status with a reason, and returns to automatic without one', async () => {
    const api = renderHealth({
      'POST /platform/providers/1/status': ok({ provider: provider(), incidentId: 119 }),
      'POST /platform/providers/2/status': ok({ provider: wa, incidentId: null }),
    });
    const sms = await screen.findByRole('region', { name: 'SMS gateway (DLT)' });
    await userEvent.click(within(sms).getByRole('button', { name: 'Set status' }));
    let dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Status' }), 'OUTAGE');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save status' }));
    expect(await within(dialog).findByText(/at least 5 characters/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Gateway down');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save status' }));
    await waitFor(() => expect(api.last('POST', '/platform/providers/1/status')).toBeTruthy());
    expect(api.last('POST', '/platform/providers/1/status')!.body).toEqual({
      version: 4,
      mode: 'MANUAL',
      status: 'OUTAGE',
      reason: 'Gateway down',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const w = screen.getByRole('region', { name: 'WhatsApp Business API' });
    await userEvent.click(within(w).getByRole('button', { name: 'Set status' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('AUTOMATIC');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save status' }));
    await waitFor(() => expect(api.last('POST', '/platform/providers/2/status')).toBeTruthy());
    expect(api.last('POST', '/platform/providers/2/status')!.body).toEqual({ version: 4, mode: 'AUTOMATIC' });
  });

  it('shows masked credentials, replaces them with password inputs and tests a send', async () => {
    const api = renderHealth({
      'PUT /platform/providers/1/credentials': ok(provider({ version: 5 })),
      'POST /platform/providers/1/test-send': ok({ ok: true, latencyMs: 640, error: null }),
    });
    const sms = await screen.findByRole('region', { name: 'SMS gateway (DLT)' });
    await userEvent.click(within(sms).getByRole('button', { name: 'Configure' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('••••••••3f9a')).toBeInTheDocument();
    await userEvent.type(within(drawer).getByRole('textbox', { name: /Send to/ }), '9876543210');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send test' }));
    expect(await within(drawer).findByText(/Test passed in 640 ms/)).toBeInTheDocument();
    expect(api.last('POST', '/platform/providers/1/test-send')!.body).toEqual({ to: '9876543210' });

    await userEvent.click(within(drawer).getByRole('button', { name: 'Replace credentials' }));
    const modal = (await screen.findAllByRole('dialog')).at(-1)!;
    const field = within(modal).getByLabelText('Auth key');
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.type(field, 'k'.repeat(24));
    await userEvent.click(within(modal).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(api.last('PUT', '/platform/providers/1/credentials')).toBeTruthy());
    expect(api.last('PUT', '/platform/providers/1/credentials')!.body).toEqual({
      version: 4,
      credentials: { authKey: 'k'.repeat(24) },
    });
  });

  it('disables Delete while a provider is enabled and explains LAST_ENABLED_PROVIDER', async () => {
    renderHealth({ 'PATCH /platform/providers/1': err(409, 'LAST_ENABLED_PROVIDER') });
    const sms = await screen.findByRole('region', { name: 'SMS gateway (DLT)' });
    await userEvent.click(within(sms).getByRole('button', { name: 'Configure' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByRole('button', { name: 'Delete' })).toBeDisabled();
    await userEvent.click(within(drawer).getByRole('switch', { name: 'Enabled' }));
    expect(await within(drawer).findByText(/last enabled provider/)).toBeInTheDocument();
  });

  it('opens an incident and validates the form', async () => {
    const api = renderHealth({
      'POST /platform/incidents': ok(incident({ id: 119, incidentNo: 'INC-000119' })),
      'GET /platform/incidents/119': ok(incident({ id: 119, incidentNo: 'INC-000119' })),
    });
    await screen.findByRole('region', { name: 'SMS gateway (DLT)' });
    await userEvent.click(screen.getByRole('button', { name: 'Open incident' }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.type(within(drawer).getByRole('textbox', { name: 'Title' }), 'WhatsApp delays');
    await userEvent.click(within(drawer).getAllByRole('button', { name: 'Open incident' }).at(-1)!);
    expect(await within(drawer).findByText(/Choose at least one affected component/)).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('checkbox', { name: 'WhatsApp' }));
    await userEvent.type(
      within(drawer).getByRole('textbox', { name: 'What is happening' }),
      'Messages arrive late for residents.',
    );
    await userEvent.click(within(drawer).getAllByRole('button', { name: 'Open incident' }).at(-1)!);
    await waitFor(() => expect(api.last('POST', '/platform/incidents')).toBeTruthy());
    expect(api.last('POST', '/platform/incidents')!.body).toMatchObject({
      title: 'WhatsApp delays',
      severity: 'SEV3',
      components: ['notifications_whatsapp'],
      isPublic: true,
    });
  });

  it('needs a root cause to resolve a SEV2 incident', async () => {
    const sev2 = incident({ severity: 'SEV2' });
    const api = renderHealth({
      'GET /platform/incidents': ok([sev2], 'OK', page(1)),
      'GET /platform/incidents/118': ok(sev2),
      'POST /platform/incidents/118/resolve': ok(incident({ status: 'RESOLVED' })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve' }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.type(
      await within(drawer).findByRole('textbox', { name: 'Closing update' }),
      'The provider fixed the issue.',
    );
    await userEvent.click(within(drawer).getByRole('button', { name: 'Resolve' }));
    expect(
      await within(drawer).findByText('Describe the root cause (at least 20 characters).'),
    ).toBeInTheDocument();
    expect(api.last('POST', '/platform/incidents/118/resolve')).toBeUndefined();
    await userEvent.type(
      within(drawer).getByRole('textbox', { name: 'Root cause' }),
      'Vendor queue backlog after a deploy.',
    );
    await userEvent.click(within(drawer).getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(api.last('POST', '/platform/incidents/118/resolve')).toBeTruthy());
  });
});

describe('Public status page (11.4)', () => {
  beforeEach(resetAll);
  const data = {
    overall: 'PARTIAL_OUTAGE',
    updatedAt: '2026-10-30T05:00:00.000Z',
    components: [
      { key: 'api', name: 'Sign-in and API', status: 'OPERATIONAL' },
      { key: 'notifications_whatsapp', name: 'WhatsApp', status: 'PARTIAL_OUTAGE' },
    ],
    activeIncidents: [
      {
        incidentNo: 'INC-000119',
        title: 'WhatsApp delivery delayed',
        severity: 'SEV2',
        status: 'IDENTIFIED',
        startedAt: '2026-10-30T04:10:00.000Z',
        components: ['notifications_whatsapp'],
        updates: [
          {
            at: '2026-10-30T04:10:00.000Z',
            status: 'INVESTIGATING',
            message: 'Messages are reaching residents late.',
          },
        ],
      },
    ],
    recentIncidents: [
      {
        incidentNo: 'INC-000117',
        title: 'Webhook retries elevated',
        severity: 'SEV3',
        startedAt: '2026-10-24T06:00:00.000Z',
        resolvedAt: '2026-10-24T06:12:00.000Z',
        durationMinutes: 12,
      },
    ],
  };

  it('renders the banner, components, active incident timeline and past incidents without a session', async () => {
    const api = mockApi({ 'GET /public/status': ok(data) });
    render(<StatusPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Some systems are not working');
    expect(screen.getByText('Sign-in and API')).toBeInTheDocument();
    expect(screen.getByText('Partial outage')).toBeInTheDocument();
    expect(screen.getByText('Messages are reaching residents late.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Past incidents (14 days)' })).toBeInTheDocument();
    expect(screen.getByText(/lasted 12 min/)).toBeInTheDocument();
    expect(api.calls).toHaveLength(1);
  });

  it('says all systems operational and refreshes every 60 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = mockApi({
        'GET /public/status': ok({
          ...data,
          overall: 'OPERATIONAL',
          activeIncidents: [],
          recentIncidents: [],
        }),
      });
      render(<StatusPage />);
      expect(await screen.findByText('All systems operational')).toBeInTheDocument();
      expect(screen.getByText('No incidents in the last 14 days.')).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(60_000);
      await waitFor(() => expect(api.calls.length).toBeGreaterThanOrEqual(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an error state when the status cannot be loaded', async () => {
    mockApi({ 'GET /public/status': err(500, 'INTERNAL_ERROR') });
    render(<StatusPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The status could not be loaded');
  });
});
