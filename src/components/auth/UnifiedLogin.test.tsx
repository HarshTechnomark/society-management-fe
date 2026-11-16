import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  err,
  mockApi,
  navigationMock,
  ok,
  otpChallenge,
  resetAll,
  router,
  sampleMe,
  search,
} from '@/test/helpers';
import { flow } from '@/lib/authFlow';
import { LoginScreen } from './LoginScreen';

vi.mock('next/navigation', () => navigationMock());

// The single sign-in address: no forced app, a host that is not a role host (jsdom's is "localhost").
beforeEach(() => {
  resetAll();
  vi.stubEnv('NEXT_PUBLIC_CLIENT_APP', '');
});
afterEach(() => vi.unstubAllEnvs());

const box = () => screen.findByLabelText(/mobile number or email/i);
const meFor = (clientApp: 'PLATFORM' | 'ADMIN' | 'RESIDENT' | 'GATE' | 'WORK', over = {}) => {
  const me = sampleMe(over);
  me.session.clientApp = clientApp;
  return me;
};

describe('the single sign-in page', () => {
  it('has one box for a mobile number or an email, no method tabs and a neutral brand panel', async () => {
    render(<LoginScreen />);
    expect(await box()).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByLabelText(/^Password/)).toBeNull();
    expect(screen.getAllByText('One sign-in for everyone.').length).toBeGreaterThan(0);
    expect(screen.queryByText('SOCIETY ADMIN')).toBeNull();
    expect(screen.queryByText('PLATFORM CONSOLE')).toBeNull();
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/signup');
  });

  it('a mobile number gets a text code: normalised, then the OTP screen', async () => {
    const api = mockApi({ 'POST /auth/otp/send': ok(otpChallenge(), 'sent') });
    render(<LoginScreen />);
    await userEvent.type(await box(), '+91 98200 11111');
    expect(screen.getByText('We will text a 6-digit code.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Password/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/otp'));
    expect(api.last('POST', '/auth/otp/send')?.body).toEqual({ mobile: '9820011111', purpose: 'LOGIN' });
    expect(flow.get().otp).toMatchObject({ purpose: 'LOGIN', mobile: '9820011111' });
  });

  it('keeps next across the OTP step', async () => {
    search.current = new URLSearchParams('next=/resident/bills');
    mockApi({ 'POST /auth/otp/send': ok(otpChallenge()) });
    render(<LoginScreen />);
    await userEvent.type(await box(), '9820011111');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/otp?next=%2Fresident%2Fbills'));
  });

  it('refuses a bad mobile number inline without calling the API', async () => {
    const api = mockApi({});
    render(<LoginScreen />);
    await userEvent.type(await box(), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    const input = screen.getByLabelText(/mobile number or email/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid 10-digit mobile number.');
    expect(api.fn).not.toHaveBeenCalled();
  });

  it('asks for a mobile number or an email when the box holds letters without an @', async () => {
    const api = mockApi({});
    render(<LoginScreen />);
    await userEvent.type(await box(), 'rajesh');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText(/mobile number or email/i)).toHaveAccessibleDescription(
      'Enter your mobile number or your email address.',
    );
    expect(api.fn).not.toHaveBeenCalled();
  });

  it('an email brings up the password field, and it goes away again when the box is cleared', async () => {
    render(<LoginScreen />);
    const input = await box();
    await userEvent.type(input, 'chairman@skyheights.in');
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot');
    await userEvent.clear(input);
    expect(screen.queryByLabelText(/^Password/)).toBeNull();
  });

  it('validates the email and the password', async () => {
    const api = mockApi({});
    render(<LoginScreen />);
    await userEvent.type(await box(), 'not@valid');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText(/mobile number or email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'true');
    expect(api.fn).not.toHaveBeenCalled();
  });

  it.each([
    ['ADMIN', '/admin'],
    ['PLATFORM', '/platform'],
    ['RESIDENT', '/resident'],
    ['GATE', '/gate'],
    ['WORK', '/work'],
  ] as const)('lands in the app the API chose: %s goes to %s', async (app, home) => {
    mockApi({ 'POST /auth/password/login': ok({ status: 'SIGNED_IN', me: meFor(app) }) });
    render(<LoginScreen />);
    await userEvent.type(await box(), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(home));
  });

  it('goes to the destination that was asked for, when there is one', async () => {
    search.current = new URLSearchParams('next=/admin/billing/dues');
    mockApi({ 'POST /auth/password/login': ok({ status: 'SIGNED_IN', me: meFor('ADMIN') }) });
    render(<LoginScreen />);
    await userEvent.type(await box(), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/billing/dues'));
  });

  it('a person with several societies is sent to the society picker', async () => {
    mockApi({
      'POST /auth/password/login': ok({
        status: 'SIGNED_IN',
        me: meFor('ADMIN', { needsSocietyPick: true }),
      }),
    });
    render(<LoginScreen />);
    await userEvent.type(await box(), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/society'));
  });

  it('a person who may open more than one app is sent to choose, and the choice waits in memory', async () => {
    search.current = new URLSearchParams('next=/resident/bills');
    mockApi({
      'POST /auth/password/login': ok({
        status: 'APP_CHOICE_REQUIRED',
        challengeToken: 'lc_app',
        apps: ['PLATFORM', 'ADMIN'],
        expiresAt: 'x',
      }),
    });
    render(<LoginScreen />);
    await userEvent.type(await box(), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/app?next=%2Fresident%2Fbills'));
    expect(flow.get().appChoice).toEqual({
      challengeToken: 'lc_app',
      apps: ['PLATFORM', 'ADMIN'],
      expiresAt: 'x',
    });
  });

  it('goes on to the second step when the API asks for it', async () => {
    mockApi({
      'POST /auth/password/login': ok({
        status: 'MFA_REQUIRED',
        challengeToken: 'lc_x',
        methods: ['TOTP', 'RECOVERY_CODE'],
        expiresAt: 'x',
      }),
    });
    render(<LoginScreen />);
    await userEvent.type(await box(), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/mfa'));
    expect(flow.get().mfa?.challengeToken).toBe('lc_x');
  });

  it('says the same thing for wrong credentials, and shows a method that is not allowed in words', async () => {
    mockApi({ 'POST /auth/password/login': err(401, 'INVALID_CREDENTIALS') });
    render(<LoginScreen />);
    await userEvent.type(await box(), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The email or password is not correct.');
  });

  it('shows the lock countdown and disables the button on ACCOUNT_LOCKED', async () => {
    mockApi({
      'POST /auth/otp/send': err(429, 'ACCOUNT_LOCKED', [{ field: 'retryAfterSeconds', message: '1781' }]),
    });
    render(<LoginScreen />);
    await userEvent.type(await box(), '9820011111');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText(/Too many attempts\. Try again in 29:4\d\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
  });

  it('remembers the email only when asked, and a remembered email brings the password field up at once', async () => {
    mockApi({ 'POST /auth/password/login': ok({ status: 'SIGNED_IN', me: meFor('ADMIN') }) });
    render(<LoginScreen />);
    await userEvent.type(await box(), 'Chairman@SkyHeights.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Demo@Society2026');
    await userEvent.click(screen.getByLabelText('Remember my email'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin'));
    expect(localStorage.getItem('sa_remember_email')).toBe('chairman@skyheights.in');
    expect(JSON.stringify({ ...localStorage })).not.toContain('Demo@Society2026');

    document.body.innerHTML = '';
    render(<LoginScreen />);
    expect(await box()).toHaveValue('chairman@skyheights.in');
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
  });

  it('shows the notice for the r query', async () => {
    search.current = new URLSearchParams('r=idle');
    render(<LoginScreen />);
    expect(await screen.findByText(/signed out after a period of inactivity/)).toBeInTheDocument();
  });
});

describe('a role address keeps its own sign-in page', () => {
  it('a forced app shows the per-app tabs, not the single box', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLIENT_APP', 'ADMIN');
    render(<LoginScreen />);
    expect(await screen.findByRole('tab', { name: 'Mobile OTP' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/mobile number or email/i)).toBeNull();
  });
});
