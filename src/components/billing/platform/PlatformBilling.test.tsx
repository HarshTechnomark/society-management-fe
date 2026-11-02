import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureApiClient } from '@/lib/apiClient';
import { setMe } from '@/lib/auth';
import { approval, detail, listItem, pagination, pay } from '@/test/billingFixtures';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { PlatformBillingScreen } from './PlatformBillingScreen';

const VIEW = 'platform.billing.view';
const EDIT = 'platform.billing.edit';
const APPROVE = 'platform.billing.approve';
const EXPORT = 'platform.billing.export';

const mount = (perms = [VIEW, EDIT, APPROVE, EXPORT]) => {
  setMe(sampleMe({ platformPermissions: perms }));
  return render(
    <ToastProvider>
      <PlatformBillingScreen />
    </ToastProvider>,
  );
};
const list = (items: unknown[]) => ok(items, 'OK', { pagination: pagination(items.length) });
const urls = (fn: ReturnType<typeof mockApi>['fn']) => fn.mock.calls.map(c => String(c[0]));
const headersOf = (fn: ReturnType<typeof mockApi>['fn'], method: string, path: string) =>
  fn.mock.calls.find(c => String(c[0]).includes(path) && (c[1] as RequestInit).method === method)?.[1] as
    { headers: Record<string, string> } | undefined;

beforeEach(resetAll);

