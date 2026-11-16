import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureApiClient } from '@/lib/apiClient';
import { mapPaymentDetail } from '@/services/paymentsMappers';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { chequeBlock, chequeDetailRaw, detailRaw, pagination } from '@/test/paymentsFixtures';
import { signIn } from '@/test/setupHelpers';
import {
  BounceDialog,
  ClearDialog,
  ReallocateDialog,
  ResendDialog,
  ReturnDialog,
  ReverseDialog,
  currentRows,
} from './PaymentDialogs';

beforeEach(() => {
  resetAll();
  signIn();
});

const online = () => mapPaymentDetail(detailRaw());
const cheque = () =>
  mapPaymentDetail(
    chequeDetailRaw({
      status: 'DEPOSITED',
      cheque: { ...chequeBlock, depositedOn: '2020-01-01' },
    }),
  );

function show(ui: (p: { onClose: () => void; onDone: (m: string) => void }) => React.ReactNode) {
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(<ToastProvider>{ui({ onClose, onDone })}</ToastProvider>);
  return { onClose, onDone };
}

describe('Bounce dialog', () => {
  it('defaults the bounce charge to 500 rupees and sends date, reason, charge and version', async () => {
    const api = mockApi({ 'POST /payments/7790/cheque/bounce': ok(detailRaw()) });
    const { onDone } = show(p => <BounceDialog payment={cheque()} {...p} />);
    expect(screen.getByLabelText('Bounce charge (₹)')).toHaveValue('500');
    expect(screen.getByLabelText('Bounce date')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Bank reason'), 'Funds insufficient');
    await userEvent.click(screen.getByRole('button', { name: 'Mark bounced' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Cheque marked as bounced'));
    const body = api.last('POST', '/payments/7790/cheque/bounce')!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      reason: 'Funds insufficient',
      applyBounceCharge: true,
      bounceChargePaise: 50000,
      version: 2,
    });
    const headers = (api.fn.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeTruthy();
  });

  it('needs a bank reason and sends no charge when the fee is switched off', async () => {
    const api = mockApi({ 'POST /payments/7790/cheque/bounce': ok(detailRaw()) });
    show(p => <BounceDialog payment={cheque()} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark bounced' }));
    expect(await screen.findByText('Enter the bank reason (at least 5 characters).')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
    await userEvent.type(screen.getByLabelText('Bank reason'), 'Account closed');
    await userEvent.click(screen.getByLabelText('Charge a bounce fee to the flat'));
    expect(screen.queryByLabelText('Bounce charge (₹)')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mark bounced' }));
    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(api.calls[0]!.body).toMatchObject({ applyBounceCharge: false, bounceChargePaise: 0 });
  });

  it('keeps the dialog open and says what went wrong', async () => {
    mockApi({ 'POST /payments/7790/cheque/bounce': err(422, 'BOUNCE_WINDOW_PASSED') });
    const { onDone } = show(p => <BounceDialog payment={cheque()} {...p} />);
    await userEvent.type(screen.getByLabelText('Bank reason'), 'Funds insufficient');
    await userEvent.click(screen.getByRole('button', { name: 'Mark bounced' }));
    expect(await screen.findByText('This cheque cleared too long ago to be returned.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('Clear and return dialogs', () => {
  it('marks a cheque cleared with the date and version', async () => {
    const api = mockApi({ 'POST /payments/7790/cheque/clear': ok({}) });
    const { onDone } = show(p => <ClearDialog payment={cheque()} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark cleared' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.calls[0]!.body).toMatchObject({ version: 2 });
  });

  it('returns a cheque to the payer with a reason', async () => {
    const api = mockApi({ 'POST /payments/7790/cheque/return': ok({}) });
    const { onDone } = show(p => <ReturnDialog payment={cheque()} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Return to payer' }));
    expect(await screen.findByText('Enter a reason (at least 5 characters).')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Reason'), 'Payer asked for it back');
    await userEvent.click(screen.getByRole('button', { name: 'Return to payer' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.calls[0]!.body).toEqual({ reason: 'Payer asked for it back', version: 2 });
  });
});

describe('Reverse dialog maker-checker', () => {
  it('says who cannot reverse it', async () => {
    mockApi({ 'POST /payments/7781/reverse': err(409, 'MAKER_CHECKER_VIOLATION') });
    show(p => <ReverseDialog payment={online()} {...p} />);
    await userEvent.type(screen.getByLabelText('Reason'), 'Bank confirmed a lost chargeback');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse payment' }));
    expect(
      await screen.findByText(
        'The person who recorded this payment cannot reverse it. Ask another committee member.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Reverse dialog', () => {
  it('needs a reason of 10 characters, then sends the code, reason and version', async () => {
    const api = mockApi({ 'POST /payments/7781/reverse': ok({}) });
    const { onDone } = show(p => <ReverseDialog payment={online()} {...p} />);
    expect(screen.getByLabelText('Why')).toHaveValue('CHARGEBACK_LOST');
    await userEvent.type(screen.getByLabelText('Reason'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse payment' }));
    expect(await screen.findByText('Enter a reason of at least 10 characters.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Reason'));
    await userEvent.type(screen.getByLabelText('Reason'), 'Bank confirmed a lost chargeback');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse payment' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Payment reversed'));
    expect(api.calls[0]!.body).toEqual({
      reasonCode: 'CHARGEBACK_LOST',
      reason: 'Bank confirmed a lost chargeback',
      version: 2,
    });
  });

  it('asks for the step-up and retries once the person confirmed it is them', async () => {
    const stepUp = vi.fn(async () => true);
    configureApiClient({ stepUp });
    const api = mockApi({ 'POST /payments/7781/reverse': [err(401, 'REAUTH_REQUIRED'), ok({})] });
    const { onDone } = show(p => <ReverseDialog payment={online()} {...p} />);
    await userEvent.type(screen.getByLabelText('Reason'), 'Bank confirmed a lost chargeback');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse payment' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(stepUp).toHaveBeenCalledTimes(1);
    expect(api.calls.filter(c => c.path === '/payments/7781/reverse')).toHaveLength(2);
    const keys = api.fn.mock.calls.map(
      c => ((c[1] as RequestInit).headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it('shows the maker-checker error', async () => {
    mockApi({ 'POST /payments/7781/reverse': err(409, 'MAKER_CHECKER_VIOLATION') });
    show(p => <ReverseDialog payment={online()} {...p} />);
    await userEvent.type(screen.getByLabelText('Reason'), 'Typed the amount twice');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse payment' }));
    expect(
      await screen.findByText(
        'The person who recorded this payment cannot reverse it. Ask another committee member.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Reallocate dialog', () => {
  const routes = {
    'GET /invoices': ok(
      [{ id: 901, invoiceNo: 'INV/0901', status: 'OVERDUE', outstandingPaise: 910900 }],
      'OK',
      pagination(),
    ),
  };

  it('starts from what the payment holds, with the total check', async () => {
    mockApi({ ...routes });
    show(p => <ReallocateDialog payment={online()} {...p} />);
    const rows = screen.getAllByTestId('realloc-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByLabelText('Invoice INV/2026-27/0900')).toHaveValue('8009');
    expect(screen.getByLabelText('Collection Diwali')).toHaveValue('1100');
    expect(screen.getByText('Total ₹9,109 of ₹9,109')).toBeInTheDocument();
  });

  it('refuses a different total and sends the targets when it matches', async () => {
    const api = mockApi({ ...routes, 'POST /payments/7781/reallocate': ok({}) });
    const { onDone } = show(p => <ReallocateDialog payment={online()} {...p} />);
    await userEvent.type(screen.getByLabelText('Reason'), 'Paid against the wrong bill');
    await userEvent.clear(screen.getByLabelText('Collection Diwali'));
    await userEvent.type(screen.getByLabelText('Collection Diwali'), '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Reallocate' }));
    expect(await screen.findByText(/must add up to ₹9,109/)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Add advance' }));
    await userEvent.type(screen.getByLabelText('Advance'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Reallocate' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.last('POST', '/payments/7781/reallocate')!.body).toEqual({
      targets: [
        { type: 'INVOICE', id: 900, amountPaise: 800900 },
        { type: 'COLLECTION_REQUEST', id: 33, amountPaise: 100000 },
        { type: 'ADVANCE', amountPaise: 10000 },
      ],
      reason: 'Paid against the wrong bill',
      version: 2,
    });
  });

  it('can add an open invoice and remove a row', async () => {
    mockApi({ ...routes });
    show(p => <ReallocateDialog payment={online()} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Collection Diwali' }));
    expect(screen.getAllByTestId('realloc-row')).toHaveLength(1);
    await userEvent.selectOptions(await screen.findByLabelText('Add an open invoice'), '901');
    expect(screen.getByLabelText('Invoice INV/0901')).toHaveValue('9109');
  });

  it('nets reversed allocations off when building the rows', () => {
    const p = mapPaymentDetail(
      detailRaw({
        allocations: [
          { id: 1, invoiceId: 900, invoiceNo: 'I9', amountPaise: 1000, targetType: 'INVOICE' },
          {
            id: 2,
            invoiceId: 900,
            invoiceNo: 'I9',
            amountPaise: -1000,
            targetType: 'INVOICE',
            reasonCode: 'REALLOCATED',
          },
          { id: 3, invoiceId: 901, invoiceNo: 'I10', amountPaise: 1000, targetType: 'INVOICE' },
        ],
        toAdvancePaise: 0,
      }),
    );
    expect(currentRows(p).map(r => r.label)).toEqual(['Invoice I10']);
  });
});

describe('Resend dialog message', () => {
  it.each([
    [{ sent: 0 }, 'Receipt queued'],
    [{ sent: 2 }, 'Receipt sent on 2 channels'],
  ])('says the truth for %j', async (reply, text) => {
    mockApi({ 'POST /payments/7781/receipt/resend': ok(reply) });
    const { onDone } = show(p => <ResendDialog payment={online()} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send receipt' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(text));
  });
});

describe('Resend dialog', () => {
  it('sends the chosen channels and needs at least one', async () => {
    const api = mockApi({ 'POST /payments/7781/receipt/resend': ok({}) });
    const { onDone } = show(p => <ResendDialog payment={online()} {...p} />);
    await userEvent.click(screen.getByLabelText('SMS'));
    await userEvent.click(screen.getByRole('button', { name: 'Send receipt' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.calls[0]!.body).toEqual({ channels: ['EMAIL', 'SMS'] });
    await userEvent.click(screen.getByLabelText('Email'));
    await userEvent.click(screen.getByLabelText('SMS'));
    await userEvent.click(screen.getByRole('button', { name: 'Send receipt' }));
    expect(await screen.findByText('Choose at least one channel.')).toBeInTheDocument();
  });

  it('says when the limit of 3 a day is reached', async () => {
    mockApi({ 'POST /payments/7781/receipt/resend': err(429, 'RATE_LIMITED') });
    show(p => <ResendDialog payment={online()} {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send receipt' }));
    expect(await screen.findByText('Too many requests. Wait a little and try again.')).toBeInTheDocument();
  });
});
