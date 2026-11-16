import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COL_FEATURES, COL_PERMS, COL_VIEW_PERMS, colRaw } from '@/test/collectionsFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { CollectionsScreen } from './CollectionsScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const list = (items: unknown[]) =>
  ok(items, 'OK', { pagination: { page: 1, limit: 24, total: items.length, totalPages: 1 } });
const ITEMS = [
  colRaw(),
  colRaw({
    id: 13,
    title: 'Water tank repair',
    isMandatory: true,
    status: 'PENDING_APPROVAL',
    purpose: 'x'.repeat(120),
    collectedPaise: 0,
    percent: 0,
    paidCount: 0,
  }),
];

function renderIt(routes: Routes = {}, perms = COL_PERMS) {
  signInAs(perms, COL_FEATURES);
  const api = mockApi({ 'GET /collections': list(ITEMS), ...routes });
  render(<CollectionsScreen />);
  return api;
}
beforeEach(resetAll);

describe('Collections list', () => {
  it('shows three skeleton cards, then a card per collection with the facts of 11.1', async () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-card')).toHaveLength(3);
    const cards = await screen.findAllByTestId('collection-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Optional');
    expect(cards[0]).toHaveTextContent('Live');
    expect(cards[0]).toHaveTextContent('Ganesh Utsav 2026');
    expect(cards[0]).toHaveTextContent('₹18,250 of ₹73,000 · 25%');
    expect(cards[0]).toHaveTextContent('18 of 73 flats');
    expect(cards[0]).toHaveTextContent('Due 10 Dec 2026');
    expect(within(cards[0]).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(cards[1]).toHaveTextContent('Mandatory');
    expect(cards[1]).toHaveTextContent('Awaiting approval');
    // purpose is cut at 90 characters
    expect(cards[1].textContent).toContain('…');
    expect(within(cards[0]).getByRole('link')).toHaveAttribute('href', '/admin/collections/12');
  });

  it('uses one column on a phone and more on wide screens', async () => {
    renderIt();
    const ul = await screen.findByRole('list', { name: 'Collections' });
    expect(ul.className).toContain('grid-cols-1');
    expect(ul.className).toContain('min-[700px]:grid-cols-2');
  });

  it('filters with the segmented control and asks the API for those statuses', async () => {
    const api = renderIt();
    await screen.findAllByTestId('collection-card');
    await userEvent.click(screen.getByRole('button', { name: 'Live' }));
    await waitFor(() => expect(api.calls.filter(c => c.path === '/collections')).toHaveLength(2));
    expect(decodeURIComponent(String(api.fn.mock.calls.at(-1)?.[0]))).toContain('status=PUBLISHED');
    expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Drafts' }));
    await waitFor(() =>
      expect(decodeURIComponent(String(api.fn.mock.calls.at(-1)?.[0]))).toContain('status=DRAFT,REJECTED'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Awaiting approval' }));
    await userEvent.click(screen.getByRole('button', { name: 'Closed' }));
    await waitFor(() =>
      expect(decodeURIComponent(String(api.fn.mock.calls.at(-1)?.[0]))).toContain('status=CLOSED,CANCELLED'),
    );
  });

  it('shows the empty state of 11.1 with New collection', async () => {
    renderIt({ 'GET /collections': list([]) });
    expect(await screen.findByText('No collections here')).toBeInTheDocument();
    expect(
      screen.getByText(/Create a festival or event collection and residents pay by UPI/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New collection' }).length).toBeGreaterThan(0);
  });

  it('hides New collection without finance.collections.create', async () => {
    renderIt({}, COL_VIEW_PERMS);
    await screen.findAllByTestId('collection-card');
    expect(screen.queryByRole('button', { name: 'New collection' })).toBeNull();
  });

  it('says there is no access without the view permission', async () => {
    renderIt({}, []);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });

  it('shows an error with Try again', async () => {
    renderIt({ 'GET /collections': [err(500, 'INTERNAL_ERROR'), list(ITEMS)] });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByTestId('collection-card')).toHaveLength(2);
  });

  it('pages when there are more collections', async () => {
    const api = renderIt({
      'GET /collections': ok(ITEMS, 'OK', { pagination: { page: 1, limit: 24, total: 40, totalPages: 2 } }),
    });
    await screen.findAllByTestId('collection-card');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(String(api.fn.mock.calls.at(-1)?.[0])).toContain('page=2'));
  });
});
