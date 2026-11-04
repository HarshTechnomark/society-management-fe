import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import {
  DUES_FEATURES,
  DUES_PERMS,
  DUES_VIEW_PERMS,
  defaulterItems,
  defaultersPagination,
  defaultersRaw,
  invoiceItemRaw,
  summaryRaw,
} from '@/test/billingDuesFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { statement } from '@/test/ledgerFixtures';
import { signIn } from '@/test/setupHelpers';
import { DuesScreen } from './DuesScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
function renderIt(routes: Routes = {}, perms = DUES_PERMS, features = DUES_FEATURES) {
  signIn(perms, features);
  const api = mockApi({
    'GET /billing/summary': ok(summaryRaw()),
    'GET /billing/defaulters': ok(defaultersRaw(), 'OK', defaultersPagination()),
    ...routes,
  });
  render(
    <ToastProvider>
      <DuesScreen />
    </ToastProvider>,
  );
  return api;
}
beforeEach(resetAll);

describe('Dues dashboard', () => {
  it('shows a skeleton, then the four tiles and the ageing in rupees', async () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    const tiles = await screen.findAllByTestId('kpi');
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveTextContent('Billed this month');
    expect(tiles[0]).toHaveTextContent('₹3,33,631');
    expect(tiles[1]).toHaveTextContent('75.0% efficiency');
    expect(tiles[2]).toHaveTextContent('₹94,000');
    expect(tiles[3]).toHaveTextContent('12');
    const rows = screen.getAllByTestId('ageing-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('0 to 30 days');
    expect(rows[0]).toHaveTextContent('₹40,000');
    expect(rows[3]).toHaveTextContent('Over 90 days');
    expect(within(rows[3]).getByRole('meter')).toHaveAttribute('aria-valuetext', '₹10,000');
  });

  it('says so when nothing was billed (efficiency null)', async () => {
    renderIt({ 'GET /billing/summary': ok(summaryRaw({ billedPaise: 0, efficiencyPct: null })) });
    expect(await screen.findByText('No bills this month')).toBeInTheDocument();
  });

  it('asks the API for the chosen month', async () => {
    const api = renderIt();
    await screen.findAllByTestId('kpi');
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-10' } });
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('month=2026-10'))).toBe(true),
    );
  });

  it('shows the error with its reference and retries', async () => {
    const api = renderIt({
      'GET /billing/summary': [err(500, 'INTERNAL_ERROR'), ok(summaryRaw())],
    });
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByTestId('kpi')).toHaveLength(4);
    expect(api.calls.filter(c => c.path === '/billing/summary')).toHaveLength(2);
  });

  it('links to the invoices page and to run billing for a person who can create', async () => {
    renderIt();
    await screen.findAllByTestId('kpi');
    expect(screen.getByRole('link', { name: 'All invoices' })).toHaveAttribute(
      'href',
      '/admin/billing/invoices',
    );
    expect(screen.getByRole('link', { name: 'Run billing' })).toHaveAttribute(
      'href',
      '/admin/billing/runs/new',
    );
  });

  it('hides Remind all and Run billing from a viewer', async () => {
    renderIt({}, DUES_VIEW_PERMS);
    await screen.findAllByTestId('kpi');
    expect(screen.queryByRole('button', { name: 'Remind all overdue' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Run billing' })).toBeNull();
  });

  it('shows no access without finance.billing.view', async () => {
    renderIt({}, ['settings.society.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('Remind all overdue', () => {
  it('asks "Remind N flats?" and sends nothing when cancelled', async () => {
    const api = renderIt();
    await screen.findAllByTestId('kpi');
    await userEvent.click(screen.getByRole('button', { name: 'Remind all overdue' }));
    expect(await screen.findByText('Remind 12 flats?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('posts the bulk reminder and shows the counts', async () => {
    const api = renderIt({ 'POST /billing/reminders': ok({ flats: 11, invoices: 15 }) });
    await screen.findAllByTestId('kpi');
    await userEvent.click(screen.getByRole('button', { name: 'Remind all overdue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send reminders' }));
    expect(
      await screen.findByText(/Reminders are on their way to 11 flats for 15 bills/),
    ).toBeInTheDocument();
    expect(screen.getByText('Reminders queued for 11 flats (15 bills).')).toBeInTheDocument();
    expect(api.last('POST', '/billing/reminders')?.body).toEqual({ scope: 'OVERDUE' });
  });

  it('shows the rate limit in words', async () => {
    renderIt({ 'POST /billing/reminders': err(429, 'RATE_LIMITED') });
    await screen.findAllByTestId('kpi');
    await userEvent.click(screen.getByRole('button', { name: 'Remind all overdue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send reminders' }));
    expect(await screen.findByText('Too many requests. Wait a little and try again.')).toBeInTheDocument();
  });
});

describe('Defaulters tab', () => {
  async function openTab(routes: Routes = {}, perms = DUES_PERMS, features = DUES_FEATURES) {
    const api = renderIt(routes, perms, features);
    await screen.findAllByTestId('kpi');
    await userEvent.click(screen.getByRole('tab', { name: 'Defaulters' }));
    return api;
  }

  it('lists flats with owner, bill-to, amount, oldest due, days and bills', async () => {
    const api = await openTab();
    const rows = await screen.findAllByTestId('defaulter-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('A-1203');
    expect(rows[0]).toHaveTextContent('Anil Deshmukh');
    expect(rows[0]).toHaveTextContent('₹12,500');
    expect(rows[0]).toHaveTextContent('117');
    expect(rows[1]).toHaveTextContent('Meera Shah, Ravi Nair');
    expect(screen.getByText(/2 flats owe ₹18,900 in all/)).toBeInTheDocument();
    const call = api.fn.mock.calls.map(c => String(c[0])).find(u => u.includes('/billing/defaulters'))!;
    expect(call).toContain('minDaysOverdue=90');
    expect(call).toContain('minAmountPaise=500000');
  });

  it('reads data.items and the totals of every page, and pages through the list', async () => {
    const api = await openTab({
      'GET /billing/defaulters': ok(
        defaultersRaw(defaulterItems(), { flats: 57, overduePaise: 98765400 }),
        'OK',
        defaultersPagination({ total: 57, totalPages: 2 }),
      ),
    });
    expect(await screen.findAllByTestId('defaulter-row')).toHaveLength(2);
    expect(screen.getByText(/57 flats owe ₹9,87,654 in all/)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      const u = api.fn.mock.calls.map(c => String(c[0])).filter(x => x.includes('/billing/defaulters'));
      expect(u.at(-1)).toContain('page=2');
      expect(u.at(-1)).toContain('limit=50');
    });
  });

  it('sends the thresholds typed by the user, in paise', async () => {
    const api = await openTab();
    await screen.findAllByTestId('defaulter-row');
    const days = screen.getByLabelText('Overdue for at least (days)');
    await userEvent.clear(days);
    await userEvent.type(days, '30');
    const amount = screen.getByLabelText('Amount at least (₹)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '1,250.50');
    await userEvent.click(screen.getByRole('button', { name: 'Show defaulters' }));
    await waitFor(() => {
      const u = api.fn.mock.calls.map(c => String(c[0])).filter(x => x.includes('/billing/defaulters'));
      expect(u.at(-1)).toContain('minDaysOverdue=30');
      expect(u.at(-1)).toContain('minAmountPaise=125050');
    });
  });

  it('rejects thresholds outside the allowed range', async () => {
    const api = await openTab();
    await screen.findAllByTestId('defaulter-row');
    const days = screen.getByLabelText('Overdue for at least (days)');
    await userEvent.clear(days);
    await userEvent.type(days, '4000');
    await userEvent.click(screen.getByRole('button', { name: 'Show defaulters' }));
    expect(
      await screen.findByText('Days overdue must be a whole number from 1 to 3650.'),
    ).toBeInTheDocument();
    expect(api.calls.filter(c => c.path === '/billing/defaulters')).toHaveLength(1);
  });

  it('shows an empty state', async () => {
    await openTab({
      'GET /billing/defaulters': ok(defaultersRaw([]), 'OK', defaultersPagination({ total: 0 })),
    });
    expect(await screen.findByText('No defaulters')).toBeInTheDocument();
  });

  it('shows the plan lock without billing.defaulter_list', async () => {
    const api = await openTab({}, DUES_PERMS, []);
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
    expect(api.calls.some(c => c.path === '/billing/defaulters')).toBe(false);
  });

  it('shows an error with retry', async () => {
    await openTab({ 'GET /billing/defaulters': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });

  it('reminds the overdue bills of one flat and counts the skipped', async () => {
    const api = await openTab({
      'GET /invoices': ok([invoiceItemRaw({ id: 1 }), invoiceItemRaw({ id: 2 })], 'OK', {
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
      }),
      'POST /invoices/1/remind': ok({ sentAt: '2026-11-04T10:00:00Z' }),
      'POST /invoices/2/remind': err(409, 'REMINDER_TOO_SOON'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Remind A-1203' }));
    expect(
      await screen.findByText(
        /Reminder sent for 1 bill of A-1203, 1 skipped \(reminded in the last 24 hours\)/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Reminder sent')).toBeInTheDocument();
    const list = api.fn.mock.calls.map(c => String(c[0])).find(u => u.includes('/invoices?'))!;
    expect(list).toContain('unitId=101');
    expect(list).toContain('status=OVERDUE');
  });

  it('says why when every bill was reminded recently', async () => {
    await openTab({
      'GET /invoices': ok([invoiceItemRaw({ id: 1 })]),
      'POST /invoices/1/remind': err(409, 'REMINDER_TOO_SOON'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Remind A-1203' }));
    expect(
      await screen.findByText('A reminder for this bill was sent in the last 24 hours. Try again tomorrow.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Reminder sent')).toBeNull();
  });

  it('hides Remind without finance.billing.edit and Export without finance.billing.export', async () => {
    await openTab({}, DUES_VIEW_PERMS);
    await screen.findAllByTestId('defaulter-row');
    expect(screen.queryByRole('button', { name: /^Remind A-/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('links to the invoices page of the flat', async () => {
    await openTab();
    const link = await screen.findByRole('link', { name: 'Overdue invoices of A-1203' });
    expect(link).toHaveAttribute('href', '/admin/billing/invoices?unitId=101&status=OVERDUE');
  });

  it('opens the statement drawer of the flat', async () => {
    const api = await openTab({ 'GET /billing/units/101/statement': ok(statement()) });
    await userEvent.click(await screen.findByRole('button', { name: 'Statement of A-1203' }));
    expect(await screen.findByText('Statement of account, A-1203')).toBeInTheDocument();
    await waitFor(() => expect(api.calls.some(c => c.path === '/billing/units/101/statement')).toBe(true));
  });

  it('downloads the CSV with format=csv', async () => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const api = await openTab();
    await screen.findAllByTestId('defaulter-row');
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
    expect(String(api.fn.mock.calls.at(-1)![0])).toContain('format=csv');
    click.mockRestore();
  });

  it('shows the export error (too large)', async () => {
    const api = await openTab();
    await screen.findAllByTestId('defaulter-row');
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
    expect(await screen.findByText(/The export is too large/)).toBeInTheDocument();
  });
});
