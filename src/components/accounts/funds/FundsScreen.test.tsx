import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signIn } from '@/test/setupHelpers';
import { FundsScreen } from './FundsScreen';

vi.mock('next/navigation', () => navigationMock());

const PERMS = [
  'settings.society.view',
  'finance.accounts.view',
  'finance.accounts.create',
  'finance.accounts.edit',
];
const BASE = ['accounting.collection_and_fund_balances'];
const FUNDS = [
  {
    id: 1,
    name: 'Sinking fund',
    fundType: 'SINKING',
    ledgerCode: '2410',
    balancePaise: 96000000,
    inflowFyPaise: 100,
    outflowFyPaise: 5000000,
    showToResidents: true,
    status: 'ACTIVE',
    version: 2,
  },
  {
    id: 7,
    name: 'Diwali fund',
    fundType: 'COLLECTION',
    ledgerCode: '2440-001',
    balancePaise: 0,
    inflowFyPaise: 0,
    outflowFyPaise: 0,
    showToResidents: true,
    status: 'ACTIVE',
    version: 1,
  },
];

function renderIt(
  routes: Parameters<typeof mockApi>[0] = {},
  features = [...BASE, 'accounting.funds'],
  perms = PERMS,
) {
  signIn(perms, features);
  const api = mockApi({ 'GET /accounts/funds': ok(FUNDS), ...routes });
  render(
    <ToastProvider>
      <FundsScreen />
    </ToastProvider>,
  );
  return api;
}
beforeEach(resetAll);

describe('Funds', () => {
  it('shows balances and totals', async () => {
    renderIt();
    expect(await screen.findAllByTestId('fund-row')).toHaveLength(2);
    expect(screen.getByText('₹9,60,000', { selector: 'td' })).toBeInTheDocument();
    expect(within(screen.getByTestId('fund-cards')).getByText('₹9,60,000')).toBeInTheDocument();
  });

  it('does not offer closing a seeded fund', async () => {
    renderIt();
    await screen.findAllByTestId('fund-row');
    expect(screen.queryByRole('button', { name: 'Close Sinking fund' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close Diwali fund' })).toBeInTheDocument();
  });

  it('creates an event fund', async () => {
    const api = renderIt({ 'POST /accounts/funds': ok(FUNDS[1]) });
    await screen.findAllByTestId('fund-row');
    await userEvent.click(screen.getByRole('button', { name: 'New fund' }));
    await userEvent.type(screen.getByLabelText(/^Name/), 'Holi fund');
    await userEvent.click(screen.getByRole('button', { name: 'Create fund' }));
    await waitFor(() => expect(api.last('POST', '/accounts/funds')).toBeTruthy());
    expect(api.last('POST', '/accounts/funds')!.body).toMatchObject({
      fundType: 'COLLECTION',
      name: 'Holi fund',
      showToResidents: true,
    });
  });

  it('saves a fund edit with an empty purpose as null', async () => {
    const api = renderIt({ 'PATCH /accounts/funds/1': ok(FUNDS[1]) });
    await screen.findAllByTestId('fund-row');
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit/ })[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.last('PATCH', '/accounts/funds/1')).toBeTruthy());
    expect(api.last('PATCH', '/accounts/funds/1')!.body).toMatchObject({ purpose: null });
  });

  it('shows balances in the transfer pickers, and the edit dialog does not say new funds start at zero', async () => {
    renderIt({});
    await screen.findAllByTestId('fund-row');
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit/ })[0]!);
    const edit = await screen.findByRole('dialog');
    expect(within(edit).queryByText(/New funds start at zero/)).toBeNull();
    await userEvent.click(within(edit).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: /Transfer between funds/ }));
    const dlg = await screen.findByRole('dialog');
    expect(
      (await within(dlg).findAllByRole('option', { name: 'Sinking fund (₹9,60,000)' })).length,
    ).toBeGreaterThan(0);
  });

  it('shows money moved to other funds apart from spending when the API sends it', async () => {
    renderIt({
      'GET /accounts/funds': ok([{ ...FUNDS[0], outflowFyPaise: 0, movedOutFyPaise: 4500000 }, FUNDS[1]]),
    });
    await screen.findAllByTestId('fund-row');
    expect(screen.getByTestId('fund-moved')).toHaveTextContent('₹45,000');
  });

  it('locks transfers and editing on a lower plan', async () => {
    renderIt({}, BASE);
    await screen.findAllByTestId('fund-row');
    expect(screen.getByRole('button', { name: /Transfer between funds/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edit Sinking fund' })).toBeNull();
  });

  it('requests a transfer and says it waits for approval', async () => {
    const api = renderIt({
      'POST /accounts/fund-transfers': { status: 202, data: { approvalRequestId: 12, status: 'PENDING' } },
    });
    await screen.findAllByTestId('fund-row');
    await userEvent.click(screen.getByRole('button', { name: /Transfer between funds/ }));
    const dlg = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dlg).getByLabelText(/^From/).querySelectorAll('option').length).toBeGreaterThan(2),
    );
    await userEvent.selectOptions(within(dlg).getByLabelText(/^From/), 'general');
    await userEvent.selectOptions(within(dlg).getByLabelText(/^To/), '7');
    await userEvent.type(within(dlg).getByLabelText(/^Amount/), '2500');
    await userEvent.type(within(dlg).getByLabelText(/^Reason/), 'Festival budget');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request transfer' }));
    expect(await screen.findByText(/Sent for approval/)).toBeInTheDocument();
    expect(api.last('POST', '/accounts/fund-transfers')!.body).toMatchObject({
      fromFundId: null,
      toFundId: 7,
      amountPaise: 250000,
      reason: 'Festival budget',
    });
  });

  it('rejects the same fund on both sides before calling the API', async () => {
    const api = renderIt();
    await screen.findAllByTestId('fund-row');
    await userEvent.click(screen.getByRole('button', { name: /Transfer between funds/ }));
    const dlg = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dlg).getByLabelText(/^From/).querySelectorAll('option').length).toBeGreaterThan(2),
    );
    await userEvent.selectOptions(within(dlg).getByLabelText(/^From/), 'general');
    await userEvent.selectOptions(within(dlg).getByLabelText(/^To/), 'general');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request transfer' }));
    expect(await within(dlg).findByText('Choose two different funds.')).toBeInTheDocument();
    expect(api.last('POST', '/accounts/fund-transfers')).toBeUndefined();
  });

  it('opens the fund statement', async () => {
    renderIt({
      'GET /accounts/funds/1/statement': ok({
        openingPaise: 1000,
        closingPaise: 3000,
        rows: [
          {
            date: '2026-10-02',
            voucherNo: 'JV/2026-27/000004',
            narration: 'Transfer in',
            inPaise: 2000,
            outPaise: 0,
            runningPaise: 3000,
          },
        ],
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open statement of Sinking fund' }));
    expect(await screen.findByText('JV/2026-27/000004')).toBeInTheDocument();
    expect(screen.getAllByTestId('statement-row')).toHaveLength(1);
  });

  it('shows plain words when a fund cannot be closed', async () => {
    renderIt({ 'PATCH /accounts/funds/7': err(422, 'FUND_BALANCE_NOT_ZERO') });
    await screen.findAllByTestId('fund-row');
    await userEvent.click(screen.getByRole('button', { name: 'Close Diwali fund' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close fund' }),
    );
    expect(await screen.findByText(/closed only at zero/)).toBeInTheDocument();
  });
});
