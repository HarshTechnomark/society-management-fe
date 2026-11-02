import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { entitlementsStore } from '@/lib/entitlements';
import * as checkout from '@/lib/gatewayCheckout';
import { configureFileUploader } from '@/lib/fileUpload';
import { detail, listItem, pagination, pay, summary } from '@/test/billingFixtures';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { setMe } from '@/lib/auth';
import { BillingSection } from './BillingSection';

const VIEW = 'settings.subscription.view';
const EDIT = 'settings.subscription.edit';

const mount = (perms = [VIEW, EDIT]) => {
  setMe(sampleMe({ permissions: perms }));
  return render(
    <ToastProvider>
      <BillingSection nextInvoiceDate="2026-12-01" />
    </ToastProvider>,
  );
};
const list = (items: unknown[]) => ok(items, 'OK', { pagination: pagination(items.length) });
const base = (extra = {}) => ({
  'GET /subscription/billing-summary': ok(summary()),
  'GET /subscription/invoices': list([listItem()]),
  'GET /subscription/invoices/7712': ok(detail()),
  ...extra,
});
const order = {
  paymentId: 9301,
  gatewayOrderId: 'order_PLT9301',
  amountPaise: 1267178,
  checkout: { key: 'rzp_test_x', order_id: 'order_PLT9301' },
  expiresAt: '2026-11-05T05:30:00.000Z',
};

beforeEach(() => {
  resetAll();
  configureFileUploader(null);
});

