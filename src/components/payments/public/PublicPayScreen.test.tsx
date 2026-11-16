import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { paidOrderRaw } from '@/test/paymentsResidentFixtures';
import { PublicPayLink } from './PublicPayLink';
import { PublicPayScreen } from './PublicPayScreen';

vi.mock('next/navigation', () => navigationMock());

const link = (over: Record<string, unknown> = {}) => ({
  societyName: 'Sky Heights CHS',
  unitLabel: 'A-1203',
  payerNameMasked: 'R*** S****',
  amountPaise: 910900,
  status: 'PAYABLE',
  expiresAt: '2026-12-20T00:00:00Z',
  ...over,
});
const code = 'AB12CD34EF';
beforeEach(resetAll);

describe('Public pay link', () => {
  it('shows society, flat, masked name and amount, with no navigation', async () => {
    mockApi({ [`GET /public/pay/${code}`]: ok(link()) });
    render(<PublicPayScreen code={code} token="tok" />);
    expect(await screen.findByText('Sky Heights CHS')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A-1203' })).toBeInTheDocument();
    expect(screen.getByText('For R*** S****')).toBeInTheDocument();
    expect(screen.getByTestId('link-amount')).toHaveTextContent('₹9,109');
    expect(screen.getByRole('button', { name: 'Pay securely' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('pays through the fake gateway test panel and shows the receipt', async () => {
    const api = mockApi({
      [`GET /public/pay/${code}`]: ok(link()),
      [`POST /public/pay/${code}/checkout`]: ok({ checkout: { order_id: 'order_pub1' } }),
      'POST /dev/payments/order_pub1/pay': ok({ gatewayPaymentId: 'pay_pub1234', status: 'captured' }),
      [`POST /public/pay/${code}/verify`]: ok(paidOrderRaw()),
    });
    render(<PublicPayScreen code={code} token="tok" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pay securely' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Pay (success)' }));
    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeInTheDocument();
    expect(screen.getByText('RCT/2026-27/000046')).toBeInTheDocument();
    expect(api.last('POST', `/public/pay/${code}/verify`)?.body).toEqual({
      token: 'tok',
      gatewayPaymentId: 'pay_pub1234',
    });
  });

  it('shows a real checkout as a UPI link on a phone-sized screen', async () => {
    mockApi({
      [`GET /public/pay/${code}`]: ok(link()),
      [`POST /public/pay/${code}/checkout`]: ok({
        checkout: { gatewayOrderId: 'o1', keyId: 'rzp', upiIntentUrl: 'upi://pay?pa=x' },
      }),
    });
    window.innerWidth = 400;
    render(<PublicPayScreen code={code} token="tok" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pay securely' }));
    expect(await screen.findByRole('link', { name: 'Open your UPI app' })).toHaveAttribute(
      'href',
      'upi://pay?pa=x',
    );
    expect(screen.queryByRole('region', { name: 'Test payment' })).toBeNull();
    window.innerWidth = 1024;
  });

  it('shows the paid state', async () => {
    mockApi({ [`GET /public/pay/${code}`]: ok(link({ status: 'PAID' })) });
    render(<PublicPayScreen code={code} token="tok" />);
    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay securely' })).toBeNull();
  });

  it.each([
    ['status EXPIRED', ok(link({ status: 'EXPIRED' }))],
    ['a 410 answer', err(410, 'PAYMENT_LINK_EXPIRED')],
  ])('shows the expired state for %s', async (_n, reply) => {
    mockApi({ [`GET /public/pay/${code}`]: reply });
    render(<PublicPayScreen code={code} token="tok" />);
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay securely' })).toBeNull();
  });

  it('shows a wrong link in plain words', async () => {
    mockApi({ [`GET /public/pay/${code}`]: err(404, 'PAYMENT_LINK_NOT_FOUND') });
    render(<PublicPayScreen code={code} token="bad" />);
    expect(await screen.findByText(/This payment link is not valid/)).toBeInTheDocument();
  });

  it('shows checkout errors in plain words', async () => {
    mockApi({
      [`GET /public/pay/${code}`]: ok(link()),
      [`POST /public/pay/${code}/checkout`]: err(422, 'GATEWAY_NOT_CONFIGURED'),
    });
    render(<PublicPayScreen code={code} token="tok" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pay securely' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not set up/));
  });
});

describe('Public pay link address', () => {
  it('reads the token the API puts after # (spec 8.24), even when it starts with a t', async () => {
    const api = mockApi({ [`GET /public/pay/${code}`]: ok(link()) });
    window.location.hash = '#tTokenValue123';
    render(<PublicPayLink code={code} />);
    expect(await screen.findByText('Sky Heights CHS')).toBeInTheDocument();
    const init = api.fn.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Pay-Token']).toBe('tTokenValue123');
    window.location.hash = '';
  });
});
