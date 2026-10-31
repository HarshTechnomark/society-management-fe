import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { flow } from '@/lib/authFlow';
import { getMe } from '@/lib/auth';
import { EnrollScreen } from './EnrollScreen';
import { RecoveryCodesScreen } from './RecoveryCodesScreen';

vi.mock('next/navigation', () => navigationMock());
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') },
}));

const SETUP = {
  secret: 'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP',
  otpauthUri: 'otpauth://totp/SocietyApp:t%40x.in?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  accountLabel: 't@x.in',
};
const CODES = [
  'RC-7K2M-Q9XD',
  'RC-AAAA-BBBB',
  'RC-CCCC-DDDD',
  'RC-EEEE-FFFF',
  'RC-GGGG-HHHH',
  'RC-JJJJ-KKKK',
  'RC-MMMM-NNNN',
  'RC-PPPP-QQQQ',
  'RC-RRRR-SSSS',
  'RC-TTTT-VVVV',
];

beforeEach(() => {
  resetAll();
  flow.set({ mfa: { challengeToken: 'lc_t', methods: ['TOTP_ENROLL'], expiresAt: 'x' } });
});

describe('EnrollScreen', () => {
  it('starts enrolment once and shows the QR, the 32-character key in groups, account and type', async () => {
    const api = mockApi({ 'POST /auth/mfa/enroll/start': ok(SETUP) });
    render(<EnrollScreen />);
    expect(await screen.findByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
    expect(await screen.findByAltText(/QR code/)).toBeInTheDocument();
    expect(screen.getByText('t@x.in')).toBeInTheDocument();
    expect(screen.getByText('Time-based, 6 digits')).toBeInTheDocument();
    expect(screen.getByText('Two-step sign-in is required for your role.')).toBeInTheDocument();
    expect(api.calls.filter(c => c.path === '/auth/mfa/enroll/start')).toHaveLength(1);
  });

  it('shows the spec message on a wrong code', async () => {
    mockApi({
      'POST /auth/mfa/enroll/start': ok(SETUP),
      'POST /auth/mfa/enroll/confirm': err(401, 'TOTP_INVALID'),
    });
    render(<EnrollScreen />);
    await screen.findByText(/JBSW/);
    await userEvent.click(screen.getByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('111111');
    expect(
      await screen.findByText('That code is not correct. Check the time on your phone and try again.'),
    ).toBeInTheDocument();
  });

  it('confirming keeps the recovery codes in memory only and goes to the codes screen', async () => {
    const api = mockApi({
      'POST /auth/mfa/enroll/start': ok(SETUP),
      'POST /auth/mfa/enroll/confirm': ok({ status: 'SIGNED_IN', me: sampleMe(), recoveryCodes: CODES }),
    });
    render(<EnrollScreen />);
    await screen.findByText(/JBSW/);
    await userEvent.click(screen.getByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('123456');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/mfa/recovery-codes'));
    expect(api.last('POST', '/auth/mfa/enroll/confirm')?.body).toEqual({
      challengeToken: 'lc_t',
      code: '123456',
    });
    expect(flow.get().recoveryCodes).toEqual(CODES);
    expect(getMe()).not.toBeNull();
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain('RC-');
  });

  it('goes back to sign in when the challenge is gone', async () => {
    mockApi({ 'POST /auth/mfa/enroll/start': err(401, 'CHALLENGE_INVALID') });
    render(<EnrollScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?r=challenge'));
  });
});

describe('RecoveryCodesScreen', () => {
  it('lists 10 codes, and Continue needs the tick', async () => {
    flow.set({ recoveryCodes: CODES });
    mockApi({});
    const { setMe } = await import('@/lib/auth');
    setMe(sampleMe());
    render(<RecoveryCodesScreen />);
    expect(
      within(await screen.findByRole('list', { name: 'Recovery codes' })).getAllByRole('listitem'),
    ).toHaveLength(10);
    const cont = screen.getByRole('button', { name: 'Continue' });
    expect(cont).toBeDisabled();
    await userEvent.click(screen.getByLabelText('I have saved these codes somewhere safe'));
    await userEvent.click(cont);
    expect(router.push).toHaveBeenCalledWith('/admin');
    expect(flow.get().recoveryCodes).toBeUndefined();
  });

  it('returns to sign in if the codes are no longer in memory', async () => {
    render(<RecoveryCodesScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });
});