describe('billing summary and invoice list (spec 11.3)', () => {
  it('shows outstanding, overdue in red, credit, next invoice and autopay', async () => {
    mockApi(
      base({
        'GET /subscription/billing-summary': ok(
          summary({ overduePaise: 50000, creditBalancePaise: 10000, nextSuspensionDate: '2026-12-01' }),
        ),
      }),
    );
    mount();
    expect(await screen.findByText('Outstanding')).toBeInTheDocument();
    expect(screen.getAllByText('₹12,671.78').length).toBeGreaterThan(0);
    expect(screen.getByText('₹500')).toHaveClass('text-bad');
    expect(screen.getByText('₹100')).toBeInTheDocument();
    expect(screen.getByText('1 Dec 2026', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Not set up')).toBeInTheDocument();
    expect(screen.getByText(/Service is suspended on 1 Dec 2026/)).toBeInTheDocument();
  });

  it('shows a suspended notice and still works', async () => {
    mockApi(
      base({
        'GET /subscription/billing-summary': ok(summary({ societyStatus: 'SUSPENDED', overduePaise: 100 })),
      }),
    );
    mount();
    expect(await screen.findByText(/This society is suspended/)).toBeInTheDocument();
    expect(await screen.findByText('PLT/2026-27/000184')).toBeInTheDocument();
  });

  it('view only members see no Pay or Claim buttons', async () => {
    mockApi(base());
    mount([VIEW]);
    await screen.findByText('PLT/2026-27/000184');
    expect(screen.queryByRole('button', { name: /^Pay/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open PLT/2026-27/000184' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(within(dlg).queryByRole('button', { name: 'Pay' })).toBeNull();
    expect(within(dlg).queryByRole('button', { name: 'Claim TDS' })).toBeNull();
  });

  it('shows the empty state and the error state with a reference', async () => {
    mockApi(base({ 'GET /subscription/invoices': list([]) }));
    const { unmount } = mount();
    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
    unmount();
    mockApi(base({ 'GET /subscription/billing-summary': err(500, 'INTERNAL_ERROR') }));
    mount();
    expect(await screen.findByText(/req_test/)).toBeInTheDocument();
  });

  it('shows cards on a phone', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('max-width: 700px'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    mockApi(base());
    mount();
    expect(await screen.findByRole('list', { name: 'Invoices' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('opens the detail sheet with lines, GST and the settlement breakdown, and downloads the PDF', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mockApi(
      base({
        'GET /subscription/invoices/7712/pdf-url': ok({ url: 'https://storage/x.pdf', expiresAt: 'x' }),
      }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Open PLT/2026-27/000184' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText(/Premium plan, 420 flats/)).toBeInTheDocument();
    expect(within(dlg).getByText('CGST 9%')).toBeInTheDocument();
    expect(within(dlg).getByText('-₹500')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://storage/x.pdf', '_blank', 'noopener'));
  });

  it('says the PDF is not ready', async () => {
    mockApi(base({ 'GET /subscription/invoices/7712/pdf-url': err(409, 'PDF_NOT_READY') }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Open PLT/2026-27/000184' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByText(/still being prepared/)).toBeInTheDocument();
  });
});

describe('pay online', () => {
  const payVia = async (onPaid: boolean | 'dismiss' | 'failed') => {
    vi.spyOn(checkout, 'openCheckout').mockImplementation(async (_c, h) => {
      if (onPaid === true) h.onPaid('pay_ABCDEFGH12');
      else if (onPaid === 'failed') h.onFailed();
      else h.onDismiss();
    });
  };

  it('creates the order with an idempotency key, opens the checkout and shows the verified result', async () => {
    await payVia(true);
    const api = mockApi(
      base({
        'POST /subscription/invoices/7712/payment-orders': ok(order),
        'POST /subscription/payments/9301/verify': ok({
          paymentId: 9301,
          status: 'CAPTURED',
          invoice: { id: 7712, status: 'PAID', amountDuePaise: 0 },
        }),
      }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Pay PLT/2026-27/000184' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByLabelText(/Amount to pay/)).toHaveValue('12671.78');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Pay ₹12,671.78' }));
    expect(await within(dlg).findByText(/Payment received/)).toBeInTheDocument();
    expect(api.last('POST', '/subscription/invoices/7712/payment-orders')?.body).toEqual({});
    const init = api.fn.mock.calls.find(c => String(c[0]).includes('payment-orders'))![1] as {
      headers: Record<string, string>;
    };
    expect(init.headers['Idempotency-Key']).toBeTruthy();
    expect(api.last('POST', '/subscription/payments/9301/verify')?.body).toEqual({
      gatewayPaymentId: 'pay_ABCDEFGH12',
    });
  });

  it('Pay now pays the oldest open invoice', async () => {
    await payVia('dismiss');
    const api = mockApi(base({ 'POST /subscription/invoices/7712/payment-orders': ok(order) }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Pay now' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Pay PLT/2026-27/000184')).toBeInTheDocument();
    const q = api.fn.mock.calls
      .map(c => String(c[0]))
      .filter(u => u.includes('/subscription/invoices?'))
      .pop()!;
    expect(q).toContain('sortBy=dueDate');
    expect(q).toContain('sortOrder=asc');
  });

  it('sends a part payment amount', async () => {
    await payVia('dismiss');
    const api = mockApi(
      base({ 'POST /subscription/invoices/7712/payment-orders': ok({ ...order, amountPaise: 500000 }) }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Pay PLT/2026-27/000184' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.clear(within(dlg).getByLabelText(/Amount to pay/));
    await userEvent.type(within(dlg).getByLabelText(/Amount to pay/), '5000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Pay ₹5,000' }));
    await waitFor(() =>
      expect(api.last('POST', '/subscription/invoices/7712/payment-orders')?.body).toEqual({
        amountPaise: 500000,
      }),
    );
  });

  it('refuses an amount above what is due without calling the API', async () => {
    const api = mockApi(base());
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Pay PLT/2026-27/000184' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.clear(within(dlg).getByLabelText(/Amount to pay/));
    await userEvent.type(within(dlg).getByLabelText(/Amount to pay/), '99999');
    await userEvent.click(within(dlg).getByRole('button', { name: /^Pay/ }));
    expect(await within(dlg).findAllByText(/At most/)).not.toHaveLength(0);
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('shows a failed result and lets the person try again', async () => {
    await payVia(true);
    mockApi(
      base({
        'POST /subscription/invoices/7712/payment-orders': ok(order),
        'POST /subscription/payments/9301/verify': ok({
          paymentId: 9301,
          status: 'FAILED',
          invoice: { id: 7712, status: 'ISSUED', amountDuePaise: 1267178 },
        }),
      }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Pay PLT/2026-27/000184' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Pay/ }));
    expect(await screen.findByText(/did not go through/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows a waiting state when the gateway still reports pending and checks again', async () => {
    await payVia(true);
    const api = mockApi(
      base({
        'POST /subscription/invoices/7712/payment-orders': ok(order),
        'POST /subscription/payments/9301/verify': [
          ok({
            paymentId: 9301,
            status: 'CREATED',
            invoice: { id: 7712, status: 'ISSUED', amountDuePaise: 1267178 },
          }),
          ok({
            paymentId: 9301,
            status: 'CAPTURED',
            invoice: { id: 7712, status: 'PAID', amountDuePaise: 0 },
          }),
        ],
      }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Pay PLT/2026-27/000184' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Pay/ }));
    expect(await screen.findByText(/Waiting for your bank/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText(/Payment received/)).toBeInTheDocument();
    expect(api.calls.filter(c => c.path.endsWith('/verify'))).toHaveLength(2);
  });

  it('shows a mismatch as a plain error and a gateway failure as nothing charged', async () => {
    await payVia(true);
    mockApi(
      base({
        'POST /subscription/invoices/7712/payment-orders': ok(order),
        'POST /subscription/payments/9301/verify': err(422, 'PAYMENT_MISMATCH'),
      }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Pay PLT/2026-27/000184' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Pay/ }));
    expect(await screen.findByText(/different order or amount/)).toBeInTheDocument();
  });

  it('shows the gateway error when the order cannot be created', async () => {
    mockApi(base({ 'POST /subscription/invoices/7712/payment-orders': err(502, 'GATEWAY_ERROR') }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Pay PLT/2026-27/000184' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Pay/ }));
    expect(await screen.findByText(/Nothing was charged/)).toBeInTheDocument();
  });
});

describe('TDS claim', () => {
  const openClaim = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Open PLT/2026-27/000184' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Claim TDS' }));
    const dlgs = await screen.findAllByRole('dialog');
    return dlgs[dlgs.length - 1];
  };

  it('shows the cap, rejects more than 10% of taxable value and submits with an idempotency key', async () => {
    const api = mockApi(
      base({ 'POST /subscription/invoices/7712/tds-claims': ok({ id: 9420, status: 'CLAIMED' }) }),
    );
    mount();
    const dlg = await openClaim();
    expect(within(dlg).getByText(/max ₹1,116.25 \(10% of taxable value\)/)).toBeInTheDocument();
    expect(within(dlg).getByText(/File upload is not available yet/)).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/TDS amount/), '2000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit claim' }));
    expect((await within(dlg).findAllByText(/At most ₹1,116.25/)).length).toBeGreaterThan(0);
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.clear(within(dlg).getByLabelText(/TDS amount/));
    await userEvent.type(within(dlg).getByLabelText(/TDS amount/), '1000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit claim' }));
    await waitFor(() =>
      expect(api.last('POST', '/subscription/invoices/7712/tds-claims')?.body).toMatchObject({
        tdsSection: '194J',
        amountPaise: 100000,
      }),
    );
    const init = api.fn.mock.calls.find(c => String(c[0]).includes('tds-claims'))![1] as {
      headers: Record<string, string>;
    };
    expect(init.headers['Idempotency-Key']).toBeTruthy();
  });

  it('uploads the certificate through the adapter and sends its file id', async () => {
    configureFileUploader({ upload: async () => ({ fileId: 321 }) });
    const api = mockApi(
      base({ 'POST /subscription/invoices/7712/tds-claims': ok({ id: 9420, status: 'CLAIMED' }) }),
    );
    mount();
    const dlg = await openClaim();
    await userEvent.type(within(dlg).getByLabelText(/TDS amount/), '1000');
    await userEvent.upload(
      within(dlg).getByLabelText('TDS certificate'),
      new File(['x'], 'cert.pdf', { type: 'application/pdf' }),
    );
    await waitFor(() => expect(within(dlg).queryByText(/Uploading/)).toBeNull());
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit claim' }));
    await waitFor(() =>
      expect(api.last('POST', '/subscription/invoices/7712/tds-claims')?.body).toMatchObject({
        certificateFileId: 321,
      }),
    );
  });

  it('explains TDS_ALREADY_CLAIMED', async () => {
    mockApi(base({ 'POST /subscription/invoices/7712/tds-claims': err(409, 'TDS_ALREADY_CLAIMED') }));
    mount();
    const dlg = await openClaim();
    await userEvent.type(within(dlg).getByLabelText(/TDS amount/), '1000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit claim' }));
    expect(await within(dlg).findByText(/already exists/)).toBeInTheDocument();
  });

  it('attaches a certificate to a waiting claim from the Payments tab', async () => {
    configureFileUploader({ upload: async () => ({ fileId: 55 }) });
    const api = mockApi(
      base({
        'GET /subscription/payments': list([
          pay({ id: 9420, kind: 'TDS', status: 'CLAIMED', method: 'TDS', tdsSection: '194J', version: 2 }),
        ]),
        'PATCH /subscription/tds-claims/9420': ok({ id: 9420 }),
      }),
    );
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Payments' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Upload certificate' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.upload(
      within(dlg).getByLabelText(/Certificate/),
      new File(['x'], 'c.pdf', { type: 'application/pdf' }),
    );
    await waitFor(() => expect(within(dlg).queryByText(/Uploading/)).toBeNull());
    await userEvent.click(within(dlg).getByRole('button', { name: 'Attach certificate' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/subscription/tds-claims/9420')?.body).toEqual({
        certificateFileId: 55,
        version: 2,
      }),
    );
  });
});

describe('payments, credits and autopay', () => {
  it('lists payments, TDS claims and refunds', async () => {
    mockApi(
      base({
        'GET /subscription/payments': list([pay(), pay({ id: 2, kind: 'REFUND', status: 'REFUNDED' })]),
      }),
    );
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Payments' }));
    expect(await screen.findByText('Refund')).toBeInTheDocument();
    expect(screen.getAllByText('Payment').length).toBeGreaterThan(0);
  });

  it('shows the credit ledger and balance', async () => {
    mockApi(
      base({
        'GET /subscription/credits': ok(
          {
            balancePaise: 50000,
            items: [
              {
                id: 1,
                entryType: 'GOODWILL',
                status: 'POSTED',
                amountPaise: 50000,
                balanceAfterPaise: 50000,
                invoiceNo: null,
                reason: 'Outage',
                postedAt: '2026-10-01',
              },
            ],
          },
          'OK',
          { pagination: pagination(1) },
        ),
      }),
    );
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Credits' }));
    expect(await screen.findByText('Goodwill credit')).toBeInTheDocument();
    expect(screen.getByText('Outage')).toBeInTheDocument();
    expect(await screen.findByText('₹500', { selector: 'b' })).toBeInTheDocument();
  });

  it('hides the autopay card when the flag is off', async () => {
    mockApi(base());
    mount();
    await screen.findByText('Outstanding');
    expect(screen.queryByText('Autopay', { selector: 'h2' })).toBeNull();
  });

  it('sets up autopay and goes to the bank with the returned URL; cancels with a reason', async () => {
    entitlementsStore.set({
      planCode: 'PREMIUM',
      status: 'ACTIVE',
      generation: 1,
      features: [],
      readOnlyFeatures: [],
      flags: { 'platform.autopay': true },
    });
    const redirect = vi.spyOn(checkout, 'redirectTo').mockImplementation(() => {});
    const api = mockApi(
      base({
        'POST /subscription/autopay': ok({ authUrl: 'https://bank/auth' }),
        'DELETE /subscription/autopay': ok(null),
      }),
    );
    const { unmount } = mount();
    await userEvent.click(await screen.findByRole('button', { name: /Set up UPI AutoPay/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Highest amount/), '20000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://bank/auth'));
    expect(api.last('POST', '/subscription/autopay')?.body).toEqual({
      method: 'UPI_AUTOPAY',
      maxAmountPaise: 2000000,
    });
    unmount();

    mockApi(
      base({
        'GET /subscription/billing-summary': ok(summary({ autopayStatus: 'ACTIVE' })),
        'DELETE /subscription/autopay': ok(null),
      }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel autopay' }));
    const c = await screen.findByRole('dialog');
    await userEvent.type(within(c).getByLabelText(/Reason/), 'switching bank');
    await userEvent.click(within(c).getByRole('button', { name: 'Cancel autopay' }));
    expect(await screen.findByText('Autopay cancelled.')).toBeInTheDocument();
  });
});
