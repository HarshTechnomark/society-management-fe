import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router, search } from '@/test/helpers';
import { visibleResidentNav } from '@/components/residents/app/ResidentNav';
import { ToastProvider } from '@/components/ui/Toast';
import { getMe } from '@/lib/auth';
import { PAY_PERMS, collectionRaw, duesRaw, paidOrderRaw, paymentRaw } from '@/test/paymentsResidentFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { AdvanceScreen } from './AdvanceScreen';
import { CollectionDetailScreen } from './CollectionDetailScreen';
import { CollectionsScreen } from './CollectionsScreen';
import { PayStatusScreen } from './PayStatusScreen';
import { ReceiptsScreen } from './ReceiptsScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const tabs: Routes = { 'GET /me/autopay-mandates': ok([]) };
function show(ui: React.ReactElement, routes: Routes, perms = PAY_PERMS) {
  signInAs(perms, []);
  const api = mockApi({ ...tabs, ...routes });
  render(<ToastProvider>{ui}</ToastProvider>);
  return api;
}
beforeEach(resetAll);

describe('resident menu', () => {
  it('has a Pay item for people who can view payments', () => {
    signInAs(PAY_PERMS, []);
    const item = visibleResidentNav(getMe()).find(i => i.label === 'Pay');
    expect(item?.href).toBe('/resident/pay');
    signInAs(['resident.home.view'], []);
    expect(visibleResidentNav(getMe()).some(i => i.label === 'Pay')).toBe(false);
  });
});

