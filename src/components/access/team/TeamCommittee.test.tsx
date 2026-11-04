import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe, search } from '@/test/helpers';
import { invitation, member, pagination, roleDetail, roleSummary } from '@/test/accessFixtures';
import {
  COMMITTEE_FEATURES,
  COMMITTEE_PERMS,
  currentRaw,
  overviewRaw,
  seatUsageRaw,
  termRaw,
} from '@/test/committeeFixtures';
import { TeamScreen } from './TeamScreen';

vi.mock('next/navigation', () => navigationMock());

const PERMS = [
  ...COMMITTEE_PERMS,
  'settings.members.export',
  'settings.roles.view',
  'settings.subscription.view',
  'finance.accounts.view',
];
const chairman = roleSummary({ id: 401, key: 'chairman', name: 'Chairman', isLocked: true });
const treasurer = roleSummary({ id: 403 });
const accountant = roleSummary({ id: 408, key: 'accountant', name: 'Accountant' });
const admin = roleSummary({ id: 409, key: 'society_admin', name: 'Society Admin' });

const members = [
  member({
    id: 1,
    userId: 11,
    name: 'Rajesh Kulkarni',
    role: { id: 401, key: 'chairman', name: 'Chairman', scope: 'society' },
  }),
  member({
    id: 2,
    userId: 13,
    name: 'Meera Iyer',
    role: { id: 405, key: 'committee_member', name: 'Committee Member', scope: 'society' },
  }),
  member({
    id: 3,
    userId: 55,
    name: 'Kiran Patel',
    role: { id: 403, key: 'treasurer', name: 'Treasurer', scope: 'society' },
  }),
  member({
    id: 4,
    userId: 99,
    name: 'Asha Menon',
    role: { id: 408, key: 'accountant', name: 'Accountant', scope: 'society' },
  }),
];

const routes = (extra: object = {}) => ({
  'GET /members': ok(members, 'OK', { pagination }),
  'GET /invitations': ok([invitation()], 'OK', { pagination }),
  'GET /roles': ok([chairman, treasurer, accountant, admin], 'OK', { pagination }),
  'GET /roles/401': ok(roleDetail({ ...chairman, permissionKeys: PERMS })),
  'GET /roles/403': ok(roleDetail()),
  'GET /roles/408': ok(roleDetail({ ...accountant, permissionKeys: ['finance.accounts.view'] })),
  'GET /roles/409': ok(roleDetail({ ...admin, permissionKeys: ['finance.accounts.view'] })),
  'GET /committee': ok(overviewRaw()),
  'GET /committee/terms/12': ok(termRaw()),
  'GET /committee/seat-usage': ok(seatUsageRaw()),
  ...extra,
});

function mount(r = routes(), perms = PERMS, features = COMMITTEE_FEATURES) {
  setMe(sampleMe({ permissions: perms, features }));
  const api = mockApi(r);
  render(
    <ToastProvider>
      <TeamScreen />
    </ToastProvider>,
  );
  return api;
}

beforeEach(resetAll);

