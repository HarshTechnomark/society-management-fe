import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  err,
  mockApi,
  navigationMock,
  ok,
  otpChallenge,
  resetAll,
  sampleMe,
  type Reply,
} from '@/test/helpers';
import { Providers } from '@/components/common/Providers';
import { SecurityCenter } from './SecurityCenter';
import type { SecurityOverview, SessionRow } from '@/types/auth';

vi.mock('next/navigation', () => navigationMock());
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') },
}));

const overview = (over: Partial<SecurityOverview> = {}): SecurityOverview => ({
  mobile: '9820022222',
  email: 'treasurer@skyheights.in',
  emailVerified: true,
  hasPassword: true,
  passwordChangedAt: '2026-09-14T06:10:00.000Z',
  mfaEnabled: true,
  mfaMandatory: true,
  recoveryCodesRemaining: 8,
  passkeys: [
    {
      id: 7,
      name: 'Passkey on Chrome on Android',
      deviceType: 'MULTI_DEVICE',
      createdAt: '2026-10-02T10:00:00.000Z',
      lastUsedAt: '2026-10-30T03:12:00.000Z',
    },
  ],
  activeSessions: 2,
  deletionScheduledFor: null,
  ...over,
});
const session = (id: number, current: boolean, label: string): SessionRow => ({
  id,
  clientApp: 'ADMIN',
  deviceLabel: label,
  ipLast: '49.36.112.18',
  createdAt: '2026-11-01T04:30:12.000Z',
  lastSeenAt: '2026-11-01T05:01:00.000Z',
  isCurrent: current,
  revokedAt: null,
  revokeReason: null,
});
const sessionsReply = (rows: SessionRow[]): Reply => ({
  data: rows,
  extra: { pagination: { page: 1, limit: 50, total: rows.length, totalPages: 1 } },
});
const CODES = Array.from({ length: 10 }, (_, i) => `RC-AAAA-B${i}CD`.replace('0', 'M'));

function base(
  over: Partial<SecurityOverview> = {},
  extra: Record<string, Reply | Reply[] | ((b: unknown) => Reply)> = {},
  userOver = {},
) {
  return mockApi({
    'GET /me/security': ok(overview(over)),
    'GET /me/security/sessions': sessionsReply([
      session(1, true, 'Chrome on Windows'),
      session(2, false, 'Safari on iPhone'),
    ]),
    'GET /auth/me': ok(sampleMe({}, { mobile: '9820022222', ...userOver })),
    ...extra,
  });
}
const renderIt = async () => {
  render(
    <Providers>
      <SecurityCenter />
    </Providers>,
  );
  await screen.findByRole('heading', { name: 'My security' });
};
const card = (name: string) => within(screen.getByRole('region', { name }));

beforeEach(resetAll);

