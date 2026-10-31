import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { flow } from '@/lib/authFlow';
import { MfaScreen } from './MfaScreen';

vi.mock('next/navigation', () => navigationMock());
const seed = () =>
  flow.set({ mfa: { challengeToken: 'lc_tok', methods: ['TOTP', 'RECOVERY_CODE'], expiresAt: 'x' } });

beforeEach(resetAll);

describe('MfaScreen', () => {
  it('returns to sign in with the challenge notice when nothing is in memory', async () => {
    render(<MfaScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?r=challenge'));
  });

  it('verifies a TOTP code on the sixth digit and signs in', async () => {
    seed();
    const api = mockApi({ 'POST /auth/mfa/verify': ok({ status: 'SIGNED_IN', me: sampleMe() }) });
    render(<MfaScreen />);
    await userEvent.click(await screen.findByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('654321');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin'));
    expect(api.last('POST', '/auth/mfa/verify')?.body).toEqual({
      challengeToken: 'lc_tok',
      method: 'TOTP',
      code: '654321',
    });
  });

  it('shows attempts left on a wrong code', async () => {
    seed();
    mockApi({ 'POST /auth/mfa/verify': err(401, 'TOTP_INVALID', [{ field: 'attemptsLeft', message: '1' }]) });
    render(<MfaScreen />);
    await userEvent.click(await screen.findByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('000000');
    expect(await screen.findByText(/not correct.*1 attempt left/)).toBeInTheDocument();
  });

  it('uses a recovery code: validates the format and normalises the input', async () => {
    seed();
    const api = mockApi({ 'POST /auth/mfa/verify': ok({ status: 'SIGNED_IN', me: sampleMe() }) });
    render(<MfaScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Use a recovery code' }));
    expect(screen.getByText('Each recovery code works once.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Recovery code/), 'nonsense');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(screen.getByLabelText(/Recovery code/)).toHaveAttribute('aria-invalid', 'true');
    expect(api.fn).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText(/Recovery code/));
    await userEvent.type(screen.getByLabelText(/Recovery code/), 'rc 7k2m q9xd');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin'));
    expect(api.last('POST', '/auth/mfa/verify')?.body).toEqual({
      challengeToken: 'lc_tok',
      method: 'RECOVERY_CODE',
      code: 'RC-7K2M-Q9XD',
    });
  });

  it('goes back to sign in when the challenge has expired', async () => {
    seed();
    mockApi({ 'POST /auth/mfa/verify': err(401, 'CHALLENGE_INVALID') });
    render(<MfaScreen />);
    await userEvent.click(await screen.findByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('123456');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?r=challenge'));
    expect(flow.get().mfa).toBeUndefined();
  });

  it('shows the lock countdown', async () => {
    seed();
    mockApi({
      'POST /auth/mfa/verify': err(429, 'ACCOUNT_LOCKED', [{ field: 'retryAfterSeconds', message: '600' }]),
    });
    render(<MfaScreen />);
    await userEvent.click(await screen.findByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('123456');
    expect(await screen.findByText(/Try again in (9:5\d|10:00)\./)).toBeInTheDocument();
  });
});
