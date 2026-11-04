import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { visibleResidentNav } from '@/components/residents/app/ResidentNav';
import { ToastProvider } from '@/components/ui/Toast';
import { getMe } from '@/lib/auth';
import {
  RESIDENT_DUES_FEATURES,
  RESIDENT_DUES_PERMS,
  invoiceDetailRaw,
  invoiceItemRaw,
  myDuesRaw,
} from '@/test/billingDuesFixtures';
import { statement } from '@/test/ledgerFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { ResidentBillDetail } from './ResidentBillDetail';
import { ResidentBillsScreen } from './ResidentBillsScreen';
import { ResidentStatement } from './ResidentStatement';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const pg = (n: number, totalPages = 1) => ({ pagination: { page: 1, limit: 20, total: n, totalPages } });
function show(
  ui: ReactElement,
  routes: Routes,
  perms = RESIDENT_DUES_PERMS,
  features = RESIDENT_DUES_FEATURES,
) {
  signInAs(perms, features);
  const api = mockApi(routes);
  render(<ToastProvider>{ui}</ToastProvider>);
  return api;
}
const BILLS = [
  invoiceItemRaw(),
  invoiceItemRaw({
    id: 5001,
    invoiceNo: 'INV/2026-27/000150',
    periodLabel: 'Oct 2026',
    dueDate: '2026-10-10',
    status: 'ISSUED',
    isOverdue: true,
    paidPaise: 0,
    outstandingPaise: 1006100,
  }),
  invoiceItemRaw({
    id: 4900,
    invoiceNo: 'INV/2026-27/000100',
    periodLabel: 'Sep 2026',
    status: 'PAID',
    paidPaise: 1006100,
    outstandingPaise: 0,
  }),
];
const listRoutes = (items: unknown[] = BILLS): Routes => ({
  'GET /me/dues': ok(myDuesRaw()),
  'GET /me/invoices': ok(items, 'OK', pg(items.length)),
});

beforeEach(resetAll);

describe('Resident nav', () => {
  it('shows Bills with resident.dues.view only', () => {
    signInAs(RESIDENT_DUES_PERMS, []);
    expect(visibleResidentNav(getMe()).map(i => i.label)).toContain('Bills');
    signInAs(['resident.home.view'], []);
    expect(visibleResidentNav(getMe()).map(i => i.label)).not.toContain('Bills');
  });
});

