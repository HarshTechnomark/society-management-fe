import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { PAY_FEATURES, PAY_PERMS, PAY_VIEW_PERMS, chequeRaw, pagination } from '@/test/paymentsFixtures';
import { signIn } from '@/test/setupHelpers';
import { ChequesScreen } from './ChequesScreen';

vi.mock('next/navigation', () => navigationMock());

const second = chequeRaw({
  id: 7791,
  unitLabel: 'C-301',
  payerName: 'Kiran Shah',
  amountPaise: 300000,
  receiptNo: 'RCT/2026-27/000048',
});

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms = PAY_PERMS, features = PAY_FEATURES) {
  signIn(perms, features);
  const api = mockApi({
    'GET /payments': ok([chequeRaw(), second], 'OK', pagination()),
    'GET /accounts/bank-accounts': ok([{ id: 3, displayName: 'HDFC Current', maskedNumber: 'XXXX4821' }]),
    'POST /payments/cheques/deposit': ok({ deposited: 2, payments: [] }),
    ...routes,
  });
  render(
    <ToastProvider>
      <ChequesScreen />
    </ToastProvider>,
  );
  return api;
}
beforeEach(resetAll);

describe('Cheques', () => {
  it('lists received cheques and asks the API for cheques of that state', async () => {
    const api = renderIt();
    expect(await screen.findAllByTestId('cheque-row')).toHaveLength(2);
    const url = String(api.fn.mock.calls.find(c => String(c[0]).includes('/payments?'))![0]);
    expect(url).toContain('method=CHEQUE');
    expect(url).toContain('status=RECEIVED');
    expect(screen.getByText('C-301')).toBeInTheDocument();
  });

  it('keeps the deposit button off until a cheque is selected', async () => {
    renderIt();
    await screen.findAllByTestId('cheque-row');
    expect(screen.getByRole('button', { name: 'Deposit selected cheques' })).toBeDisabled();
  });

  it('sends paymentIds, depositedOn and bankAccountId', async () => {
    const api = renderIt();
    await screen.findAllByTestId('cheque-row');
    await userEvent.click(screen.getByLabelText('Select all cheques'));
    expect(screen.getByRole('button', { name: 'Deposit 2 cheques (₹9,809)' })).toBeEnabled();
    await waitFor(() =>
      expect(screen.getByLabelText('Bank account').querySelectorAll('option').length).toBe(2),
    );
    await userEvent.selectOptions(screen.getByLabelText('Bank account'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Deposit 2 cheques (₹9,809)' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/payments/cheques/deposit')).toBe(true));
    const body = api.last('POST', '/payments/cheques/deposit')!.body as Record<string, unknown>;
    expect(body.paymentIds).toEqual([7790, 7791]);
    expect(body.bankAccountId).toBe(3);
    expect(body.depositedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText('2 cheques marked as deposited')).toBeInTheDocument();
  });

  it('asks for a bank account before depositing', async () => {
    const api = renderIt();
    await screen.findAllByTestId('cheque-row');
    await userEvent.click(screen.getByLabelText('Select cheque of B-402'));
    await userEvent.click(screen.getByRole('button', { name: /^Deposit 1 cheque/ }));
    expect(await screen.findByText('Choose the bank account.')).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('shows the error of a failed deposit', async () => {
    renderIt({ 'POST /payments/cheques/deposit': err(422, 'CHEQUE_DATE_INVALID') });
    await screen.findAllByTestId('cheque-row');
    await userEvent.click(screen.getByLabelText('Select cheque of B-402'));
    await waitFor(() =>
      expect(screen.getByLabelText('Bank account').querySelectorAll('option').length).toBe(2),
    );
    await userEvent.selectOptions(screen.getByLabelText('Bank account'), '3');
    await userEvent.click(screen.getByRole('button', { name: /^Deposit 1 cheque/ }));
    expect(await screen.findByText(/deposit date is before the cheque date/)).toBeInTheDocument();
  });

  it('shows the other states without the deposit form', async () => {
    const api = renderIt();
    await screen.findAllByTestId('cheque-row');
    await userEvent.click(screen.getByRole('button', { name: 'Deposited' }));
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('status=DEPOSITED'))).toBe(true),
    );
    expect(screen.queryByTestId('deposit-form')).toBeNull();
    expect(screen.queryByLabelText('Select all cheques')).toBeNull();
  });

  it('hides the deposit form without the edit permission', async () => {
    renderIt({}, PAY_VIEW_PERMS);
    await screen.findAllByTestId('cheque-row');
    expect(screen.queryByTestId('deposit-form')).toBeNull();
  });

  it('shows an empty state', async () => {
    renderIt({ 'GET /payments': ok([], 'OK', pagination({ total: 0 })) });
    expect(await screen.findByText('No cheques here')).toBeInTheDocument();
  });

  it('is locked when the plan has no cheque lifecycle', async () => {
    renderIt(
      {},
      PAY_PERMS,
      PAY_FEATURES.filter(f => f !== 'payments.cheque_lifecycle'),
    );
    expect(await screen.findByText(/Not (in|available in) your plan/)).toBeInTheDocument();
  });

  it('opens a cheque in the payment drawer', async () => {
    renderIt({ 'GET /payments/7790': ok({ ...chequeRaw(), allocations: [], cheque: null, timeline: [] }) });
    await screen.findAllByTestId('cheque-row');
    await userEvent.click(screen.getByRole('button', { name: 'Open RCT/2026-27/000047' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Received from')).toBeInTheDocument();
  });
});
