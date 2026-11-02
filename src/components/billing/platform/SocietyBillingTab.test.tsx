import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { listItem, pagination } from '@/test/billingFixtures';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { SocietyBillingTab } from './SocietyBillingTab';

const mount = (perms = ['platform.billing.view', 'platform.billing.edit']) => {
  setMe(sampleMe({ platformPermissions: perms }));
  return render(
    <ToastProvider>
      <SocietyBillingTab societyId={4} />
    </ToastProvider>,
  );
};
const routes = (extra = {}) => ({
  'GET /platform/societies/4/credits': ok({ balancePaise: 95312, items: [] }, 'OK', {
    pagination: pagination(0),
  }),
  'GET /platform/invoices': ok([listItem()], 'OK', { pagination: pagination(1) }),
  ...extra,
});
beforeEach(resetAll);

describe('platform society Subscription tab billing parts (spec 11.2)', () => {
  it('shows the credit balance and the invoices of this society only', async () => {
    const api = mockApi(routes());
    mount();
    expect(await screen.findByLabelText('Credit balance')).toHaveTextContent('₹953.12');
    expect(await screen.findByText('PLT/2026-27/000184')).toBeInTheDocument();
    expect(api.fn.mock.calls.some(c => String(c[0]).includes('societyId=4'))).toBe(true);
    expect(screen.queryByRole('columnheader', { name: 'Society' })).toBeNull();
  });

  it('requests a goodwill credit with a reason', async () => {
    const api = mockApi(routes({ 'POST /platform/societies/4/credits': ok({}) }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Apply credit' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Credit amount/), '600000');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Outage on 3 days');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request credit' }));
    expect(await within(dlg).findByText(/between 1 and 5,00,000/)).toBeInTheDocument();
    await userEvent.clear(within(dlg).getByLabelText(/Credit amount/));
    await userEvent.type(within(dlg).getByLabelText(/Credit amount/), '5000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request credit' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/societies/4/credits')?.body).toEqual({
        amountPaise: 500000,
        reason: 'Outage on 3 days',
      }),
    );
  });

  it('refunds credit by bank transfer and explains an insufficient balance', async () => {
    const api = mockApi(
      routes({ 'POST /platform/societies/4/refunds': err(422, 'INSUFFICIENT_CREDIT_BALANCE') }),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Refund credit' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Amount/), '500');
    await userEvent.type(within(dlg).getByLabelText(/Payee reference/), 'HDFC ending 4821');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Society closing the account');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request refund' }));
    expect(await within(dlg).findByText(/more than the credit balance/)).toBeInTheDocument();
    expect(api.last('POST', '/platform/societies/4/refunds')?.body).toMatchObject({
      amountPaise: 50000,
      mode: 'BANK_TRANSFER',
      payeeReference: 'HDFC ending 4821',
    });
  });

  it('rejects a payee reference holding a full account number', async () => {
    const api = mockApi(routes());
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Refund credit' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Amount/), '100');
    await userEvent.type(within(dlg).getByLabelText(/Payee reference/), 'HDFC 123456789012');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Society closing the account');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request refund' }));
    expect(await within(dlg).findByText(/no full account number/)).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('hides everything without the view permission and the buttons without edit', async () => {
    mockApi(routes());
    const { unmount } = mount([]);
    expect(screen.queryByLabelText('Credit balance')).toBeNull();
    unmount();
    mount(['platform.billing.view']);
    await screen.findByLabelText('Credit balance');
    expect(screen.queryByRole('button', { name: 'Apply credit' })).toBeNull();
  });
});