describe('My bills', () => {
  it('shows a skeleton, the dues per flat and the bills with status in words', async () => {
    show(<ResidentBillsScreen />, listRoutes());
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    const cards = await screen.findAllByTestId('dues-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('C-0801');
    expect(cards[0]).toHaveTextContent('₹5,061 due by 10 Nov 2026');
    expect(cards[0]).toHaveTextContent('1 open bill');
    expect(cards[1]).toHaveTextContent('Paid up');
    const rows = await screen.findAllByTestId('bill-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Nov 2026');
    expect(rows[0]).toHaveTextContent('Part paid');
    expect(rows[1]).toHaveTextContent('Overdue');
    expect(rows[2]).toHaveTextContent('Paid');
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/resident/bills/5123');
  });

  it('shows the overdue amount in words on the flat card', async () => {
    const dues = myDuesRaw();
    dues.units[0].overduePaise = 100000;
    show(<ResidentBillsScreen />, { ...listRoutes(), 'GET /me/dues': ok(dues) });
    expect(await screen.findByText('Overdue ₹1,000')).toBeInTheDocument();
  });

  it('shows Pay as disabled until online payment ships, and the statement for owners only', async () => {
    show(<ResidentBillsScreen />, listRoutes());
    const pay = await screen.findByRole('button', { name: 'Pay dues of C-0801' });
    expect(pay).toBeDisabled();
    expect(pay).toHaveAccessibleDescription('Online payment comes with the payments update.');
    expect(screen.queryByRole('link', { name: /^Pay/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Statement of C-0801' })).toHaveAttribute(
      'href',
      '/resident/bills/statement/312',
    );
    expect(screen.queryByRole('link', { name: 'Statement of C-0802' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay dues of C-0802' })).toBeNull();
  });

  it('hides the statement link without the plan feature', async () => {
    show(<ResidentBillsScreen />, listRoutes(), RESIDENT_DUES_PERMS, []);
    await screen.findAllByTestId('dues-card');
    expect(screen.queryByRole('link', { name: 'Statement of C-0801' })).toBeNull();
  });

  it('filters by flat and by status through the API', async () => {
    const api = show(<ResidentBillsScreen />, listRoutes());
    await screen.findAllByTestId('bill-row');
    await userEvent.selectOptions(screen.getByLabelText('Flat'), '312');
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('unitId=312'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'To pay' }));
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('status=OPEN'))).toBe(true));
  });

  it('shows "No bills yet" when there are none', async () => {
    show(<ResidentBillsScreen />, listRoutes([]));
    expect(await screen.findByText('No bills yet')).toBeInTheDocument();
  });

  it('shows an error with a reference and retries', async () => {
    show(<ResidentBillsScreen />, {
      ...listRoutes(),
      'GET /me/invoices': [err(500, 'INTERNAL_ERROR'), ok(BILLS, 'OK', pg(3))],
    });
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByTestId('bill-row')).toHaveLength(3);
  });

  it('pages through the bills', async () => {
    const api = show(<ResidentBillsScreen />, {
      ...listRoutes(),
      'GET /me/invoices': ok(BILLS, 'OK', pg(40, 2)),
    });
    await screen.findAllByTestId('bill-row');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('page=2'))).toBe(true));
  });

  it('shows no access without resident.dues.view', async () => {
    show(<ResidentBillsScreen />, listRoutes(), ['resident.home.view'], []);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('Bill detail', () => {
  const detail = (over: Record<string, unknown> = {}, routes: Routes = {}) => ({
    'GET /me/invoices/5123': ok(invoiceDetailRaw(over)),
    ...routes,
  });

  it('shows lines, GST, round off, previous dues and totals', async () => {
    show(<ResidentBillDetail id={5123} />, detail());
    expect(await screen.findByRole('heading', { name: 'Nov 2026' })).toBeInTheDocument();
    expect(screen.getByText('Part paid')).toBeInTheDocument();
    expect(screen.getAllByTestId('bill-line')).toHaveLength(3);
    expect(screen.getByText('CGST')).toBeInTheDocument();
    expect(screen.getByText('SGST')).toBeInTheDocument();
    expect(screen.getByText('Round off')).toBeInTheDocument();
    expect(screen.getByText('Total of this bill').nextSibling).toHaveTextContent('₹10,061');
    expect(screen.getByText('Still to pay on this bill').nextSibling).toHaveTextContent('₹5,061');
    expect(screen.getByText(/Earlier dues of this flat/).nextSibling).toHaveTextContent('₹2,500');
    expect(screen.getByText(/27AAAAS1234A1Z5/)).toBeInTheDocument();
  });

  it('leaves out GST and previous dues when there are none', async () => {
    show(
      <ResidentBillDetail id={5123} />,
      detail({ gstApplied: false, previousDuesPaise: 0, roundOffPaise: 0 }),
    );
    await screen.findByRole('heading', { name: 'Nov 2026' });
    expect(screen.queryByText('SGST')).toBeNull();
    expect(screen.queryByText(/Earlier dues/)).toBeNull();
  });

  it('explains a line in plain words: text, friendly inputs and rule version, no internals', async () => {
    show(<ResidentBillDetail id={5123} />, detail());
    await userEvent.click(await screen.findByRole('button', { name: /how Maintenance/ }));
    expect(screen.getByText('2,150 sq ft × ₹3.20 = ₹6,880.00')).toBeInTheDocument();
    const panel = document.getElementById('explain-90121')!;
    const pairs = [...panel.querySelectorAll('dt')].map(
      dt => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`,
    );
    expect(pairs).toEqual([
      'Area: 2,150 sq ft',
      'Area type: Carpet area',
      'Rate: ₹3.20 per sq ft',
      'Months: 1',
    ]);
    expect(panel).not.toHaveTextContent(/formula|roundHalfUp|milli|paise/i);
    expect(screen.getByText('Rate rule version 3, in force from 1 Apr 2026')).toBeInTheDocument();
  });

  it('Explain this bill opens every explainable line and toggles back', async () => {
    show(<ResidentBillDetail id={5123} />, detail());
    await userEvent.click(await screen.findByRole('button', { name: 'Explain this bill' }));
    expect(screen.getByText('Rate rule version 3, in force from 1 Apr 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide explanation' }));
    expect(screen.queryByText('Rate rule version 3, in force from 1 Apr 2026')).toBeNull();
  });

  it('hides the explanation when the plan lacks explain-my-bill', async () => {
    show(<ResidentBillDetail id={5123} />, detail(), RESIDENT_DUES_PERMS, []);
    await screen.findByRole('heading', { name: 'Nov 2026' });
    expect(screen.queryByRole('button', { name: 'Explain this bill' })).toBeNull();
    expect(screen.queryByRole('button', { name: /how Maintenance/ })).toBeNull();
  });

  it('hides the explanation when the API omits the computation', async () => {
    show(
      <ResidentBillDetail id={5123} />,
      detail({
        lines: [{ id: 1, lineNo: 1, lineKind: 'CHARGE', description: 'Maintenance', amountPaise: 5000 }],
      }),
    );
    await screen.findByRole('heading', { name: 'Nov 2026' });
    expect(screen.queryByRole('button', { name: 'Explain this bill' })).toBeNull();
  });

  it('shows Pay as disabled with a note for an open bill until online payment ships', async () => {
    show(<ResidentBillDetail id={5123} />, detail());
    const pay = await screen.findByRole('button', { name: 'Pay ₹5,061' });
    expect(pay).toBeDisabled();
    expect(screen.getByText('Online payment comes with the payments update.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Pay/ })).toBeNull();
  });

  it('shows no Pay link on a paid bill', async () => {
    show(
      <ResidentBillDetail id={5123} />,
      detail({ status: 'PAID', paidPaise: 1006100, outstandingPaise: 0 }),
    );
    await screen.findByRole('heading', { name: 'Nov 2026' });
    expect(screen.queryByRole('button', { name: /^Pay/ })).toBeNull();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
  });

  it('opens the PDF link in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const api = show(
      <ResidentBillDetail id={5123} />,
      detail(
        {},
        {
          'GET /me/invoices/5123/pdf-url': ok({
            url: 'https://files/x.pdf',
            expiresAt: '2026-11-04T10:05:00Z',
          }),
        },
      ),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files/x.pdf', '_blank', 'noopener'));
    expect(api.calls.some(c => c.path === '/me/invoices/5123/pdf-url')).toBe(true);
    open.mockRestore();
  });

  it('says so when the PDF is not ready', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    show(
      <ResidentBillDetail id={5123} />,
      detail({}, { 'GET /me/invoices/5123/pdf-url': err(409, 'PDF_NOT_READY') }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF' }));
    expect(
      await screen.findAllByText('The PDF of this bill is not ready yet. Try again in a few minutes.'),
    ).not.toHaveLength(0);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('disables the PDF button while it is pending', async () => {
    show(<ResidentBillDetail id={5123} />, detail({ pdfStatus: 'PENDING' }));
    expect(await screen.findByRole('button', { name: 'Download PDF' })).toBeDisabled();
    expect(screen.getByText(/being prepared/)).toBeInTheDocument();
  });

  it('shows a not-found message for a bill that is not visible', async () => {
    show(<ResidentBillDetail id={5123} />, { 'GET /me/invoices/5123': err(404, 'INVOICE_NOT_FOUND') });
    expect(
      await screen.findByText('This bill was not found. It may belong to another flat.'),
    ).toBeInTheDocument();
  });
});

describe('Statement of my flat', () => {
  it('shows opening, entries with running balance and closing', async () => {
    const api = show(<ResidentStatement unitId={101} />, { 'GET /me/units/101/statement': ok(statement()) });
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Opening balance')).toBeInTheDocument();
    expect(screen.getByText('Closing balance')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    expect(String(api.fn.mock.calls[0][0])).toContain('/me/units/101/statement');
  });

  it('reloads for a new range and rejects a range over 1,100 days', async () => {
    const api = show(<ResidentStatement unitId={101} />, { 'GET /me/units/101/statement': ok(statement()) });
    await screen.findByRole('table');
    const from = screen.getByLabelText('From');
    await userEvent.clear(from);
    await userEvent.type(from, '2020-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Show statement' }));
    expect(await screen.findByText('The period can be at most 1,100 days.')).toBeInTheDocument();
    expect(api.calls.filter(c => c.path === '/me/units/101/statement')).toHaveLength(1);
  });

  it('tells a tenant to use the bill list (UNIT_NOT_FOUND)', async () => {
    show(<ResidentStatement unitId={101} />, { 'GET /me/units/101/statement': err(404, 'UNIT_NOT_FOUND') });
    expect(await screen.findByText(/You can only see the statement of a flat you own/)).toBeInTheDocument();
  });

  it('offers Share only when the browser supports it', async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    show(<ResidentStatement unitId={101} />, { 'GET /me/units/101/statement': ok(statement()) });
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalled();
    delete (navigator as unknown as { share?: unknown }).share;
  });

  it('is locked without the plan feature', async () => {
    const api = show(<ResidentStatement unitId={101} />, {}, RESIDENT_DUES_PERMS, []);
    expect(await screen.findByRole('status')).toHaveTextContent(/plan/i);
    expect(api.calls).toHaveLength(0);
  });
});
