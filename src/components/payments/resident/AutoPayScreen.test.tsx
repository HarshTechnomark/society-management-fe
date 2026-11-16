import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { PAY_PERMS, duesRaw, mandateRaw } from '@/test/paymentsResidentFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { AutoPayScreen } from './AutoPayScreen';
import { PayTabs } from './PayTabs';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
function show(routes: Routes) {
  signInAs(PAY_PERMS, []);
  const api = mockApi({ 'GET /me/dues': ok(duesRaw()), ...routes });
  render(
    <ToastProvider>
      <AutoPayScreen />
    </ToastProvider>,
  );
  return api;
}
beforeEach(resetAll);

describe('AutoPay', () => {
  it('says AutoPay is not available when the society does not have it', async () => {
    show({ 'GET /me/autopay-mandates': err(422, 'AUTOPAY_NOT_AVAILABLE') });
    expect(await screen.findByText('AutoPay is not available')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'AutoPay' })).toBeNull();
  });

  it('the tab bar shows AutoPay only when the route answers', async () => {
    signInAs(PAY_PERMS, []);
    mockApi({ 'GET /me/autopay-mandates': ok([]) });
    render(<PayTabs />);
    expect(await screen.findByRole('link', { name: 'AutoPay' })).toHaveAttribute(
      'href',
      '/resident/pay/autopay',
    );
  });

  it('shows a mandate and pauses it with its version', async () => {
    let paused = false;
    const api = show({
      'GET /me/autopay-mandates': () => ok([mandateRaw(paused ? { status: 'PAUSED', version: 4 } : {})]),
      'POST /me/autopay-mandates/31/pause': () => {
        paused = true;
        return ok({});
      },
    });
    expect(await screen.findByText(/Up to/)).toHaveTextContent('₹10,000');
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/autopay-mandates/31/pause')?.body).toEqual({ version: 3 }),
    );
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('resumes a paused mandate and shows STALE_VERSION in words', async () => {
    const api = show({
      'GET /me/autopay-mandates': ok([mandateRaw({ status: 'PAUSED', version: 4 })]),
      'POST /me/autopay-mandates/31/resume': err(409, 'STALE_VERSION'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    expect(await screen.findByText(/changed in the meantime/)).toBeInTheDocument();
    expect(api.last('POST', '/me/autopay-mandates/31/resume')?.body).toEqual({ version: 4 });
  });

  it('cancels a mandate after confirming', async () => {
    const api = show({
      'GET /me/autopay-mandates': ok([mandateRaw()]),
      'POST /me/autopay-mandates/31/cancel': ok({}),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel AutoPay' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel AutoPay' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/autopay-mandates/31/cancel')?.body).toEqual({ version: 3 }),
    );
    expect(await screen.findByText('AutoPay cancelled.')).toBeInTheDocument();
  });

  it('sets up AutoPay with a cap, start and end and shows how to authorise', async () => {
    const api = show({
      'GET /me/autopay-mandates': ok([]),
      'POST /me/autopay-mandates': ok({
        mandateId: 5,
        status: 'PENDING_AUTH',
        authorisation: { upiIntentUrl: 'upi://mandate?x=1' },
        expiresAt: '2026-12-01T00:00:00Z',
      }),
    });
    const cap = await screen.findByLabelText('Cap per payment (₹)');
    await userEvent.click(screen.getByRole('button', { name: 'Authorise AutoPay' }));
    expect(await screen.findByText('Enter the most that may be paid at one time.')).toBeInTheDocument();
    await userEvent.type(cap, '10000');
    await userEvent.click(screen.getByRole('button', { name: 'Authorise AutoPay' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/autopay-mandates')?.body).toMatchObject({
        unitId: 312,
        mandateType: 'UPI_AUTOPAY',
        maxAmountPaise: 1000000,
      }),
    );
    expect(await screen.findByText('Approve in your bank app')).toBeInTheDocument();
  });

  it('shows MANDATE_LIMIT_EXCEEDED in plain words', async () => {
    show({
      'GET /me/autopay-mandates': ok([]),
      'POST /me/autopay-mandates': err(422, 'MANDATE_LIMIT_EXCEEDED'),
    });
    await userEvent.type(await screen.findByLabelText('Cap per payment (₹)'), '999999');
    await userEvent.click(screen.getByRole('button', { name: 'Authorise AutoPay' }));
    expect(
      await screen.findByText('The cap is outside the limits allowed. Change the amount.'),
    ).toBeInTheDocument();
  });
});
