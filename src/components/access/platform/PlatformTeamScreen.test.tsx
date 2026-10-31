import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { pagination, platformRoles } from '@/test/accessFixtures';
import type { PlatformTeamItem } from '@/types/accessControl';
import { PlatformTeamScreen } from './PlatformTeamScreen';

const superAdmin = { id: 1, key: 'super_admin', name: 'Super Admin' };
const support = { id: 2, key: 'platform_support', name: 'Platform Support' };
const team: PlatformTeamItem[] = [
  {
    kind: 'USER',
    userId: 3,
    name: 'Isha Kapoor',
    email: 'isha@societyapp.in',
    mobile: '98XXXXX431',
    role: superAdmin,
    status: 'ACTIVE',
    mfaEnabled: true,
    lastLoginAt: '2026-10-28T10:00:00.000Z',
    isSelf: true,
  },
  {
    kind: 'USER',
    userId: 4,
    name: 'Dev Rao',
    email: 'dev@societyapp.in',
    mobile: '98XXXXX432',
    role: support,
    status: 'DISABLED',
    mfaEnabled: false,
    lastLoginAt: null,
    isSelf: false,
  },
  {
    kind: 'USER',
    userId: 5,
    name: 'Nina Roy',
    email: 'nina@societyapp.in',
    mobile: null,
    role: support,
    status: 'ACTIVE',
    mfaEnabled: true,
    lastLoginAt: null,
    isSelf: false,
  },
  {
    kind: 'INVITATION',
    invitationId: 90,
    name: 'New Person',
    email: 'new@societyapp.in',
    mobile: null,
    role: support,
    status: 'INVITED',
    expiresAt: '2026-11-06T09:30:00.000Z',
    resendCount: 0,
  },
];
const routes = (extra: object = {}) => ({
  'GET /platform/team': ok(team, 'OK', { pagination }),
  'GET /platform/roles': ok(platformRoles),
  ...extra,
});
const ALL = ['platform.team.view', 'platform.team.create', 'platform.team.edit', 'platform.team.delete'];
const mount = (perms = ALL) => {
  setMe(sampleMe({ platformPermissions: perms, platformRole: 'super_admin', permissions: [] }));
  return render(
    <ToastProvider>
      <PlatformTeamScreen />
    </ToastProvider>,
  );
};
const row = (name: string) => screen.getByText(name).closest('tr')!;

beforeEach(resetAll);

