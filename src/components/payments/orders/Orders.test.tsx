import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { OPS_FEATURES, OPS_PERMS, OPS_VIEW, listOf, orderRaw } from '@/test/paymentsOpsFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { OrdersScreen } from './OrdersScreen';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const ROWS = [
  orderRaw(),
  orderRaw({ id: 4413, status: 'PAID', sourceType: 'AUTOPAY' }),
  orderRaw({ id: 4414, status: 'EXPIRED' }),
];
const DETAIL = {
  ...orderRaw(),
  basePaise: 900000,
  items: [{ itemType: 'INVOICE', label: 'INV-77 Nov maintenance', amountPaise: 900000 }],
};
function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms = OPS_PERMS, features = OPS_FEATURES) {
  signInAs(perms, features);
  const api = mockApi({
    'GET /payment-orders': listOf(ROWS),
    'GET /payment-orders/4412': ok(DETAIL),
    ...routes,
  });
  render(
    <ToastProvider>
      <OrdersScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Payment orders', () => {
  it('lists orders with status and source in words', async () => {
    renderIt();
    const rows = await screen.findAllByTestId('order-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('PO-4412');
    expect(rows[0]).toHaveTextContent('Waiting for payment');
    expect(rows[0]).toHaveTextContent('₹9,109');
    expect(rows[1]).toHaveTextContent('AutoPay');
    expect(rows[1]).toHaveTextContent('Paid');
  });
  it('filters by status and source', async () => {
    const api = renderIt();
    await screen.findAllByTestId('order-row');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PAID');
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('status=PAID'))).toBe(true));
    await userEvent.selectOptions(screen.getByLabelText('Started from'), 'PAYMENT_LINK');
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('sourceType=PAYMENT_LINK'))).toBe(true),
    );
  });
  it('shows empty and error states', async () => {
    renderIt({ 'GET /payment-orders': listOf([]) });
    expect(await screen.findByText('No payment orders yet')).toBeInTheDocument();
  });
  it('shows an error with retry', async () => {
    renderIt({ 'GET /payment-orders': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it('opens the order with its items', async () => {
    renderIt();
    await userEvent.click((await screen.findAllByTestId('order-row'))[0].querySelector('button')!);
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('INV-77 Nov maintenance')).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Check with the gateway' })).toBeInTheDocument();
  });
  it('forces a gateway check', async () => {
    const api = renderIt({ 'POST /payment-orders/4412/check': ok(orderRaw({ status: 'PAID' })) });
    await userEvent.click((await screen.findAllByTestId('order-row'))[0].querySelector('button')!);
    await userEvent.click(await screen.findByRole('button', { name: 'Check with the gateway' }));
    await waitFor(() => expect(api.last('POST', '/payment-orders/4412/check')).toBeTruthy());
  });
  it('hides the gateway check when the order has no gateway order yet (link not opened)', async () => {
    renderIt({ 'GET /payment-orders/4412': ok({ ...DETAIL, gatewayOrderId: null }) });
    await userEvent.click((await screen.findAllByTestId('order-row'))[0].querySelector('button')!);
    expect(await screen.findByText(/Nothing to check yet: the link has not been opened/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check with the gateway' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel this order' })).toBeInTheDocument();
  });
  it('shows the one-a-minute limit of a check in plain words', async () => {
    renderIt({ 'POST /payment-orders/4412/check': err(429, 'RATE_LIMITED') });
    await userEvent.click((await screen.findAllByTestId('order-row'))[0].querySelector('button')!);
    await userEvent.click(await screen.findByRole('button', { name: 'Check with the gateway' }));
    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
  });
  it('cancels with a reason', async () => {
    const api = renderIt({ 'POST /payment-orders/4412/cancel': ok(orderRaw({ status: 'CANCELLED' })) });
    await userEvent.click((await screen.findAllByTestId('order-row'))[0].querySelector('button')!);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel this order' }));
    const dlgs = await screen.findAllByRole('dialog');
    const modal = dlgs[dlgs.length - 1];
    await userEvent.click(within(modal).getByRole('button', { name: 'Cancel order' }));
    expect(await within(modal).findByText(/Enter a reason of 5 to 300/)).toBeInTheDocument();
    await userEvent.type(within(modal).getByLabelText(/Reason/), 'Wrong amount');
    await userEvent.click(within(modal).getByRole('button', { name: 'Cancel order' }));
    await waitFor(() =>
      expect(api.last('POST', '/payment-orders/4412/cancel')?.body).toEqual({ reason: 'Wrong amount' }),
    );
  });
  it('offers no actions on a paid order or to a viewer', async () => {
    renderIt({ 'GET /payment-orders/4413': ok({ ...DETAIL, id: 4413, status: 'PAID' }) });
    await userEvent.click((await screen.findAllByTestId('order-row'))[1].querySelector('button')!);
    await screen.findByText('INV-77 Nov maintenance');
    expect(screen.queryByRole('button', { name: 'Cancel this order' })).toBeNull();
  });
  it('hides actions without edit permission', async () => {
    renderIt({}, OPS_VIEW);
    await userEvent.click((await screen.findAllByTestId('order-row'))[0].querySelector('button')!);
    await screen.findByText('INV-77 Nov maintenance');
    expect(screen.queryByRole('button', { name: 'Check with the gateway' })).toBeNull();
  });
});
