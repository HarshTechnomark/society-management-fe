import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router, search } from '@/test/helpers';
import { ChoosePasswordScreen } from './ChoosePasswordScreen';
import { ForgotScreen } from './ForgotScreen';
import { VerifyEmailScreen } from './VerifyEmailScreen';
import { SignupScreen } from './SignupScreen';
import { SignupDetailsScreen } from './SignupDetailsScreen';
import { flow } from '@/lib/authFlow';

vi.mock('next/navigation', () => navigationMock());

const TOKEN = 'A'.repeat(43);
beforeEach(resetAll);

describe('ForgotScreen', () => {
  it('validates the email', async () => {
    const api = mockApi({});
    render(<ForgotScreen />);
    await userEvent.type(screen.getByLabelText(/^Email/), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(api.fn).not.toHaveBeenCalled();
  });

  it('shows the same "check your email" text and a resend timer', async () => {
    const api = mockApi({ 'POST /auth/password/forgot': ok(null) });
    render(<ForgotScreen />);
    await userEvent.type(screen.getByLabelText(/^Email/), 'Office@SkyHeights.in');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(
      await screen.findByText(/a reset link is on its way\. It expires in 15 minutes/),
    ).toBeInTheDocument();
    expect(api.last('POST', '/auth/password/forgot')?.body).toEqual({ email: 'office@skyheights.in' });
    expect(screen.getByRole('button', { name: /Resend link in/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
  });

  it('shows the mobile OTP hint on ADMIN only', () => {
    mockApi({});
    render(<ForgotScreen />);
    expect(screen.getByText(/Prefer a code on your phone/)).toBeInTheDocument();
  });
});

describe('ChoosePasswordScreen', () => {
  const status = (data: object) => ({ 'GET /auth/password/link-status': ok(data) });

  it('shows "not valid" for a malformed link without calling the API', async () => {
    search.current = new URLSearchParams('token=short');
    const api = mockApi({});
    render(<ChoosePasswordScreen mode="reset" />);
    expect(await screen.findByText('This link is not valid.')).toBeInTheDocument();
    expect(api.fn).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot');
  });

  it.each([
    ['EXPIRED', 'This link has expired.'],
    ['USED', 'This link was already used.'],
    ['INVALID', 'This link is not valid.'],
  ])('shows %s link status', async (reason, text) => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    mockApi(status({ valid: false, reason }));
    render(<ChoosePasswordScreen mode="reset" />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('shows the email, live rules and a strength meter', async () => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    mockApi(status({ valid: true, email: 'office@skyheights.in' }));
    render(<ChoosePasswordScreen mode="reset" />);
    expect(await screen.findByText('office@skyheights.in')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Password rules' })).getAllByRole('listitem'),
    ).toHaveLength(6);
    await userEvent.type(screen.getByLabelText(/^New password/), 'Demo@Society2026');
    expect(screen.getByText(/Strength: Strong/)).toBeInTheDocument();
    expect(screen.getAllByText(/\(met\)/)).toHaveLength(6);
  });

  it('flags the email rule (T02-02) and blocks a mismatch', async () => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    const api = mockApi(status({ valid: true, email: 'chairman@skyheights.in' }));
    render(<ChoosePasswordScreen mode="reset" />);
    await screen.findByText('chairman@skyheights.in');
    await userEvent.type(screen.getByLabelText(/^New password/), 'Rajesh@chairman1');
    expect(screen.getByText('Does not contain your email name').parentElement).toHaveTextContent('(not met)');
    await userEvent.type(screen.getByLabelText(/^Confirm password/), 'different');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Confirm password/)).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('resets the password and offers to continue to sign in', async () => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    const api = mockApi({
      ...status({ valid: true, email: 'office@skyheights.in' }),
      'POST /auth/password/reset': ok(null),
    });
    render(<ChoosePasswordScreen mode="reset" />);
    await screen.findByText('office@skyheights.in');
    await userEvent.type(screen.getByLabelText(/^New password/), 'Demo@Society2026');
    await userEvent.type(screen.getByLabelText(/^Confirm password/), 'Demo@Society2026');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
    expect(api.last('POST', '/auth/password/reset')?.body).toEqual({
      token: TOKEN,
      password: 'Demo@Society2026',
    });
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/login?r=reset',
    );
  });

  it('setup mode uses the setup endpoint and r=invite', async () => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    const api = mockApi({
      ...status({ valid: true, email: 'kavita@tulip.in' }),
      'POST /auth/password/setup': ok(null),
    });
    render(<ChoosePasswordScreen mode="setup" />);
    await screen.findByRole('heading', { name: 'Set your password' });
    await userEvent.type(screen.getByLabelText(/^New password/), 'Demo@Society2026');
    await userEvent.type(screen.getByLabelText(/^Confirm password/), 'Demo@Society2026');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('You are all set')).toBeInTheDocument();
    expect(api.last('GET', '/auth/password/link-status')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/login?r=invite',
    );
  });

  it('shows the used-link screen when the submit says LINK_USED', async () => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    mockApi({
      ...status({ valid: true, email: 'o@s.in' }),
      'POST /auth/password/reset': err(400, 'LINK_USED'),
    });
    render(<ChoosePasswordScreen mode="reset" />);
    await screen.findByText('o@s.in');
    await userEvent.type(screen.getByLabelText(/^New password/), 'Demo@Society2026');
    await userEvent.type(screen.getByLabelText(/^Confirm password/), 'Demo@Society2026');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('This link was already used.')).toBeInTheDocument();
  });

  it('maps PASSWORD_POLICY_FAILED to the failed rules', async () => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    mockApi({
      ...status({ valid: true, email: 'o@s.in' }),
      'POST /auth/password/reset': err(422, 'PASSWORD_POLICY_FAILED', [
        { field: 'password', message: 'breach' },
      ]),
    });
    render(<ChoosePasswordScreen mode="reset" />);
    await screen.findByText('o@s.in');
    await userEvent.type(screen.getByLabelText(/^New password/), 'Demo@Society2026');
    await userEvent.type(screen.getByLabelText(/^Confirm password/), 'Demo@Society2026');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText(/Needs: not a commonly breached password/)).toBeInTheDocument();
  });
});

