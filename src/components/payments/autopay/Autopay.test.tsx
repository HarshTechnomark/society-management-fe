import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { OPS_FEATURES, OPS_PERMS, OPS_VIEW, listOf, mandateRaw } from '@/test/paymentsOpsFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { AutopayScreen } from './AutopayScreen';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const ROWS = [mandateRaw(), mandateRaw({ id: 32, status: 'CANCELLED', unitLabel: 'C-1' })];
function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms = OPS_PERMS) {
  signInAs(perms, OPS_FEATURES);
  const api = mockApi({ 'GET /autopay-mandates': listOf(ROWS), ...routes });
  render(
    <ToastProvider>
      <AutopayScreen />
    </ToastProvider>,
  );
  return api;
}

describe('AutoPay mandates', () => {
  it('lists mandates with type, cap, status and last debit', async () => {
    renderIt();
    const rows = await screen.findAllByTestId('mandate-row');
    expect(rows[0]).toHaveTextContent('B-402');
    expect(rows[0]).toHaveTextContent('Meera Shah');
    expect(rows[0]).toHaveTextContent('UPI AutoPay');
    expect(rows[0]).toHaveTextContent('Up to ₹5,000');
    expect(rows[0]).toHaveTextContent('Active');
    expect(rows[0]).toHaveTextContent('Debited');
  });
  it('offers Cancel only on a live mandate', async () => {
    renderIt();
    const rows = await screen.findAllByTestId('mandate-row');
    expect(within(rows[0]).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
  it('cancels with a reason and the version', async () => {
    const api = renderIt({ 'POST /autopay-mandates/31/cancel': ok(null) });
    await userEvent.click(
      within((await screen.findAllByTestId('mandate-row'))[0]).getByRole('button', { name: 'Cancel' }),
    );
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Resident left');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel AutoPay' }));
    await waitFor(() =>
      expect(api.last('POST', '/autopay-mandates/31/cancel')?.body).toEqual({
        reason: 'Resident left',
        version: 2,
      }),
    );
  });
  it('shows a stale version in the dialog', async () => {
    renderIt({ 'POST /autopay-mandates/31/cancel': err(409, 'STALE_VERSION') });
    await userEvent.click(
      within((await screen.findAllByTestId('mandate-row'))[0]).getByRole('button', { name: 'Cancel' }),
    );
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Resident left');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel AutoPay' }));
    expect(await within(dlg).findByText(/Someone else changed this/)).toBeInTheDocument();
  });
  it('hides Cancel from a viewer', async () => {
    renderIt({}, OPS_VIEW);
    await screen.findAllByTestId('mandate-row');
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
  it('says AutoPay is not available on a 402 instead of an error', async () => {
    renderIt({ 'GET /autopay-mandates': err(402, 'FEATURE_NOT_IN_PLAN') });
    expect(await screen.findByText('AutoPay is not available')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
  it('filters by status and shows the empty state', async () => {
    const api = renderIt({ 'GET /autopay-mandates': listOf([]) });
    expect(await screen.findByText('No AutoPay mandates yet')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ACTIVE');
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('status=ACTIVE'))).toBe(true),
    );
  });
});
