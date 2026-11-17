import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { ACCOUNT_FEATURES, PERIOD_PERMS, periodsRaw } from '@/test/accountsReportsFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { CloseYearDialog } from './CloseYearDialog';
import { PeriodsScreen } from './PeriodsScreen';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

describe('Periods screen', () => {
  it('links a waiting unlock to its approval request', async () => {
    signInAs(PERIOD_PERMS, ACCOUNT_FEATURES);
    mockApi({
      'GET /accounts/periods': ok(
        periodsRaw({
          pendingUnlock: {
            approvalRequestId: 31,
            fromDate: '2026-09-01',
            hours: 24,
            reason: 'Late bank entry',
          },
        }),
      ),
    });
    render(<PeriodsScreen />);
    expect(await screen.findByRole('link', { name: 'Open the approval' })).toHaveAttribute(
      'href',
      '/admin/approvals/31',
    );
  });
  it('shows the lock badge, years and the blockers of a year that cannot close', async () => {
    signInAs(PERIOD_PERMS, ACCOUNT_FEATURES);
    mockApi({ 'GET /accounts/periods': ok(periodsRaw()) });
    render(<PeriodsScreen />);
    expect(await screen.findByText(/Locked through 30 Sep/)).toBeInTheDocument();
    const rows = screen.getAllByTestId('year-row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('The year has not ended yet.');
    expect(within(rows[2]).queryByRole('button')).toBeNull();
    expect(within(rows[0]).getByRole('button', { name: 'Close year' })).toBeInTheDocument();
  });
  it('locks books through a month end', async () => {
    signInAs(PERIOD_PERMS, ACCOUNT_FEATURES);
    const api = mockApi({ 'GET /accounts/periods': ok(periodsRaw()), 'POST /accounts/period-lock': ok({}) });
    render(<PeriodsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Lock books up to' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Lock through the end of/), '2026-10');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lock books' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/period-lock')?.body).toEqual({
        lockThrough: '2026-10-31',
        version: 6,
      }),
    );
  });
  it('refuses a month that is not after the current lock without calling the API', async () => {
    signInAs(PERIOD_PERMS, ACCOUNT_FEATURES);
    const api = mockApi({ 'GET /accounts/periods': ok(periodsRaw()) });
    render(<PeriodsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Lock books up to' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Lock through the end of/), '2026-08');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lock books' }));
    expect(await within(dlg).findByRole('alert')).toHaveTextContent('after the one already locked');
    expect(api.last('POST', '/accounts/period-lock')).toBeUndefined();
  });
  it('requests an unlock with a reason and then shows it waiting for approval', async () => {
    signInAs(PERIOD_PERMS, ACCOUNT_FEATURES);
    const api = mockApi({
      'GET /accounts/periods': ok(periodsRaw()),
      'POST /accounts/period-lock/unlock-requests': ok({ approvalRequestId: 9 }),
    });
    render(<PeriodsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Request unlock' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Open from the start of/), '2026-09');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'short');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send request' }));
    expect(await within(dlg).findByText('Explain why in 10 to 500 characters.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), ' and a wrong entry to fix');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send request' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/period-lock/unlock-requests')?.body).toMatchObject({
        fromDate: '2026-09-01',
        hours: 24,
      }),
    );
    expect(await screen.findByText('Unlock waiting for approval')).toBeInTheDocument();
  });
  it('shows an open window and relocks it', async () => {
    signInAs(PERIOD_PERMS, ACCOUNT_FEATURES);
    const api = mockApi({
      'GET /accounts/periods': ok(
        periodsRaw({ unlock: { fromDate: '2026-09-01', until: '2026-11-18', approvalRequestId: 3 } }),
      ),
      'POST /accounts/period-lock/relock': ok({}),
    });
    render(<PeriodsScreen />);
    expect(await screen.findByText(/Temporarily open from 1 Sep/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request unlock' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Relock' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/period-lock/relock')?.body).toEqual({ version: 6 }),
    );
  });
  it('hides write buttons without the approve permission', async () => {
    signInAs(['finance.accounts.view'], ACCOUNT_FEATURES);
    mockApi({ 'GET /accounts/periods': ok(periodsRaw()) });
    render(<PeriodsScreen />);
    await screen.findByText(/Locked through 30 Sep/);
    expect(screen.queryByRole('button', { name: 'Lock books up to' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close year' })).toBeNull();
  });
});

describe('Close financial year', () => {
  const year = periodsRaw().years[0] as never;
  it('needs the typed text, then shows progress and the carry-forward result', async () => {
    signInAs(PERIOD_PERMS, ACCOUNT_FEATURES);
    const api = mockApi({
      'POST /accounts/financial-years/2025-26/close': { status: 202, data: { jobId: 'j1' } },
      'GET /accounts/periods': [ok(periodsRaw()), ok(periodsRaw({ lastClosedFinancialYear: '2025-26' }))],
      'GET /accounts/reports/income-expenditure': ok({
        rows: [],
        totals: { incomePaise: 0, expenditurePaise: 0, surplusPaise: 1250000 },
      }),
      'GET /accounts/reports/balance-sheet': ok({
        rows: [],
        totals: { assetsPaise: 9900000, liabilitiesAndFundsPaise: 9900000 },
      }),
    });
    const onDone = vi.fn();
    render(<CloseYearDialog year={year} version={6} onClose={() => {}} onDone={onDone} pollMs={5} />);
    const btn = screen.getByRole('button', { name: 'Close year' });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Type CLOSE 2025-26/), 'CLOSE 2025-26');
    await userEvent.click(btn);
    expect(await screen.findByText(/Closing the year/)).toBeInTheDocument();
    const res = await screen.findByTestId('close-result');
    expect(res).toHaveTextContent('Surplus for the period: ₹12,500');
    expect(res).toHaveTextContent('₹99,000');
    expect(api.last('POST', '/accounts/financial-years/2025-26/close')?.body).toEqual({
      confirm: true,
      version: 6,
    });
  });
  it('lists the reasons when the server refuses and goes back to the checklist', async () => {
    mockApi({
      'POST /accounts/financial-years/2025-26/close': err(422, 'YEAR_CLOSE_PRECONDITION', [
        { field: 'year', message: '2 expenses are still pending.' },
      ]),
    });
    render(<CloseYearDialog year={year} version={6} onClose={() => {}} onDone={() => {}} pollMs={5} />);
    await userEvent.type(screen.getByLabelText(/Type CLOSE 2025-26/), 'CLOSE 2025-26');
    await userEvent.click(screen.getByRole('button', { name: 'Close year' }));
    expect(await screen.findByText('2 expenses are still pending.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close year' })).toBeEnabled();
  });
  it('blocks closing while the checklist has blockers', () => {
    const blocked = periodsRaw().years[1] as never;
    render(<CloseYearDialog year={blocked} version={6} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByText('The year has not ended yet.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Type CLOSE 2026-27/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close year' })).toBeDisabled();
  });
});