describe('VerifyEmailScreen', () => {
  it('confirms the email', async () => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    mockApi({ 'POST /auth/email/verify': ok({ email: 'new@mail.in' }) });
    render(<VerifyEmailScreen />);
    expect(await screen.findByText('Your email is confirmed')).toBeInTheDocument();
    expect(screen.getByText('new@mail.in')).toBeInTheDocument();
  });
  it('explains an expired link', async () => {
    search.current = new URLSearchParams(`token=${TOKEN}`);
    mockApi({ 'POST /auth/email/verify': err(400, 'LINK_EXPIRED') });
    render(<VerifyEmailScreen />);
    expect(await screen.findByText(/This link has expired/)).toBeInTheDocument();
  });
});

describe('Sign up', () => {
  it('validates the mobile, then sends a SIGNUP OTP', async () => {
    const api = mockApi({
      'POST /auth/otp/send': ok({
        challengeId: 'otp_k3mzq7wd2xa5hn4pbc6rtyv2',
        maskedMobile: '98XXXXX222',
        channel: 'SMS',
        expiresAt: 'x',
        resendAvailableAt: new Date().toISOString(),
        resendsLeft: 3,
      }),
    });
    render(<SignupScreen />);
    await userEvent.type(screen.getByLabelText(/Mobile number/), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByLabelText(/Mobile number/)).toHaveAttribute('aria-invalid', 'true');
    expect(api.fn).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText(/Mobile number/));
    await userEvent.type(screen.getByLabelText(/Mobile number/), '9820022222');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/otp'));
    expect(api.last('POST', '/auth/otp/send')?.body).toEqual({ mobile: '9820022222', purpose: 'SIGNUP' });
    expect(flow.get().otp?.purpose).toBe('SIGNUP');
  });

  it('is only offered on the admin app', () => {
    window.history.replaceState(null, '', '/signup?app=RESIDENT');
    render(<SignupScreen />);
    expect(screen.getByText('Societies are created from the society admin app.')).toBeInTheDocument();
  });

  it('the details step needs a verified signup token', async () => {
    render(<SignupDetailsScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/signup'));
  });
});
