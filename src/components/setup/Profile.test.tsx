import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { society } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { ProfileScreen } from './ProfileScreen';

vi.mock('next/navigation', () => navigationMock());

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms?: string[], features?: string[]) {
  signIn(perms, features);
  const api = mockApi({ 'GET /society': ok(society()), ...routes });
  render(
    <ToastProvider>
      <ProfileScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Society profile (11.2)', () => {
  beforeEach(resetAll);

  it('shows a skeleton while loading', () => {
    renderIt();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows the error state with the reference', async () => {
    renderIt({ 'GET /society': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });

  it('fills the full form from the profile', async () => {
    renderIt();
    expect(await screen.findByRole('textbox', { name: /^Legal name/ })).toHaveValue(
      'Sky Heights Co-operative Housing Society Ltd',
    );
    expect(screen.getByRole('textbox', { name: /^PAN/ })).toHaveValue('AAAAS1234C');
    expect(screen.getByRole('textbox', { name: /^GSTIN/ })).toHaveValue('27AAAAS1234C1Z5');
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveValue('Maharashtra');
  });

  it('saves a plain change with only the changed fields and the version', async () => {
    const api = renderIt({ 'PATCH /society': ok(society({ city: 'Mumbai', version: 8 })) });
    const city = await screen.findByRole('textbox', { name: /^City/ });
    await userEvent.clear(city);
    await userEvent.type(city, 'Mumbai');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/society')).toBeTruthy());
    expect(api.last('PATCH', '/society')!.body).toEqual({ version: 7, city: 'Mumbai' });
    expect(await screen.findByText('Society profile saved.')).toBeInTheDocument();
  });

  it('asks for a reason when the GSTIN changes and sends it', async () => {
    const api = renderIt({ 'PATCH /society': ok(society({ version: 8 })) });
    const gstin = await screen.findByRole('textbox', { name: /^GSTIN/ });
    await userEvent.clear(gstin);
    await userEvent.type(gstin, '27AAAAS1234C1Z5'.replace('S1234', 'S5678'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Reason/ }), 'New registration');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/society')).toBeTruthy());
    expect(api.last('PATCH', '/society')!.body).toMatchObject({
      gstin: '27AAAAS5678C1Z5',
      reason: 'New registration',
    });
  });

  it.each([
    ['GSTIN_CHECKSUM_INVALID', /check digit is wrong/],
    ['GSTIN_STATE_MISMATCH', /state code/],
    ['GSTIN_PAN_MISMATCH', /PAN inside the GSTIN/],
    ['TIMEZONE_LOCKED', /cannot change after go-live/],
    ['STALE_VERSION', /Someone else changed this/],
  ])('shows words for %s', async (code, text) => {
    renderIt({ 'PATCH /society': err(code === 'STALE_VERSION' ? 409 : 422, code) });
    const city = await screen.findByRole('textbox', { name: /^City/ });
    await userEvent.clear(city);
    await userEvent.type(city, 'Thane');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('checks the PIN code before sending', async () => {
    const api = renderIt();
    const pin = await screen.findByRole('textbox', { name: /^PIN code/ });
    await userEvent.clear(pin);
    await userEvent.type(pin, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a 6 digit PIN code.')).toBeInTheDocument();
    expect(api.last('PATCH', '/society')).toBeUndefined();
  });

  it('locks the time zone and language after go-live', async () => {
    renderIt({ 'GET /society': ok(society({ isLive: true })) });
    expect(await screen.findByRole('combobox', { name: 'Time zone' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeDisabled();
  });

  it('is read only without the edit permission', async () => {
    renderIt({}, ['settings.society.view']);
    expect(await screen.findByRole('textbox', { name: /^Society name/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('shows the plan lock without property.society_profile', async () => {
    renderIt({}, undefined, []);
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
});
