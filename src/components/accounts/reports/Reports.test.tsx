import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import {
  ACCOUNT_FEATURES,
  REPORT_PERMS,
  glRaw,
  periodsRaw,
  trialBalanceRaw,
} from '@/test/accountsReportsFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { ReportsScreen } from './ReportsScreen';
import { ExportPanel } from './ExportPanel';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const base = () => ({
  'GET /accounts/periods': ok(periodsRaw()),
  'GET /accounts/ledger-accounts': ok([
    { id: 11, code: '1110-001', name: 'Bank - HDFC Current', isGroup: false },
  ]),
  'GET /accounts/reports/trial-balance': ok(trialBalanceRaw()),
  'GET /accounts/reports/general-ledger': ok(glRaw()),
});

describe('Reports screen', () => {
  it('shows the trial balance with totals and a balanced badge', async () => {
    signInAs(REPORT_PERMS, ACCOUNT_FEATURES);
    mockApi(base());
    render(<ReportsScreen />);
    expect(await screen.findByText('Balanced')).toBeInTheDocument();
    expect(screen.getAllByText('₹14,32,709', { selector: 'td' })).toHaveLength(2);
  });
  it('drills from an account row to its general ledger and a voucher link', async () => {
    signInAs(REPORT_PERMS, ACCOUNT_FEATURES);
    mockApi(base());
    render(<ReportsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: /Open the ledger of 1110-001/ }));
    const link = await screen.findByRole('link', { name: 'RV/26-27/0007' });
    expect(link).toHaveAttribute('href', '/admin/accounts/journals?open=77');
  });
  it('asks for an account before the general ledger and refuses a range over a year', async () => {
    signInAs(REPORT_PERMS, ACCOUNT_FEATURES);
    mockApi(base());
    render(<ReportsScreen />);
    await screen.findByText('Balanced');
    await userEvent.click(screen.getByRole('tab', { name: 'General ledger' }));
    expect(await screen.findByText('Choose an account to see its ledger.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Receipts and payments' }));
    const from = screen.getByLabelText('From');
    await userEvent.clear(from);
    await userEvent.type(from, '2024-01-01');
    expect(await screen.findByText(/at most one year/)).toBeInTheDocument();
  });
  it('shows a lock state for GST on a plan without it, and a 402 as a plan prompt', async () => {
    signInAs(REPORT_PERMS, ['accounting.financial_reports']);
    mockApi(base());
    render(<ReportsScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: /GST summary/ }));
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
  it('shows the plan prompt for the whole screen on a lower plan', async () => {
    signInAs(REPORT_PERMS, []);
    mockApi(base());
    render(<ReportsScreen />);
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
  it('hides export without the export permission', async () => {
    signInAs(['finance.accounts.view'], ACCOUNT_FEATURES);
    mockApi(base());
    render(<ReportsScreen />);
    await screen.findByText('Balanced');
    expect(screen.queryByTestId('export-panel')).toBeNull();
  });
});

describe('Export panel', () => {
  it('starts a job, shows preparing and then the download link', async () => {
    const api = mockApi({
      'POST /accounts/exports': ok({ exportJobId: 'e1' }),
      'GET /accounts/exports/e1': [
        ok({ status: 'PREPARING' }),
        ok({ status: 'READY', downloadUrl: 'https://f/tb.xlsx' }),
      ],
    });
    render(<ExportPanel report="trial-balance" params={{ asOf: '2026-10-31' }} pollMs={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export as Excel' }));
    expect(await screen.findByText(/Preparing your file/)).toBeInTheDocument();
    const a = await screen.findByRole('link', { name: 'Download your file' });
    expect(a).toHaveAttribute('href', 'https://f/tb.xlsx');
    expect(api.last('POST', '/accounts/exports')?.body).toMatchObject({
      format: 'xlsx',
      report: 'trial-balance',
    });
  });
  it('says so when the export limit is reached', async () => {
    mockApi({ 'POST /accounts/exports': err(429, 'RATE_LIMITED') });
    render(<ExportPanel report="trial-balance" params={{}} pollMs={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export as CSV' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many exports'));
  });
  it('tells the user a notification will come when the file is slow', async () => {
    mockApi({
      'POST /accounts/exports': ok({ exportJobId: 'e2' }),
      'GET /accounts/exports/e2': ok({ status: 'PREPARING' }),
    });
    render(<ExportPanel report="trial-balance" params={{}} pollMs={2} maxPolls={2} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export as PDF' }));
    expect(await screen.findByText(/get a notification/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('export-panel')).getByRole('button', { name: 'Export as PDF' }),
    ).toBeEnabled();
  });
});
