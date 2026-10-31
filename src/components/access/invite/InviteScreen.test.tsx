import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import type { InvitationPreview } from '@/types/accessControl';
import { InviteScreen } from './InviteScreen';

vi.mock('next/navigation', () => navigationMock());

const TOKEN = 'a'.repeat(43);
const preview = (over: Partial<InvitationPreview> = {}): InvitationPreview => ({
  societyName: 'Sky Heights CHS',
  societyLogoUrl: null,
  roleName: 'Treasurer',
  scope: 'society',
  inviterName: 'Rajesh Kulkarni',
  inviteeName: 'Meera Iyer',
  mobileMasked: '98XXXXX222',
  message: 'Welcome to the committee',
  status: 'PENDING',
  expiresAt: '2026-11-06T09:30:00.000Z',
  requiresMfa: true,
  ...over,
});
const previewRoute = `GET /public/invitations/${TOKEN}`;
const assign = vi.fn();

beforeEach(() => {
  resetAll();
  assign.mockReset();
  vi.stubGlobal('location', {
    ...window.location,
    assign,
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
    search: '',
  });
});

describe('InviteScreen', () => {
  it('shows society, role, message, expiry and masked mobile, and sends a signed-out user to OTP login with next', async () => {
    mockApi({ [previewRoute]: ok(preview()), 'GET /auth/me': err(401, 'UNAUTHENTICATED') });
    render(<InviteScreen token={TOKEN} />);
    expect(await screen.findByText('Rajesh Kulkarni invited you as Treasurer')).toBeInTheDocument();
    expect(screen.getByText('Sky Heights CHS')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the committee')).toBeInTheDocument();
    expect(screen.getByText(/valid until 6 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText(/98XXXXX222/, { selector: 'h1 + p' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Continue with OTP' });
    expect(link).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/invite/${TOKEN}`)}`);
  });

  it('accepts when signed in: accept, switch society, go to redirectTo', async () => {
    const api = mockApi({
      [previewRoute]: ok(preview()),
      'GET /auth/me': ok(sampleMe()),
      [`POST /invitations/${TOKEN}/accept`]: ok({
        societyId: 1,
        memberId: 1201,
        role: { key: 'treasurer', name: 'Treasurer', scope: 'society' },
        requiresMfa: true,
        reSignInRequired: false,
        redirectTo: 'https://admin.societyapp.in/today',
      }),
      'POST /auth/switch-society': ok(sampleMe()),
    });
    render(<InviteScreen token={TOKEN} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://admin.societyapp.in/today'));
    expect(api.last('POST', '/auth/switch-society')?.body).toEqual({ societyId: 1 });
  });

  it('goes to sign in when the server says re-sign-in is required (MFA enrolment)', async () => {
    mockApi({
      [previewRoute]: ok(preview()),
      'GET /auth/me': ok(sampleMe()),
      [`POST /invitations/${TOKEN}/accept`]: ok({
        societyId: 1,
        memberId: 1,
        role: { key: 'treasurer', name: 'Treasurer', scope: 'society' },
        requiresMfa: true,
        reSignInRequired: true,
        redirectTo: 'https://admin.societyapp.in/today',
      }),
    });
    render(<InviteScreen token={TOKEN} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/login?next=%2Ftoday'));
  });

  it('declines with an optional reason', async () => {
    const api = mockApi({
      [previewRoute]: ok(preview()),
      'GET /auth/me': ok(sampleMe()),
      [`POST /public/invitations/${TOKEN}/decline`]: ok(null),
    });
    render(<InviteScreen token={TOKEN} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    const dlg = await screen.findByRole('dialog', { name: 'Decline this invitation?' });
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Not available');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Decline' }));
    expect(await screen.findByText('Invitation declined')).toBeInTheDocument();
    expect(api.last('POST', `/public/invitations/${TOKEN}/decline`)?.body).toEqual({
      reason: 'Not available',
    });
  });

  it('shows the mobile mismatch message with a Sign out button', async () => {
    mockApi({
      [previewRoute]: ok(preview()),
      'GET /auth/me': ok(sampleMe()),
      [`POST /invitations/${TOKEN}/accept`]: err(403, 'INVITATION_MOBILE_MISMATCH'),
      'POST /auth/logout': ok(null),
    });
    render(<InviteScreen token={TOKEN} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    expect(
      await screen.findByText(/This invitation is for 98XXXXX222. Sign out and sign in with that number./),
    ).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Sign out/ })[0]);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringContaining('/login?next=')));
  });

  it('keeps the invitation and explains when no admin seat is free (402)', async () => {
    mockApi({
      [previewRoute]: ok(preview({ roleName: 'Auditor' })),
      'GET /auth/me': ok(sampleMe()),
      [`POST /invitations/${TOKEN}/accept`]: err(402, 'USAGE_LIMIT_EXCEEDED'),
    });
    render(<InviteScreen token={TOKEN} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    expect(await screen.findByText(/no free admin seat/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeEnabled();
  });

  it('shows expired, used and revoked states without Accept or Decline', async () => {
    for (const [status, text] of [
      ['EXPIRED', 'This invitation has expired. Ask the society to send a new one.'],
      ['ACCEPTED', 'This invitation was already used.'],
      ['REVOKED', 'This invitation was withdrawn by the society.'],
    ] as const) {
      mockApi({ [previewRoute]: ok(preview({ status })), 'GET /auth/me': ok(sampleMe()) });
      const { unmount } = render(<InviteScreen token={TOKEN} />);
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Accept invitation' })).toBeNull();
      unmount();
      setMe(null);
    }
  });

  it('shows the expired and not-found answers of the preview call', async () => {
    mockApi({ [previewRoute]: err(410, 'INVITATION_EXPIRED') });
    const { unmount } = render(<InviteScreen token={TOKEN} />);
    expect(
      await screen.findByText('This invitation has expired. Ask the society to send a new one.'),
    ).toBeInTheDocument();
    unmount();
    mockApi({ [previewRoute]: err(404, 'INVITATION_NOT_FOUND') });
    render(<InviteScreen token={TOKEN} />);
    expect(await screen.findByText(/This invitation link is not valid/)).toBeInTheDocument();
  });
});
