import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { DepositsScreen } from './DepositsScreen';
import { MyDepositsScreen } from './MyDepositsScreen';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const dep = (over: Record<string, unknown> = {}) => ({
  id: 7,
  unitLabel: 'A-1203',
  kind: 'RENOVATION',
  title: 'Renovation deposit',
  status: 'HELD',
  amountPaise: 2500000,
  receivedPaise: 2500000,
  deductedPaise: 0,
  refundedPaise: 0,
  refundRequestedPaise: 0,
  adjustments: [],
  version: 4,
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
});
const list = (items: unknown[]) => ({
  data: items,
  extra: { pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } },
});
const VIEW = ['finance.accounts.view'];
const ALL = ['finance.accounts.view', 'finance.accounts.create'];
function renderIt(rows: unknown[], routes: Parameters<typeof mockApi>[0] = {}, perms = ALL) {
  signInAs(perms, []);
  const api = mockApi({
    'GET /accounts/deposits': list(rows),
    'GET /accounts/deposits/summary': ok({ heldPaise: 5000000, refundedPaise: 0, forfeitedPaise: 0 }),
    ...routes,
  });
  render(<DepositsScreen />);
  return api;
}

describe('Deposits list', () => {
  it('shows rows, status words and the three tiles', async () => {
    renderIt([dep(), dep({ id: 8, status: 'REFUND_PENDING' })]);
    const rows = await screen.findAllByTestId('deposit-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('DEP-7');
    expect(rows[1]).toHaveTextContent('Refund waiting for approval');
    await waitFor(() => expect(screen.getAllByTestId('deposit-tile')[0]).toHaveTextContent('₹50,000'));
  });
  it('filters by status segment through the API', async () => {
    const api = renderIt([dep()]);
    await screen.findAllByTestId('deposit-row');
    await userEvent.click(screen.getByRole('button', { name: 'Awaiting payment' }));
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('status=AWAITING_PAYMENT'))).toBe(true),
    );
  });
  it('shows an empty state and hides New deposit from a viewer', async () => {
    renderIt([], {}, VIEW);
    expect(await screen.findByText('No deposits yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New deposit' })).toBeNull();
  });
  it('shows an error with retry', async () => {
    renderIt([], { 'GET /accounts/deposits': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Deposit drawer actions', () => {
  it('links a waiting refund to its approval request', async () => {
    await open(dep({ status: 'REFUND_PENDING', refundRequestedPaise: 2500000, refundApprovalRequestId: 44 }));
    expect(screen.getByRole('link', { name: 'Open the approval' })).toHaveAttribute(
      'href',
      '/admin/approvals/44',
    );
  });
  const open = async (d: object, routes: Parameters<typeof mockApi>[0] = {}) => {
    const api = renderIt([d], routes);
    await userEvent.click(await screen.findByRole('button', { name: /Details of DEP-/ }));
    return { api, drawer: await screen.findByRole('dialog') };
  };
  it('offers deduct, forfeit and refund when held, and shows the timeline', async () => {
    const { drawer } = await open(
      dep({
        adjustments: [
          { kind: 'DEDUCTION', amountPaise: 300000, reason: 'Wall damage', at: '2026-11-02T10:00:00Z' },
        ],
        deductedPaise: 300000,
      }),
    );
    for (const n of ['Request refund', 'Deduct', 'Forfeit'])
      expect(within(drawer).getByRole('button', { name: n })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Mark refund paid' })).toBeNull();
    expect(within(drawer).getAllByTestId('timeline-item').length).toBeGreaterThanOrEqual(3);
    expect(within(drawer).getByText(/Wall damage/)).toBeInTheDocument();
  });
  it('offers only Mark refund paid when approved and only Cancel when awaiting payment', async () => {
    const a = await open(dep({ status: 'REFUND_APPROVED', refundRequestedPaise: 2500000 }));
    expect(within(a.drawer).getByRole('button', { name: 'Mark refund paid' })).toBeInTheDocument();
    expect(within(a.drawer).queryByRole('button', { name: 'Deduct' })).toBeNull();
  });
  it('offers Cancel for an unpaid deposit', async () => {
    const { drawer } = await open(dep({ status: 'AWAITING_PAYMENT', receivedPaise: 0 }));
    expect(within(drawer).getByRole('button', { name: 'Cancel deposit' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Forfeit' })).toBeNull();
  });
  it('deducts with amount, reason and the version, and refuses more than is held', async () => {
    const { api, drawer } = await open(dep(), { 'POST /accounts/deposits/7/deduct': ok(dep()) });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Deduct' }));
    const dlg = screen.getAllByRole('dialog').at(-1)!;
    await userEvent.type(within(dlg).getByLabelText(/Amount/), '30000');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Damage');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Deduct' }));
    expect(await screen.findByText(/At most ₹25,000 is held/)).toBeInTheDocument();
    await userEvent.clear(within(dlg).getByLabelText(/Amount/));
    await userEvent.type(within(dlg).getByLabelText(/Amount/), '3000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Deduct' }));
    await waitFor(() => expect(api.last('POST', '/accounts/deposits/7/deduct')).toBeTruthy());
    expect(api.last('POST', '/accounts/deposits/7/deduct')?.body).toMatchObject({
      amountPaise: 300000,
      reason: 'Damage',
      version: 4,
    });
  });
  it('shows the API reason when the refund request is refused', async () => {
    const { drawer } = await open(dep(), {
      'POST /accounts/deposits/7/refund-request': err(
        409,
        'INVALID_STATE',
        undefined,
        'The unpaid bill of this deposit is already paid, so it cannot be cancelled.',
      ),
    });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Request refund' }));
    const dlg = screen.getAllByRole('dialog').at(-1)!;
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request refund' }));
    expect(await screen.findByText(/already paid, so it cannot be cancelled/)).toBeInTheDocument();
  });
  it('marks the refund paid from a chosen bank account', async () => {
    const { api, drawer } = await open(dep({ status: 'REFUND_APPROVED', refundRequestedPaise: 2500000 }), {
      'GET /accounts/ledger-accounts': ok([{ id: 2, code: '1110-001', name: 'HDFC', subtype: 'BANK' }]),
      'POST /accounts/deposits/7/refund-paid': ok(dep({ status: 'REFUNDED' })),
    });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Mark refund paid' }));
    const dlg = screen.getAllByRole('dialog').at(-1)!;
    await userEvent.type(within(dlg).getByLabelText(/Reference/), 'UTR123456');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(api.last('POST', '/accounts/deposits/7/refund-paid')).toBeTruthy());
    expect(api.last('POST', '/accounts/deposits/7/refund-paid')?.body).toMatchObject({
      paidFromLedgerAccountId: 2,
      refundMode: 'NEFT',
      refundReference: 'UTR123456',
      version: 4,
    });
  });
  it('falls back to a typed ledger account when the list is not available', async () => {
    const { drawer } = await open(dep({ status: 'REFUND_APPROVED' }), {
      'GET /accounts/ledger-accounts': err(404, 'NOT_FOUND'),
    });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Mark refund paid' }));
    expect(await screen.findByLabelText(/ledger account number/)).toBeInTheDocument();
  });
});

describe('New deposit', () => {
  it('validates before calling', async () => {
    const api = renderIt([]);
    await userEvent.click(await screen.findByRole('button', { name: 'New deposit' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add deposit' }));
    expect(await within(dlg).findByText('Choose the flat.')).toBeInTheDocument();
    expect(within(dlg).getByText(/title of 3 to 120/)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });
});

describe('Resident deposits', () => {
  it('lists my deposits in plain words', async () => {
    signInAs(['resident.dues.view'], []);
    mockApi({
      'GET /me/deposits': list([
        dep(),
        dep({ id: 9, status: 'AWAITING_PAYMENT', receivedPaise: 0, dueDate: '2026-12-01' }),
      ]),
    });
    render(<MyDepositsScreen />);
    const rows = await screen.findAllByTestId('my-deposit');
    expect(rows[0]).toHaveTextContent('Held');
    expect(rows[1]).toHaveTextContent('Awaiting payment');
  });
  it('shows an empty state', async () => {
    signInAs(['resident.dues.view'], []);
    mockApi({ 'GET /me/deposits': list([]) });
    render(<MyDepositsScreen />);
    expect(await screen.findByText('No deposits')).toBeInTheDocument();
  });
});
