import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, navigationMock, ok, resetAll, search } from '@/test/helpers';
import { DevApprovals } from '@/components/residents/DevApprovals';
import { ToastProvider } from '@/components/ui/Toast';
import { signInAs } from '@/test/residentsHelpers';

vi.mock('next/navigation', () => navigationMock());

function renderIt(routes: Parameters<typeof mockApi>[0]) {
  signInAs();
  const api = mockApi(routes);
  render(
    <ToastProvider>
      <DevApprovals />
    </ToastProvider>,
  );
  return api;
}

beforeEach(() => resetAll());

describe('DevApprovals', () => {
  it('lists waiting requests and approves one through the development route', async () => {
    const api = renderIt({
      'GET /dev/approvals': ok([
        { id: 9000, type: 'RENOVATION_PERMIT', entityId: 1, societyId: 1, status: 'PENDING' },
      ]),
      'POST /dev/approvals/9000/approve': ok({ id: 9000, status: 'APPROVED' }),
    });
    expect(await screen.findByText('Renovation permit')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve request 9000' }));
    await waitFor(() => expect(api.last('POST', '/dev/approvals/9000/approve')).toBeTruthy());
  });

  it('filters by ?source= and tells same-numbered requests of two sources apart, sending the reason', async () => {
    search.current = new URLSearchParams('source=accounts');
    const api = renderIt({
      'GET /dev/approvals': ok([
        { id: 1, type: 'EXPENSE', entityId: 5, societyId: 1, status: 'PENDING', source: 'accounts' },
        { id: 1, type: 'OFFLINE_PAYMENT', entityId: 6, societyId: 1, status: 'PENDING', source: 'payments' },
      ]),
      'POST /dev/approvals/1/reject': ok({ id: 1 }),
    });
    expect(await screen.findByText('Expense')).toBeInTheDocument();
    expect(screen.queryByText('Offline payment')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reject accounts request 1' }));
    await userEvent.type(await screen.findByLabelText(/Reason/), 'Not in budget');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(api.last('POST', '/dev/approvals/1/reject')?.body).toEqual({ reason: 'Not in budget' }),
    );
    search.current = new URLSearchParams();
  });

  it('says nothing is waiting when the list is empty', async () => {
    renderIt({ 'GET /dev/approvals': ok([]) });
    expect(await screen.findByText('Nothing is waiting for a decision.')).toBeInTheDocument();
  });

  it('sends the source of a billing request so the right module decides it', async () => {
    const api = renderIt({
      'GET /dev/approvals': ok([
        {
          id: 4,
          type: 'BILLING_RUN_PUBLISH',
          entityId: 2,
          societyId: 1,
          status: 'PENDING',
          source: 'billing',
        },
      ]),
      'POST /dev/approvals/4/approve': ok({ id: 4, status: 'APPROVED' }),
    });
    expect(await screen.findByText('Billing run publish')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve billing request 4' }));
    await waitFor(() => expect(api.last('POST', '/dev/approvals/4/approve')).toBeTruthy());
    expect(
      api.fn.mock.calls.some(c => String(c[0]).includes('/dev/approvals/4/approve?source=billing')),
    ).toBe(true);
  });
  it('shows readable labels and a summary for the payment request types and decides them with source=payments', async () => {
    const api = renderIt({
      'GET /dev/approvals': ok([
        {
          id: 5,
          type: 'OFFLINE_PAYMENT',
          entityId: 77,
          societyId: 1,
          status: 'PENDING',
          source: 'payments',
          title: 'Cash from A-101',
          amountPaise: 250000,
          categoryKey: 'CASH',
        },
        {
          id: 6,
          type: 'PAYMENT_REFUND',
          entityId: 12,
          societyId: 1,
          status: 'PENDING',
          source: 'payments',
          title: 'Refund for A-101',
          amountPaise: 100000,
          categoryKey: 'BANK_TRANSFER',
        },
        {
          id: 7,
          type: 'COLLECTION_PUBLISH',
          entityId: 3,
          societyId: 1,
          status: 'PENDING',
          source: 'payments',
        },
      ]),
      'POST /dev/approvals/6/approve': ok({ id: 6, status: 'APPROVED' }),
      'POST /dev/approvals/7/reject': ok({ id: 7, status: 'REJECTED' }),
    });
    expect(await screen.findByText('Offline payment')).toBeInTheDocument();
    expect(screen.getByText('Payment refund')).toBeInTheDocument();
    expect(screen.getByText('Collection publish')).toBeInTheDocument();
    expect(screen.getByText('Cash from A-101 · ₹2,500 · cash')).toBeInTheDocument();
    expect(screen.getByText('Refund for A-101 · ₹1,000 · bank transfer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve payments request 6' }));
    await waitFor(() => expect(api.last('POST', '/dev/approvals/6/approve')).toBeTruthy());
    expect(
      api.fn.mock.calls.some(c => String(c[0]).includes('/dev/approvals/6/approve?source=payments')),
    ).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Reject payments request 7' }));
    await userEvent.type(await screen.findByLabelText(/Reason/), 'Wrong amount');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(api.last('POST', '/dev/approvals/7/reject')).toBeTruthy());
    expect(
      api.fn.mock.calls.some(c => String(c[0]).includes('/dev/approvals/7/reject?source=payments')),
    ).toBe(true);
  });

  it('shows flat, amount and mode of a payments request when it carries them', async () => {
    renderIt({
      'GET /dev/approvals': ok([
        {
          id: 45,
          type: 'OFFLINE_PAYMENT',
          entityId: 12,
          societyId: 1,
          status: 'PENDING',
          source: 'payments',
          payload: { unitLabel: 'A-1203', amountPaise: 250000, method: 'CASH' },
        },
      ]),
    });
    expect(await screen.findByText('Flat A-1203 · ₹2,500 · cash')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
  it('labels the module 13 approval types and decides them with source=accounts', async () => {
    const api = renderIt({
      'GET /dev/approvals': ok([
        {
          id: 31,
          type: 'MANUAL_JOURNAL',
          entityId: 8,
          societyId: 1,
          status: 'PENDING',
          source: 'accounts',
          title: 'Fix',
          amountPaise: 118000,
        },
        { id: 32, type: 'EXPENSE', entityId: 9, societyId: 1, status: 'PENDING', source: 'accounts' },
        { id: 33, type: 'FUND_TRANSFER', entityId: 1, societyId: 1, status: 'PENDING', source: 'accounts' },
        { id: 34, type: 'DEPOSIT_REFUND', entityId: 2, societyId: 1, status: 'PENDING', source: 'accounts' },
        { id: 35, type: 'PERIOD_UNLOCK', entityId: 3, societyId: 1, status: 'PENDING', source: 'accounts' },
      ]),
      'POST /dev/approvals/31/approve': ok({ id: 31, status: 'APPROVED' }),
    });
    for (const label of ['Manual journal', 'Expense', 'Fund transfer', 'Deposit refund', 'Period unlock'])
      expect(await screen.findByText(label)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve accounts request 31' }));
    await waitFor(() =>
      expect(
        api.fn.mock.calls.some(c => String(c[0]).includes('/dev/approvals/31/approve?source=accounts')),
      ).toBe(true),
    );
  });
});
