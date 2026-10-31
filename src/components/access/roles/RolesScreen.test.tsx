import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { pagination, roleSummary } from '@/test/accessFixtures';
import { RolesScreen } from './RolesScreen';

vi.mock('next/navigation', () => navigationMock());

const chairman = roleSummary({
  id: 401,
  key: 'chairman',
  name: 'Chairman',
  isLocked: true,
  permissionCount: 120,
});
const custom = roleSummary({
  id: 412,
  key: 'custom_clubhouse',
  name: 'Clubhouse manager',
  isSystem: false,
  memberCount: 0,
  permissionCount: 11,
  description: 'Runs the clubhouse',
});
const busy = roleSummary({
  id: 413,
  key: 'custom_busy',
  name: 'Busy role',
  isSystem: false,
  memberCount: 2,
  pendingInvitationCount: 1,
});
const owner = roleSummary({ id: 420, key: 'owner', name: 'Owner', scope: 'resident' });
const list = ok([chairman, custom, busy, owner], 'OK', { pagination });

const PERMS = ['settings.roles.view', 'settings.roles.create', 'settings.roles.delete'];
const mount = (perms = PERMS) => {
  setMe(sampleMe({ permissions: perms }));
  return render(
    <ToastProvider>
      <RolesScreen />
    </ToastProvider>,
  );
};
const row = (name: string) => screen.getByText(name).closest('tr')!;

beforeEach(resetAll);

describe('RolesScreen', () => {
  it('lists roles with type, lock, scope, member and permission counts and the custom role usage', async () => {
    mockApi({ 'GET /roles': list });
    mount();
    expect(await screen.findByText('Clubhouse manager')).toBeInTheDocument();
    expect(within(row('Chairman')).getByLabelText('Locked')).toBeInTheDocument();
    expect(within(row('Chairman')).getByText('System')).toBeInTheDocument();
    expect(within(row('Clubhouse manager')).getByText('Custom')).toBeInTheDocument();
    expect(within(row('Clubhouse manager')).getByText('11')).toBeInTheDocument();
    expect(within(row('Busy role')).getByText('2 (+1 invited)')).toBeInTheDocument();
    expect(screen.getByTestId('custom-usage')).toHaveTextContent('2 custom roles');
  });

  it('opens New role and Clone (not for resident roles) and the role itself', async () => {
    mockApi({ 'GET /roles': list });
    mount();
    await screen.findByText('Clubhouse manager');
    await userEvent.click(screen.getByRole('button', { name: 'New role' }));
    expect(router.push).toHaveBeenCalledWith('/admin/roles/new');
    await userEvent.click(
      within(row('Clubhouse manager')).getByRole('button', { name: 'Clone Clubhouse manager' }),
    );
    expect(router.push).toHaveBeenCalledWith('/admin/roles/new?from=412');
    expect(within(row('Owner')).queryByRole('button', { name: /Clone/ })).toBeNull();
    await userEvent.click(within(row('Chairman')).getByRole('button', { name: 'View Chairman' }));
    expect(router.push).toHaveBeenCalledWith('/admin/roles/401');
  });

  it('deletes only unused custom roles; a role in use is disabled with a tooltip', async () => {
    const api = mockApi({ 'GET /roles': list, 'DELETE /roles/412': ok(null) });
    mount();
    await screen.findByText('Clubhouse manager');
    expect(within(row('Chairman')).queryByRole('button', { name: /Delete/ })).toBeNull();
    const inUse = within(row('Busy role')).getByRole('button', { name: 'Delete Busy role' });
    expect(inUse).toBeDisabled();
    expect(inUse).toHaveAttribute('title', expect.stringContaining('2 member(s)'));
    await userEvent.click(
      within(row('Clubhouse manager')).getByRole('button', { name: 'Delete Clubhouse manager' }),
    );
    const dlg = await screen.findByRole('dialog', { name: 'Delete Clubhouse manager?' });
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Not needed');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Delete role' }));
    await waitFor(() =>
      expect(api.last('DELETE', '/roles/412')?.body).toEqual({ version: 1, reason: 'Not needed' }),
    );
  });

  it('explains ROLE_IN_USE when the server refuses the delete', async () => {
    mockApi({
      'GET /roles': list,
      'DELETE /roles/412': err(409, 'ROLE_IN_USE', [{ field: 'memberCount', message: '1' }]),
    });
    mount();
    await screen.findByText('Clubhouse manager');
    await userEvent.click(
      within(row('Clubhouse manager')).getByRole('button', { name: 'Delete Clubhouse manager' }),
    );
    const dlg = await screen.findByRole('dialog', { name: 'Delete Clubhouse manager?' });
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Not needed');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Delete role' }));
    expect(await screen.findByText(/still used by 1 member/)).toBeInTheDocument();
  });

  it('hides New role, Clone and Delete without the permissions', async () => {
    mockApi({ 'GET /roles': list });
    mount(['settings.roles.view']);
    await screen.findByText('Clubhouse manager');
    expect(screen.queryByRole('button', { name: 'New role' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Clone/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });
});
