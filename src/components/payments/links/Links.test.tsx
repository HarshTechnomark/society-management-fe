import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { OPS_FEATURES, OPS_PERMS, OPS_VIEW, listOf, orderRaw } from '@/test/paymentsOpsFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { LinksScreen } from './LinksScreen';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const LINK_ORDER = orderRaw({ id: 55, sourceType: 'PAYMENT_LINK', linkShortCode: 'abc123' });
function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms = OPS_PERMS, features = OPS_FEATURES) {
  signInAs(perms, features);
  const api = mockApi({
    'GET /payment-orders': listOf([LINK_ORDER]),
    'GET /units': ok([{ id: 51, label: 'A-1203' }]),
    ...routes,
  });
  render(
    <ToastProvider>
      <LinksScreen />
    </ToastProvider>,
  );
  return api;
}
async function pickFlat() {
  await userEvent.type(screen.getByLabelText(/^Flat/), 'A-12');
  await userEvent.selectOptions(await screen.findByLabelText('Matching flats'), '51');
}

describe('Payment links', () => {
  it('lists links made so far, asks only for payment links, and offers to copy a live one', async () => {
    const api = renderIt();
    const rows = await screen.findAllByTestId('link-row');
    expect(rows[0]).toHaveTextContent('PO-55');
    expect(within(rows[0]).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(api.fn.mock.calls.some(c => String(c[0]).includes('sourceType=PAYMENT_LINK'))).toBe(true);
  });
  it('hides New payment link from a viewer', async () => {
    renderIt({}, OPS_VIEW);
    await screen.findAllByTestId('link-row');
    expect(screen.queryByRole('button', { name: 'New payment link' })).toBeNull();
  });
  it('shows the empty state', async () => {
    renderIt({ 'GET /payment-orders': listOf([]) });
    expect(await screen.findByText('No payment links yet')).toBeInTheDocument();
  });
  it('creates an outstanding-amount link and shows the full link once', async () => {
    const api = renderIt({
      'POST /payment-links': ok({
        orderId: 56,
        url: 'https://my.societyapp.in/pay/xyz#secret',
        expiresAt: '2026-11-30T00:00:00.000Z',
        amountPaise: 480000,
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'New payment link' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText('Choose the flat.')).toBeInTheDocument();
    await pickFlat();
    await userEvent.click(screen.getByLabelText('SMS'));
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByDisplayValue('https://my.societyapp.in/pay/xyz#secret')).toBeInTheDocument();
    expect(screen.getByText(/₹4,800 for A-1203/)).toBeInTheDocument();
    expect(api.last('POST', '/payment-links')?.body).toEqual({
      unitId: 51,
      amountMode: 'OUTSTANDING',
      channels: ['SMS'],
    });
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });
  it('validates a fixed amount and expiry, then sends them in paise and days', async () => {
    const api = renderIt({
      'POST /payment-links': ok({ orderId: 57, url: 'https://x/pay/a#b', amountPaise: 150000 }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'New payment link' }));
    await pickFlat();
    await userEvent.selectOptions(screen.getByLabelText('Amount'), 'FIXED');
    await userEvent.type(screen.getByLabelText('Valid for (days)'), '45');
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText(/Enter an amount from/)).toBeInTheDocument();
    expect(screen.getByText('Enter 1 to 30 days.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Amount \(₹\)/), '1500');
    await userEvent.clear(screen.getByLabelText('Valid for (days)'));
    await userEvent.type(screen.getByLabelText('Valid for (days)'), '7');
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(api.last('POST', '/payment-links')).toBeTruthy());
    expect(api.last('POST', '/payment-links')?.body).toEqual({
      unitId: 51,
      amountMode: 'FIXED',
      amountPaise: 150000,
      expiresInDays: 7,
    });
  });
  it('locks WhatsApp when the plan has no WhatsApp link', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'New payment link' }));
    expect(screen.getByLabelText('WhatsApp (Standard plan)')).toBeDisabled();
  });
  it('allows WhatsApp on a plan that has it', async () => {
    renderIt({}, OPS_PERMS, [...OPS_FEATURES, 'payments.whatsapp_payment_link']);
    await userEvent.click(await screen.findByRole('button', { name: 'New payment link' }));
    expect(screen.getByLabelText('WhatsApp')).toBeEnabled();
  });
  it('shows server errors in plain words', async () => {
    renderIt({ 'POST /payment-links': err(422, 'NOTHING_TO_PAY') });
    await userEvent.click(await screen.findByRole('button', { name: 'New payment link' }));
    await pickFlat();
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing outstanding/);
  });
});