describe('Status page', () => {
  const fast = { pollMs: 10, maxPollMs: 60 };
  it('says Confirming, never failed, while the order is pending, and then shows success after a poll', async () => {
    show(<PayStatusScreen orderId={4412} pollMs={10} maxPollMs={5000} />, {
      'GET /me/payment-orders/4412': [
        ok({ orderId: 4412, status: 'ATTEMPTED', payment: null }),
        ok(paidOrderRaw()),
      ],
    });
    expect(await screen.findByRole('heading', { name: 'Confirming your payment' })).toBeInTheDocument();
    expect(screen.queryByText(/did not go through/i)).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeInTheDocument();
  });

  it('says the payment failed (not Confirming) when the server reports a failed attempt, and Try again frees the order', async () => {
    const api = show(<PayStatusScreen orderId={4412} {...fast} />, {
      'GET /me/payment-orders/4412': ok({
        orderId: 4412,
        status: 'ATTEMPTED',
        payment: null,
        failureReason: 'The bank declined the payment.',
      }),
      'POST /me/payment-orders/4412/cancel': ok({ orderId: 4412, status: 'CANCELLED', payment: null }),
    });
    expect(await screen.findByRole('heading', { name: 'Payment failed' })).toBeInTheDocument();
    expect(screen.getByText(/The bank declined the payment/)).toBeInTheDocument();
    expect(screen.queryByText(/You do not need to pay again/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Confirming your payment' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.last('POST', '/me/payment-orders/4412/cancel')).toBeTruthy());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/pay'));
  });

  it('shows the failed state right after the checkout said so (?failed=1) and offers another method', async () => {
    search.current = new URLSearchParams('failed=1');
    show(<PayStatusScreen orderId={4412} {...fast} />, {
      'GET /me/payment-orders/4412': ok({ orderId: 4412, status: 'ATTEMPTED', payment: null }),
      'POST /me/payment-orders/4412/cancel': ok({ orderId: 4412, status: 'CANCELLED', payment: null }),
    });
    expect(await screen.findByRole('heading', { name: 'Payment failed' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose another method' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/pay'));
  });

  it('Check again fetches the order again and says what it found', async () => {
    const api = show(<PayStatusScreen orderId={4412} pollMs={100000} maxPollMs={500000} />, {
      'GET /me/payment-orders/4412': ok({ orderId: 4412, status: 'CREATED', payment: null }),
    });
    await screen.findByRole('heading', { name: 'Confirming your payment' });
    const before = api.fn.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText(/Checked just now/)).toBeInTheDocument();
    expect(api.fn.mock.calls.length).toBeGreaterThan(before);
  });

  it('shows success with the receipt number, lines and a receipt download', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const api = show(<PayStatusScreen orderId={4412} {...fast} />, {
      'GET /me/payment-orders/4412': ok(paidOrderRaw()),
      'GET /me/payments/7781/receipt-url': ok({ url: 'https://files/r.pdf', expiresAt: null }),
    });
    expect(await screen.findByText('₹8,009 added to Sky Heights CHS account')).toBeInTheDocument();
    expect(screen.getByText('RCT/2026-27/000046')).toBeInTheDocument();
    const lines = within(screen.getByRole('list', { name: 'Paid for' }));
    expect(lines.getByText('INV/2026-27/000123')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download receipt' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files/r.pdf', '_blank', 'noopener'));
    expect(api.last('GET', '/me/payments/7781/receipt-url')).toBeTruthy();
    open.mockRestore();
  });

  it('says in plain words when the receipt is not ready', async () => {
    show(<PayStatusScreen orderId={4412} {...fast} />, {
      'GET /me/payment-orders/4412': ok(paidOrderRaw()),
      'GET /me/payments/7781/receipt-url': err(409, 'RECEIPT_NOT_READY'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Download receipt' }));
    expect(
      await screen.findByText('The receipt is not ready yet. Try again in a few minutes.'),
    ).toBeInTheDocument();
  });

  it('shows Failed with a retry link for a failed order', async () => {
    show(<PayStatusScreen orderId={4412} {...fast} />, {
      'GET /me/payment-orders/4412': ok({ orderId: 4412, status: 'FAILED', payment: null }),
    });
    expect(await screen.findByRole('heading', { name: 'Payment did not go through' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/resident/pay');
    expect(screen.getByRole('link', { name: 'Use another method' })).toBeInTheDocument();
  });

  it('keeps saying Confirming with a calm note when polling runs out', async () => {
    show(<PayStatusScreen orderId={4412} {...fast} />, {
      'GET /me/payment-orders/4412': ok({ orderId: 4412, status: 'CREATED', payment: null }),
    });
    expect(await screen.findByText(/taking longer than usual/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirming your payment' })).toBeInTheDocument();
  });

  it('cancels a pending payment', async () => {
    show(<PayStatusScreen orderId={4412} pollMs={5000} maxPollMs={60000} />, {
      'GET /me/payment-orders/4412': ok({ orderId: 4412, status: 'CREATED', payment: null }),
      'POST /me/payment-orders/4412/cancel': ok({ orderId: 4412, status: 'CANCELLED', payment: null }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel this payment' }));
    expect(await screen.findByRole('heading', { name: 'Payment cancelled' })).toBeInTheDocument();
  });

  it('shows an unknown order in plain words', async () => {
    show(<PayStatusScreen orderId={1} {...fast} />, {
      'GET /me/payment-orders/1': err(404, 'PAYMENT_ORDER_NOT_FOUND'),
    });
    expect(await screen.findByText('This payment was not found.')).toBeInTheDocument();
  });
});

describe('Receipts', () => {
  it('groups payments by month and downloads a receipt', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    show(<ReceiptsScreen />, {
      'GET /me/dues': ok(duesRaw()),
      'GET /me/payments': ok(
        [
          paymentRaw(),
          paymentRaw({
            id: 7700,
            paymentDate: '2026-10-05',
            receiptNo: 'RCT/2026-27/000030',
            amountPaise: 500000,
            grossAmountPaise: 500000,
          }),
          paymentRaw({
            id: 7701,
            paymentDate: '2026-10-02',
            receiptNo: null,
            status: 'PENDING_APPROVAL',
            method: 'NEFT',
          }),
        ],
        'OK',
        { pagination: { page: 1, limit: 30, total: 3, totalPages: 1 } },
      ),
      'GET /me/payments/7781/receipt-url': ok({ url: 'https://files/r.pdf', expiresAt: null }),
    });
    expect(await screen.findByRole('region', { name: 'November 2026' })).toBeInTheDocument();
    const oct = screen.getByRole('region', { name: 'October 2026' });
    expect(within(oct).getAllByTestId('receipt-row')).toHaveLength(2);
    expect(within(oct).getByText('Waiting for approval')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download receipt RCT/2026-27/000046' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files/r.pdf', '_blank', 'noopener'));
    open.mockRestore();
  });

  it('shows an empty state and filters by flat', async () => {
    const api = show(<ReceiptsScreen />, {
      'GET /me/dues': ok(duesRaw()),
      'GET /me/payments': ok([], 'OK', { pagination: { page: 1, limit: 30, total: 0, totalPages: 1 } }),
    });
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Flat'), '313');
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('unitId=313'))).toBe(true));
  });
});

describe('Advance', () => {
  it('shows codes as words and hides the internal payment number', async () => {
    show(<AdvanceScreen />, {
      'GET /me/dues': ok(duesRaw()),
      'GET /me/advances': ok({
        unitId: 312,
        balancePaise: 100,
        entries: [
          {
            id: 3,
            entryType: 'PAYMENT_EXCESS',
            amountPaise: 100,
            balanceAfterPaise: 100,
            narration: 'Advance from payment #45',
            createdAt: '2026-11-10',
          },
          {
            id: 2,
            entryType: 'REFUND_HOLD',
            amountPaise: -50,
            balanceAfterPaise: 0,
            narration: '',
            createdAt: '2026-11-09',
          },
        ],
      }),
    });
    await screen.findByTestId('advance-balance');
    const list = screen.getByRole('list', { name: 'Advance history' });
    expect(list).toHaveTextContent('Excess of a payment');
    expect(list).toHaveTextContent('Refund held');
    expect(list).not.toHaveTextContent('PAYMENT_EXCESS');
    expect(list).not.toHaveTextContent('Advance from payment #45');
  });

  it('shows the balance and the history newest first', async () => {
    show(<AdvanceScreen />, {
      'GET /me/dues': ok(duesRaw()),
      'GET /me/advances': ok({
        unitId: 312,
        balancePaise: 250000,
        entries: [
          {
            id: 2,
            entryType: 'DEBIT',
            amountPaise: 100000,
            balanceAfterPaise: 250000,
            narration: 'Nov bill',
            createdAt: '2026-11-10',
          },
          {
            id: 1,
            entryType: 'CREDIT',
            amountPaise: 350000,
            balanceAfterPaise: 350000,
            narration: '',
            createdAt: '2026-11-01',
          },
        ],
      }),
    });
    expect(await screen.findByTestId('advance-balance')).toHaveTextContent('₹2,500');
    const items = within(screen.getByRole('list', { name: 'Advance history' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Used on a bill');
    expect(items[1]).toHaveTextContent('Money added');
  });
});

describe('Collections', () => {
  it('shows a card per collection with progress, my request and a Pay link', async () => {
    show(<CollectionsScreen />, {
      'GET /me/collections': ok([
        collectionRaw(),
        collectionRaw({ id: 10, title: 'Lift repair', status: 'CLOSED', myRequests: [] }),
      ]),
    });
    const cards = await screen.findAllByTestId('collection-card');
    expect(cards).toHaveLength(2);
    expect(
      within(cards[0]).getByRole('progressbar', { name: 'Collected for Ganesh Utsav 2026' }),
    ).toHaveAttribute('aria-valuenow', '25');
    expect(within(cards[0]).getByText('₹50,000 of ₹2,00,000 · 25%')).toBeInTheDocument();
    const pay = within(cards[0]).getByRole('link', { name: 'Pay Ganesh Utsav 2026 for C-0801' });
    expect(pay).toHaveAttribute('href', '/resident/pay?unitId=312&requestId=2201');
    expect(within(cards[1]).getByText('Closed')).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('link', { name: /^Pay/ })).toBeNull();
  });

  it('asks about AutoPay once per session', async () => {
    const api = show(<CollectionsScreen />, {
      'GET /me/autopay-mandates': err(422, 'AUTOPAY_NOT_AVAILABLE'),
      'GET /me/collections': ok([]),
    });
    await screen.findByText('No collections');
    const asked = () => api.fn.mock.calls.filter(c => String(c[0]).includes('/me/autopay-mandates')).length;
    expect(asked()).toBe(1);
    render(
      <ToastProvider>
        <ReceiptsScreen />
      </ToastProvider>,
    );
    await waitFor(() => expect(api.fn.mock.calls.length).toBeGreaterThan(2));
    expect(asked()).toBe(1);
  });

  it('shows an empty state', async () => {
    show(<CollectionsScreen />, { 'GET /me/collections': ok([]) });
    expect(await screen.findByText('No collections')).toBeInTheDocument();
  });

  it('detail shows who paid with amounts at the amounts privacy level, and spending', async () => {
    show(<CollectionDetailScreen id={9} />, {
      'GET /me/collections/9': ok({
        ...collectionRaw(),
        whoPaid: [{ unitLabel: 'A-101', paidPaise: 110000 }],
        spentPaise: 300000,
        expenses: [{ title: 'Idol', category: 'Decoration', date: '2026-11-05', amountPaise: 300000 }],
      }),
    });
    const who = within(await screen.findByRole('list', { name: 'Who has paid' }));
    expect(who.getByText('A-101')).toBeInTheDocument();
    expect(who.getByText('₹1,100')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Spending' })).getByText('Idol')).toBeInTheDocument();
    expect(screen.getByText('12 of 48 flats have paid.')).toBeInTheDocument();
  });

  it('detail hides the who-paid list when the society hides it, and names only flats at the flats level', async () => {
    show(<CollectionDetailScreen id={9} />, {
      'GET /me/collections/9': ok({
        ...collectionRaw({ contributorCount: undefined, requestCount: undefined }),
      }),
    });
    await screen.findByRole('heading', { name: 'Ganesh Utsav 2026' });
    expect(screen.queryByText('Who has paid')).toBeNull();
    expect(screen.queryByText(/flats have paid/)).toBeNull();
    expect(screen.queryByText('How the money was used')).toBeNull();
  });

  it('detail shows flats only without amounts', async () => {
    show(<CollectionDetailScreen id={9} />, {
      'GET /me/collections/9': ok({ ...collectionRaw(), whoPaid: [{ unitLabel: 'B-202' }] }),
    });
    const who = within(await screen.findByRole('list', { name: 'Who has paid' }));
    expect(who.getByText('B-202')).toBeInTheDocument();
    expect(who.queryByText(/₹/)).toBeNull();
  });

  it('detail shows COLLECTION_NOT_FOUND in plain words, with a way back and no retry', async () => {
    show(<CollectionDetailScreen id={9} />, { 'GET /me/collections/9': err(404, 'COLLECTION_NOT_FOUND') });
    expect(await screen.findByText('This collection was not found.')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('link', { name: 'All collections' })).toHaveAttribute(
      'href',
      '/resident/pay/collections',
    );
  });

  it('says Any amount (not ₹0) for a voluntary request and keeps the Pay link', async () => {
    show(<CollectionDetailScreen id={9} />, {
      'GET /me/collections/9': ok(
        collectionRaw({
          requestCount: 1,
          contributorCount: 1,
          myRequests: [
            { id: 2201, unitId: 312, unitLabel: 'C-0801', status: 'OPEN', amountPaise: 0, paidPaise: 0 },
          ],
        }),
      ),
    });
    expect(await screen.findByText('Any amount')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 flat has paid.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay for C-0801' })).toHaveAttribute(
      'href',
      '/resident/pay?unitId=312&requestId=2201',
    );
  });
});
