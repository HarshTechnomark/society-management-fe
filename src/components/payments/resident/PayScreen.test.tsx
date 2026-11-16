import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureFileUploader } from '@/lib/fileUpload';
import { err, mockApi, navigationMock, ok, resetAll, router, search } from '@/test/helpers';
import { PAY_PERMS, duesRaw, fakeOrderRaw, payablesRaw } from '@/test/paymentsResidentFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { ToastProvider } from '@/components/ui/Toast';
import { PayScreen } from './PayScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const base = (extra: Routes = {}, pay = payablesRaw()): Routes => ({
  'GET /me/dues': ok(duesRaw()),
  'GET /me/payables': ok(pay),
  'GET /me/autopay-mandates': err(422, 'AUTOPAY_NOT_AVAILABLE'),
  ...extra,
});
function show(routes: Routes, perms = PAY_PERMS) {
  signInAs(perms, []);
  const api = mockApi(routes);
  render(
    <ToastProvider>
      <PayScreen />
    </ToastProvider>,
  );
  return api;
}
beforeEach(() => {
  resetAll();
  configureFileUploader(null);
});

describe('Pay list', () => {
  it('lists bills first (overdue oldest first), then optional items, with the advance line and total', async () => {
    show(base());
    const rows = await screen.findAllByTestId('pay-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('INV/2026-27/000087');
    expect(rows[1]).toHaveTextContent('INV/2026-27/000123');
    expect(rows[2]).toHaveTextContent('Ganesh Utsav 2026 (optional)');
    expect(within(rows[0]).getByRole('checkbox')).toBeChecked();
    expect(within(rows[2]).getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByTestId('pay-total')).toHaveTextContent('₹8,009');
    expect(screen.getByTestId('advance-line')).toHaveTextContent('Advance balance: ₹25');
    expect(screen.getByRole('button', { name: 'Pay ₹8,009' })).toBeEnabled();
  });

  it('a disputed bill (maxPaise 0 from the API) is not ticked at the start', async () => {
    const raw = payablesRaw();
    const items = raw.items as Record<string, unknown>[];
    items[1] = { ...items[1], isDisputed: true, minPaise: 0, maxPaise: 0 };
    show(base({}, raw));
    const rows = await screen.findAllByTestId('pay-row');
    expect(within(rows[0]).getByRole('checkbox')).toBeChecked();
    expect(within(rows[1]).getByRole('checkbox')).not.toBeChecked();
  });

  it('unticking an item and ticking the optional one updates the total, and a partial amount can be typed', async () => {
    show(base());
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('checkbox', { name: /Pay INV\/2026-27\/000123/ }));
    expect(screen.getByTestId('pay-total')).toHaveTextContent('₹1,200');
    await userEvent.click(screen.getByRole('checkbox', { name: /Pay Ganesh/ }));
    expect(screen.getByTestId('pay-total')).toHaveTextContent('₹2,300');
    const amount = screen.getByLabelText('Amount for INV/2026-27/000087 · Aug 2026 (₹)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '500');
    expect(screen.getByTestId('pay-total')).toHaveTextContent('₹1,600');
    expect(screen.getByText('Between ₹1 and ₹1,200')).toBeInTheDocument();
  });

  it('shows the min and max hint and blocks an amount out of range', async () => {
    show(base());
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('checkbox', { name: /Pay Ganesh/ }));
    const amount = screen.getByLabelText('Amount for Ganesh Utsav 2026 (optional) (₹)');
    expect(screen.getByText('Between ₹501 and ₹1,00,000')).toBeInTheDocument();
    await userEvent.clear(amount);
    await userEvent.type(amount, '100');
    expect(screen.getByText('At least ₹501.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pay ₹/ })).toBeDisabled();
    await userEvent.clear(amount);
    await userEvent.type(amount, '2000000');
    expect(screen.getByText('At most ₹1,00,000.')).toBeInTheDocument();
  });

  it('locks bill amounts when part payment is off and hides the advance field when advance is off', async () => {
    show(base({}, payablesRaw({ allowPartial: false, allowAdvance: false })));
    await screen.findAllByTestId('pay-row');
    expect(screen.getByLabelText('Amount for INV/2026-27/000087 · Aug 2026 (₹)')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText(/Add to advance balance/)).toBeNull();
  });

  it('switches flat and loads that flat', async () => {
    const api = show(base());
    await screen.findAllByTestId('pay-row');
    await userEvent.selectOptions(screen.getByLabelText('Flat'), '313');
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('unitId=313'))).toBe(true));
  });

  it('ticks only the bill of a link from the bill page', async () => {
    search.current = new URLSearchParams('unitId=312&invoiceId=123');
    show(base());
    await screen.findAllByTestId('pay-row');
    expect(screen.getByRole('checkbox', { name: /Pay INV\/2026-27\/000123/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Pay INV\/2026-27\/000087/ })).not.toBeChecked();
    expect(screen.getByTestId('pay-total')).toHaveTextContent('₹6,809');
  });

  it('hides Pay without the create permission, and says when online payment is not set up', async () => {
    show(base({}, payablesRaw({ gatewayReady: false })), ['resident.payments.view', 'resident.dues.view']);
    await screen.findAllByTestId('pay-row');
    expect(screen.queryByRole('button', { name: /^Pay ₹/ })).toBeNull();
    expect(screen.getByText(/Online payment is not set up/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay offline' })).toBeInTheDocument();
  });

  it('shows the live order with a link to its status', async () => {
    show(base({}, payablesRaw({ liveOrder: { orderId: 77, status: 'CREATED' } })));
    const link = await screen.findByRole('link', { name: 'See its status' });
    expect(link).toHaveAttribute('href', '/resident/pay/status/77');
  });

  it('blocks the screen without the view permission', async () => {
    show(base(), ['resident.home.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('Checkout', () => {
  const order = (over: Record<string, unknown> = {}) => ok(fakeOrderRaw(over), 'Payment order created');

  it('shows the fee of each method before confirming, sends the chosen method, then the test panel completes it', async () => {
    const api = show(
      base({
        'POST /me/payables/payment-orders': order({
          convenienceFeePaise: 1442,
          convenienceFeeGstPaise: 260,
          grossAmountPaise: 802600,
          checkout: { order_id: 'order_fake1' },
        }),
        'POST /dev/payments/order_fake1/pay': ok({ gatewayPaymentId: 'pay_ok12345', status: 'captured' }),
        'POST /me/payables/payment-orders/4412/verify': ok({
          orderId: 4412,
          status: 'PAID',
          payment: { id: 1, receiptNo: 'R', amountPaise: 1, paymentDate: '2026-11-20' },
        }),
      }),
    );
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay ₹8,009' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('No fee')).toBeInTheDocument();
    expect(within(dlg).getByText('Fee ₹144.16 plus GST')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('radio', { name: /Card/ }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Pay ₹8,009' }));
    const body = api.last('POST', '/me/payables/payment-orders')?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      unitId: 312,
      allocationMode: 'SELECTED',
      methodHint: 'CARD',
      payListVersion: 'a'.repeat(64),
      items: [
        { type: 'INVOICE', id: 87, amountPaise: 120000 },
        { type: 'INVOICE', id: 123, amountPaise: 680900 },
      ],
    });
    expect(await screen.findByRole('region', { name: 'Test payment' })).toBeInTheDocument();
    expect(screen.getByText('₹8,026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pay (success)' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/pay/status/4412'));
    expect(api.last('POST', '/me/payables/payment-orders/4412/verify')?.body).toEqual({
      gatewayPaymentId: 'pay_ok12345',
    });
  });

  it('the Fail button drives the fake gateway to a failed payment and goes to the status page', async () => {
    const api = show(
      base({
        'POST /me/payables/payment-orders': order(),
        'POST /dev/payments/order_fake1/pay': ok({ gatewayPaymentId: 'pay_bad1234', status: 'failed' }),
        'POST /me/payables/payment-orders/4412/verify': ok({
          orderId: 4412,
          status: 'ATTEMPTED',
          payment: null,
        }),
      }),
    );
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay ₹8,009' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pay ₹8,009' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Fail' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/pay/status/4412?failed=1'));
    expect(api.last('POST', '/dev/payments/order_fake1/pay')?.body).toEqual({ status: 'failed' });
  });

  it('a real gateway shows the UPI link on a phone instead of the test panel', async () => {
    vi.stubGlobal('innerWidth', 400);
    show(
      base({
        'POST /me/payables/payment-orders': order({
          checkout: {
            provider: 'RAZORPAY',
            keyId: 'rzp_x',
            gatewayOrderId: 'order_r',
            upiIntentUrl: 'upi://pay?pa=x',
          },
        }),
      }),
    );
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay ₹8,009' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pay ₹8,009' }),
    );
    const link = await screen.findByRole('link', { name: 'Open your UPI app' });
    expect(link).toHaveAttribute('href', 'upi://pay?pa=x');
    expect(screen.queryByRole('region', { name: 'Test payment' })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('PAYABLE_CHANGED reloads the list and says so in plain words', async () => {
    const api = show(base({ 'POST /me/payables/payment-orders': err(409, 'PAYABLE_CHANGED') }));
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay ₹8,009' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pay ₹8,009' }),
    );
    expect(await screen.findByText(/Your dues changed while you were choosing/)).toBeInTheDocument();
    await waitFor(() => expect(api.calls.filter(c => c.path === '/me/payables').length).toBe(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('PAYMENT_IN_PROGRESS offers the payment that is already running', async () => {
    show(
      base({
        'POST /me/payables/payment-orders': err(409, 'PAYMENT_IN_PROGRESS', [
          { field: 'orderId', message: '55', orderId: 55 },
        ]),
      }),
    );
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay ₹8,009' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pay ₹8,009' }),
    );
    expect(await screen.findByText(/already in progress/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'See that payment' }));
    expect(router.push).toHaveBeenCalledWith('/resident/pay/status/55');
  });

  it.each([
    ['PARTIAL_NOT_ALLOWED', 422, /does not accept part payments/],
    ['GATEWAY_NOT_CONFIGURED', 422, /not set up for your society yet/],
    ['GATEWAY_ERROR', 502, /You were not charged/],
  ])('shows %s in plain words', async (code, status, text) => {
    show(base({ 'POST /me/payables/payment-orders': err(status, code) }));
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay ₹8,009' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pay ₹8,009' }),
    );
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('cancels a created order', async () => {
    const api = show(
      base({
        'POST /me/payables/payment-orders': order(),
        'POST /me/payment-orders/4412/cancel': ok({ orderId: 4412, status: 'CANCELLED' }),
      }),
    );
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay ₹8,009' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pay ₹8,009' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel this payment' }));
    await waitFor(() => expect(api.last('POST', '/me/payment-orders/4412/cancel')).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Pay offline', () => {
  it('shows the bank details and declares a transfer with proof', async () => {
    configureFileUploader({ upload: async () => ({ fileId: 55 }) });
    const api = show(
      base({ 'POST /me/payments/declared': ok({ id: 1, status: 'PENDING_APPROVAL' }, 'Created') }),
    );
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay offline' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/HDFC Bank xxxx4521/)).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'I paid by bank transfer' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send for approval' }));
    expect(
      await within(dlg).findByText('Enter the UTR or reference number from your bank.'),
    ).toBeInTheDocument();
    expect(within(dlg).getByText('Add a screenshot or photo of the transfer.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText('UTR or reference number'), 'UTR123456789');
    await userEvent.upload(
      within(dlg).getByLabelText('Proof of transfer'),
      new File(['x'], 'p.png', { type: 'image/png' }),
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send for approval' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/payments/declared')?.body).toMatchObject({
        unitId: 312,
        method: 'NEFT',
        amountPaise: 800900,
        referenceNo: 'UTR123456789',
        fileIds: [55],
      }),
    );
    expect(await screen.findByText(/committee will check your transfer/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows DUPLICATE_REFERENCE in plain words', async () => {
    configureFileUploader({ upload: async () => ({ fileId: 55 }) });
    show(base({ 'POST /me/payments/declared': err(409, 'DUPLICATE_REFERENCE') }));
    await screen.findAllByTestId('pay-row');
    await userEvent.click(screen.getByRole('button', { name: 'Pay offline' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'I paid by bank transfer' }));
    await userEvent.type(within(dlg).getByLabelText('UTR or reference number'), 'UTR123456789');
    await userEvent.upload(
      within(dlg).getByLabelText('Proof of transfer'),
      new File(['x'], 'p.png', { type: 'image/png' }),
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send for approval' }));
    expect(await within(dlg).findByText('This reference number was already recorded.')).toBeInTheDocument();
  });
});

describe('Pay list from a collection', () => {
  it('ticks the collection request named in the address and nothing else', async () => {
    search.current = new URLSearchParams('unitId=312&requestId=2201');
    show(base());
    const rows = await screen.findAllByTestId('pay-row');
    const ganesh = rows.find(r => r.textContent?.includes('Ganesh'))!;
    expect(within(ganesh).getByRole('checkbox')).toBeChecked();
    expect(rows.filter(r => within(r).getByRole('checkbox').hasAttribute('checked'))).toHaveLength(1);
    expect(screen.getByTestId('pay-total')).toHaveTextContent('₹1,100');
  });

  it('says Any amount for a voluntary collection with no suggested amount', async () => {
    const raw = payablesRaw();
    (raw.items as Record<string, unknown>[])[0] = {
      ...(raw.items as Record<string, unknown>[])[0],
      suggestedPaise: 0,
    };
    show(base({}, raw));
    const rows = await screen.findAllByTestId('pay-row');
    expect(rows.find(r => r.textContent?.includes('Ganesh'))).toHaveTextContent('Any amount');
    expect(screen.queryByText(/Suggested ₹0/)).toBeNull();
  });
});
