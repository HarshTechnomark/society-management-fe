import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { dashboard } from '@/test/opsFixtures';
import { DashboardScreen } from './dashboard/DashboardScreen';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => navigationMock());

const health = {
  apiP95Ms: 192,
  errorRatePct: 0.12,
  requestsLast15Min: 48210,
  failedJobs: 7,
  providerIssues: [],
  uptime30dPct: 99.97,
  openIncidents: 0,
};

function renderIt(
  routes: Parameters<typeof mockApi>[0] = {},
  perms = ['platform.dashboard.view', 'platform.societies.create'],
) {
  setMe(sampleMe({ platformPermissions: perms }, { name: 'Isha Kapoor' }));
  const api = mockApi({
    'GET /platform/dashboard': ok(dashboard()),
    'GET /platform/dashboard/activity': ok({
      items: [
        {
          id: 1,
          at: new Date().toISOString(),
          tone: 'ok',
          text: 'Sky Heights CHS paid INV-100',
          link: '/societies/1',
        },
      ],
    }),
    'GET /platform/health/summary': ok(health),
    'GET /platform/plans': ok([{ code: 'PREMIUM', name: 'Premium', activeSubscriptions: 12 }]),
    ...routes,
  });
  render(
    <ToastProvider>
      <DashboardScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Dashboard (11.1)', () => {
  beforeEach(resetAll);

  it('shows skeleton tiles, then the KPI tiles with their sub-lines', async () => {
    renderIt();
    expect(screen.getAllByTestId('tile-skeleton')).toHaveLength(6);
    expect(await screen.findByText('₹1,84,350')).toBeInTheDocument();
    expect(screen.getByText('4.8% net MRR change')).toBeInTheDocument();
    expect(screen.getByText('2 past due · 6 on trial')).toBeInTheDocument();
    expect(screen.getByText('6 of 9')).toBeInTheDocument();
    expect(screen.getByText('67% convert')).toBeInTheDocument();
    expect(screen.getByText('2 unassigned')).toBeInTheDocument();
    // Null values read "Not available yet" (units and payment success).
    expect(screen.getAllByText('Not available yet')).toHaveLength(2);
    expect(screen.getByText('Welcome back, Isha')).toBeInTheDocument();
  });

  it('shows the health strip, needs-attention links and the activity feed', async () => {
    renderIt();
    expect(await screen.findByText('192 ms')).toBeInTheDocument();
    expect(screen.getByText('99.97%')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Past due societies/ });
    expect(link).toHaveAttribute('href', '/platform/societies?status=PAST_DUE');
    expect(await screen.findByText('Sky Heights CHS paid INV-100')).toBeInTheDocument();
  });

  it('shows "All clear" when nothing needs attention and loads the chosen period', async () => {
    const api = renderIt({ 'GET /platform/dashboard': ok(dashboard({ needsAttention: [] })) });
    expect(await screen.findByText('All clear')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '90 days' }));
    await screen.findByText('₹1,84,350');
    const periods = api.calls.filter(c => c.path === '/platform/dashboard').length;
    expect(periods).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: 'Add society' })).toHaveAttribute(
      'href',
      '/platform/societies?add=1',
    );
  });

  it('shows a per-card error with the request id', async () => {
    renderIt({ 'GET /platform/dashboard': err(500, 'INTERNAL_ERROR') });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('req_test')).toBeInTheDocument();
  });

  it('nudges an at-risk society', async () => {
    const api = renderIt({ 'POST /platform/societies/9/nudge': ok({ sentTo: 1, lastNudgedAt: 'x' }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Nudge' }));
    expect(await screen.findByText('Reminder sent.')).toBeInTheDocument();
    expect(api.last('POST', '/platform/societies/9/nudge')).toBeTruthy();
  });
});
