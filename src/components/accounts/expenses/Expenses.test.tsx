import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { resetAccountsExpensesSession } from '@/services/accountsExpenses.service';
import { detailRaw, EXP_FEATURES, EXP_PERMS, expenseRaw, ledgerTree } from '@/test/expensesFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signIn } from '@/test/setupHelpers';
import { CashBookScreen, cashBookCsv } from '../cashbook/CashBookScreen';
import { APPROVAL_POLICY_TEXT } from './ExpenseModal';
import { ExpensesScreen } from './ExpensesScreen';

vi.mock('next/navigation', () => navigationMock());
vi.setConfig({ testTimeout: 30000 });

const pg = { pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } };
function renderIt(ui: React.ReactElement, routes: Parameters<typeof mockApi>[0] = {}, perms = EXP_PERMS) {
  signIn(perms, EXP_FEATURES);
  const api = mockApi({
    'GET /expenses': ok(
      [expenseRaw(), expenseRaw({ id: 413, displayId: 'EXP-413', status: 'DRAFT', payee: 'Drafty' })],
      'OK',
      pg,
    ),
    'GET /accounts/ledger-accounts': ok(ledgerTree),
    'GET /accounts/funds': ok([{ id: 2, name: 'Repair fund', balancePaise: 4500000 }]),
    'GET /accounts/bank-accounts': ok([
      { id: 3, displayName: 'HDFC Current', maskedNumber: 'XXXX4821', ledgerAccountId: 13 },
    ]),
    ...routes,
  });
  render(<ToastProvider>{ui}</ToastProvider>);
  return api;
}
beforeEach(() => {
  resetAll();
  resetAccountsExpensesSession();
});

describe('Expenses list', () => {
  it('lists rows with status chips and filters by status', async () => {
    const api = renderIt(<ExpensesScreen />);
    expect(await screen.findAllByTestId('expense-row')).toHaveLength(2);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Drafts' }));
    await waitFor(() => expect(api.calls.filter(c => c.path === '/expenses').length).toBeGreaterThan(1));
  });
  it('hides Add expense and Export without permission', async () => {
    renderIt(<ExpensesScreen />, {}, ['settings.society.view', 'finance.expenses.view']);
    await screen.findAllByTestId('expense-row');
    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });
  it('downloads the CSV', async () => {
    const api = renderIt(<ExpensesScreen />, { 'GET /expenses/export': ok({}) });
    await screen.findAllByTestId('expense-row');
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/expenses/export')).toBe(true));
  });
});

describe('Add expense', () => {
  it('says approval depends on the society rules, with no amounts', async () => {
    renderIt(<ExpensesScreen />, {
      'GET /expenses': ok([expenseRaw({ approvalRequired: true, approvalThresholdPaise: 500000 })], 'OK', pg),
    });
    await screen.findAllByTestId('expense-row');
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(APPROVAL_POLICY_TEXT);
    expect(dialog).not.toHaveTextContent('approved automatically');
  });
  it('checks fields on the client and sends submit true with the paid-from ledger', async () => {
    const api = renderIt(<ExpensesScreen />, {
      'POST /expenses': ok({ id: 9, status: 'PENDING_APPROVAL', version: 2 }),
    });
    await screen.findAllByTestId('expense-row');
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save expense' }));
    expect(within(dialog).getByText('Enter an amount of at least ₹1.')).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);

    await userEvent.type(within(dialog).getByLabelText(/Amount/), '1800');
    await userEvent.type(within(dialog).getByLabelText(/Payee/), 'Ganesh Gardeners');
    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: 'Garden and landscaping' })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(within(dialog).getByLabelText(/Category/), '81');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Paid from/), '12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(api.calls.some(c => c.method === 'POST')).toBe(true));
    const body = api.calls.find(c => c.method === 'POST')!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      grossAmountPaise: 180000,
      ledgerAccountId: 81,
      paidFromLedgerAccountId: 12,
      paymentMode: 'CASH',
      submit: true,
    });
  });
  it('shows BILL_REQUIRED under the bill field and sends submit false for a draft', async () => {
    const api = renderIt(<ExpensesScreen />, {
      'POST /expenses': [err(422, 'BILL_REQUIRED'), ok({ id: 9, status: 'DRAFT', version: 1 })],
    });
    await screen.findAllByTestId('expense-row');
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Amount/), '9000');
    await userEvent.type(within(dialog).getByLabelText(/Payee/), 'Lift Co');
    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: 'Garden and landscaping' })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(within(dialog).getByLabelText(/Category/), '81');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Paid from/), '13');
    await userEvent.type(within(dialog).getByLabelText(/Reference/), 'UTR123456');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save expense' }));
    expect(await within(dialog).findByText(/Add a photo of the bill/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(api.calls.filter(c => c.method === 'POST')).toHaveLength(2));
    expect((api.calls.filter(c => c.method === 'POST')[1]!.body as { submit: boolean }).submit).toBe(false);
  });
  it('asks for the whole chart on the starter plan so cash and bank sources are listed', async () => {
    const api = renderIt(<ExpensesScreen />);
    await screen.findAllByTestId('expense-row');
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    await screen.findByRole('dialog');
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('/accounts/ledger-accounts'))).toBe(true),
    );
    const urls = api.fn.mock.calls.map(c => String(c[0])).filter(u => u.includes('ledger-accounts'));
    expect(urls.every(u => !u.includes('cashBookOnly'))).toBe(true);
  });
  it('falls back to typed ids when the lists are not built yet', async () => {
    renderIt(<ExpensesScreen />, {
      'GET /accounts/ledger-accounts': err(404, 'NOT_FOUND'),
      'GET /accounts/funds': err(404, 'NOT_FOUND'),
    });
    await screen.findAllByTestId('expense-row');
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByLabelText(/Paid from \(ledger/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Fund number/)).toBeInTheDocument();
  });
});

