import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { INV_FEATURES, INV_PERMS, detailRaw, headRaw, unitRaw } from '@/test/billingInvoicesFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { AdHocInvoiceDrawer } from './AdHocInvoiceDrawer';
import { addDaysIso, todayIso } from './format';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
function renderIt(routes: Routes = {}) {
  signInAs(INV_PERMS, INV_FEATURES);
  const api = mockApi({
    'GET /billing/charge-heads': ok([headRaw(), headRaw({ id: 1, name: 'Maintenance', isSystem: true })]),
    'GET /units': ok([unitRaw()]),
    ...routes,
  });
  const onCreated = vi.fn();
  render(
    <ToastProvider>
      <AdHocInvoiceDrawer onClose={() => {}} onCreated={onCreated} />
    </ToastProvider>,
  );
  return { api, onCreated };
}

async function fill() {
  await userEvent.type(screen.getByLabelText(/^Flat/), 'C-08');
  await userEvent.selectOptions(await screen.findByLabelText('Matching flats'), '312');
  await screen.findByRole('option', { name: 'Hall booking' });
  await userEvent.selectOptions(screen.getByLabelText('Charge head, line 1'), '4');
  await userEvent.type(screen.getByLabelText('Description, line 1'), 'Community hall, 12 Nov');
  await userEvent.type(screen.getByLabelText('Amount in rupees, line 1'), '2500.75');
  await userEvent.type(screen.getByLabelText(/Narration/), 'Birthday party booking');
}
const create = () => screen.getByRole('button', { name: 'Create invoice' });
beforeEach(resetAll);

describe('New invoice', () => {
  it('lists active non-system heads and defaults the due date to 15 days ahead', async () => {
    renderIt();
    await screen.findByRole('option', { name: 'Hall booking' });
    expect(screen.queryByRole('option', { name: 'Maintenance' })).toBeNull();
    expect(screen.getByLabelText(/Due date/)).toHaveValue(addDaysIso(todayIso(), 15));
  });

  it('checks the fields before sending', async () => {
    const { api } = renderIt();
    await screen.findByRole('option', { name: 'Hall booking' });
    await userEvent.click(create());
    expect(await screen.findByText('Choose the flat to bill.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Flat/), 'C-08');
    await userEvent.selectOptions(await screen.findByLabelText('Matching flats'), '312');
    await userEvent.click(create());
    expect(await screen.findByText('Line 1: choose a charge head.')).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('rejects a due date in the past', async () => {
    renderIt();
    await fill();
    const due = screen.getByLabelText(/Due date/);
    fireEvent.change(due, { target: { value: '2020-01-01' } });
    await userEvent.click(create());
    expect(await screen.findByText(/due date must be from today/)).toBeInTheDocument();
  });

  it('sends flat, lines in paise, due date and narration with an idempotency key', async () => {
    const { api, onCreated } = renderIt({ 'POST /invoices': ok(detailRaw({ invoiceType: 'ADHOC' })) });
    await fill();
    await userEvent.click(create());
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.last('POST', '/invoices')!.body).toEqual({
      unitId: 312,
      lines: [{ chargeHeadId: 4, description: 'Community hall, 12 Nov', amountPaise: 250075 }],
      dueDate: addDaysIso(todayIso(), 15),
      description: 'Birthday party booking',
    });
    const init = api.fn.mock.calls.find(c => String(c[0]).endsWith('/invoices'))![1] as RequestInit;
    expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy();
  });

  it.each([
    ['NO_BILL_TO', /no owner or payer/],
    ['MIXED_BILL_TO', /billed to different people/],
    ['UNIT_NOT_FOUND', /not found or is archived/],
    ['PERIOD_LOCKED', /books are locked/],
  ])('shows %s in words and keeps the form', async (code, text) => {
    const { onCreated } = renderIt({ 'POST /invoices': err(422, code) });
    await fill();
    await userEvent.click(create());
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Description, line 1')).toHaveValue('Community hall, 12 Nov');
  });

  it('shows when charge heads cannot be loaded', async () => {
    renderIt({ 'GET /billing/charge-heads': err(403, 'PERMISSION_DENIED') });
    expect(await screen.findByText(/do not have permission/)).toBeInTheDocument();
  });

  it('can change the flat after choosing it', async () => {
    renderIt();
    await userEvent.type(screen.getByLabelText(/^Flat/), 'C-08');
    await userEvent.selectOptions(await screen.findByLabelText('Matching flats'), '312');
    const box = screen.getByText('C-0801', { selector: 'span' });
    expect(within(box.parentElement!).getByRole('button', { name: 'Change flat' })).toBeInTheDocument();
  });
});