describe('Team screen: committee seat column and term banner (11.1)', () => {
  it('shows the seat chips, the no-seat chip, flags and a dash for staff', async () => {
    mount();
    const r1 = (await screen.findByText('Rajesh Kulkarni')).closest('tr')!;
    await waitFor(() => expect(within(r1).getByText('Chairman', { selector: 'span' })).toBeInTheDocument());
    expect(screen.getByRole('columnheader', { name: /Committee seat/ })).toBeInTheDocument();
    expect(
      within(screen.getByText('Meera Iyer').closest('tr')!).getByText('Member · Co-opted'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText('Kiran Patel').closest('tr')!).getByText('No committee seat'),
    ).toBeInTheDocument();
    expect(within(screen.getByText('Asha Menon').closest('tr')!).queryByText('No committee seat')).toBeNull();
  });

  it('shows the seat flags as warning chips with words', async () => {
    mount(
      routes({
        'GET /members': ok(
          [
            member({
              id: 5,
              userId: 12,
              name: 'Arjun Shah',
              role: { id: 403, key: 'secretary', name: 'Secretary', scope: 'society' },
            }),
          ],
          'OK',
          { pagination },
        ),
      }),
    );
    expect(await screen.findByText('Check: Role does not match the seat')).toBeInTheDocument();
  });

  it('shows the term banner and a link to the Committee tab', async () => {
    mount(
      routes({
        'GET /committee': ok(overviewRaw({ banner: { code: 'TERM_ENDING', daysLeft: 28 } })),
      }),
    );
    expect(await screen.findByText(/Term ends in 28 days/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open the Committee tab' }));
    expect(await screen.findByText('Managing Committee 2024-2029')).toBeInTheDocument();
  });

  it('shows the caretaker banner and the election draft banner', async () => {
    mount(
      routes({
        'GET /committee': ok(
          overviewRaw({
            current: currentRaw({ status: 'EXPIRED' }),
            banner: { code: 'CARETAKER', endedOn: '2029-03-31' },
          }),
        ),
      }),
    );
    expect(await screen.findByText(/The committee continues as caretaker/)).toBeInTheDocument();
  });

  it('has no seat column and no banner when the plan has no committee terms', async () => {
    const api = mount(routes(), PERMS, []);
    await screen.findByText('Rajesh Kulkarni');
    expect(screen.queryByRole('columnheader', { name: /Committee seat/ })).toBeNull();
    expect(api.calls.some(c => c.path === '/committee')).toBe(false);
  });

  it('keeps the Team table when the committee cannot be loaded', async () => {
    mount(routes({ 'GET /committee': err(500, 'INTERNAL_ERROR') }));
    expect(await screen.findByText('Rajesh Kulkarni')).toBeInTheDocument();
    expect(screen.queryByTestId('term-banner')).toBeNull();
  });

  it('keeps the existing admin seat meter on the All tab', async () => {
    mount();
    await screen.findByText('Rajesh Kulkarni');
    expect(screen.queryByTestId('staff-seat-meter')).toBeNull();
  });
});

describe('Staff and admins tab (11.8)', () => {
  const open = async () => {
    search.current = new URLSearchParams('tab=staff');
  };

  it('shows loading, then the meter, presets and the staff table', async () => {
    await open();
    mount();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(await screen.findByText('Staff seats: 2 of 8 used')).toBeInTheDocument();
    expect(screen.getByText('Asha Menon')).toBeInTheDocument();
    expect(screen.getAllByText('Uses a seat').length).toBe(2);
    expect(await screen.findByRole('button', { name: 'Invite Accountant' })).toBeEnabled();
    expect(screen.getByRole('progressbar', { name: 'Staff seats used' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
  });

  it('shows the amber words at 80 percent and the full state with the upgrade link', async () => {
    await open();
    mount(routes({ 'GET /committee/seat-usage': ok(seatUsageRaw({ used: 7, free: 1 })) }));
    expect(await screen.findByText(/Staff seats: 7 of 8 used \(almost full\)/)).toBeInTheDocument();
  });

  it('disables inviting when no seat is free', async () => {
    await open();
    mount(routes({ 'GET /committee/seat-usage': ok(seatUsageRaw({ used: 8, free: 0 })) }));
    expect(await screen.findByText(/Staff seats: 8 of 8 used \(full\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite staff' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Invite staff' })).toHaveAttribute(
      'title',
      'No free staff seats',
    );
    expect(screen.getByRole('link', { name: 'Upgrade or free a seat' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Invite Accountant' })).toBeDisabled();
  });

  it('opens the invite modal titled Invite staff, limited to staff roles, with the preset role', async () => {
    await open();
    mount();
    await screen.findByText('Staff seats: 2 of 8 used');
    await userEvent.click(await screen.findByRole('button', { name: 'Invite Accountant' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('heading', { name: 'Invite staff' })).toBeInTheDocument();
    const role = within(dlg).getByLabelText(/Role/) as HTMLSelectElement;
    expect(role.value).toBe('408');
    const names = [...role.options].map(o => o.textContent);
    expect(names).toContain('Accountant');
    expect(names).not.toContain('Treasurer');
    expect(names).not.toContain('Chairman');
  });

  it('shows the empty state and hides invite buttons without settings.members.create', async () => {
    await open();
    mount(
      routes({ 'GET /committee/seat-usage': ok(seatUsageRaw({ staff: [], used: 0, free: 8 })) }),
      PERMS.filter(p => p !== 'settings.members.create'),
    );
    expect(await screen.findByText(/No staff accounts yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite staff' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Invite presets' })).toBeNull();
  });

  it('shows an error with a reference and retries', async () => {
    await open();
    mount(routes({ 'GET /committee/seat-usage': [err(500, 'INTERNAL_ERROR'), ok(seatUsageRaw())] }));
    expect(await screen.findByText('Reference:')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Staff seats: 2 of 8 used')).toBeInTheDocument();
  });

  it('shows the access page without settings.members.view', async () => {
    await open();
    mount(routes(), []);
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });
});
