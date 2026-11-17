import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signIn } from '@/test/setupHelpers';
import { REVEAL_MS } from './BankCard';
import { BankScreen } from './BankScreen';

vi.mock('next/navigation', () => navigationMock());

const PERMS = ['settings.society.view', 'finance.bank.view', 'finance.bank.edit', 'finance.bank.approve'];
const BASE = ['accounting.simple_cash_book'];
const bank = (over: Record<string, unknown> = {}) => ({
  id: 3,
  displayName: 'HDFC Current',
  bankName: 'HDFC Bank',
  branchName: 'Andheri',
  ifsc: 'HDFC0001234',
  accountKind: 'CURRENT',
  accountHolderName: 'Sky Heights CHS',
  maskedNumber: 'XXXXXX4821',
  isCollectionAccount: true,
  verificationStatus: 'UNVERIFIED',
  status: 'ACTIVE',
  version: 3,
  lastReconciledDate: '2026-10-31',
  lastReconciledBalancePaise: 1250000,
  ...over,
});

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, features = BASE, perms = PERMS) {
  signIn(perms, features);
  const api = mockApi({ 'GET /accounts/bank-accounts': ok([bank()]), ...routes });
  render(
    <ToastProvider>
      <BankScreen />
    </ToastProvider>,
  );
  return api;
}
beforeEach(resetAll);
afterEach(() => vi.useRealTimers());

describe('Bank accounts', () => {
  it('shows the masked number and the verification state', async () => {
    renderIt();
    expect(await screen.findByText('XXXXXX4821')).toBeInTheDocument();
    expect(screen.getByText('Not verified')).toBeInTheDocument();
    expect(screen.getByText('Collection account')).toBeInTheDocument();
    expect(screen.getByText(/Last reconciled 31 Oct 2026/)).toBeInTheDocument();
  });

  it('locks a second account on a lower plan', async () => {
    renderIt();
    await screen.findByText('XXXXXX4821');
    expect(screen.getByRole('button', { name: /Add bank account/ })).toBeDisabled();
  });

  it('adds an account with a matching number and sends the key', async () => {
    const api = renderIt({
      'GET /accounts/bank-accounts': ok([]),
      'POST /accounts/bank-accounts': ok(bank()),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add bank account' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/^Name in the books/), 'HDFC Current');
    await userEvent.type(within(dlg).getByLabelText(/^Bank/), 'HDFC Bank');
    await userEvent.type(within(dlg).getByLabelText(/^IFSC/), 'hdfc0001234');
    await userEvent.type(within(dlg).getByLabelText(/^Account holder/), 'Sky Heights CHS');
    await userEvent.type(within(dlg).getByLabelText(/^Account number/), '123456789012');
    await userEvent.type(within(dlg).getByLabelText(/^Confirm account number/), '123456789013');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add account' }));
    expect(await within(dlg).findByText('The two account numbers do not match.')).toBeInTheDocument();
    expect(api.last('POST', '/accounts/bank-accounts')).toBeUndefined();
    await userEvent.clear(within(dlg).getByLabelText(/^Confirm account number/));
    await userEvent.type(within(dlg).getByLabelText(/^Confirm account number/), '123456789012');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add account' }));
    await waitFor(() => expect(api.last('POST', '/accounts/bank-accounts')).toBeTruthy());
    expect(api.last('POST', '/accounts/bank-accounts')!.body).toMatchObject({
      ifsc: 'HDFC0001234',
      accountNumber: '123456789012',
      confirmAccountNumber: '123456789012',
      isCollectionAccount: true,
    });
  });

  it('says the verification was reset only when the server did reset it', async () => {
    const api = renderIt(
      {
        'GET /accounts/bank-accounts': ok([bank({ verificationStatus: 'VERIFIED' })]),
        'PATCH /accounts/bank-accounts/3': ok(bank({ verificationStatus: 'VERIFIED' })),
      },
      BASE,
    );
    await screen.findByText('XXXXXX4821');
    await userEvent.click(screen.getByRole('button', { name: 'Change bank account' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/^New account number/), '123456789012');
    await userEvent.type(within(dlg).getByLabelText(/^Confirm account number/), '123456789012');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Verify and save' }));
    await waitFor(() => expect(api.last('PATCH', '/accounts/bank-accounts/3')).toBeTruthy());
    expect(await screen.findByText('Bank account saved.')).toBeInTheDocument();
    expect(screen.queryByText(/needs to be verified again/)).toBeNull();
  });

  it('verifies and explains the maker-checker refusal', async () => {
    renderIt({ 'POST /accounts/bank-accounts/3/verify': err(409, 'MAKER_CHECKER_VIOLATION') });
    await userEvent.click(await screen.findByRole('button', { name: 'Verify' }));
    expect(await screen.findByText(/another person must verify/)).toBeInTheDocument();
  });

  it('hides verify and close without the approve permission', async () => {
    renderIt({}, BASE, ['settings.society.view', 'finance.bank.view']);
    await screen.findByText('XXXXXX4821');
    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reveal number' })).toBeNull();
  });

  it('reveals the number and hides it again after a short time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderIt({ 'GET /accounts/bank-accounts/3/reveal': ok({ accountNumber: '123456789012' }) });
    await user.click(await screen.findByRole('button', { name: 'Reveal number' }));
    expect(await screen.findByText('123456789012')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(REVEAL_MS + 100);
    });
    expect(screen.queryByText('123456789012')).toBeNull();
    expect(screen.getByText('XXXXXX4821')).toBeInTheDocument();
  });

  it('closes an account with a reason and shows the refusal in words', async () => {
    renderIt({ 'POST /accounts/bank-accounts/3/close': err(422, 'COLLECTION_ACCOUNT_REQUIRED') });
    await userEvent.click(await screen.findByRole('button', { name: 'Close account' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Moved to another bank');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Close account' }));
    expect(await within(dlg).findByText(/another account the collection account first/)).toBeInTheDocument();
  });
});
