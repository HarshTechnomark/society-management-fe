import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(resetAll);

const mobileBox = () => screen.findByLabelText(/mobile number/i);

describe('LoginScreen (ADMIN)', () => {
  it('shows both methods and no demo accounts', async () => {
    render(<LoginScreen />);
    expect(await screen.findByRole('tab', { name: 'Mobile OTP' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Email and password' })).toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).toBeNull();
  });

  it('validates the mobile number inline with aria-invalid and does not call the API', async () => {
    const api = mockApi({});
    render(<LoginScreen />);
    await userEvent.type(await mobileBox(), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    const input = screen.getByLabelText(/mobile number/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid 10-digit mobile number.');
    expect(api.fn).not.toHaveBeenCalled();
  });

  it('sends the OTP with a normalised number and goes to the OTP screen', async () => {
    const api = mockApi({ 'POST /auth/otp/send': ok(otpChallenge(), 'sent') });
    render(<LoginScreen />);
    await userEvent.type(await mobileBox(), '+91 98200 11111');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/otp'));
    expect(api.last('POST', '/auth/otp/send')?.body).toEqual({ mobile: '9820011111', purpose: 'LOGIN' });
    expect(flow.get().otp).toMatchObject({
      purpose: 'LOGIN',
      mobile: '9820011111',
      maskedMobile: '98XXXXX222',
    });
  });

  it('keeps next across the OTP step', async () => {
    search.current = new URLSearchParams('next=/admin/money');
    mockApi({ 'POST /auth/otp/send': ok(otpChallenge()) });
    render(<LoginScreen />);
    await userEvent.type(await mobileBox(), '9820011111');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/otp?next=%2Fadmin%2Fmoney'));
  });

  it('validates email and password', async () => {
    mockApi({});
    render(<LoginScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Email and password' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('signs in with email and password, lands on /admin and remembers the email only when asked', async () => {
    mockApi({ 'POST /auth/password/login': ok({ status: 'SIGNED_IN', me: sampleMe() }) });
    render(<LoginScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Email and password' }));
    await userEvent.type(screen.getByLabelText(/^Email/), 'Chairman@SkyHeights.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Demo@Society2026');
    await userEvent.click(screen.getByLabelText('Remember my email'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin'));
    expect(localStorage.getItem('sa_remember_email')).toBe('chairman@skyheights.in');
    expect(JSON.stringify({ ...localStorage })).not.toContain('Demo@Society2026');
  });

  it('goes to MFA when the API asks for a second step', async () => {
    mockApi({
      'POST /auth/password/login': ok({
        status: 'MFA_REQUIRED',
        challengeToken: 'lc_x',
        methods: ['TOTP', 'RECOVERY_CODE'],
        expiresAt: 'x',
      }),
    });
    render(<LoginScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Email and password' }));
    await userEvent.type(screen.getByLabelText(/^Email/), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/mfa'));
    expect(flow.get().mfa?.challengeToken).toBe('lc_x');
  });

  it('sends to society picker when the user has several societies', async () => {
    mockApi({
      'POST /auth/password/login': ok({ status: 'SIGNED_IN', me: sampleMe({ needsSocietyPick: true }) }),
    });
    render(<LoginScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Email and password' }));
    await userEvent.type(screen.getByLabelText(/^Email/), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/society'));
  });

  it('shows a generic message for wrong credentials in an assertive alert', async () => {
    mockApi({ 'POST /auth/password/login': err(401, 'INVALID_CREDENTIALS') });
    render(<LoginScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Email and password' }));
    await userEvent.type(screen.getByLabelText(/^Email/), 'a@b.in');
    await userEvent.type(screen.getByLabelText(/^Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The email or password is not correct.');
  });

  it('shows the lock countdown and disables the button on ACCOUNT_LOCKED', async () => {
    mockApi({
      'POST /auth/otp/send': err(429, 'ACCOUNT_LOCKED', [{ field: 'retryAfterSeconds', message: '1781' }]),
    });
    render(<LoginScreen />);
    await userEvent.type(await mobileBox(), '9820011111');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText(/Too many attempts\. Try again in 29:4\d\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
  });

  it('shows the notice for the r query', async () => {
    search.current = new URLSearchParams('r=idle');
    render(<LoginScreen />);
    expect(await screen.findByText(/signed out after a period of inactivity/)).toBeInTheDocument();
  });

  it('PLATFORM offers only email and password with a Work email label', async () => {
    window.history.replaceState(null, '', '/login?app=PLATFORM');
    render(<LoginScreen />);
    expect(await screen.findByLabelText(/Work email/)).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByLabelText(/mobile number/i)).toBeNull();
  });

  it('RESIDENT offers only mobile', async () => {
    window.history.replaceState(null, '', '/login?app=RESIDENT');
    render(<LoginScreen />);
    expect(await mobileBox()).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText('Forgot password?')).toBeNull();
  });
});
