import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { statement } from '@/test/ledgerFixtures';
import {
  INV_FEATURES,
  INV_PERMS,
  INV_VIEW_PERMS,
  detailRaw,
  lineRaw,
  noteRaw,
} from '@/test/billingInvoicesFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { InvoiceDrawer } from './InvoiceDrawer';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const UNPAID = detailRaw({
  status: 'ISSUED',
  paidPaise: 0,
  outstandingPaise: 1006100,
  payments: [],
});

function renderIt(
  detail: unknown = detailRaw(),
  routes: Routes = {},
  perms = INV_PERMS,
  features = INV_FEATURES,
) {
  signInAs(perms, features);
  const api = mockApi({ 'GET /invoices/5123': ok(detail), ...routes });
  const onChanged = vi.fn();
  render(
    <ToastProvider>
      <InvoiceDrawer id={5123} onClose={() => {}} onChanged={onChanged} />
    </ToastProvider>,
  );
  return { api, onChanged };
}
const btn = (name: string) => screen.findByRole('button', { name });
beforeEach(resetAll);

describe('Invoice drawer: reading', () => {
  it('shows header, lines, GST split, round off, payments and balance', async () => {
    renderIt();
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByText('Balance due');
    expect(dlg).toHaveTextContent('INV/2026-27/000201');
    expect(dlg).toHaveTextContent('C-0801 · Anil Deshmukh (Owner) · Nov 2026');
    expect(dlg).toHaveTextContent('Part paid');
    expect(dlg).toHaveTextContent('Due 10 Nov 2026');
    expect(within(dlg).getAllByTestId('invoice-line')).toHaveLength(2);
    expect(dlg).toHaveTextContent('CGST₹740.70');
    expect(dlg).toHaveTextContent('SGST₹740.70');
    expect(dlg).toHaveTextContent('Round off-₹0.40');
    expect(dlg).toHaveTextContent('Total₹10,061');
    expect(dlg).toHaveTextContent('RCT/2026-27/000310');
    expect(dlg).toHaveTextContent('Balance due₹5,061');
    expect(dlg).toHaveTextContent('27AAAAS1234A1Z5');
  });

  it('shows a skeleton first and an error with a retry', async () => {
    renderIt(undefined, { 'GET /invoices/5123': err(404, 'INVOICE_NOT_FOUND') });
    expect(await screen.findByText(/This invoice was not found/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the explanation of a line when the plan has explain my bill', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: /Maintenance: 2,150/ }));
    expect(screen.getByText('2,150 sq ft × ₹3.20 = ₹6,880.00')).toBeInTheDocument();
  });

  it('does not make lines tappable without explain my bill', async () => {
    renderIt(
      detailRaw(),
      {},
      INV_PERMS,
      INV_FEATURES.filter(f => f !== 'billing.explain_my_bill'),
    );
    await screen.findByText('Balance due');
    expect(screen.queryByRole('button', { name: /Maintenance: 2,150/ })).toBeNull();
  });

  it('lists notes with status in words and a link to approvals while one waits', async () => {
    renderIt(
      detailRaw({
        notes: [
          noteRaw(),
          noteRaw({ id: 612, noteNo: null, status: 'PENDING_APPROVAL', totalPaise: 2000000 }),
          noteRaw({
            id: 613,
            noteType: 'DEBIT',
            noteNo: 'DN/2026-27/000002',
            reasonCode: 'ADDITIONAL_CHARGE',
          }),
        ],
      }),
    );
    const rows = await screen.findAllByTestId('note-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('CN/2026-27/000017');
    expect(rows[0]).toHaveTextContent('Issued');
    expect(rows[1]).toHaveTextContent('Waiting for approval');
    expect(rows[2]).toHaveTextContent('Additional charge');
    expect(screen.getByRole('link', { name: 'Open the approvals page' })).toHaveAttribute(
      'href',
      expect.stringContaining('approvals'),
    );
  });

  it('shows a cancelled bill with no actions', async () => {
    renderIt(detailRaw({ status: 'CANCELLED', outstandingPaise: 0 }));
    await screen.findByText('Balance due');
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
    for (const n of ['Credit note', 'Debit note', 'Write off', 'Cancel invoice', 'Send reminder'])
      expect(screen.queryByRole('button', { name: n })).toBeNull();
  });
});

describe('Invoice drawer: actions by status, permission and plan', () => {
  it('offers everything on an unpaid bill', async () => {
    renderIt(UNPAID);
    for (const n of [
      'Download PDF',
      'Statement',
      'Send reminder',
      'Credit note',
      'Debit note',
      'Write off',
      'Cancel invoice',
    ])
      expect(await btn(n)).toBeInTheDocument();
  });

  it('does not offer cancel on a part paid bill, nor write-off on a paid one', async () => {
    renderIt();
    await btn('Write off');
    expect(screen.queryByRole('button', { name: 'Cancel invoice' })).toBeNull();
  });

  it('offers no write-off or reminder on a paid bill', async () => {
    renderIt(detailRaw({ status: 'PAID', outstandingPaise: 0, paidPaise: 1006100 }));
    await btn('Credit note');
    expect(screen.queryByRole('button', { name: 'Write off' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send reminder' })).toBeNull();
  });

  it('hides write actions for a viewer', async () => {
    renderIt(UNPAID, {}, INV_VIEW_PERMS);
    await btn('Download PDF');
    for (const n of ['Credit note', 'Debit note', 'Write off', 'Cancel invoice', 'Send reminder'])
      expect(screen.queryByRole('button', { name: n })).toBeNull();
  });

  it('hides gated actions when the plan lacks them', async () => {
    renderIt(UNPAID, {}, INV_PERMS, []);
    await screen.findByText('Balance due');
    for (const n of ['Download PDF', 'Statement', 'Credit note', 'Debit note', 'Write off', 'Cancel invoice'])
      expect(screen.queryByRole('button', { name: n })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send reminder' })).toBeInTheDocument();
  });

  it('disables the PDF button while it is not ready', async () => {
    renderIt(detailRaw({ pdfStatus: 'PENDING' }));
    expect(await btn('Download PDF')).toBeDisabled();
  });

  it('downloads the PDF through the signed url', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { api } = renderIt(detailRaw(), {
      'GET /invoices/5123/pdf-url': ok({ url: 'https://f/x.pdf', expiresAt: 'z' }),
    });
    await userEvent.click(await btn('Download PDF'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(api.calls.some(c => c.path === '/invoices/5123/pdf-url')).toBe(true);
    click.mockRestore();
  });

  it('explains PDF_NOT_READY', async () => {
    renderIt(detailRaw(), { 'GET /invoices/5123/pdf-url': err(409, 'PDF_NOT_READY') });
    await userEvent.click(await btn('Download PDF'));
    expect(await screen.findByText(/PDF of this bill is not ready/)).toBeInTheDocument();
  });

  it('opens the statement of the flat and comes back', async () => {
    renderIt(detailRaw(), { 'GET /billing/units/312/statement': ok(statement()) });
    await userEvent.click(await btn('Statement'));
    expect(await screen.findByRole('dialog', { name: /Statement of account, C-0801/ })).toBeInTheDocument();
  });

  it('sends a reminder, and explains REMINDER_TOO_SOON', async () => {
    const { api } = renderIt(UNPAID, {
      'POST /invoices/5123/remind': [err(409, 'REMINDER_TOO_SOON'), ok({})],
    });
    await userEvent.click(await btn('Send reminder'));
    expect(await screen.findByText(/reminder was sent in the last 24 hours/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send reminder' }));
    expect(await screen.findByText('Reminder sent')).toBeInTheDocument();
    expect(api.calls.filter(c => c.path === '/invoices/5123/remind')).toHaveLength(2);
  });
});

describe('Invoice drawer: credit note', () => {
  const open = async (routes: Routes = {}, detail: unknown = UNPAID) => {
    const r = renderIt(detail, routes);
    await userEvent.click(await btn('Credit note'));
    return { ...r, dlg: await screen.findByRole('dialog', { name: /Credit note for/ }) };
  };

  it('lists creditable lines with their maximum and totals with a tax estimate', async () => {
    const { dlg } = await open();
    const lines = within(dlg).getAllByTestId('credit-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('Max ₹6,880');
    await userEvent.type(within(dlg).getByLabelText(/Credit for Maintenance/), '1000');
    expect(dlg).toHaveTextContent('Credit₹1,000');
    expect(dlg).toHaveTextContent('GST (estimate)₹180');
    expect(dlg).toHaveTextContent('Total credit₹1,180');
    expect(dlg).toHaveTextContent('Needs approval above ₹10,000');
  });

  it('leaves out fully credited lines and lines of other kinds', async () => {
    const { dlg } = await open(
      {},
      detailRaw({
        lines: [lineRaw({ creditedPaise: 688000 }), lineRaw({ id: 2, description: 'Sinking fund' })],
      }),
    );
    expect(within(dlg).getAllByTestId('credit-line')).toHaveLength(1);
  });

  it('adds issued debit-note lines to the creditable lines', async () => {
    const { dlg } = await open(
      {},
      detailRaw({
        notes: [
          noteRaw({
            noteType: 'DEBIT',
            noteNo: 'DN/2026-27/000002',
            lines: [lineRaw({ id: 777, description: 'Penalty', amountPaise: 50000 })],
          }),
        ],
      }),
    );
    expect(within(dlg).getAllByTestId('credit-line')).toHaveLength(3);
    expect(dlg).toHaveTextContent('DN/2026-27/000002');
  });

  it('says a big note needs approval', async () => {
    const { dlg } = await open({}, detailRaw({ lines: [lineRaw({ amountPaise: 2000000 })] }));
    await userEvent.type(within(dlg).getByLabelText(/Credit for Maintenance/), '11000');
    expect(dlg).toHaveTextContent('needs approval from another committee member');
  });

  it('checks the form before sending', async () => {
    const { dlg, api } = await open();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create credit note' }));
    expect(await within(dlg).findByText('Enter an amount for at least one line.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Credit for Maintenance/), '99999');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create credit note' }));
    expect(await within(dlg).findByText(/above its maximum of ₹6,880/)).toBeInTheDocument();
    await userEvent.clear(within(dlg).getByLabelText(/Credit for Maintenance/));
    await userEvent.type(within(dlg).getByLabelText(/Credit for Maintenance/), '10');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create credit note' }));
    expect(await within(dlg).findByText(/remarks in 5 to 500/)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('sends the note with an idempotency key and shows waiting for approval', async () => {
    const { api, onChanged, dlg } = await open({
      'POST /invoices/5123/credit-notes': ok(noteRaw({ status: 'PENDING_APPROVAL', noteNo: null }), 'ok'),
    });
    await userEvent.selectOptions(within(dlg).getByLabelText(/^Reason/), 'DISPUTE_RESOLUTION');
    await userEvent.type(within(dlg).getByLabelText(/^Remarks/), 'Meter dispute settled');
    await userEvent.type(within(dlg).getByLabelText(/Credit for Maintenance/), '500.50');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create credit note' }));
    expect(await screen.findByText('Credit note sent for approval')).toBeInTheDocument();
    expect(api.last('POST', '/invoices/5123/credit-notes')!.body).toEqual({
      reasonCode: 'DISPUTE_RESOLUTION',
      remarks: 'Meter dispute settled',
      lines: [{ invoiceLineId: 90121, amountPaise: 50050 }],
    });
    const init = api.fn.mock.calls.find(c => String(c[0]).includes('credit-notes'))![1] as RequestInit;
    expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows an issued note number when it was approved at once', async () => {
    const { dlg } = await open({ 'POST /invoices/5123/credit-notes': ok(noteRaw()) });
    await userEvent.type(within(dlg).getByLabelText(/^Remarks/), 'Billing error fixed');
    await userEvent.type(within(dlg).getByLabelText(/Credit for Maintenance/), '100');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create credit note' }));
    expect(await screen.findByText('Credit note CN/2026-27/000017 issued')).toBeInTheDocument();
  });

  it('shows the maximum per line after CREDIT_EXCEEDS_LINE', async () => {
    const { dlg } = await open({
      'POST /invoices/5123/credit-notes': err(422, 'CREDIT_EXCEEDS_LINE', [
        { field: 'lines.90121.amountPaise', message: 'x', maxAllowedPaise: 25000 },
      ]),
    });
    await userEvent.type(within(dlg).getByLabelText(/^Remarks/), 'Billing error fixed');
    await userEvent.type(within(dlg).getByLabelText(/Credit for Maintenance/), '500');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create credit note' }));
    expect(await within(dlg).findByText(/above what can still be credited/)).toBeInTheDocument();
    expect(within(dlg).getAllByTestId('credit-line')[0]).toHaveTextContent('Max ₹250');
  });

  it('explains INVOICE_CANCEL_PENDING inside the form', async () => {
    const { dlg } = await open({ 'POST /invoices/5123/credit-notes': err(409, 'INVOICE_CANCEL_PENDING') });
    await userEvent.type(within(dlg).getByLabelText(/^Remarks/), 'Billing error fixed');
    await userEvent.type(within(dlg).getByLabelText(/Credit for Maintenance/), '5');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create credit note' }));
    expect(await within(dlg).findByText(/cancellation of this bill waits for approval/)).toBeInTheDocument();
  });
});

describe('Invoice drawer: debit note', () => {
  const heads = ok([
    { id: 4, key: 'HALL', name: 'Hall booking', gstTreatment: 'ALWAYS', isSystem: false },
    { id: 1, key: 'M', name: 'Maintenance', isSystem: true },
  ]);

  it('checks lines, then sends reason, remarks and lines', async () => {
    const { api } = renderIt(UNPAID, {
      'GET /billing/charge-heads': heads,
      'POST /invoices/5123/debit-notes': ok(noteRaw({ noteType: 'DEBIT', noteNo: 'DN/2026-27/000003' })),
    });
    await userEvent.click(await btn('Debit note'));
    const dlg = await screen.findByRole('dialog', { name: /Debit note for/ });
    await within(dlg).findByRole('option', { name: 'Hall booking' });
    expect(within(dlg).queryByRole('option', { name: 'Maintenance' })).toBeNull();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create debit note' }));
    expect(await within(dlg).findByText('Line 1: choose a charge head.')).toBeInTheDocument();
    await userEvent.selectOptions(within(dlg).getByLabelText('Charge head, line 1'), '4');
    expect(within(dlg).getByText('GST is added on top as per the head setting.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText('Description, line 1'), 'Hall for 2 days');
    await userEvent.type(within(dlg).getByLabelText('Amount in rupees, line 1'), '1500');
    await userEvent.type(within(dlg).getByLabelText(/^Remarks/), 'Hall was used twice');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create debit note' }));
    expect(await screen.findByText('Debit note DN/2026-27/000003 issued')).toBeInTheDocument();
    expect(api.last('POST', '/invoices/5123/debit-notes')!.body).toEqual({
      reasonCode: 'ADDITIONAL_CHARGE',
      remarks: 'Hall was used twice',
      lines: [{ chargeHeadId: 4, description: 'Hall for 2 days', amountPaise: 150000 }],
    });
  });

  it('adds and removes lines and shows an API error inside the dialog', async () => {
    renderIt(UNPAID, {
      'GET /billing/charge-heads': heads,
      'POST /invoices/5123/debit-notes': err(422, 'GST_SETTINGS_INVALID'),
    });
    await userEvent.click(await btn('Debit note'));
    const dlg = await screen.findByRole('dialog', { name: /Debit note for/ });
    await within(dlg).findByRole('option', { name: 'Hall booking' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add a line' }));
    expect(within(dlg).getAllByTestId('line-draft')).toHaveLength(2);
    await userEvent.click(within(dlg).getByRole('button', { name: 'Remove line 2' }));
    expect(within(dlg).getAllByTestId('line-draft')).toHaveLength(1);
    await userEvent.selectOptions(within(dlg).getByLabelText('Charge head, line 1'), '4');
    await userEvent.type(within(dlg).getByLabelText('Description, line 1'), 'Hall for 2 days');
    await userEvent.type(within(dlg).getByLabelText('Amount in rupees, line 1'), '10');
    await userEvent.type(within(dlg).getByLabelText(/^Remarks/), 'Hall was used twice');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create debit note' }));
    expect(await within(dlg).findByText(/taxed charge head has no SAC code/)).toBeInTheDocument();
  });
});

describe('Invoice drawer: cancel and write-off', () => {
  it('cancel needs a reason of 10 characters, sends it and shows waiting for approval', async () => {
    const { api } = renderIt(UNPAID, {
      'POST /invoices/5123/cancel': { status: 202, data: { approvalRequestId: 55, status: 'PENDING' } },
    });
    await userEvent.click(await btn('Cancel invoice'));
    const dlg = await screen.findByRole('dialog', { name: /Cancel INV/ });
    await userEvent.type(within(dlg).getByLabelText(/^Reason/), 'short');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request cancellation' }));
    expect(await within(dlg).findByText('Enter a reason of 10 to 500 characters.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/^Reason/), ' billed to the wrong flat');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request cancellation' }));
    expect(await screen.findByText('Cancellation sent for approval')).toBeInTheDocument();
    expect(api.last('POST', '/invoices/5123/cancel')!.body).toEqual({
      reason: 'short billed to the wrong flat',
    });
    const init = api.fn.mock.calls.find(c => String(c[0]).includes('/cancel'))![1] as RequestInit;
    expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Open the approvals page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel invoice' })).toBeDisabled();
  });

  it('shows "Invoice cancelled" when approval was automatic', async () => {
    renderIt(UNPAID, { 'POST /invoices/5123/cancel': ok(detailRaw({ status: 'CANCELLED' })) });
    await userEvent.click(await btn('Cancel invoice'));
    const dlg = await screen.findByRole('dialog', { name: /Cancel INV/ });
    await userEvent.type(within(dlg).getByLabelText(/^Reason/), 'Duplicate of another bill');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request cancellation' }));
    expect(await screen.findByText('Invoice cancelled')).toBeInTheDocument();
  });

  it('explains CREDIT_NOTE_PENDING inside the cancel dialog', async () => {
    renderIt(UNPAID, { 'POST /invoices/5123/cancel': err(409, 'CREDIT_NOTE_PENDING') });
    await userEvent.click(await btn('Cancel invoice'));
    const dlg = await screen.findByRole('dialog', { name: /Cancel INV/ });
    await userEvent.type(within(dlg).getByLabelText(/^Reason/), 'Duplicate of another bill');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request cancellation' }));
    expect(await within(dlg).findByText(/credit note for this bill still waits/)).toBeInTheDocument();
  });

  it('write-off starts at the amount due, refuses more, and sends paise with a key', async () => {
    const { api } = renderIt(UNPAID, {
      'POST /invoices/5123/write-off': ok(noteRaw({ status: 'PENDING_APPROVAL', noteNo: null })),
    });
    await userEvent.click(await btn('Write off'));
    const dlg = await screen.findByRole('dialog', { name: /Write off on/ });
    const amount = within(dlg).getByLabelText(/Amount to write off/);
    expect(amount).toHaveValue('10061');
    await userEvent.clear(amount);
    await userEvent.type(amount, '20000');
    await userEvent.type(within(dlg).getByLabelText(/^Reason/), 'Resident left, cannot be traced');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request write-off' }));
    expect(await within(dlg).findByText(/Enter an amount from ₹0.01 to ₹10,061/)).toBeInTheDocument();
    await userEvent.clear(amount);
    await userEvent.type(amount, '250.50');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request write-off' }));
    expect(await screen.findByText('Write-off sent for approval')).toBeInTheDocument();
    expect(api.last('POST', '/invoices/5123/write-off')!.body).toEqual({
      amountPaise: 25050,
      reason: 'Resident left, cannot be traced',
    });
    const init = api.fn.mock.calls.find(c => String(c[0]).includes('/write-off'))![1] as RequestInit;
    expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy();
  });

  it('asks the step-up and retries the write-off with the same key', async () => {
    const stepUp = vi.fn(async () => true);
    const { configureApiClient } = await import('@/lib/apiClient');
    configureApiClient({ stepUp });
    const { api } = renderIt(UNPAID, {
      'POST /invoices/5123/write-off': [
        err(401, 'REAUTH_REQUIRED'),
        ok(noteRaw({ status: 'PENDING_APPROVAL', noteNo: null })),
      ],
    });
    await userEvent.click(await btn('Write off'));
    const dlg = await screen.findByRole('dialog', { name: /Write off on/ });
    await userEvent.type(within(dlg).getByLabelText(/^Reason/), 'Resident left, cannot be traced');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request write-off' }));
    expect(await screen.findByText('Write-off sent for approval')).toBeInTheDocument();
    expect(stepUp).toHaveBeenCalledTimes(1);
    const keys = api.fn.mock.calls
      .filter(c => String(c[0]).includes('/write-off'))
      .map(c => new Headers((c[1] as RequestInit).headers).get('Idempotency-Key'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('explains WRITE_OFF_EXCEEDS_OUTSTANDING from the server', async () => {
    renderIt(UNPAID, { 'POST /invoices/5123/write-off': err(422, 'WRITE_OFF_EXCEEDS_OUTSTANDING') });
    await userEvent.click(await btn('Write off'));
    const dlg = await screen.findByRole('dialog', { name: /Write off on/ });
    await userEvent.type(within(dlg).getByLabelText(/^Reason/), 'Resident left, cannot be traced');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request write-off' }));
    expect(await within(dlg).findByText(/more than the amount still due/)).toBeInTheDocument();
  });
});
