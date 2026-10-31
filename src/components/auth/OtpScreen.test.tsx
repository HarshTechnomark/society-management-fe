import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  err,
  futureIso,
  mockApi,
  navigationMock,
  ok,
  otpChallenge,
  resetAll,
  router,
  sampleMe,
} from '@/test/helpers';
import type { OtpChallenge } from '@/types/auth';
import { flow } from '@/lib/authFlow';
import { OtpScreen } from './OtpScreen';

vi.mock('next/navigation', () => navigationMock());

const seed = (over: object = {}, purpose: 'LOGIN' | 'SIGNUP' = 'LOGIN') =>
  flow.set({ otp: { ...(otpChallenge(over) as unknown as OtpChallenge), purpose, mobile: '9820022222' } });
const type = async (code: string) => {
  await userEvent.click(await screen.findByLabelText('Digit 1 of 6'));
  await userEvent.keyboard(code);
};

beforeEach(resetAll);

describe('OtpScreen', () => {
  it('goes back to sign in when there is no challenge in memory', async () => {
    render(<OtpScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('shows the masked number without confirming the number is registered', async () => {
    seed();
    render(<OtpScreen />);
    expect(await screen.findByText(/98XXXXX222 if it is registered/)).toBeInTheDocument();
  });

  it('auto-submits the sixth digit and signs in', async () => {
    seed();
    const api = mockApi({ 'POST /auth/otp/verify': ok({ status: 'SIGNED_IN', me: sampleMe() }) });
    render(<OtpScreen />);
    await type('123456');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin'));
    expect(api.last('POST', '/auth/otp/verify')?.body).toEqual({
      challengeId: 'otp_k3mzq7wd2xa5hn4pbc6rtyv2',
      code: '123456',
    });
    expect(flow.get().otp).toBeUndefined();
  });

  it('goes to the authenticator step when MFA is needed', async () => {
    seed();
    mockApi({
      'POST /auth/otp/verify': ok({
        status: 'MFA_ENROLL_REQUIRED',
        challengeToken: 'lc_a',
        methods: ['TOTP_ENROLL'],
        expiresAt: 'x',
      }),
    });
    render(<OtpScreen />);
    await type('123456');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/mfa/enroll'));
  });

  it('shows attempts left and clears the boxes on a wrong code', async () => {
    seed();
    mockApi({ 'POST /auth/otp/verify': err(401, 'OTP_INVALID', [{ field: 'attemptsLeft', message: '3' }]) });
    render(<OtpScreen />);
    await type('000000');
    expect(await screen.findByText(/That code is not correct\. 3 attempts left\./)).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('');
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAttribute('aria-invalid', 'true');
  });

  it('offers Resend when the code has expired', async () => {
    seed({ resendAvailableAt: futureIso(-5) });
    mockApi({ 'POST /auth/otp/verify': err(401, 'OTP_EXPIRED') });
    render(<OtpScreen />);
    await type('123456');
    expect(await screen.findByText('That code has expired. Request a new one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled();
  });

  it('shows the lock countdown', async () => {
    seed();
    mockApi({
      'POST /auth/otp/verify': err(429, 'ACCOUNT_LOCKED', [{ field: 'retryAfterSeconds', message: '900' }]),
    });
    render(<OtpScreen />);
    await type('123456');
    expect(await screen.findByText(/Try again in 1[45]:\d\d\./)).toBeInTheDocument();
  });

  it('disables Resend with a countdown, then enables it', async () => {
    seed({ resendAvailableAt: futureIso(24) });
    render(<OtpScreen />);
    expect(await screen.findByText(/You can request another code in 2[34]s/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send on WhatsApp instead' })).toBeDisabled();
  });

  it('resends on WhatsApp with the new challenge id', async () => {
    seed({ resendAvailableAt: futureIso(-1) });
    const api = mockApi({
      'POST /auth/otp/resend': ok(
        otpChallenge({ challengeId: 'otp_bbbbbbbbbbbbbbbbbbbbbbbb', channel: 'WHATSAPP', resendsLeft: 2 }),
      ),
      'POST /auth/otp/verify': ok({ status: 'SIGNED_IN', me: sampleMe() }),
    });
    render(<OtpScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Send on WhatsApp instead' }));
    await waitFor(() => expect(screen.getByText(/It is on WhatsApp/)).toBeInTheDocument());
    expect(api.last('POST', '/auth/otp/resend')?.body).toEqual({
      challengeId: 'otp_k3mzq7wd2xa5hn4pbc6rtyv2',
      channel: 'WHATSAPP',
    });
    await type('123456');
    await waitFor(() =>
      expect(api.last('POST', '/auth/otp/verify')?.body).toMatchObject({
        challengeId: 'otp_bbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    );
  });

  it('says so when the three resends are used', async () => {
    seed({ resendAvailableAt: futureIso(-1), resendsLeft: 0 });
    render(<OtpScreen />);
    expect(await screen.findByText(/No more resends/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();
  });

  it('sign-up purpose hands the signup token on in memory and goes to the details step', async () => {
    seed({}, 'SIGNUP');
    mockApi({
      'POST /auth/otp/verify': ok({
        status: 'SIGNUP_VERIFIED',
        signupToken: 'su_abc',
        mobile: '9820022222',
        expiresAt: 'x',
      }),
    });
    render(<OtpScreen />);
    await type('123456');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/signup/details'));
    expect(flow.get().signup?.signupToken).toBe('su_abc');
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain('su_abc');
  });

  it('sign-up on a number that has an account shows the sign-in message', async () => {
    seed({}, 'SIGNUP');
    mockApi({ 'POST /auth/otp/verify': err(409, 'MOBILE_IN_USE') });
    render(<OtpScreen />);
    await type('123456');
    expect(await screen.findByText(/This number already has an account\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in instead.' })).toHaveAttribute('href', '/login');
  });
});
