import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import {
  BANK_FEATURES,
  BANK_PERMS,
  candidateRaw,
  importRaw,
  lineRaw,
  listOf,
} from '@/test/accountsBankFixtures';
import { fakeUploader, signInAs } from '@/test/residentsHelpers';
import { ReconciliationScreen } from './ReconciliationScreen';
import { StatementsScreen } from './StatementsScreen';

vi.mock('next/navigation', () => navigationMock());
vi.setConfig({ testTimeout: 30000 });
beforeEach(resetAll);

const LINES = [
  lineRaw(),
  lineRaw({
    id: 102,
    lineNo: 2,
    creditPaise: 0,
    debitPaise: 35000,
    description: 'SMS charges',
    reference: null,
  }),
];
function recon(routes: Parameters<typeof mockApi>[0] = {}, perms = BANK_PERMS, features = BANK_FEATURES) {
  signInAs(perms, features);
  const api = mockApi({
    'GET /accounts/bank-statements/9': ok(importRaw()),
    'GET /accounts/bank-statements/9/lines': listOf(LINES),
    'GET /accounts/bank-statement-lines/101/candidates': ok([candidateRaw()]),
    'GET /accounts/bank-statement-lines/102/candidates': ok([]),
    ...routes,
  });
  render(<ReconciliationScreen id={9} />);
  return api;
}

