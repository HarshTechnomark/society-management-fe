import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import {
  PAY_FEATURES,
  PAY_PERMS,
  PAY_VIEW_PERMS,
  chequeBlock,
  chequeDetailRaw,
  chequeRaw,
  detailRaw,
  liveItemRaw,
  pagination,
  paymentRaw,
  summaryRaw,
} from '@/test/paymentsFixtures';
import { signIn } from '@/test/setupHelpers';
import { PaymentsScreen, buildQuery } from './PaymentsScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
function renderIt(routes: Routes = {}, perms = PAY_PERMS, features = PAY_FEATURES) {
  signIn(perms, features);
  const api = mockApi({
    'GET /payments': ok([paymentRaw(), chequeRaw()], 'OK', pagination()),
    'GET /payments/summary': ok(summaryRaw()),
    'GET /payments/live-feed': ok([liveItemRaw()]),
    'GET /residents/units': ok([], 'OK', pagination()),
    'GET /collections': ok([], 'OK', pagination()),
    ...routes,
  });
  render(
    <ToastProvider>
      <PaymentsScreen />
    </ToastProvider>,
  );
  return api;
}
beforeEach(resetAll);

const listCalls = (api: ReturnType<typeof mockApi>) =>
  api.fn.mock.calls.map(c => String(c[0])).filter(u => /\/payments\?/.test(u) && !u.includes('/export'));

describe('buildQuery', () => {
  it('maps the filters to the list query', () => {
    expect(buildQuery('ALL', 'ANY', ' ', 1)).toEqual({ page: 1, limit: 20 });
    expect(buildQuery('CHEQUES_PENDING', 'ANY', 'A-12', 2)).toMatchObject({
      chequeStatus: 'PENDING',
      q: 'A-12',
      page: 2,
    });
    expect(buildQuery('NEFT', 'PENDING_APPROVAL', '', 1)).toMatchObject({
      method: 'NEFT,IMPS,RTGS',
      status: 'PENDING_APPROVAL',
    });
    expect(buildQuery('UPI', 'REVIEW', '', 1)).toMatchObject({ method: 'UPI', needsReview: true });
    expect(buildQuery('ALL', 'RECEIVED', '', 1).status).toContain('CLEARED');
  });
});