describe('PlatformTeamScreen', () => {
  it('lists teammates and pending invitations with role, status and MFA', async () => {
    mockApi(routes());
    mount();
    expect(await screen.findByText('Dev Rao')).toBeInTheDocument();
    expect(within(row('Isha Kapoor')).getByText('You')).toBeInTheDocument();
    expect(within(row('Isha Kapoor')).getByText('Enrolled')).toBeInTheDocument();
    expect(within(row('Dev Rao')).getByText('Disabled')).toBeInTheDocument();
    expect(within(row('Dev Rao')).getByText('Not yet')).toBeInTheDocument();
    expect(within(row('New Person')).getByText('Invited')).toBeInTheDocument();
  });

  it('computes the capability card for Super Admin and Platform Support', async () => {
    mockApi(routes());
    mount();
    const table = await screen.findByRole('table', { name: 'What each platform role can do' });
    const manage = within(table).getByText('Export audit trail, manage team and settings').closest('tr')!;
    // Super Admin yes, Platform Support no.
    expect(
      within(manage)
        .getAllByLabelText(/^(Yes|No)$/)
        .map(e => e.getAttribute('aria-label')),
    ).toEqual(['Yes', 'No']);
    const create = within(table).getByText('Create societies (assisted onboarding)').closest('tr')!;
    expect(within(create).getAllByLabelText('Yes')).toHaveLength(2);
  });

  it('invites a teammate and validates the work email domain on the client', async () => {
    const api = mockApi(
      routes({ 'POST /platform/team/invite': ok({ id: 91, name: 'Asha', role: support }) }),
    );
    mount();
    await screen.findByText('Dev Rao');
    await userEvent.click(screen.getByRole('button', { name: 'Invite teammate' }));
    const dlg = await screen.findByRole('dialog', { name: 'Invite a teammate' });
    await userEvent.type(within(dlg).getByLabelText(/Full name/), 'Asha Verma');
    await userEvent.type(within(dlg).getByLabelText(/Work email/), 'asha@gmail.com');
    await userEvent.type(within(dlg).getByLabelText(/Mobile/), '9820011901');
    await userEvent.selectOptions(within(dlg).getByLabelText(/Role/), 'Platform Support');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send invite' }));
    expect(within(dlg).getByText('Use a work email ending with @societyapp.in.')).toBeInTheDocument();
    expect(api.last('POST', '/platform/team/invite')).toBeUndefined();
    await userEvent.clear(within(dlg).getByLabelText(/Work email/));
    await userEvent.type(within(dlg).getByLabelText(/Work email/), 'asha@societyapp.in');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send invite' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/team/invite')?.body).toEqual({
        name: 'Asha Verma',
        email: 'asha@societyapp.in',
        mobile: '9820011901',
        roleId: 2,
      }),
    );
  });

  it('maps EMAIL_DOMAIN_NOT_ALLOWED from the server', async () => {
    mockApi(routes({ 'POST /platform/team/invite': err(422, 'EMAIL_DOMAIN_NOT_ALLOWED') }));
    mount();
    await screen.findByText('Dev Rao');
    await userEvent.click(screen.getByRole('button', { name: 'Invite teammate' }));
    const dlg = await screen.findByRole('dialog', { name: 'Invite a teammate' });
    await userEvent.type(within(dlg).getByLabelText(/Full name/), 'Asha Verma');
    await userEvent.type(within(dlg).getByLabelText(/Work email/), 'asha@societyapp.in');
    await userEvent.type(within(dlg).getByLabelText(/Mobile/), '9820011901');
    await userEvent.selectOptions(within(dlg).getByLabelText(/Role/), 'Super Admin');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send invite' }));
    expect(await within(dlg).findByText(/Use a work email ending with/)).toBeInTheDocument();
  });

  it('changes a role with a reason', async () => {
    const api = mockApi(routes({ 'PATCH /platform/team/5': ok({}) }));
    mount();
    await screen.findByText('Nina Roy');
    await userEvent.click(within(row('Nina Roy')).getByRole('button', { name: 'Role Nina Roy' }));
    const dlg = await screen.findByRole('dialog', { name: 'Change role for Nina Roy' });
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Promoted');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Change role' }));
    expect(within(dlg).getByText('Pick a different role.')).toBeInTheDocument();
    await userEvent.selectOptions(within(dlg).getByLabelText('New role'), 'Super Admin');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Change role' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/platform/team/5')?.body).toEqual({ roleId: 1, reason: 'Promoted' }),
    );
  });

  it('disables, enables, resets MFA and removes through reason dialogs', async () => {
    const api = mockApi(
      routes({
        'POST /platform/team/5/disable': ok(null),
        'POST /platform/team/4/enable': ok(null),
        'POST /platform/team/5/reset-mfa': ok(null),
        'DELETE /platform/team/5': ok(null),
      }),
    );
    mount();
    await screen.findByText('Nina Roy');
    const act = async (who: string, button: string, dialog: string, confirm: string, reason: string) => {
      await userEvent.click(within(row(who)).getByRole('button', { name: `${button} ${who}` }));
      const dlg = await screen.findByRole('dialog', { name: dialog });
      await userEvent.type(within(dlg).getByLabelText(/Reason/), reason);
      await userEvent.click(within(dlg).getByRole('button', { name: confirm }));
    };
    await act('Nina Roy', 'Disable', 'Disable Nina Roy?', 'Disable', 'Left the team');
    await waitFor(() =>
      expect(api.last('POST', '/platform/team/5/disable')?.body).toEqual({ reason: 'Left the team' }),
    );
    await act('Dev Rao', 'Enable', 'Enable Dev Rao?', 'Enable', 'Returned');
    await waitFor(() =>
      expect(api.last('POST', '/platform/team/4/enable')?.body).toEqual({ reason: 'Returned' }),
    );
    await act('Nina Roy', 'Reset MFA', 'Reset MFA for Nina Roy?', 'Reset MFA', 'Lost phone');
    await waitFor(() =>
      expect(api.last('POST', '/platform/team/5/reset-mfa')?.body).toEqual({ reason: 'Lost phone' }),
    );
    await act('Nina Roy', 'Remove', 'Remove Nina Roy from the platform team?', 'Remove', 'Offboarded');
    await waitFor(() =>
      expect(api.last('DELETE', '/platform/team/5')?.body).toEqual({ reason: 'Offboarded' }),
    );
  });

  it('shows LAST_SUPER_ADMIN as text and keeps your own row disabled', async () => {
    mockApi(routes({ 'POST /platform/team/5/disable': err(409, 'LAST_SUPER_ADMIN') }));
    mount();
    await screen.findByText('Nina Roy');
    expect(within(row('Isha Kapoor')).getByRole('button', { name: 'Disable Isha Kapoor' })).toBeDisabled();
    await userEvent.click(within(row('Nina Roy')).getByRole('button', { name: 'Disable Nina Roy' }));
    const dlg = await screen.findByRole('dialog', { name: 'Disable Nina Roy?' });
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Test reason');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('At least one active Super Admin is required.')).toBeInTheDocument();
  });

  it('resends and revokes a platform invitation', async () => {
    const api = mockApi(
      routes({
        'POST /platform/invitations/90/resend': ok({}),
        'POST /platform/invitations/90/revoke': ok({}),
      }),
    );
    mount();
    await screen.findByText('New Person');
    await userEvent.click(
      within(row('New Person')).getByRole('button', { name: 'Resend invite New Person' }),
    );
    await waitFor(() => expect(api.last('POST', '/platform/invitations/90/resend')).toBeTruthy());
    await userEvent.click(within(row('New Person')).getByRole('button', { name: 'Revoke New Person' }));
    const dlg = await screen.findByRole('dialog', { name: 'Revoke the invite for New Person?' });
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Mistake');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Revoke invite' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/invitations/90/revoke')?.body).toEqual({ reason: 'Mistake' }),
    );
  });

  it('hides write actions for a read-only teammate and blocks users without view', async () => {
    mockApi(routes());
    const { unmount } = mount(['platform.team.view']);
    await screen.findByText('Dev Rao');
    expect(screen.queryByRole('button', { name: 'Invite teammate' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Disable/ })).toBeNull();
    unmount();
    mount([]);
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });
});