describe('Invoices tab (spec 11.1)', () => {
  const routes = (extra = {}) => ({
    'GET /platform/invoices': list([
      listItem(),
      listItem({ id: 7713, invoiceNo: 'PLT/2026-27/000185', status: 'PAID', amountDuePaise: 0 }),
    ]),
    'GET /platform/invoices/7712': ok(detail()),
    ...extra,
  });

  it('lists invoices with Remind and Record payment only for open invoices and editors', async () => {
    mockApi(routes());
    mount();
    expect(await screen.findByText('PLT/2026-27/000184')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remind/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Record payment for/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('hides edit and export actions for view only users', async () => {
    mockApi(routes());
    mount([VIEW]);
    await screen.findByText('PLT/2026-27/000184');
    expect(screen.queryByRole('button', { name: /^Remind/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New invoice' })).toBeNull();
  });

  it('shows an access message without the view permission', async () => {
    mockApi(routes());
    mount([]);
    expect(await screen.findByText('You do not have access to billing')).toBeInTheDocument();
  });

  it('sends the search text and status filter to the API', async () => {
    const api = mockApi(routes());
    mount();
    await screen.findByText('PLT/2026-27/000184');
    await userEvent.type(screen.getByLabelText('Search invoice number or society'), 'Sky');
    await userEvent.click(screen.getByRole('button', { name: 'Overdue' }));
    await waitFor(() => {
      const last = urls(api.fn)
        .filter(u => u.includes('/platform/invoices?'))
        .pop()!;
      expect(last).toContain('q=Sky');
      expect(last).toContain('status=OVERDUE');
    });
  });

  it('opens the drawer with lines, CGST and SGST, SAC and the supplier', async () => {
    mockApi(routes());
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Open PLT/2026-27/000184' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText(/Premium plan, 420 flats/)).toBeInTheDocument();
    expect(within(dlg).getByText('CGST 9%')).toBeInTheDocument();
    expect(within(dlg).getByText('SGST 9%')).toBeInTheDocument();
    expect(within(dlg).getByText(/same state as supplier/)).toBeInTheDocument();
    expect(within(dlg).getByText('27ABCDE1234F1Z5')).toBeInTheDocument();
    expect(within(dlg).getByText('998314')).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Issue credit note' })).toBeInTheDocument();
  });

  it('shows IGST for an inter-state supply and the payments, credit notes and dunning timeline', async () => {
    mockApi(
      routes({
        'GET /platform/invoices/7712': ok(
          detail({
            taxType: 'INTER_STATE',
            igstPaise: 200926,
            cgstPaise: 0,
            sgstPaise: 0,
            payments: [
              {
                id: 1,
                status: 'CAPTURED',
                method: 'NEFT',
                amountPaise: 45312,
                bankReference: 'UTR1',
              },
            ],
            creditNotes: [{ id: 3, invoiceNo: 'PCN/2026-27/000001', status: 'ISSUED', totalPaise: 1000 }],
            dunningEvents: [{ eventType: 'REMINDER_SENT', createdAt: '2026-11-09T00:00:00Z' }],
          }),
        ),
      }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Open PLT/2026-27/000184' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('IGST 18%')).toBeInTheDocument();
    expect(within(dlg).getByText(/inter-state supply/)).toBeInTheDocument();
    expect(within(dlg).getByText(/UTR1/)).toBeInTheDocument();
    expect(within(dlg).getByText('PCN/2026-27/000001')).toBeInTheDocument();
    expect(within(dlg).getByText('reminder sent')).toBeInTheDocument();
  });

  it('records a payment: no cash, checks the reference, sends it for approval with an idempotency key', async () => {
    const api = mockApi(routes({ 'POST /platform/payments': ok({ id: 9350, status: 'PENDING_APPROVAL' }) }));
    mount();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Record payment for PLT/2026-27/000184' }),
    );
    const dlg = await screen.findByRole('dialog');
    const method = within(dlg).getByLabelText('Payment method') as HTMLSelectElement;
    expect([...method.options].map(o => o.value)).toEqual(['NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'UPI', 'DD']);
    expect(within(dlg).getByLabelText(/Amount/)).toHaveValue('12671.78');
    await userEvent.selectOptions(method, 'CHEQUE');
    await userEvent.type(within(dlg).getByLabelText(/Reference number/), 'ABC123');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send for approval' }));
    expect(await within(dlg).findByText('A cheque or draft number has 6 digits.')).toBeInTheDocument();
    expect(api.calls.some(c => c.path === '/platform/payments')).toBe(false);
    await userEvent.clear(within(dlg).getByLabelText(/Reference number/));
    await userEvent.type(within(dlg).getByLabelText(/Reference number/), '123456');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send for approval' }));
    expect(await screen.findByText('Sent for approval.')).toBeInTheDocument();
    expect(api.last('POST', '/platform/payments')?.body).toMatchObject({
      societyId: 1,
      invoiceId: 7712,
      method: 'CHEQUE',
      amountPaise: 1267178,
      bankReference: '123456',
    });
    expect(headersOf(api.fn, 'POST', '/platform/payments')?.headers['Idempotency-Key']).toBeTruthy();
  });

  it('shows a plain message for a duplicate bank reference', async () => {
    mockApi(routes({ 'POST /platform/payments': err(409, 'DUPLICATE_BANK_REFERENCE') }));
    mount();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Record payment for PLT/2026-27/000184' }),
    );
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reference number/), 'UTR9999');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send for approval' }));
    expect(await within(dlg).findByText(/already recorded/)).toBeInTheDocument();
  });

  it('creates a credit note draft within the invoice value', async () => {
    const api = mockApi(routes({ 'POST /platform/invoices/7712/credit-notes': ok({ id: 8 }) }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Open PLT/2026-27/000184' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Issue credit note' }));
    const dlgs = await screen.findAllByRole('dialog');
    const dlg = dlgs[dlgs.length - 1];
    await userEvent.type(within(dlg).getByLabelText(/Amount before tax/), '99999999');
    await userEvent.type(within(dlg).getByLabelText(/Notes/), 'Price was wrong on the invoice');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save draft' }));
    expect(await within(dlg).findByText(/At most/)).toBeInTheDocument();
    await userEvent.clear(within(dlg).getByLabelText(/Amount before tax/));
    await userEvent.type(within(dlg).getByLabelText(/Amount before tax/), '384');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/invoices/7712/credit-notes')?.body).toMatchObject({
        reason: 'PRICE_CORRECTION',
        subtotalPaise: 38400,
      }),
    );
  });

  it('requests a write-off only with a reason of 10 characters', async () => {
    const api = mockApi(routes({ 'POST /platform/invoices/7712/write-off': ok({}) }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Open PLT/2026-27/000184' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Write off' }));
    const dlgs = await screen.findAllByRole('dialog');
    const dlg = dlgs[dlgs.length - 1];
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'too short');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request write-off' }));
    expect(await within(dlg).findByText(/at least 10/)).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), ' and longer');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request write-off' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/invoices/7712/write-off')?.body).toMatchObject({ version: 2 }),
    );
  });
});

