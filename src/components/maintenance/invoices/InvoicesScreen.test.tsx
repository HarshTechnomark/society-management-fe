import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import {
  INV_FEATURES,
  INV_PERMS,
  INV_VIEW_PERMS,
  detailRaw,
  rowRaw,
  unitRaw,
} from '@/test/billingInvoicesFixtures';
import { err, mockApi, navigationMock, ok, resetAll, search } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { InvoicesScreen } from './InvoicesScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const list = (items: unknown[], totalPages = 1) =>
  ok(items, 'OK', { pagination: { page: 1, limit: 20, total: items.length, totalPages } });
const ROWS = [
  rowRaw(),
  rowRaw({
    id: 5124,
    invoiceNo: 'INV/2026-27/000202',
    unitLabel: 'A-0101',
    billToName: 'Meera Shah',
    billToRelation: 'TENANT',
    status: 'ISSUED',
    isOverdue: true,
    paidPaise: 0,
    outstandingPaise: 1006100,
  }),
  rowRaw({
    id: 5125,
    invoiceNo: 'INV/2026-27/000203',
    status: 'CANCELLED',
    outstandingPaise: 0,
    invoiceType: 'ADHOC',
  }),
];

function renderIt(routes: Routes = {}, perms = INV_PERMS, features = INV_FEATURES) {
  signInAs(perms, features);
  const api = mockApi({ 'GET /invoices': list(ROWS), ...routes });
  render(
    <ToastProvider>
      <InvoicesScreen />
    </ToastProvider>,
  );
  return api;
}
const urls = (api: ReturnType<typeof mockApi>) => api.fn.mock.calls.map(c => String(c[0]));
beforeEach(resetAll);

describe('Invoice list', () => {
  it('shows a skeleton, then rows with status in words, overdue mark, amounts and bill-to', async () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    const rows = await screen.findAllByTestId('invoice-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('INV/2026-27/000201');
    expect(rows[0]).toHaveTextContent('C-0801');
    expect(rows[0]).toHaveTextContent('Anil Deshmukh (Owner)');
    expect(rows[0]).toHaveTextContent('₹10,061');
    expect(rows[0]).toHaveTextContent('Part paid');
    expect(rows[1]).toHaveTextContent('Unpaid');
    expect(rows[1]).toHaveTextContent('Overdue');
    expect(rows[1]).toHaveTextContent('Meera Shah (Tenant)');
    expect(rows[2]).toHaveTextContent('Cancelled');
    expect(rows[2]).toHaveTextContent('One-off');
    expect(within(rows[2]).queryByText('Overdue')).toBeNull();
  });

  it('filters by status, period and search through the API and goes back to page 1', async () => {
    const api = renderIt();
    await screen.findAllByTestId('invoice-row');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'OVERDUE');
    await waitFor(() => expect(urls(api).some(u => u.includes('status=OVERDUE'))).toBe(true));
    await userEvent.selectOptions(
      screen.getByLabelText('Period'),
      screen.getAllByRole('option', { name: /20\d\d/ })[0],
    );
    await waitFor(() => expect(urls(api).some(u => u.includes('periodStart=20'))).toBe(true));
    await userEvent.type(screen.getByLabelText('Search'), 'Meera');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(urls(api).some(u => u.includes('q=Meera'))).toBe(true));
  });

  it('sorts by a column and flips the order', async () => {
    const api = renderIt();
    await screen.findAllByTestId('invoice-row');
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'dueDate');
    await waitFor(() => expect(urls(api).some(u => u.includes('sortBy=dueDate'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: /switch/ }));
    await waitFor(() => expect(urls(api).some(u => u.includes('sortOrder=asc'))).toBe(true));
  });

  it('filters by flat after finding it', async () => {
    const api = renderIt({ 'GET /units': ok([unitRaw()]) });
    await screen.findAllByTestId('invoice-row');
    await userEvent.type(screen.getByLabelText('Flat'), 'C-08');
    await userEvent.selectOptions(await screen.findByLabelText('Matching flats'), '312');
    await waitFor(() =>
      expect(urls(api).some(u => u.includes('/invoices?') && u.includes('unitId=312'))).toBe(true),
    );
    expect(screen.getByRole('button', { name: 'Change flat' })).toBeInTheDocument();
  });

  it('starts with the filters of the link and can clear the payer filter', async () => {
    search.current = new URLSearchParams('status=OVERDUE&billToResidentId=77');
    const api = renderIt();
    await screen.findAllByTestId('invoice-row');
    expect(urls(api)[0]).toContain('status=OVERDUE');
    expect(urls(api)[0]).toContain('billToResidentId=77');
    await userEvent.click(screen.getByRole('button', { name: 'Clear the payer filter' }));
    await waitFor(() => expect(urls(api).at(-1)).not.toContain('billToResidentId'));
  });

  it('ignores a status of the link the API does not know', async () => {
    search.current = new URLSearchParams('status=LATE&unitId=abc');
    const api = renderIt();
    await screen.findAllByTestId('invoice-row');
    expect(urls(api)[0]).not.toContain('status=');
    expect(urls(api)[0]).not.toContain('unitId=');
  });

  it('pages through a long list', async () => {
    const api = renderIt({ 'GET /invoices': list(ROWS, 3) });
    await screen.findAllByTestId('invoice-row');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(urls(api).some(u => u.includes('page=2'))).toBe(true));
  });

  it('shows an empty state, and a different one with a filter', async () => {
    renderIt({ 'GET /invoices': list([]) });
    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PAID');
    expect(await screen.findByText('No invoices match')).toBeInTheDocument();
  });

  it('shows an error with the reference and a retry', async () => {
    renderIt({ 'GET /invoices': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says so without the view permission', async () => {
    renderIt({}, []);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });

  it('shows New invoice and Export CSV by permission and plan', async () => {
    renderIt();
    expect(await screen.findByRole('button', { name: 'New invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('hides New invoice and Export CSV for a viewer, and New invoice when the plan lacks it', async () => {
    renderIt({}, INV_VIEW_PERMS);
    await screen.findAllByTestId('invoice-row');
    expect(screen.queryByRole('button', { name: 'New invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('hides New invoice when the plan has no ad-hoc invoices', async () => {
    renderIt({}, INV_PERMS, []);
    await screen.findAllByTestId('invoice-row');
    expect(screen.queryByRole('button', { name: 'New invoice' })).toBeNull();
  });

  it('downloads the CSV with the filters and format=csv', async () => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const api = renderIt();
    await screen.findAllByTestId('invoice-row');
    api.fn.mockImplementationOnce(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers(),
          blob: async () => new Blob(['a']),
        }) as unknown as Response,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const u = urls(api).at(-1)!;
    expect(u).toContain('/invoices/export');
    expect(u).toContain('format=csv');
    expect(u).not.toContain('page=');
    click.mockRestore();
  });

  it('explains an export that is too large', async () => {
    const api = renderIt();
    await screen.findAllByTestId('invoice-row');
    api.fn.mockImplementationOnce(
      async () =>
        ({
          ok: false,
          status: 422,
          headers: new Headers(),
          json: async () => ({ success: false, code: 'EXPORT_TOO_LARGE', message: 'x' }),
        }) as unknown as Response,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/Too many invoices to export/)).toBeInTheDocument();
  });

  it('opens the drawer on a row click', async () => {
    renderIt({ 'GET /invoices/5123': ok(detailRaw()) });
    await userEvent.click((await screen.findAllByTestId('invoice-row'))[0].querySelector('button')!);
    expect(await screen.findByRole('dialog')).toHaveTextContent('INV/2026-27/000201');
  });
});
