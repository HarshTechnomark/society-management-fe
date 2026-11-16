import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { COL_FEATURES, COL_VIEW_PERMS, colRaw } from '@/test/collectionsFixtures';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { LiveCollectionsCard } from './LiveCollectionsCard';

beforeEach(resetAll);
const list = (items: unknown[]) =>
  ok(items, 'OK', { pagination: { page: 1, limit: 5, total: items.length, totalPages: 1 } });

describe('LiveCollectionsCard', () => {
  it('lists live collections with meters and asks only for PUBLISHED ones', async () => {
    signInAs(COL_VIEW_PERMS, COL_FEATURES);
    const api = mockApi({ 'GET /collections': list([colRaw()]) });
    render(<LiveCollectionsCard />);
    const row = await screen.findByTestId('live-collection');
    expect(row).toHaveTextContent('Ganesh Utsav 2026');
    expect(row).toHaveTextContent('₹18,250 of ₹73,000 · 25%');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(String(api.fn.mock.calls[0][0])).toContain('status=PUBLISHED');
    expect(screen.getByRole('link', { name: 'All collections' })).toHaveAttribute(
      'href',
      '/admin/collections',
    );
  });
  it('says so when nothing is live', async () => {
    signInAs(COL_VIEW_PERMS, COL_FEATURES);
    mockApi({ 'GET /collections': list([]) });
    render(<LiveCollectionsCard />);
    expect(await screen.findByText(/No live collections/)).toBeInTheDocument();
  });
  it('shows a quiet error', async () => {
    signInAs(COL_VIEW_PERMS, COL_FEATURES);
    mockApi({ 'GET /collections': err(500, 'INTERNAL_ERROR') });
    render(<LiveCollectionsCard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  });
  it('renders nothing without the view permission', () => {
    signInAs([], COL_FEATURES);
    const { container } = render(<LiveCollectionsCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