describe('Approvals tab', () => {
  const open = async (items: unknown[], extra = {}) => {
    const api = mockApi({ 'GET /platform/billing/approvals': list(items), ...extra });
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Approvals' }));
    return api;
  };

  it('shows own items as waiting for another approver', async () => {
    await open([approval(), approval({ id: 2, canApprove: false, createdBy: { id: 1, name: 'Me' } })]);
    expect(await screen.findByText('Waiting for another approver')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Approve/ })).toHaveLength(1);
  });

  it('approves a manual payment; the step-up dialog opens through the API client and the call is retried', async () => {
    const stepUp = vi.fn(async () => true);
    const api = await open([approval()], {
      'POST /platform/payments/9350/approve': [err(401, 'REAUTH_REQUIRED'), ok({ status: 'CAPTURED' })],
    });
    configureApiClient({ stepUp });
    await userEvent.click(await screen.findByRole('button', { name: /^Approve Manual payment/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(stepUp).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Approved.')).toBeInTheDocument();
    expect(api.calls.filter(c => c.path === '/platform/payments/9350/approve')).toHaveLength(2);
    expect(api.last('POST', '/platform/payments/9350/approve')?.body).toEqual({ version: 1 });
  });

  it('uses the invoice, credit and write-off endpoints for the other types', async () => {
    const api = await open(
      [
        approval({ type: 'CREDIT_NOTE', id: 11 }),
        approval({ type: 'GOODWILL_CREDIT', id: 12 }),
        approval({ type: 'WRITE_OFF', id: 13 }),
      ],
      {
        'POST /platform/invoices/11/approve': ok({}),
        'POST /platform/credits/12/approve': ok({}),
        'POST /platform/invoices/13/write-off/approve': ok({}),
      },
    );
    for (const name of [/^Approve Credit note/, /^Approve Goodwill credit/, /^Approve Write-off/]) {
      await userEvent.click(await screen.findByRole('button', { name }));
      const dlg = await screen.findByRole('dialog');
      await userEvent.click(within(dlg).getByRole('button', { name: 'Approve' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    expect(api.calls.map(c => c.path)).toEqual(
      expect.arrayContaining([
        '/platform/invoices/11/approve',
        '/platform/credits/12/approve',
        '/platform/invoices/13/write-off/approve',
      ]),
    );
  });

  it('rejects with a reason and shows maker-checker errors in plain words', async () => {
    const api = await open([approval()], {
      'POST /platform/payments/9350/reject': [err(409, 'MAKER_CHECKER_VIOLATION'), ok({})],
    });
    await userEvent.click(await screen.findByRole('button', { name: /^Reject Manual payment/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Reference does not match bank');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText(/another person has to approve or reject/)).toBeInTheDocument();
    expect(api.last('POST', '/platform/payments/9350/reject')?.body).toEqual({
      version: 1,
      reason: 'Reference does not match bank',
    });
  });

  it('reads the current version first when the list item has none', async () => {
    const api = await open([approval({ version: undefined, type: 'MANUAL_INVOICE', id: 5 })], {
      'GET /platform/invoices/5': ok(detail({ id: 5, version: 7 })),
      'POST /platform/invoices/5/approve': ok({}),
    });
    await userEvent.click(await screen.findByRole('button', { name: /^Approve Manual invoice/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/invoices/5/approve')?.body).toEqual({ version: 7 }),
    );
  });

  it('shows an empty state', async () => {
    await open([]);
    expect(await screen.findByText('Nothing is waiting')).toBeInTheDocument();
  });
});

describe('Payments tab', () => {
  it('lists payments and lets an editor decide a TDS claim; rejection needs a reason', async () => {
    const api = mockApi({
      'GET /platform/payments': list([
        pay(),
        pay({
          id: 9420,
          kind: 'TDS',
          status: 'CLAIMED',
          tdsSection: '194J',
          method: 'TDS',
          amountPaise: 268000,
          version: 2,
        }),
      ]),
      'POST /platform/payments/9420/tds-decision': ok({}),
    });
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Payments' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Decide' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dlg).getByLabelText('Decision'), 'REJECTED');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject claim' }));
    expect(await within(dlg).findByText(/at least 10/)).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Certificate is for another PAN');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject claim' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/payments/9420/tds-decision')?.body).toEqual({
        decision: 'REJECTED',
        reason: 'Certificate is for another PAN',
        version: 2,
      }),
    );
  });

  it('completes a bank transfer refund', async () => {
    const api = mockApi({
      'GET /platform/payments': list([
        pay({ id: 77, kind: 'REFUND', status: 'PROCESSING', method: 'BANK_TRANSFER', version: 4 }),
      ]),
      'POST /platform/payments/77/complete-refund': ok({}),
    });
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Payments' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Complete refund' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Bank reference/), 'IMPS778899');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mark refunded' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/payments/77/complete-refund')?.body).toMatchObject({
        bankReference: 'IMPS778899',
        version: 4,
      }),
    );
  });
});

