import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { catalogue, roleDetail } from '@/test/accessFixtures';
import { RoleEditor } from './RoleEditor';

vi.mock('next/navigation', () => navigationMock());

const PERMS = [
  'settings.roles.view',
  'settings.roles.create',
  'settings.roles.edit',
  'settings.roles.delete',
];
const custom = roleDetail({
  id: 412,
  key: 'custom_clubhouse',
  name: 'Clubhouse manager',
  isSystem: false,
  memberCount: 0,
  version: 3,
  requiresMfa: false,
  permissionKeys: ['finance.expenses.view', 'helpdesk.tickets.view'],
});
const treasurer = roleDetail({ permissionKeys: ['finance.expenses.view', 'finance.expenses.approve'] });

const mount = (props: { roleId?: number; cloneFrom?: number }, perms = PERMS) => {
  setMe(sampleMe({ permissions: perms }));
  return render(
    <ToastProvider>
      <RoleEditor {...props} />
    </ToastProvider>,
  );
};
const expand = async (name: string) =>
  userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }));
const cell = (name: string) => screen.getByRole('checkbox', { name });

beforeEach(resetAll);

describe('RoleEditor', () => {
  it('shows the matrix grouped by master with disabled lock cells and shield icons', async () => {
    mockApi({ 'GET /roles/412': ok(custom), 'GET /permissions': ok(catalogue) });
    mount({ roleId: 412 });
    await expand('Finance');
    expect(cell('View Expenses and cash book')).toBeChecked();
    expect(cell('Approve Expenses and cash book')).toBeDisabled();
    expect(screen.getAllByTestId('lock-icon')).toHaveLength(1);
    expect(screen.getAllByTestId('shield-icon').length).toBe(2);
    expect(screen.getByText('You do not have this permission', { selector: '.sr-only' })).toBeInTheDocument();
    // blank cells (import, export...) have no checkbox
    expect(screen.getAllByRole('checkbox')).toHaveLength(4); // three cells and the two-step flag
  });

  it('searches permissions and opens matching groups', async () => {
    mockApi({ 'GET /roles/412': ok(custom), 'GET /permissions': ok(catalogue) });
    mount({ roleId: 412 });
    await screen.findByRole('button', { name: /^Finance/ });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search permissions' }), 'complaints');
    expect(screen.queryByRole('button', { name: /^Finance/ })).toBeNull();
    expect(cell('Edit Complaints and building issues')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No permission matches that search.')).toBeInTheDocument();
  });

  it('Select row and View only helpers touch only cells the caller holds', async () => {
    mockApi({ 'GET /roles/412': ok(custom), 'GET /permissions': ok(catalogue) });
    mount({ roleId: 412 });
    await expand('Finance');
    await userEvent.click(screen.getByRole('button', { name: 'Select row Expenses and cash book' }));
    expect(cell('Create Expenses and cash book')).toBeChecked();
    expect(cell('Approve Expenses and cash book')).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'View only Expenses and cash book' }));
    expect(cell('View Expenses and cash book')).toBeChecked();
    expect(cell('Create Expenses and cash book')).not.toBeChecked();
  });

  it('save opens a diff preview with a required reason, then PATCHes only what changed', async () => {
    const api = mockApi({
      'GET /roles/412': ok(custom),
      'GET /permissions': ok(catalogue),
      'PATCH /roles/412': ok({ ...custom, version: 4 }),
    });
    mount({ roleId: 412 });
    await expand('Finance');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.click(cell('Create Expenses and cash book'));
    await userEvent.click(cell('View Expenses and cash book'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dlg = await screen.findByRole('dialog', { name: 'Review changes' });
    expect(within(dlg).getByText('Adding 1, removing 1')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Confirm and save' }));
    expect(within(dlg).getByText('Enter between 5 and 500 characters.')).toBeInTheDocument();
    expect(api.last('PATCH', '/roles/412')).toBeUndefined();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Clubhouse changes');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Confirm and save' }));
    await waitFor(() => expect(api.last('PATCH', '/roles/412')).toBeTruthy());
    expect(api.last('PATCH', '/roles/412')?.body).toEqual({
      version: 3,
      permissionKeys: ['finance.expenses.create', 'helpdesk.tickets.view'],
      requiresMfa: true,
      reason: 'Clubhouse changes',
    });
    expect(await screen.findByText('Role saved.')).toBeInTheDocument();
  });

  it('forces the two-step flag on while a sensitive permission is selected', async () => {
    mockApi({ 'GET /roles/412': ok(custom), 'GET /permissions': ok(catalogue) });
    mount({ roleId: 412 });
    await expand('Finance');
    const box = screen.getByRole('checkbox', { name: /Needs two-step sign-in/ });
    expect(box).not.toBeChecked();
    await userEvent.click(cell('Create Expenses and cash book'));
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });

  it('shows STALE_VERSION with a Reload button', async () => {
    const api = mockApi({
      'GET /roles/412': [ok(custom), ok(custom)],
      'GET /permissions': ok(catalogue),
      'PATCH /roles/412': err(409, 'STALE_VERSION'),
    });
    mount({ roleId: 412 });
    await userEvent.type(await screen.findByLabelText(/^Name/), ' X');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dlg = await screen.findByRole('dialog', { name: 'Review changes' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Confirm and save' }));
    expect(await screen.findByText(/Someone else changed this/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() =>
      expect(api.calls.filter(c => c.path === '/roles/412' && c.method === 'GET').length).toBe(2),
    );
  });

  it('opens the Chairman role read-only with the support banner and no Save', async () => {
    mockApi({
      'GET /roles/401': ok(
        roleDetail({
          id: 401,
          key: 'chairman',
          name: 'Chairman',
          isLocked: true,
          permissionKeys: ['finance.expenses.view'],
        }),
      ),
      'GET /permissions': ok(catalogue),
    });
    mount({ roleId: 401 });
    await expand('Finance');
    expect(screen.getByText('Only SocietyApp support can change the Chairman role.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(cell('View Expenses and cash book')).toBeDisabled();
  });

  it('system roles keep their name and can be reset to default', async () => {
    const api = mockApi({
      'GET /roles/403': ok(treasurer),
      'GET /permissions': ok(catalogue),
      'POST /roles/403/reset': ok(treasurer),
    });
    mount({ roleId: 403 });
    expect(await screen.findByLabelText(/^Name/)).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    const dlg = await screen.findByRole('dialog', { name: 'Reset Treasurer to default?' });
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Back to default');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reset to default' }));
    await waitFor(() =>
      expect(api.last('POST', '/roles/403/reset')?.body).toEqual({ version: 1, reason: 'Back to default' }),
    );
  });

  it('is read-only for a user without settings.roles.edit', async () => {
    mockApi({ 'GET /roles/412': ok(custom), 'GET /permissions': ok(catalogue) });
    mount({ roleId: 412 }, ['settings.roles.view']);
    await expand('Finance');
    expect(screen.getByText('You can view this role but not change it.')).toBeInTheDocument();
    expect(cell('View Expenses and cash book')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('creates a role: validates, sends the keys and goes to the new role', async () => {
    const api = mockApi({
      'GET /permissions': ok(catalogue),
      'POST /roles': ok({ ...custom, id: 500, name: 'Clubhouse manager' }),
    });
    mount({});
    await expand('Helpdesk');
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByText('Pick at least one permission.')).toBeInTheDocument();
    expect(screen.getByText(/Use 3 to 50 letters/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Name/), 'Clubhouse manager');
    await userEvent.click(cell('View Complaints and building issues'));
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    await waitFor(() => expect(api.last('POST', '/roles')).toBeTruthy());
    expect(api.last('POST', '/roles')?.body).toEqual({
      name: 'Clubhouse manager',
      scope: 'society',
      permissionKeys: ['helpdesk.tickets.view'],
      requiresMfa: false,
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/roles/500'));
  });

  it('shows the plan limit message on 402', async () => {
    mockApi({ 'GET /permissions': ok(catalogue), 'POST /roles': err(402, 'USAGE_LIMIT_EXCEEDED') });
    mount({});
    await expand('Helpdesk');
    await userEvent.type(screen.getByLabelText(/^Name/), 'Another role');
    await userEvent.click(cell('View Complaints and building issues'));
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByText(/custom role limit|plan limit is reached/i)).toBeInTheDocument();
    expect(screen.getByText(/Upgrade your plan/)).toBeInTheDocument();
  });

  it('clones a role with basedOnRoleId and drops keys the caller does not hold', async () => {
    const api = mockApi({
      'GET /roles/403': ok(treasurer),
      'GET /permissions': ok(catalogue),
      'POST /roles': ok({ ...custom, id: 501 }),
    });
    mount({ cloneFrom: 403 });
    expect(
      await screen.findByText(/1 permission\(s\) of the source role are not available to you/),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Name/), 'Treasurer copy');
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    await waitFor(() => expect(api.last('POST', '/roles')).toBeTruthy());
    expect(api.last('POST', '/roles')?.body).toMatchObject({
      basedOnRoleId: 403,
      permissionKeys: ['finance.expenses.view'],
    });
  });

  it('shows CANNOT_GRANT_UNHELD_PERMISSION on save', async () => {
    mockApi({
      'GET /roles/412': ok(custom),
      'GET /permissions': ok(catalogue),
      'PATCH /roles/412': err(403, 'CANNOT_GRANT_UNHELD_PERMISSION'),
    });
    mount({ roleId: 412 });
    await expand('Helpdesk');
    await userEvent.click(cell('Edit Complaints and building issues'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dlg = await screen.findByRole('dialog', { name: 'Review changes' });
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: 'More access' } });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Confirm and save' }));
    expect(
      await screen.findByText('You cannot give a role with more access than yours.'),
    ).toBeInTheDocument();
  });
});
