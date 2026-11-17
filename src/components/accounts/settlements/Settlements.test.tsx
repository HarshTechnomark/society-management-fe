import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { BANK_FEATURES, BANK_PERMS, listOf, settlementRaw } from '@/test/accountsBankFixtures';
import { fakeUploader, signInAs } from '@/test/residentsHelpers';
import { SettlementsScreen } from './SettlementsScreen';

vi.mock('next/navigation', () => navigationMock());
vi.setConfig({ testTimeout: 30000 });
beforeEach(resetAll);

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms = BANK_PERMS) {
  signInAs(perms, BANK_FEATURES);
  const api = mockApi({
    'GET /accounts/settlements': listOf([
      settlementRaw(),
      settlementRaw({ id: 6, gatewaySettlementId: 'setl_002', status: 'POSTED' }),
    ]),
    'GET /accounts/settlements/5': ok(settlementRaw()),
    ...routes,
  });
  render(<SettlementsScreen />);
  return api;
}

describe('Settlements', () => {
  it('lists rows with gross, fees plus GST, net and a status chip', async () => {
    renderIt();
    const rows = await screen.findAllByTestId('settlement-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Mismatch');
    expect(rows[0]).toHaveTextContent('Fees + GST ₹41.65');
    expect(rows[0]).toHaveTextContent('Net ₹13,576.35');
    expect(rows[1]).toHaveTextContent('Posted');
  });
  it('opens the drawer with unmatched items marked and the difference shown', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'Details of setl_001' }));
    const items = await screen.findAllByTestId('settlement-item');
    expect(items[0]).toHaveTextContent('Receipt RCT/1');
    expect(items[1]).toHaveAttribute('data-unmatched', 'true');
    expect(items[1]).toHaveTextContent('Payment not found');
    expect(screen.getByText('GST on the fee')).toBeInTheDocument();
  });
  it('reconciles again from the drawer', async () => {
    const api = renderIt({
      'POST /accounts/settlements/5/reconcile': ok(settlementRaw({ status: 'POSTED' })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Details of setl_001' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reconcile' }));
    await waitFor(() => expect(api.last('POST', '/accounts/settlements/5/reconcile')).toBeTruthy());
  });
  it('accepts a difference only with a reason, sending the version', async () => {
    const api = renderIt({
      'POST /accounts/settlements/5/accept-difference': ok(settlementRaw({ status: 'POSTED' })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Details of setl_001' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Accept difference' }));
    const dlg = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(dlg).getByRole('button', { name: 'Accept difference' }));
    expect(within(dlg).getByText(/5 to 500/)).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Bank confirmed the payout');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Accept difference' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/settlements/5/accept-difference')?.body).toEqual({
        reason: 'Bank confirmed the payout',
        version: 2,
      }),
    );
  });
  it('hides Accept difference without the approve permission', async () => {
    renderIt({}, ['finance.bank.view', 'finance.bank.import']);
    await userEvent.click(await screen.findByRole('button', { name: 'Details of setl_001' }));
    await screen.findByRole('button', { name: 'Reconcile' });
    expect(screen.queryByRole('button', { name: 'Accept difference' })).toBeNull();
  });
  it('imports pasted rows as a file and reports created and skipped', async () => {
    fakeUploader();
    const api = renderIt({ 'POST /accounts/settlements/import': ok({ created: 3, skipped: 1 }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Import a settlement report' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('tab', { name: 'Paste the rows' }));
    await userEvent.type(within(dlg).getByLabelText('Report rows'), 'a,b{Enter}1,2,3 more');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Import report' }));
    expect(await within(dlg).findByTestId('import-result')).toHaveTextContent(
      '3 settlements added. 1 were already there',
    );
    expect(api.last('POST', '/accounts/settlements/import')?.body).toEqual({
      fileId: 55,
      gatewayProvider: 'RAZORPAY',
    });
  });
  it('shows the empty state', async () => {
    renderIt({ 'GET /accounts/settlements': listOf([]) });
    expect(await screen.findByText('No settlements yet')).toBeInTheDocument();
  });
  it('shows the lock state on a 402', async () => {
    renderIt({ 'GET /accounts/settlements': err(402, 'FEATURE_NOT_IN_PLAN') });
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
});