describe('Dunning tab', () => {
  const row = {
    societyId: 1,
    societyName: 'Sky Heights CHS',
    city: 'Pune',
    status: 'PAST_DUE',
    overduePaise: 1267178,
    overdueInvoiceCount: 1,
    oldestDueDate: '2026-10-16',
    daysLate: 16,
    lastStep: 'REMINDER +7',
    nextSuspensionDate: '2026-12-01',
    holdUntil: null,
    pendingManualPaymentPaise: 0,
  };

  it('shows the ladder text and the empty message', async () => {
    mockApi({ 'GET /platform/billing/dunning': list([]) });
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Dunning' }));
    expect(
      await screen.findByText(/Reminders 7 days before, on the due date, 3 and 7 days after/),
    ).toBeInTheDocument();
    expect(screen.getByText('Every society is paid up.')).toBeInTheDocument();
  });

  it('extends grace on the oldest overdue invoice of the society', async () => {
    const api = mockApi({
      'GET /platform/billing/dunning': list([row]),
      'GET /platform/invoices': list([listItem({ status: 'OVERDUE' })]),
      'GET /platform/invoices/7712': ok(detail({ status: 'OVERDUE' })),
      'POST /platform/invoices/7712/extend-grace': ok({}),
    });
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Dunning' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Extend grace for Sky Heights CHS' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dlg).getByLabelText('Days'), '14');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Treasurer is travelling');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Extend' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/invoices/7712/extend-grace')?.body).toEqual({
        days: 14,
        reason: 'Treasurer is travelling',
        version: 2,
      }),
    );
    expect(urls(api.fn).some(u => u.includes('societyId=1') && u.includes('status=OVERDUE'))).toBe(true);
  });

  it('shows Suspend only with the societies approve permission', async () => {
    mockApi({ 'GET /platform/billing/dunning': list([row]) });
    mount([VIEW, EDIT, 'platform.societies.approve']);
    await userEvent.click(screen.getByRole('tab', { name: 'Dunning' }));
    expect(await screen.findByRole('link', { name: 'Suspend Sky Heights CHS' })).toHaveAttribute(
      'href',
      '/platform/societies/1',
    );
  });
});

describe('Revenue and GST and TDS tabs', () => {
  it('shows the revenue tiles, ageing and top societies', async () => {
    mockApi({
      'GET /platform/billing/revenue': ok({
        asOf: '2026-10-30',
        mrrPaise: 41234500,
        arrPaise: 494814000,
        payingSocieties: 21,
        collectedThisMonthPaise: 38120055,
        billedThisMonthPaise: 41980400,
        outstandingPaise: 3860345,
        overduePaise: 1120400,
        gstThisMonthPaise: 6403790,
        creditBalancesPaise: 95312,
        mrrByPlan: [{ planKey: 'PREMIUM', mrrPaise: 19876000 }],
        ageing: {
          notDuePaise: 2739945,
          d1to15Paise: 820400,
          d16to30Paise: 300000,
          d31to60Paise: 0,
          over60Paise: 0,
        },
        series: [
          {
            month: '2026-10',
            startMrrPaise: 40100000,
            newPaise: 900000,
            expansionPaise: 384500,
            contractionPaise: 0,
            churnedPaise: 150000,
            endMrrPaise: 41234500,
            logoChurnPct: '4.76',
            revenueChurnPct: '0.37',
          },
        ],
        topSocieties: [{ societyId: 6, name: 'Orchid Residency', mrrPaise: 1116667 }],
      }),
    });
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Revenue' }));
    expect(await screen.findByText('ARR (run rate)')).toBeInTheDocument();
    expect(screen.getByText('91% of billed')).toBeInTheDocument();
    expect(screen.getByText('4.76%')).toBeInTheDocument();
    expect(screen.getByText('Orchid Residency')).toBeInTheDocument();
    expect(screen.getByText('1 to 15 days')).toBeInTheDocument();
  });

  it('shows GST rows, TDS rows and claims; CSV only with export', async () => {
    mockApi({
      'GET /platform/billing/gst-summary': ok([
        {
          supplyType: 'B2C',
          placeOfSupplyStateCode: '27',
          documentType: 'INVOICE',
          count: 10,
          taxablePaise: 1000000,
          cgstPaise: 90000,
          sgstPaise: 90000,
          igstPaise: 0,
        },
      ]),
      'GET /platform/billing/tds-receivable': ok([
        {
          societyId: 6,
          societyName: 'Orchid Residency',
          tdsSection: '194J',
          claimedPaise: 268000,
          verifiedPaise: 0,
          rejectedPaise: 0,
          missingCertificates: 1,
        },
      ]),
      'GET /platform/payments': list([pay({ id: 5, kind: 'TDS', status: 'CLAIMED', tdsSection: '194J' })]),
    });
    mount([VIEW, EDIT]);
    await userEvent.click(screen.getByRole('tab', { name: 'GST and TDS' }));
    expect(await screen.findByText('B2C · state 27')).toBeInTheDocument();
    expect(await screen.findByText('Orchid Residency')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Verify or reject TDS/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('shows an error state with the reference when revenue fails', async () => {
    mockApi({ 'GET /platform/billing/revenue': err(500, 'INTERNAL_ERROR') });
    mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Revenue' }));
    expect(await screen.findByText(/req_test/)).toBeInTheDocument();
  });
});
