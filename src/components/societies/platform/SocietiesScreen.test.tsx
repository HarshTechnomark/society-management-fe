import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { page, societyRow } from '@/test/societyFixtures';
import { SocietiesScreen } from './SocietiesScreen';

vi.mock('next/navigation', () => navigationMock());

const ALL = [
  'platform.societies.view',
  'platform.societies.create',
  'platform.societies.export',
  'platform.societies.approve',
  'platform.plans.view',
];
const urls = (fn: ReturnType<typeof mockApi>['fn']) => fn.mock.calls.map(c => new URL(String(c[0])));

const rows = [
  societyRow(),
  societyRow({
    id: 2,
    name: 'Lake View CHS',
    slug: 'lake-view',
    status: 'TRIAL',
    planKey: 'STANDARD',
    mrrPaise: 0,
    healthScore: 52,
  }),
];

function renderScreen(perms = ALL) {
  setMe(sampleMe({ platformPermissions: perms, permissions: [] }));
  return render(
    <ToastProvider>
      <SocietiesScreen />
    </ToastProvider>,
  );
}

describe('SocietiesScreen (P-01)', () => {
  beforeEach(resetAll);

  it('lists societies with plan, status, MRR and health, and counts per status', async () => {
    mockApi({ 'GET /platform/societies': ok(rows, 'OK', page(2)) });
    renderScreen();
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(10);
    const table = await screen.findByRole('table', { name: 'Societies' });
    expect(within(table).getByText('Sky Heights CHS')).toBeInTheDocument();
    expect(within(table).getByText('sky-heights')).toBeInTheDocument();
    expect(within(table).getByText('₹10,300')).toBeInTheDocument();
    expect(within(table).getByRole('meter', { name: 'Health 52, At risk' })).toBeInTheDocument();
    // 5 statuses × total 2 from the limit=1 count calls.
    await waitFor(() => expect(screen.getByText('10 tenants')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Trial\s*2/ })).toBeInTheDocument();
  });

  it('sends search, plan, status and server sort to the API', async () => {
    const api = mockApi({ 'GET /platform/societies': ok(rows, 'OK', page(2)) });
    renderScreen();
    await screen.findByText('Sky Heights CHS');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search societies' }), 'pune');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by plan' }), 'PREMIUM');
    await userEvent.click(screen.getByRole('button', { name: /^Suspended/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Health/ }));
    await waitFor(() => {
      const last = urls(api.fn)
        .filter(u => u.searchParams.get('limit') === '20')
        .pop()!;
      expect(last.searchParams.get('q')).toBe('pune');
      expect(last.searchParams.get('planKey')).toBe('PREMIUM');
      expect(last.searchParams.get('status')).toBe('SUSPENDED');
      expect(last.searchParams.get('sortBy')).toBe('healthScore');
    });
  });

  it('sorts MRR within the page only and opens a row', async () => {
    const api = mockApi({ 'GET /platform/societies': ok(rows, 'OK', page(2)) });
    renderScreen();
    await screen.findByText('Sky Heights CHS');
    const before = api.fn.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: /^MRR/ }));
    const names = () =>
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map(r => within(r).getAllByRole('cell')[0].textContent);
    expect(names()[0]).toContain('Lake View CHS');
    // Changing a client-only sort does not refetch the list (only counts may be reused).
    expect(
      urls(api.fn)
        .slice(before)
        .some(u => u.searchParams.get('sortBy') === 'mrrPaise'),
    ).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Open Sky Heights CHS' }));
    expect(router.push).toHaveBeenCalledWith('/platform/societies/1');
  });

  it('shows the empty state and the error state with the request id', async () => {
    mockApi({ 'GET /platform/societies': ok([], 'OK', page(0)) });
    renderScreen();
    expect(await screen.findByText('No societies match')).toBeInTheDocument();
    resetAll();
    mockApi({ 'GET /platform/societies': err(500, 'INTERNAL_ERROR') });
    renderScreen();
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });

  it('hides Export CSV and Add society without their permissions', async () => {
    mockApi({ 'GET /platform/societies': ok(rows, 'OK', page(2)) });
    renderScreen(['platform.societies.view']);
    await screen.findByText('Sky Heights CHS');
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add society' })).not.toBeInTheDocument();
  });
});
