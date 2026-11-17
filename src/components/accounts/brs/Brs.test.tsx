import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { BANK_FEATURES, BANK_PERMS } from '@/test/accountsBankFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { BrsScreen } from './BrsScreen';
import { brsToCsv } from './brsCsv';
import { normaliseBrs } from '@/services/accountsStatementsMappers';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const BRS = {
  bookBalancePaise: 1000000,
  unclearedDebitsPaise: 50000,
  unclearedCreditsPaise: 20000,
  unmatchedStatementCreditsPaise: 0,
  unmatchedStatementDebitsPaise: 0,
  computedBankBalancePaise: 1030000,
  statementBalancePaise: 1030000,
  differencePaise: 0,
  items: [{ kind: 'UNCLEARED_DEBIT', date: '2026-11-29', description: 'Cheque 000123', amountPaise: 50000 }],
};

describe('BRS', () => {
  it('shows the balances, the open items and agreement', async () => {
    signInAs(BANK_PERMS, BANK_FEATURES);
    const api = mockApi({ 'GET /accounts/bank-accounts/3/brs': ok(BRS) });
    render(<BrsScreen bankAccountId={3} />);
    expect(await screen.findByText('The books and the bank statement agree.')).toBeInTheDocument();
    expect(screen.getByText('Balance as per the books').closest('div')).toHaveTextContent('₹10,000');
    expect(screen.getAllByTestId('brs-item')[0]).toHaveTextContent('Cheque 000123');
    expect(api.calls[0].path).toBe('/accounts/bank-accounts/3/brs');
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  });
  it('warns about a difference and shows the lock state without the Premium entitlement', async () => {
    signInAs(BANK_PERMS, BANK_FEATURES);
    mockApi({ 'GET /accounts/bank-accounts/3/brs': ok({ ...BRS, differencePaise: 12000 }) });
    render(<BrsScreen bankAccountId={3} />);
    expect(await screen.findByText(/difference of ₹120/)).toBeInTheDocument();
  });
  it('builds a CSV with rupees and quoted text', () => {
    const csv = brsToCsv(
      normaliseBrs({
        ...BRS,
        items: [
          { kind: 'UNCLEARED_DEBIT', date: '2026-11-29', description: 'He said "hi"', amountPaise: 50000 },
        ],
      }),
    );
    expect(csv).toContain('"Difference",0.00');
    expect(csv).toContain('"He said ""hi"""');
    expect(csv).toContain('500.00');
  });
});