describe('SecurityCenter', () => {
  it('shows every card from the spec and never offers to show old recovery codes', async () => {
    base();
    await renderIt();
    for (const name of [
      'Change password',
      'Authenticator and recovery',
      'Passkeys',
      'Signed-in devices',
      'Mobile and email',
      'Delete my account',
    ])
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    expect(screen.getByText('8 of 10 recovery codes left')).toBeInTheDocument();
    expect(screen.queryByText(/show recovery codes/i)).toBeNull();
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(screen.getByText('98XXXXX222')).toBeInTheDocument();
  });

  it('shows an error state with a retry when loading fails', async () => {
    mockApi({
      'GET /me/security': err(500, 'INTERNAL_ERROR', undefined, 'Boom'),
      'GET /me/security/sessions': sessionsReply([]),
    });
    render(
      <Providers>
        <SecurityCenter />
      </Providers>,
    );
    expect(await screen.findByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('change password: validates, then step-up with a TOTP code and the request is retried', async () => {
    const api = base(
      {},
      {
        'POST /me/security/password': [err(401, 'REAUTH_REQUIRED'), ok({ otherSessionsRevoked: 1 })],
        'POST /auth/reauth': ok({ authTime: 'now' }),
      },
    );
    await renderIt();
    const pw = card('Change password');
    await userEvent.click(pw.getByRole('button', { name: 'Update password' }));
    expect(pw.getByLabelText(/^Current password/)).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls.some(c => c.path === '/me/security/password')).toBe(false);

    await userEvent.type(pw.getByLabelText(/^Current password/), 'OldPassword@1');
    await userEvent.type(pw.getByLabelText(/^New password/), 'Demo@Society2026');
    await userEvent.type(pw.getByLabelText(/^Confirm password/), 'Demo@Society2026');
    await userEvent.click(pw.getByRole('button', { name: 'Update password' }));

    const dialog = await screen.findByRole('dialog', { name: 'Confirm it is you' });
    expect(within(dialog).getByText(/code from your authenticator app/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('123456');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText(/Password updated\. 1 other device was signed out\./)).toBeInTheDocument();
    const order = api.calls.filter(c => c.method === 'POST').map(c => c.path);
    expect(order).toEqual(['/me/security/password', '/auth/reauth', '/me/security/password']);
    expect(api.last('POST', '/auth/reauth')?.body).toEqual({ method: 'TOTP', code: '123456' });
    expect(api.last('POST', '/me/security/password')?.body).toEqual({
      currentPassword: 'OldPassword@1',
      newPassword: 'Demo@Society2026',
    });
  });

  it('step-up for a user without MFA sends an OTP to the masked mobile first', async () => {
    const api = base(
      { mfaEnabled: false, mfaMandatory: false },
      {
        'POST /me/security/password': [err(401, 'REAUTH_REQUIRED'), ok({ otherSessionsRevoked: 0 })],
        'POST /auth/reauth/otp': ok(otpChallenge()),
        'POST /auth/reauth': ok({ authTime: 'now' }),
      },
      { mfaEnabled: false },
    );
    await renderIt();
    const pw = card('Change password');
    await userEvent.type(pw.getByLabelText(/^Current password/), 'OldPassword@1');
    await userEvent.type(pw.getByLabelText(/^New password/), 'Demo@Society2026');
    await userEvent.type(pw.getByLabelText(/^Confirm password/), 'Demo@Society2026');
    await userEvent.click(pw.getByRole('button', { name: 'Update password' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm it is you' });
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Send code to 98XXXXX222' }));
    await userEvent.click(await within(dialog).findByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('654321');
    await waitFor(() =>
      expect(api.last('POST', '/auth/reauth')?.body).toEqual({
        method: 'OTP',
        code: '654321',
        challengeId: 'otp_k3mzq7wd2xa5hn4pbc6rtyv2',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a wrong step-up code stays in the dialog with the message; cancelling does not retry', async () => {
    const api = base(
      {},
      {
        'POST /me/security/password': err(401, 'REAUTH_REQUIRED'),
        'POST /auth/reauth': err(401, 'TOTP_INVALID'),
      },
    );
    await renderIt();
    const pw = card('Change password');
    await userEvent.type(pw.getByLabelText(/^Current password/), 'OldPassword@1');
    await userEvent.type(pw.getByLabelText(/^New password/), 'Demo@Society2026');
    await userEvent.type(pw.getByLabelText(/^Confirm password/), 'Demo@Society2026');
    await userEvent.click(pw.getByRole('button', { name: 'Update password' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm it is you' });
    await userEvent.click(within(dialog).getByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('000000');
    expect(
      await within(dialog).findByText(/That code is not correct\. Check the time on your phone/),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.calls.filter(c => c.path === '/me/security/password')).toHaveLength(1);
  });

  it('maps CURRENT_PASSWORD_INCORRECT to the field', async () => {
    base({}, { 'POST /me/security/password': err(422, 'CURRENT_PASSWORD_INCORRECT') });
    await renderIt();
    const pw = card('Change password');
    await userEvent.type(pw.getByLabelText(/^Current password/), 'wrong');
    await userEvent.type(pw.getByLabelText(/^New password/), 'Demo@Society2026');
    await userEvent.type(pw.getByLabelText(/^Confirm password/), 'Demo@Society2026');
    await userEvent.click(pw.getByRole('button', { name: 'Update password' }));
    expect(await pw.findByText('That is not your current password.')).toBeInTheDocument();
    expect(pw.getByLabelText(/^Current password/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('a user with no password sees "Set a password" and no current password field', async () => {
    base({ hasPassword: false });
    await renderIt();
    const pw = card('Set a password');
    expect(pw.queryByLabelText(/^Current password/)).toBeNull();
  });

  it('hides Turn off when MFA is required and shows it when optional', async () => {
    base();
    await renderIt();
    expect(card('Authenticator and recovery').queryByRole('button', { name: 'Turn off' })).toBeNull();
  });

  it('optional MFA can be turned off after confirmation', async () => {
    const api = base({ mfaMandatory: false }, { 'DELETE /me/security/totp': ok(null) });
    await renderIt();
    await userEvent.click(card('Authenticator and recovery').getByRole('button', { name: 'Turn off' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Turn off' }),
    );
    await waitFor(() =>
      expect(api.calls.some(c => c.method === 'DELETE' && c.path === '/me/security/totp')).toBe(true),
    );
  });

  it('new recovery codes appear once in a sticky modal that needs the tick', async () => {
    base({}, { 'POST /me/security/recovery-codes': ok({ recoveryCodes: CODES, batchCreatedAt: 'x' }) });
    await renderIt();
    await userEvent.click(
      card('Authenticator and recovery').getByRole('button', { name: 'Generate new codes' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Generate new codes' }),
    );
    const codes = await screen.findByRole('dialog', { name: 'Save your recovery codes' });
    expect(within(codes).getAllByRole('listitem')).toHaveLength(10);
    expect(within(codes).getByRole('button', { name: 'Done' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Save your recovery codes' })).toBeInTheDocument();
    await userEvent.click(within(codes).getByLabelText('I have saved these codes somewhere safe'));
    await userEvent.click(within(codes).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sets up the authenticator from My security and shows the codes', async () => {
    const api = base(
      { mfaEnabled: false, mfaMandatory: false, recoveryCodesRemaining: 0 },
      {
        'POST /me/security/totp/setup': ok({
          secret: 'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP',
          otpauthUri: 'otpauth://x',
          accountLabel: 't@x.in',
        }),
        'POST /me/security/totp/confirm': ok({ recoveryCodes: CODES }),
      },
    );
    await renderIt();
    await userEvent.click(
      card('Authenticator and recovery').getByRole('button', { name: 'Set up authenticator' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Set up your authenticator' });
    await within(dialog).findByText(/JBSW/);
    await userEvent.click(within(dialog).getByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('123456');
    expect(await screen.findByRole('dialog', { name: 'Save your recovery codes' })).toBeInTheDocument();
    expect(api.last('POST', '/me/security/totp/confirm')?.body).toEqual({ code: '123456' });
  });

  it('removes a passkey after confirmation and renames one', async () => {
    const api = base(
      {},
      { 'DELETE /me/security/passkeys/7': ok(null), 'PATCH /me/security/passkeys/7': ok({}) },
    );
    await renderIt();
    const pk = card('Passkeys');
    await userEvent.click(pk.getByRole('button', { name: 'Rename Passkey on Chrome on Android' }));
    const rename = await screen.findByRole('dialog', { name: 'Rename passkey' });
    await userEvent.clear(within(rename).getByLabelText('Name'));
    await userEvent.type(within(rename).getByLabelText('Name'), 'Work laptop');
    await userEvent.click(within(rename).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/me/security/passkeys/7')?.body).toEqual({ name: 'Work laptop' }),
    );
    await userEvent.click(pk.getByRole('button', { name: 'Remove Passkey on Chrome on Android' }));
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Remove this passkey?' })).getByRole('button', {
        name: 'Remove',
      }),
    );
    await waitFor(() =>
      expect(api.calls.some(c => c.method === 'DELETE' && c.path === '/me/security/passkeys/7')).toBe(true),
    );
  });

  it('revokes another device but not the current one, and signs out all others', async () => {
    const api = base(
      {},
      {
        'DELETE /me/security/sessions/2': ok(null),
        'POST /me/security/sessions/revoke-others': ok({ revoked: 1 }),
      },
    );
    await renderIt();
    const dev = card('Signed-in devices');
    expect(dev.queryByRole('button', { name: 'Revoke Chrome on Windows' })).toBeNull();
    await userEvent.click(dev.getByRole('button', { name: 'Revoke Safari on iPhone' }));
    await waitFor(() =>
      expect(api.calls.some(c => c.method === 'DELETE' && c.path === '/me/security/sessions/2')).toBe(true),
    );
    await userEvent.click(dev.getByRole('button', { name: 'Sign out all others' }));
    await waitFor(() =>
      expect(api.calls.some(c => c.path === '/me/security/sessions/revoke-others')).toBe(true),
    );
    expect(await screen.findByText('1 device signed out.')).toBeInTheDocument();
  });

  it('changes the mobile number with an OTP to the new number', async () => {
    const api = base(
      {},
      { 'POST /me/security/mobile/start': ok(otpChallenge()), 'POST /me/security/mobile/confirm': ok({}) },
    );
    await renderIt();
    await userEvent.click(card('Mobile and email').getByRole('button', { name: 'Change mobile' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change mobile number' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send OTP' }));
    expect(within(dialog).getByLabelText(/New mobile number/)).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(within(dialog).getByLabelText(/New mobile number/), '98765 43210');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send OTP' }));
    await userEvent.click(await within(dialog).findByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('123456');
    await waitFor(() =>
      expect(api.last('POST', '/me/security/mobile/confirm')?.body).toEqual({
        challengeId: 'otp_k3mzq7wd2xa5hn4pbc6rtyv2',
        code: '123456',
      }),
    );
    expect(api.last('POST', '/me/security/mobile/start')?.body).toEqual({ newMobile: '9876543210' });
  });

  it('shows MOBILE_IN_USE under the field', async () => {
    base({}, { 'POST /me/security/mobile/start': err(409, 'MOBILE_IN_USE') });
    await renderIt();
    await userEvent.click(card('Mobile and email').getByRole('button', { name: 'Change mobile' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/New mobile number/), '9876543210');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send OTP' }));
    expect(
      await within(dialog).findByText('This number already belongs to another account.'),
    ).toBeInTheDocument();
  });

  it('sends an email confirmation link and flags an unverified email', async () => {
    const api = base({ emailVerified: false }, { 'POST /me/security/email': ok(null) });
    await renderIt();
    expect(card('Mobile and email').getByText('Unverified')).toBeInTheDocument();
    await userEvent.click(card('Mobile and email').getByRole('button', { name: 'Change email' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/New email/), 'New@Mail.in');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send confirmation link' }));
    expect(await within(dialog).findByText(/We sent a link to new@mail.in/)).toBeInTheDocument();
    expect(api.last('POST', '/me/security/email')?.body).toEqual({ newEmail: 'new@mail.in' });
  });

  it('delete account needs the word DELETE and lists blockers', async () => {
    const api = base(
      {},
      {
        'POST /me/security/deletion-request': err(409, 'ACCOUNT_DELETION_BLOCKED', [
          { field: 'blockers', message: 'COMMITTEE_ROLE:Sky Heights CHS' },
          { field: 'blockers', message: 'LAST_SOCIETY_ADMIN:Green Park CHS' },
        ]),
      },
    );
    await renderIt();
    await userEvent.click(card('Delete my account').getByRole('button', { name: 'Delete my account' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your account?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete my account' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Type DELETE'), 'delete');
    expect(confirm).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText('Type DELETE'));
    await userEvent.type(within(dialog).getByLabelText('Type DELETE'), 'DELETE');
    await userEvent.click(confirm);
    expect(
      await within(dialog).findByText(/You hold a committee role in Sky Heights CHS/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/last society admin of Green Park CHS/)).toBeInTheDocument();
    expect(api.last('POST', '/me/security/deletion-request')?.body).toEqual({ confirmText: 'DELETE' });
  });

  it('shows the pending-deletion banner with the date and cancels the deletion', async () => {
    const api = base(
      { deletionScheduledFor: '2026-12-01T05:00:00.000Z' },
      { 'DELETE /me/security/deletion-request': ok(null) },
    );
    await renderIt();
    expect(screen.getByText('Your account will be deleted on 1 Dec 2026.')).toBeInTheDocument();
    expect(card('Delete my account').queryByRole('button', { name: 'Delete my account' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel deletion' }));
    await waitFor(() =>
      expect(api.calls.some(c => c.method === 'DELETE' && c.path === '/me/security/deletion-request')).toBe(
        true,
      ),
    );
  });
});