describe('Add expense without account permissions', () => {
  it('does not ask for the funds list without finance.accounts.view', async () => {
    const api = renderIt(
      <ExpensesScreen />,
      {},
      EXP_PERMS.filter(p => p !== 'finance.accounts.view'),
    );
    await screen.findAllByTestId('expense-row');
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    await screen.findByRole('dialog');
    expect(api.calls.some(c => c.path === '/accounts/funds')).toBe(false);
  });
});

describe('Expense drawer', () => {
  const open = async (status: string, extra: Record<string, unknown> = {}) => {
    const api = renderIt(<ExpensesScreen />, {
      'GET /expenses/412': ok(detailRaw({ status, ...extra })),
      'POST /expenses/412/reverse': ok({
        id: 412,
        status: 'REVERSED',
        version: 3,
        reversalVoucherNo: 'VCH/2',
      }),
      'POST /expenses/412/submit': ok({ id: 412, status: 'PENDING_APPROVAL', version: 3 }),
    });
    await userEvent.click((await screen.findAllByLabelText('Open EXP-412'))[0]!);
    await screen.findByText('Expense EXP-412');
    return api;
  };
  it('shows the fund name from the funds list, a journal link, and no invented rejection', async () => {
    await open('POSTED', {
      fundId: 2,
      fundName: null,
      approvedBy: { name: 'Meera' },
      approval: { requestId: 9, status: null, actions: [] },
      journal: {
        id: 61,
        voucherNo: 'VCH/1',
        lines: [{ account: 'Garden', debitPaise: 180000, creditPaise: 0 }],
      },
    });
    expect(await screen.findByText('Repair fund')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the journal entry/ })).toHaveAttribute(
      'href',
      '/admin/accounts/journals?open=61',
    );
    expect(screen.getByTestId('approval-state')).toHaveTextContent('Approved by Meera');
    expect(screen.getByTestId('approval-state')).not.toHaveTextContent(/rejected/i);
  });
  it('shows bill, timeline and Reverse for a posted expense and sends the reason', async () => {
    const api = await open('POSTED');
    expect(await screen.findByText('bill.jpg', { selector: 'a' })).toHaveAttribute(
      'href',
      'https://f.test/bill.jpg',
    );
    expect(screen.getByTestId('timeline')).toHaveTextContent('Approved by Meera');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    await userEvent.type(await screen.findByLabelText(/Reason/), 'Paid twice by mistake');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse expense' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/expenses/412/reverse')).toBe(true));
    expect(api.calls.find(c => c.path === '/expenses/412/reverse')!.body).toMatchObject({
      reason: 'Paid twice by mistake',
      version: 2,
    });
  });
  it('offers Submit, Edit and Cancel draft for a draft', async () => {
    const api = await open('DRAFT');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel draft' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reverse' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/expenses/412/submit')).toBe(true));
  });
  it('links to the approval and offers Withdraw when pending', async () => {
    await open('PENDING_APPROVAL', { approvalRequestId: 77 });
    expect(screen.getByRole('link', { name: 'Open the approval' })).toHaveAttribute(
      'href',
      '/admin/approvals/77',
    );
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
  });
});

describe('Cash book', () => {
  const book = {
    openingPaise: 1000000,
    closingPaise: 820000,
    rows: [
      {
        date: '2026-10-30',
        voucherNo: 'V1',
        voucherType: 'PAYMENT',
        narration: 'Gardener',
        account: 'Cash in hand',
        inPaise: 0,
        outPaise: 180000,
        runningPaise: 820000,
        refType: 'expense',
        refId: 412,
      },
    ],
  };
  it('shows opening, closing and entries, and asks for the chosen account', async () => {
    const api = renderIt(<CashBookScreen />, {
      'GET /accounts/cash-book': ok(book, 'OK', {
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      }),
    });
    expect(await screen.findAllByTestId('cash-row')).toHaveLength(1);
    expect(screen.getByTestId('balances')).toHaveTextContent('₹10,000');
    expect(screen.getByTestId('balances')).toHaveTextContent('₹8,200');
    await waitFor(() => expect(screen.getByRole('option', { name: /HDFC Current/ })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Account'), 'BANK:3');
    await waitFor(() =>
      expect(api.calls.filter(c => c.path === '/accounts/cash-book').length).toBeGreaterThan(1),
    );
  });
  it('does not ask for the bank accounts without finance.bank.view', async () => {
    const api = renderIt(
      <CashBookScreen />,
      {
        'GET /accounts/cash-book': ok(book, 'OK', {
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        }),
      },
      EXP_PERMS.filter(p => p !== 'finance.bank.view'),
    );
    expect(await screen.findAllByTestId('cash-row')).toHaveLength(1);
    expect(api.calls.some(c => c.path === '/accounts/bank-accounts')).toBe(false);
    expect(screen.queryByRole('option', { name: /HDFC Current/ })).toBeNull();
  });
  it('says a range over 366 days is too long, apart from start-after-end', async () => {
    renderIt(<CashBookScreen />, {});
    fireEvent.change(await screen.findByLabelText('From'), { target: { value: '2020-01-01' } });
    expect(await screen.findByText('A range can be 366 days at most.')).toBeInTheDocument();
    expect(screen.queryByText(/must be on or before/)).toBeNull();
  });
  it('builds CSV in rupees', () => {
    const csv = cashBookCsv([{ ...book.rows[0]!, refType: null, refId: null }]);
    expect(csv.split('\n')[1]).toContain('1800');
  });
});
