import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { pagination } from '@/test/paymentsFixtures';
import { signIn } from '@/test/setupHelpers';
import { RecordPaymentModal } from './RecordPaymentModal';

const flat = (unitId: number, unitLabel: string, duesPaise: number) => ({
  unitId,
  unitLabel,
  buildingId: 1,
  unitType: 'FLAT',
  areaSqft: 900,
  occupancy: 'OWNER_OCCUPIED',
  primaryOwner: { residentId: unitId, name: `Owner ${unitLabel}`, mobile: null },
  tenant: null,
  residentCount: 2,
  duesPaise,
});
const FLATS = [flat(1, 'A-101', 0), flat(51, 'A-1203', 680900), flat(2, 'B-402', 120000)];
const sent = {
  id: 7790,
  status: 'PENDING_APPROVAL',
  method: 'CASH',
  amountPaise: 680900,
  receiptNo: null,
  approval: { requestId: 3302, status: 'PENDING' },
  version: 1,
};

beforeEach(() => {
  resetAll();
  signIn();
});

function renderIt(routes: Parameters<typeof mockApi>[0] = {}) {
  const api = mockApi({
    'GET /residents/units': ok(FLATS, 'OK', pagination()),
    'GET /collections': ok(
      [{ id: 7, title: 'Diwali 2026', amountPerUnitPaise: 50000, minAmountPaise: 0 }],
      'OK',
      pagination(),
    ),
    'GET /collections/7/requests': ok(
      [{ id: 71, unitId: 51, unitLabel: 'A-1203', amountPaise: 50000, paidPaise: 10000, status: 'OPEN' }],
      'OK',
      pagination(),
    ),
    'POST /payments/offline': ok(sent, 'Payment recorded and sent for approval'),
    ...routes,
  });
  const onClose = vi.fn();
  const onRecorded = vi.fn();
  render(
    <ToastProvider>
      <RecordPaymentModal onClose={onClose} onRecorded={onRecorded} />
    </ToastProvider>,
  );
  return { api, onClose, onRecorded };
}

const pickFlat = async (id = '51') => {
  const select = await screen.findByLabelText(/^Flat/);
  await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(2));
  await userEvent.selectOptions(select, id);
};

describe('Record a payment', () => {
  it('lists flats by dues with "owes" and prefills the amount with the dues', async () => {
    renderIt();
    const select = await screen.findByLabelText(/^Flat/);
    await waitFor(() => expect(select.querySelectorAll('option').length).toBe(4));
    const labels = [...select.querySelectorAll('option')].map(o => o.textContent);
    expect(labels).toEqual(['Choose a flat', 'A-1203 (owes ₹6,809)', 'B-402 (owes ₹1,200)', 'A-101']);
    await userEvent.selectOptions(select, '51');
    expect(screen.getByLabelText(/^Amount/)).toHaveValue('6809');
    expect(screen.getByText(/Cash goes to Cash in hand/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record and send for approval' })).toBeInTheDocument();
  });

  it('records cash, sends an idempotency key and shows "Sent for approval"', async () => {
    const { api, onRecorded } = renderIt();
    await pickFlat();
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    expect(await screen.findByText('Sent for approval')).toBeInTheDocument();
    expect(screen.getByText(/waiting for a second committee member/)).toBeInTheDocument();
    expect(onRecorded).toHaveBeenCalled();
    const call = api.calls.find(c => c.path === '/payments/offline')!;
    expect(call.body).toMatchObject({
      unitId: 51,
      payingFor: 'DUES',
      method: 'CASH',
      amountPaise: 680900,
      payerName: 'Owner A-1203',
    });
    const i = api.calls.indexOf(call);
    expect(
      ((api.fn.mock.calls[i]![1] as RequestInit).headers as Record<string, string>)['Idempotency-Key'],
    ).toBeTruthy();
  });

  it('says "Payment recorded" with the receipt when the payment was auto-approved', async () => {
    renderIt({
      'POST /payments/offline': ok({
        ...sent,
        status: 'CONFIRMED',
        receiptNo: 'RCT/2026-27/000051',
        approval: null,
      }),
    });
    await pickFlat();
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    expect(await screen.findByText('Payment recorded')).toBeInTheDocument();
    expect(screen.getByText(/Receipt RCT\/2026-27\/000051/)).toBeInTheDocument();
  });

  it('asks for the cheque bank, number and date when the method is Cheque', async () => {
    const { api } = renderIt();
    await pickFlat();
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'CHEQUE');
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    expect(await screen.findByText('Enter the cheque bank.')).toBeInTheDocument();
    expect(screen.getByText('The cheque number has 6 digits.')).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
    await userEvent.type(screen.getByLabelText('Cheque bank'), 'HDFC Bank');
    await userEvent.type(screen.getByLabelText('Cheque number'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    await screen.findByText('Sent for approval');
    expect(api.last('POST', '/payments/offline')!.body).toMatchObject({
      method: 'CHEQUE',
      cheque: { bankName: 'HDFC Bank', chequeNo: '123456' },
    });
  });

  it('needs a reference for a bank transfer', async () => {
    const { api } = renderIt();
    await pickFlat();
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'NEFT');
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    expect(await screen.findByText('Use the UTR: 12 to 22 letters and digits.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Reference/), 'UTR123456789A');
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    await screen.findByText('Sent for approval');
    expect(api.last('POST', '/payments/offline')!.body).toMatchObject({
      method: 'NEFT',
      referenceNo: 'UTR123456789A',
    });
  });

  it('pays a live collection with the open part prefilled', async () => {
    const { api } = renderIt();
    await pickFlat();
    await userEvent.selectOptions(screen.getByLabelText('Paying for'), '7');
    await waitFor(() => expect(screen.getByLabelText(/^Amount/)).toHaveValue('400'));
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    await screen.findByText('Sent for approval');
    expect(api.last('POST', '/payments/offline')!.body).toMatchObject({
      payingFor: 'COLLECTION',
      collectionRequestId: 71,
      amountPaise: 40000,
    });
  });

  it('warns about a suspected duplicate and records it anyway on request', async () => {
    const { api } = renderIt({
      'POST /payments/offline': [err(409, 'DUPLICATE_PAYMENT_SUSPECTED'), ok(sent)],
    });
    await pickFlat();
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    expect(await screen.findByText('Possible duplicate')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record anyway' }));
    expect(await screen.findByText('Sent for approval')).toBeInTheDocument();
    const posts = api.calls.filter(c => c.path === '/payments/offline');
    expect(posts[0]!.body).not.toHaveProperty('confirmDuplicate');
    expect(posts[1]!.body).toMatchObject({ confirmDuplicate: true });
  });

  it('shows other errors in words and keeps the form', async () => {
    renderIt({ 'POST /payments/offline': err(422, 'CASH_LIMIT_EXCEEDED') });
    await pickFlat();
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    expect(await screen.findByText(/section 269ST/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record and send for approval' })).toBeInTheDocument();
  });

  it('checks the flat and the amount before calling the API', async () => {
    const { api } = renderIt();
    await screen.findByLabelText(/^Flat/);
    await userEvent.click(screen.getByRole('button', { name: 'Record and send for approval' }));
    expect(await screen.findByText('Choose a flat.')).toBeInTheDocument();
    expect(screen.getByText('Enter an amount of at least ₹1.')).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('offers a proof upload', async () => {
    renderIt();
    expect(await screen.findByLabelText(/^Proof/)).toBeInTheDocument();
  });
});
