import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { AccountsHome } from './balance/AccountsHome';
import { SocietyBalanceCard } from './balance/SocietyBalanceCard';
import { FinancesScreen } from './resident/FinancesScreen';
import { FundStatementScreen } from './resident/FundStatementScreen';

vi.mock('next/navigation', () => navigationMock());

const balance = {
  totalPaise: 123640900,
  inBankPaise: 123030900,
  clearingPaise: 0,
  cashPaise: 610000,
  chequesPaise: 0,
  generalPaise: 12640900,
  lastChangedAt: '2026-10-21T02:00:11.204Z',
  bankAccounts: [
    {
      id: 3,
      displayName: 'HDFC Current',
      bankName: 'HDFC Bank',
      maskedNumber: 'XXXXXX4821',
      balancePaise: 123030900,
      lastReconciledDate: '2026-10-19',
    },
  ],
  funds: [{ id: 1, name: 'Sinking fund', fundType: 'SINKING', balancePaise: 96000000 }],
  movements: [1, 2, 3, 4, 5].map(i => ({
    journalEntryId: i,
    changedAt: '2026-10-21T02:00:11Z',
    direction: 'UP',
    deltaTotalPaise: 100,
    label: `Move ${i}`,
    totalPaise: 1,
  })),
};
const history = {
  points: [
    { date: '2026-10-19', totalPaise: 100 },
    { date: '2026-10-20', totalPaise: 200 },
  ],
};
beforeEach(() => resetAll());

describe('SocietyBalanceCard', () => {
  it('is hidden without finance.accounts.view', () => {
    signInAs([], []);
    mockApi({});
    const { container } = render(<SocietyBalanceCard />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows total, chips and only the last 4 movements', async () => {
    signInAs(['finance.accounts.view'], []);
    mockApi({ 'GET /society-balance': ok(balance) });
    render(<SocietyBalanceCard />);
    expect(await screen.findByTestId('balance-total')).toHaveTextContent('₹12,36,409');
    expect(screen.getAllByTestId('balance-chip')).toHaveLength(4);
    expect(screen.getByText('HDFC Bank XXXXXX4821')).toBeInTheDocument();
    expect(screen.getByLabelText('Recent movements').querySelectorAll('li')).toHaveLength(4);
  });
  it('shows an error with a retry', async () => {
    signInAs(['finance.accounts.view'], []);
    mockApi({ 'GET /society-balance': err(500, 'INTERNAL_ERROR') });
    render(<SocietyBalanceCard />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it('polls again after the interval', async () => {
    signInAs(['finance.accounts.view'], []);
    const api = mockApi({ 'GET /society-balance': ok(balance) });
    render(<SocietyBalanceCard pollMs={20} />);
    await waitFor(() =>
      expect(api.calls.filter(c => c.path.endsWith('/society-balance')).length).toBeGreaterThan(1),
    );
  });
});

describe('AccountsHome', () => {
  it('shows the card, the chart and the links', async () => {
    signInAs(['finance.accounts.view'], []);
    mockApi({ 'GET /society-balance': ok(balance), 'GET /society-balance/history': ok(history) });
    render(<AccountsHome />);
    expect(await screen.findByTestId('balance-chart')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cash book/ })).toHaveAttribute(
      'href',
      '/admin/accounts/cash-book',
    );
  });
  it('says so without permission', async () => {
    signInAs([], []);
    mockApi({});
    render(<AccountsHome />);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('Resident finances', () => {
  const perms = ['resident.finances.view'];
  it('shows the balance and funds at BALANCE level without spend bars', async () => {
    signInAs(perms, []);
    mockApi({
      'GET /me/society-finances': ok({
        level: 'BALANCE',
        totalPaise: 5000,
        funds: [{ id: 1, name: 'Sinking fund', balancePaise: 100 }],
        spendByCategory: null,
      }),
    });
    render(<FinancesScreen />);
    expect(await screen.findByTestId('resident-total')).toHaveTextContent('₹50');
    expect(screen.getByTestId('fund-row')).toHaveAttribute('href', '/resident/finances/funds/1');
    expect(screen.queryByText('Where the money went this year')).toBeNull();
  });
  it('adds the category bars at FULL level', async () => {
    signInAs(perms, []);
    mockApi({
      'GET /me/society-finances': ok({
        level: 'FULL',
        totalPaise: 5000,
        funds: [],
        spendByCategory: [{ category: 'Repairs', financialYear: '2026-27', amountPaise: 300 }],
        incomeByCategory: [],
      }),
    });
    render(<FinancesScreen />);
    expect(await screen.findByText('Where the money went this year')).toBeInTheDocument();
    expect(screen.getAllByTestId('category-row')).toHaveLength(1);
  });
  it('shows the hidden state on 404', async () => {
    signInAs(perms, []);
    mockApi({ 'GET /me/society-finances': err(404, 'NOT_FOUND') });
    render(<FinancesScreen />);
    expect(await screen.findByText('Finances are not shown')).toBeInTheDocument();
  });
  it('shows no access without the permission', async () => {
    signInAs([], []);
    mockApi({});
    render(<FinancesScreen />);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
  it('explains money moved out of a fund that was not an expense, and hides zero contributors', async () => {
    signInAs(perms, []);
    mockApi({
      'GET /me/society-finances/funds/3/statement': ok({
        fund: { id: 3, name: 'Sinking' },
        collectedPaise: 10000000,
        spentPaise: 10000000,
        balancePaise: 0,
        contributors: 0,
        spend: [],
      }),
    });
    render(<FundStatementScreen id={3} />);
    expect(await screen.findByTestId('fund-moved')).toHaveTextContent('₹1,00,000');
    expect(screen.queryByText(/Nothing has been spent/)).toBeNull();
    expect(screen.queryByTestId('fund-contributors')).toBeNull();
  });
  it('shows a fund statement and the not-available state', async () => {
    signInAs(perms, []);
    mockApi({
      'GET /me/society-finances/funds/2/statement': ok({
        fund: { id: 2, name: 'Repair fund' },
        collectedPaise: 1000,
        spentPaise: 400,
        balancePaise: 600,
        contributors: 12,
        spend: [{ category: 'Lift', amountPaise: 400 }],
      }),
    });
    render(<FundStatementScreen id={2} />);
    expect(await screen.findByTestId('fund-balance')).toHaveTextContent('₹6');
    expect(screen.getByText('12 households')).toBeInTheDocument();
    resetAll();
    signInAs(perms, []);
    mockApi({ 'GET /me/society-finances/funds/9/statement': err(404, 'FUND_NOT_FOUND') });
    render(<FundStatementScreen id={9} />);
    expect(await screen.findByText('This fund is not available')).toBeInTheDocument();
  });
});