describe('Statements list', () => {
  it('lists imports with status in words and an upload button', async () => {
    signInAs(BANK_PERMS, BANK_FEATURES);
    mockApi({
      'GET /accounts/bank-statements': listOf([
        importRaw(),
        importRaw({ id: 10, status: 'FAILED', errorMessage: 'Row 7: bad date' }),
      ]),
      'GET /accounts/bank-accounts': ok([{ id: 3, bankName: 'HDFC', accountNumberMasked: 'XXXX4821' }]),
    });
    render(<StatementsScreen />);
    const rows = await screen.findAllByTestId('statement-row');
    expect(rows[0]).toHaveTextContent('118 of 142 matched');
    expect(rows[0]).toHaveTextContent('Ready to match');
    expect(rows[1]).toHaveTextContent('Row 7: bad date');
    expect(screen.getByRole('button', { name: 'Upload a statement' })).toBeInTheDocument();
  });
  it('uploads a statement and goes to its screen, with the template link', async () => {
    fakeUploader();
    signInAs(BANK_PERMS, BANK_FEATURES);
    const api = mockApi({
      'GET /accounts/bank-statements': listOf([]),
      'GET /accounts/bank-accounts': ok([{ id: 3, bankName: 'HDFC', accountNumberMasked: 'XXXX4821' }]),
      'POST /accounts/bank-statements': ok(importRaw({ id: 12, status: 'UPLOADED' })),
    });
    render(<StatementsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Upload a statement' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('link', { name: /template/ })).toHaveAttribute(
      'href',
      expect.stringContaining('bank-statement-template'),
    );
    await waitFor(() =>
      expect(within(dlg).getByRole('option', { name: 'HDFC XXXX4821' })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(within(dlg).getByLabelText(/Bank account/), '3');
    await userEvent.upload(
      within(dlg).getByLabelText('Statement file'),
      new File(['a'], 's.csv', { type: 'text/csv' }),
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'Upload statement' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/bank-statements')?.body).toEqual({ bankAccountId: 3, fileId: 55 }),
    );
  });
  it('shows the upgrade state on a plan 402', async () => {
    signInAs(BANK_PERMS, BANK_FEATURES);
    mockApi({ 'GET /accounts/bank-statements': err(402, 'FEATURE_NOT_IN_PLAN') });
    render(<StatementsScreen />);
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
});

describe('Reconciliation screen', () => {
  it('shows progress and the lines, filtered to unmatched', async () => {
    const api = recon();
    expect(await screen.findAllByTestId('line-row')).toHaveLength(2);
    expect(screen.getByTestId('progress')).toHaveTextContent('118 of 142 lines matched');
    expect(api.calls.find(c => c.path.endsWith('/lines'))).toBeTruthy();
  });
  it('matches a line with a candidate', async () => {
    const api = recon({ 'POST /accounts/bank-statement-lines/101/match': ok({}) });
    await userEvent.click((await screen.findAllByTestId('line-row'))[0].querySelector('button')!);
    const row = await screen.findByTestId('candidate-row');
    expect(row).toHaveTextContent('Score 100');
    await userEvent.click(within(row).getByRole('button', { name: 'Match' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/bank-statement-lines/101/match')?.body).toEqual({
        journalLineId: 700,
        version: 1,
      }),
    );
  });
  it('creates an entry from a line with a chosen account', async () => {
    const api = recon({ 'POST /accounts/bank-statement-lines/102/create-entry': ok({}) });
    await userEvent.click((await screen.findAllByTestId('line-row'))[1].querySelector('button')!);
    await userEvent.click(await screen.findByRole('button', { name: 'Create entry from line' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create entry' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/bank-statement-lines/102/create-entry')?.body).toEqual({
        ledgerAccountCode: '5600',
        version: 1,
      }),
    );
  });
  it('asks for a reason of 5 characters before ignoring', async () => {
    const api = recon({ 'POST /accounts/bank-statement-lines/102/ignore': ok({}) });
    await userEvent.click((await screen.findAllByTestId('line-row'))[1].querySelector('button')!);
    await userEvent.click(await screen.findByRole('button', { name: 'Ignore' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'abc');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Ignore line' }));
    expect(within(dlg).getByText(/5 to 200/)).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'def');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Ignore line' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/bank-statement-lines/102/ignore')?.body).toEqual({
        reason: 'abcdef',
        version: 1,
      }),
    );
  });
  it('runs auto-match and marks reconciled, showing the API message when lines remain', async () => {
    const api = recon({
      'POST /accounts/bank-statements/9/auto-match': ok({ matched: 4 }),
      'POST /accounts/bank-statements/9/mark-reconciled': err(422, 'RECONCILIATION_INCOMPLETE'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Auto-match' }));
    await waitFor(() => expect(api.last('POST', '/accounts/bank-statements/9/auto-match')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: 'Mark reconciled' }));
    expect(await screen.findByText(/still unmatched/)).toBeInTheDocument();
  });
  it('hides Mark reconciled without the Premium entitlement and write buttons without permission', async () => {
    recon({}, ['finance.bank.view'], ['payments.bank_statement_import']);
    await screen.findAllByTestId('line-row');
    expect(screen.queryByRole('button', { name: 'Mark reconciled' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Auto-match' })).toBeNull();
  });
  it('shows the parsing state and the failed state with Upload again', async () => {
    recon({ 'GET /accounts/bank-statements/9': ok(importRaw({ status: 'UPLOADED', lineCount: 0 })) });
    expect(await screen.findByRole('status')).toHaveTextContent('Reading your statement');
  });
  it('shows the row number of a failed parse', async () => {
    recon({
      'GET /accounts/bank-statements/9': ok(
        importRaw({ status: 'FAILED', errorMessage: 'Row 12: date not understood' }),
      ),
    });
    expect(await screen.findByText('Row 12: date not understood')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload again' })).toBeInTheDocument();
  });
  it('shows a matched line with Unmatch', async () => {
    const api = recon({
      'GET /accounts/bank-statements/9/lines': listOf([
        lineRaw({
          matchStatus: 'MATCHED',
          matchMethod: 'AUTO_REFERENCE',
          matchConfidence: 100,
          matchedLabel: 'RCT/7',
        }),
      ]),
      'POST /accounts/bank-statement-lines/101/unmatch': ok({}),
    });
    await userEvent.click((await screen.findAllByTestId('line-row'))[0].querySelector('button')!);
    expect(await screen.findByText(/Matched by reference: RCT\/7/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unmatch' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/bank-statement-lines/101/unmatch')?.body).toEqual({ version: 1 }),
    );
  });
  it('says the statement was not found on a 404', async () => {
    recon({ 'GET /accounts/bank-statements/9': err(404, 'STATEMENT_NOT_FOUND') });
    expect(await screen.findByText('This statement was not found.')).toBeInTheDocument();
  });
});
