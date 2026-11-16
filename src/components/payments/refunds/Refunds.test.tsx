import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { OPS_FEATURES, OPS_PERMS, OPS_VIEW, listOf, refundRaw } from '@/test/paymentsOpsFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { RefundsScreen } from './RefundsScreen';
import { RequestRefundDialog } from './RequestRefundDialog';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const ROWS = [
  refundRaw(),
  refundRaw({ id: 13, status: 'PENDING_APPROVAL', mode: 'GATEWAY', payeeName: null }),
  refundRaw({ id: 14, status: 'PROCESSED', refundNo: 'RFD/2026-27/000003' }),
];
function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms = OPS_PERMS, features = OPS_FEATURES) {
  signInAs(perms, features);
  const api = mockApi({ 'GET /refunds': listOf(ROWS), ...routes });
  render(<RefundsScreen />);
  return api;
}

describe('Refunds list', () => {
  it('shows one row per refund with status and mode in words', async () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    const rows = await screen.findAllByTestId('refund-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Being paid out');
    expect(rows[0]).toHaveTextContent('Bank transfer to Rohan Sharma');
    expect(rows[0]).toHaveTextContent('₹2,500');
    expect(rows[1]).toHaveTextContent('Waiting for approval');
    expect(rows[2]).toHaveTextContent('RFD/2026-27/000003');
  });
  it('offers Record payout only for an offline refund being paid out, and only with edit permission', async () => {
    renderIt();
    const rows = await screen.findAllByTestId('refund-row');
    expect(within(rows[0]).getByRole('button', { name: 'Record payout' })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('button', { name: 'Record payout' })).toBeNull();
    expect(within(rows[2]).queryByRole('button', { name: 'Record payout' })).toBeNull();
  });
  it('hides both actions from a viewer', async () => {
    renderIt({}, OPS_VIEW);
    await screen.findAllByTestId('refund-row');
    expect(screen.queryByRole('button', { name: 'Record payout' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Request a refund' })).toBeNull();
  });
  it('filters by status and mode through the API', async () => {
    const api = renderIt();
    await screen.findAllByTestId('refund-row');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PROCESSED');
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('status=PROCESSED'))).toBe(true),
    );
    await userEvent.selectOptions(screen.getByLabelText('Mode'), 'CASH');
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('mode=CASH'))).toBe(true));
  });
  it('shows an empty state, an error with retry, and the plan lock', async () => {
    renderIt({ 'GET /refunds': listOf([]) });
    expect(await screen.findByText('No refunds yet')).toBeInTheDocument();
  });
  it('shows an error with the reference', async () => {
    renderIt({ 'GET /refunds': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it('shows the lock when the plan has no refunds', async () => {
    signInAs(OPS_PERMS, []);
    render(<RefundsScreen />);
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
  });
  it('completes a payout with a bank reference and the row version', async () => {
    const api = renderIt({ 'POST /refunds/12/complete': ok(refundRaw({ status: 'PROCESSED' })) });
    const rows = await screen.findAllByTestId('refund-row');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Record payout' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Record payout' }));
    expect(await screen.findByText(/Enter the UTR or cheque number/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Bank reference/), 'UTR998877');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Record payout' }));
    await waitFor(() => expect(api.last('POST', '/refunds/12/complete')).toBeTruthy());
    expect(api.last('POST', '/refunds/12/complete')?.body).toMatchObject({
      bankReference: 'UTR998877',
      version: 3,
    });
  });
  it('shows a stale version error inside the payout dialog', async () => {
    renderIt({ 'POST /refunds/12/complete': err(409, 'STALE_VERSION') });
    const rows = await screen.findAllByTestId('refund-row');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Record payout' }));
    await userEvent.type(screen.getByLabelText(/Bank reference/), 'UTR998877');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Record payout' }));
    expect(await screen.findByText(/Someone else changed this/)).toBeInTheDocument();
  });
});

describe('RequestRefundDialog', () => {
  const open = (
    props: Partial<Parameters<typeof RequestRefundDialog>[0]> = {},
    routes: Parameters<typeof mockApi>[0] = {},
  ) => {
    signInAs(OPS_PERMS, OPS_FEATURES);
    const api = mockApi({ 'POST /refunds': ok(refundRaw({ status: 'PENDING_APPROVAL' })), ...routes });
    const onClose = vi.fn();
    const onDone = vi.fn();
    render(
      <RequestRefundDialog
        paymentId={7781}
        refundablePaise={910900}
        onClose={onClose}
        onDone={onDone}
        {...props}
      />,
    );
    return { api, onClose, onDone };
  };

  it('validates the amount, reason and the masked account before calling', async () => {
    const { api } = open();
    await userEvent.clear(screen.getByLabelText(/Amount/));
    await userEvent.type(screen.getByLabelText(/Amount/), '99999');
    await userEvent.type(screen.getByLabelText(/Reason/), 'short');
    await userEvent.type(screen.getByLabelText(/Account/), 'HDFC 4521');
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));
    expect(await screen.findByText(/At most ₹9,109 can be refunded/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a reason of 10 to 500/)).toBeInTheDocument();
    expect(screen.getByText(/HDFC xxxx4521/)).toBeInTheDocument();
    expect(screen.getByText(/name of the person to pay/)).toBeInTheDocument();
    expect(api.last('POST', '/refunds')).toBeUndefined();
  });
  it('sends a bank transfer refund in paise with payee details', async () => {
    const { api, onDone, onClose } = open();
    await userEvent.clear(screen.getByLabelText(/Amount/));
    await userEvent.type(screen.getByLabelText(/Amount/), '2,500.50');
    await userEvent.type(screen.getByLabelText(/Pay to/), 'Rohan Sharma');
    await userEvent.type(screen.getByLabelText(/Account/), 'HDFC xxxx4521');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Paid twice by mistake');
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(api.last('POST', '/refunds')?.body).toEqual({
      paymentId: 7781,
      amountPaise: 250050,
      mode: 'BANK_TRANSFER',
      reason: 'Paid twice by mistake',
      payeeName: 'Rohan Sharma',
      payeeAccountMasked: 'HDFC xxxx4521',
    });
  });
  it('needs no payee for a gateway refund and sends reallocate when ticked', async () => {
    const { api } = open();
    await userEvent.selectOptions(screen.getByLabelText('Pay back by'), 'GATEWAY');
    expect(screen.queryByLabelText(/Pay to/)).toBeNull();
    await userEvent.type(screen.getByLabelText(/Reason/), 'Duplicate online payment');
    await userEvent.click(screen.getByLabelText(/Free the amount/));
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));
    await waitFor(() => expect(api.last('POST', '/refunds')).toBeTruthy());
    expect(api.last('POST', '/refunds')?.body).toMatchObject({
      mode: 'GATEWAY',
      reallocate: true,
      paymentId: 7781,
    });
  });
  it('asks for the payment number when opened without one', async () => {
    open({ paymentId: undefined, refundablePaise: undefined });
    expect(screen.getByLabelText(/Payment number/)).toBeInTheDocument();
  });
  it('shows the server error in plain words', async () => {
    open({}, { 'POST /refunds': err(422, 'REFUND_NEEDS_REALLOCATION') });
    await userEvent.type(screen.getByLabelText(/Pay to/), 'Rohan Sharma');
    await userEvent.type(screen.getByLabelText(/Account/), 'HDFC xxxx4521');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Paid twice by mistake');
    await userEvent.click(screen.getByRole('button', { name: 'Send for approval' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/flat advance is not enough/);
  });
});