describe('Payments list', () => {
  it('shows a skeleton, then the rows in rupees with method and status', async () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(await screen.findByText('RCT/2026-27/000046')).toBeInTheDocument();
    const row = screen.getByText('RCT/2026-27/000046').closest('tr')!;
    expect(within(row).getByText('A-1203')).toBeInTheDocument();
    expect(within(row).getByText('Rohan Sharma')).toBeInTheDocument();
    expect(within(row).getByText('₹9,109')).toBeInTheDocument();
    expect(within(row).getByText('Maintenance ₹8,009 + Collection ₹1,100')).toBeInTheDocument();
    expect(within(row).getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Cheque received')).toBeInTheDocument();
  });

  it('has the search box, the method segments and the status chips of the prototype', async () => {
    renderIt();
    await screen.findByText('RCT/2026-27/000046');
    expect(screen.getByPlaceholderText('Search receipt, flat, name or reference')).toBeInTheDocument();
    const method = screen.getByRole('group', { name: 'Method' });
    for (const l of ['All', 'UPI', 'Cash', 'Cheque', 'NEFT', 'Netbanking', 'Cheques pending'])
      expect(within(method).getByRole('button', { name: l })).toBeInTheDocument();
    const status = screen.getByRole('group', { name: 'Status' });
    for (const l of ['Pending approval', 'Received', 'Returned', 'Reversed', 'Needs review'])
      expect(within(status).getByRole('button', { name: l })).toBeInTheDocument();
  });

  it('asks the API for each filter', async () => {
    const api = renderIt();
    await screen.findByText('RCT/2026-27/000046');
    await userEvent.click(screen.getByRole('button', { name: 'Cheques pending' }));
    await waitFor(() => expect(listCalls(api).some(u => u.includes('chequeStatus=PENDING'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Needs review' }));
    await waitFor(() => expect(listCalls(api).some(u => u.includes('needsReview=true'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Pending approval' }));
    await waitFor(() => expect(listCalls(api).some(u => u.includes('status=PENDING_APPROVAL'))).toBe(true));
    await userEvent.type(screen.getByPlaceholderText('Search receipt, flat, name or reference'), 'A-12');
    await waitFor(() => expect(listCalls(api).some(u => u.includes('q=A-12'))).toBe(true));
  });

  it('says so when nothing matches', async () => {
    renderIt({ 'GET /payments': ok([], 'OK', pagination({ total: 0 })) });
    expect(await screen.findByText('No payments here')).toBeInTheDocument();
  });

  it('shows the error with its reference and retries', async () => {
    renderIt({ 'GET /payments': [err(500, 'INTERNAL_ERROR'), ok([paymentRaw()], 'OK', pagination())] });
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('RCT/2026-27/000046')).toBeInTheDocument();
  });

  it('pages through the list', async () => {
    const api = renderIt({
      'GET /payments': ok([paymentRaw()], 'OK', pagination({ total: 45, totalPages: 3 })),
    });
    await screen.findByText('Page 1 of 3');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listCalls(api).some(u => u.includes('page=2'))).toBe(true));
  });

  it('exports the filtered list as CSV', async () => {
    const api = renderIt({ 'GET /payments/export': ok('x') });
    // jsdom has no blob support in the mocked response, so the download fails softly with a toast
    await screen.findByText('RCT/2026-27/000046');
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/payments/export')).toBe(true));
  });

  it('hides Record payment and Export without the permissions', async () => {
    renderIt({}, PAY_VIEW_PERMS);
    await screen.findByText('RCT/2026-27/000046');
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('shows no access without the view permission', async () => {
    renderIt({}, ['settings.society.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('Today cards and live feed', () => {
  it('shows collected today, this month with efficiency, the method mix and the Live feed', async () => {
    renderIt();
    const tiles = await screen.findAllByTestId('kpi');
    expect(tiles[0]).toHaveTextContent('Collected today');
    expect(tiles[0]).toHaveTextContent('₹21,727');
    expect(tiles[0]).toHaveTextContent('4 payments');
    expect(tiles[1]).toHaveTextContent('This month');
    expect(tiles[1]).toHaveTextContent('85% of billed collected');
    expect(tiles[2]).toHaveTextContent('2');
    expect(tiles[3]).toHaveTextContent('2 cheques');
    const mix = screen.getByTestId('method-mix');
    expect(within(mix).getByRole('meter', { name: 'UPI' })).toHaveAttribute('aria-valuetext', '₹3,02,100');
    expect(await screen.findByText('Live')).toBeInTheDocument();
    expect(await screen.findByTestId('feed-item')).toHaveTextContent(
      'A-1203 paid ₹6,809 (maintenance) by UPI',
    );
  });

  it('omits the efficiency note when the plan has no analytics', async () => {
    renderIt({ 'GET /payments/summary': ok(summaryRaw({ efficiency: null })) });
    const tiles = await screen.findAllByTestId('kpi');
    expect(tiles[1]).toHaveTextContent('61 payments');
  });

  it('is hidden when the plan lacks the instant payment feature', async () => {
    renderIt(
      {},
      PAY_PERMS,
      PAY_FEATURES.filter(f => f !== 'payments.instant_payment_to_society_balance'),
    );
    await screen.findByText('RCT/2026-27/000046');
    expect(screen.queryByTestId('kpi')).toBeNull();
    expect(screen.queryByText('Live payments')).toBeNull();
  });
});

describe('Payment drawer', () => {
  const open = async (detail: unknown, perms = PAY_PERMS, features = PAY_FEATURES) => {
    const api = renderIt(
      {
        'GET /payments/7781': ok(detail),
        'GET /payments/7790': ok(detail),
        'GET /payments/7781/receipt-url': ok({ url: 'https://files.example/r.pdf' }),
      },
      perms,
      features,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Open RCT/2026-27/000046' }));
    await screen.findByText('Received from');
    return api;
  };

  it('shows every field of an online payment and its actions', async () => {
    await open(detailRaw());
    const dlg = screen.getByRole('dialog', { name: 'Receipt RCT/2026-27/000046' });
    expect(within(dlg).getByText('Rohan Sharma (A-1203)')).toBeInTheDocument();
    expect(within(dlg).getByText('Reaching bank')).toBeInTheDocument();
    expect(within(dlg).getByText('Paid at the gate')).toBeInTheDocument();
    expect(within(dlg).getAllByTestId('allocation')).toHaveLength(2);
    for (const l of ['Download receipt', 'Resend receipt', 'Reallocate', 'Reverse', 'Request refund'])
      expect(within(dlg).getByText(l)).toBeInTheDocument();
    expect(within(dlg).queryByText('Mark cleared')).toBeNull();
    expect(within(dlg).queryByText('Return to payer')).toBeNull();
  });

  it('hides edit and reverse actions without the permissions', async () => {
    await open(detailRaw(), PAY_VIEW_PERMS);
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Download receipt')).toBeInTheDocument();
    for (const l of ['Resend receipt', 'Reallocate', 'Reverse', 'Request refund'])
      expect(within(dlg).queryByText(l)).toBeNull();
  });

  it('shows Return to payer for a received cheque and no Reverse', async () => {
    await open(chequeDetailRaw());
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Return to payer')).toBeInTheDocument();
    expect(within(dlg).getByText('Cheques in clearing')).toBeInTheDocument();
    expect(within(dlg).queryByText('Reverse')).toBeNull();
    expect(within(dlg).queryByText('Mark cleared')).toBeNull();
    expect(within(dlg).getByText('HDFC Bank')).toBeInTheDocument();
  });

  it('shows Mark cleared and Bounced with the deposit alert for a deposited cheque', async () => {
    const cheque = {
      status: 'DEPOSITED',
      cheque: { ...chequeBlock, depositedOn: '2026-11-19' },
    };
    await open(chequeDetailRaw(cheque));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Mark cleared')).toBeInTheDocument();
    expect(within(dlg).getByText('Bounced')).toBeInTheDocument();
    expect(within(dlg).getByText(/Deposited on 19 Nov 2026/)).toBeInTheDocument();
  });

  it('shows the Sent for approval notice for a pending payment', async () => {
    await open(detailRaw({ status: 'PENDING_APPROVAL', receiptNo: null, receiptStatus: 'NONE' }));
    expect(screen.getByText(/Sent for approval/)).toBeInTheDocument();
    expect(screen.queryByText('Download receipt')).toBeNull();
    expect(screen.queryByText('Reverse')).toBeNull();
  });

  it('shows the review flag action and clears it with a note', async () => {
    const api = await open(
      detailRaw({ needsReview: true, reviewReason: 'Late capture on a cancelled order' }),
    );
    expect(screen.getAllByText('Late capture on a cancelled order').length).toBeGreaterThan(0);
    api.fn.mockClear();
    const dlg = screen.getByRole('dialog', { name: /Receipt/ });
    await userEvent.click(within(dlg).getByText('Mark reviewed'));
    await userEvent.type(screen.getByLabelText('Note'), 'Checked with the bank');
    await userEvent.click(screen.getAllByRole('button', { name: 'Mark reviewed' }).pop()!);
    await waitFor(() =>
      expect(api.last('POST', '/payments/7781/review-done')?.body).toEqual({
        note: 'Checked with the bank',
        version: 2,
      }),
    );
  });

  it('downloads the receipt through the receipt url', async () => {
    const api = await open(detailRaw());
    api.fn.mockClear();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await userEvent.click(screen.getByText('Download receipt'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(api.calls.some(c => c.path === '/payments/7781/receipt-url')).toBe(true);
  });
});
