import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RUN_FEATURES, RUN_PERMS, RUN_VIEW_PERMS, runRaw } from '@/test/billingRunsFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { RunsScreen } from './RunsScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const list = (items: unknown[]) =>
  ok(items, 'OK', { pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } });
const RUNS = [
  runRaw(),
  runRaw({
    id: 87,
    runLabel: 'BR-2026-10',
    status: 'ISSUED',
    changePct: '-2.5',
    totalPaise: 32980000,
    counts: { items: 70, ready: 70, issued: 70 },
  }),
  runRaw({
    id: 90,
    runLabel: 'BR-2026-11-S1',
    runType: 'SUPPLEMENTARY',
    status: 'PENDING_APPROVAL',
    changePct: null,
  }),
];

function renderIt(routes: Routes = {}, perms = RUN_PERMS, features = RUN_FEATURES) {
  signInAs(perms, features);
  const api = mockApi({ 'GET /billing/runs': list(RUNS), ...routes });
  render(<RunsScreen />);
  return api;
}
beforeEach(resetAll);

describe('Billing runs list', () => {
  it('shows a skeleton, then one row per run with the status in words', async () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    const rows = await screen.findAllByTestId('run-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('BR-2026-11');
    expect(rows[0]).toHaveTextContent('November 2026');
    expect(rows[0]).toHaveTextContent('Ready to review');
    expect(rows[0]).toHaveTextContent('71 flats');
    expect(rows[0]).toHaveTextContent('₹3,33,631');
    expect(rows[1]).toHaveTextContent('Issued');
    expect(rows[1]).toHaveTextContent('-2.5 %');
    expect(rows[2]).toHaveTextContent('(extra run)');
    expect(rows[2]).toHaveTextContent('Waiting for approval');
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/admin/billing/runs/88');
  });

  it('shows New billing run to a person who can create, and not to a viewer', async () => {
    renderIt();
    expect(await screen.findByRole('link', { name: 'New billing run' })).toHaveAttribute(
      'href',
      '/admin/billing/runs/new',
    );
  });

  it('hides New billing run without finance.billing.create', async () => {
    renderIt({}, RUN_VIEW_PERMS);
    await screen.findAllByTestId('run-row');
    expect(screen.queryByRole('link', { name: 'New billing run' })).toBeNull();
  });

  it('filters by status and type through the API', async () => {
    const api = renderIt();
    await screen.findAllByTestId('run-row');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ISSUED');
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('status=ISSUED'))).toBe(true),
    );
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'SUPPLEMENTARY');
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('runType=SUPPLEMENTARY'))).toBe(true),
    );
  });

  it('shows an empty state with a way to start, and a different one for a filter', async () => {
    renderIt({ 'GET /billing/runs': list([]) });
    expect(await screen.findByText('No billing runs yet')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New billing run' }).length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'FAILED');
    expect(await screen.findByText('No runs match')).toBeInTheDocument();
  });

  it('shows an error with the reference and a retry', async () => {
    renderIt({ 'GET /billing/runs': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the lock when the plan has no billing run pipeline', async () => {
    signInAs(RUN_PERMS, []);
    render(<RunsScreen />);
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
  });

  it('pages through a long list', async () => {
    const api = renderIt({
      'GET /billing/runs': ok(RUNS, 'OK', { pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });
    await screen.findAllByTestId('run-row');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('page=2'))).toBe(true));
  });
});
