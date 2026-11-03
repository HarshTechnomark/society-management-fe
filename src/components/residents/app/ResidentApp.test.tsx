import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { page } from '@/test/societyFixtures';
import {
  RES_FEATURES,
  RESIDENT_PERMS,
  householdUnit,
  joinRequest,
  move,
  permit,
  tenancy,
  transfer,
} from '@/test/residentsFixtures';
import { fakeUploader, signInAs } from '@/test/residentsHelpers';
import { ConfirmScreen } from './ConfirmScreen';
import { DirectoryScreen } from './DirectoryScreen';
import { EmergencyScreen } from './EmergencyScreen';
import { HomeScreen } from './HomeScreen';
import { JoinScreen } from './JoinScreen';
import { MyDocumentsScreen } from './MyDocumentsScreen';
import { MyRequestsScreen } from './MyRequestsScreen';
import { PetsScreen } from './PetsScreen';
import { PrivacyScreen } from './PrivacyScreen';
import { TenantScreen } from './TenantScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
function show(
  ui: ReactElement,
  routes: Routes,
  perms: string[] = RESIDENT_PERMS,
  features: string[] = RES_FEATURES,
) {
  signInAs(perms, features);
  const api = mockApi(routes);
  render(<ToastProvider>{ui}</ToastProvider>);
  return api;
}
const household = { 'GET /me/household': ok({ units: [householdUnit()] }) };

beforeEach(() => {
  resetAll();
  fakeUploader();
});

describe('Join your society', () => {
  const none = { 'GET /me/join-requests': ok([]) };

  it('shows the code step, then the status card after a request', async () => {
    const api = show(<JoinScreen />, {
      ...none,
      'GET /me/join/societies/sky-heights': ok({
        societyId: 1,
        name: 'Sky Heights CHS',
        city: 'Pune',
        joinable: true,
      }),
      'GET /me/join/societies/sky-heights/units': ok([{ unitId: 101, label: 'A-1203' }]),
      'POST /me/join-requests': ok({}),
    });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Society code' }), 'sky-heights');
    await userEvent.click(screen.getByRole('button', { name: 'Find society' }));
    expect(await screen.findByText('Sky Heights CHS', { exact: false })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search your flat' }), 'A-12');
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Flat' }), '101');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'I am the' }), 'OWNER');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.upload(
      screen.getByLabelText('Photo or PDF'),
      new File(['x'], 'id.jpg', { type: 'image/jpeg' }),
    );
    await screen.findByText('Attached: id.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/join-requests')?.body).toMatchObject({
        societyCode: 'sky-heights',
        unitId: 101,
        relation: 'OWNER',
        fileIds: [{ fileId: 55, docType: 'AADHAAR' }],
      }),
    );
  });

  it.each([
    ['SOCIETY_CODE_NOT_FOUND', 404, /No society has this code/],
    ['SOCIETY_NOT_JOINABLE', 422, /not accepting join requests/],
  ])('shows %s in plain words', async (code, status, text) => {
    show(<JoinScreen />, { ...none, 'GET /me/join/societies/sky-heights': err(status, code) });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Society code' }), 'sky-heights');
    await userEvent.click(screen.getByRole('button', { name: 'Find society' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('needs the agreement dates for a tenant and a document before sending', async () => {
    show(<JoinScreen />, {
      ...none,
      'GET /me/join/societies/sky-heights': ok({
        societyId: 1,
        name: 'Sky Heights CHS',
        city: 'Pune',
        joinable: true,
      }),
      'GET /me/join/societies/sky-heights/units': ok([{ unitId: 101, label: 'A-1203' }]),
    });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Society code' }), 'sky-heights');
    await userEvent.click(screen.getByRole('button', { name: 'Find society' }));
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search your flat' }), 'A');
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Flat' }), '101');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'I am the' }), 'TENANT');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Add the agreement start and an end date after it.')).toBeInTheDocument();
  });

  it.each([
    ['PENDING_OWNER', 'Waiting for the owner'],
    ['PENDING_ADMIN', 'Waiting for the committee'],
  ])('shows the %s status card and withdraws', async (status, text) => {
    const api = show(<JoinScreen />, {
      'GET /me/join-requests': ok([joinRequest({ status: status as 'PENDING_OWNER' })]),
      'POST /me/join-requests/913/withdraw': ok({}),
    });
    expect(await screen.findByText(text)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/join-requests/913/withdraw')?.body).toEqual({ version: 1 }),
    );
  });

  it('shows the approved card with a link to the society', async () => {
    show(<JoinScreen />, { 'GET /me/join-requests': ok([joinRequest({ status: 'APPROVED' })]) });
    expect(await screen.findByText('Approved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open Sky Heights CHS/ })).toBeInTheDocument();
  });

  it('shows the error state', async () => {
    show(<JoinScreen />, { 'GET /me/join-requests': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
});

describe('My home', () => {
  it('shows skeletons, then my flat, occupancy and the household with chips in words', async () => {
    show(<HomeScreen />, household);
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(await screen.findByText('A-1203')).toBeInTheDocument();
    expect(screen.getByText('Owner-occupied')).toBeInTheDocument();
    expect(screen.getByText('Kabir Shah')).toBeInTheDocument();
    expect(screen.getByText('No app login')).toBeInTheDocument();
    expect(screen.getByText('Has the app')).toBeInTheDocument();
  });
  it('shows the empty state with a join link', async () => {
    show(<HomeScreen />, { 'GET /me/household': ok({ units: [] }) });
    expect(await screen.findByText('No flat is linked to you yet.')).toBeInTheDocument();
  });
  it('shows the error state', async () => {
    show(<HomeScreen />, { 'GET /me/household': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
  it('asks for access without the household permission', async () => {
    show(<HomeScreen />, household, ['resident.home.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
  it('adds a member and invites one', async () => {
    const api = show(<HomeScreen />, {
      ...household,
      'POST /me/household/members': ok({}),
      'POST /me/household/members/8840/invite': ok({}),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add member' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Name/ }), 'Sita Shah');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add member' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/household/members')?.body).toMatchObject({
        unitId: 101,
        name: 'Sita Shah',
        relation: 'FAMILY',
        familyRelation: 'SPOUSE',
        invite: false,
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(api.last('POST', '/me/household/members/8840/invite')).toBeTruthy());
  });
  it('shows HOUSEHOLD_CONTROL_REQUIRED inside the add dialog', async () => {
    show(<HomeScreen />, {
      ...household,
      'POST /me/household/members': err(403, 'HOUSEHOLD_CONTROL_REQUIRED'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add member' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Name/ }), 'Sita Shah');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add member' }));
    expect(await within(dlg).findByText(/do not manage this household/)).toBeInTheDocument();
  });
  it('removes a member after confirming', async () => {
    const api = show(<HomeScreen />, {
      ...household,
      'DELETE /me/household/members/8840': { status: 200, data: null },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.last('DELETE', '/me/household/members/8840')).toBeTruthy());
  });
  it('hides the manage buttons for a family member and links to household permissions for members with a login', async () => {
    const u = householdUnit({ canManage: false });
    show(<HomeScreen />, { 'GET /me/household': ok({ units: [u] }) });
    await screen.findByText('A-1203');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
  });
  it('links to the permissions screen for a member with a login', async () => {
    const u = householdUnit();
    u.people[1] = { ...u.people[1], hasLogin: true, memberId: 1480 };
    show(<HomeScreen />, { 'GET /me/household': ok({ units: [u] }) });
    expect(await screen.findByRole('link', { name: 'Permissions' })).toHaveAttribute(
      'href',
      '/resident/household/1480/permissions',
    );
  });
  it('shows the portfolio for an owner of several flats', async () => {
    show(<HomeScreen />, {
      'GET /me/household': ok({ units: [householdUnit(), householdUnit({ unitId: 102, unitLabel: 'B-7' })] }),
      'GET /me/portfolio': ok([
        {
          unitId: 101,
          unitLabel: 'A-1203',
          occupancy: 'RENTED',
          duesPaise: 150000,
          tenancy: {
            status: 'ACTIVE',
            agreementEnd: '2027-09-30',
            policeVerificationStatus: 'NOT_SUBMITTED',
          },
          openRequests: [],
        },
      ]),
    });
    expect(await screen.findByText('Dues ₹1,500')).toBeInTheDocument();
    expect(screen.getByText('Police verification not submitted')).toBeInTheDocument();
  });
});

describe('Confirm requests', () => {
  it('confirms a join request and a move NOC, and declines with a reason', async () => {
    const api = show(<ConfirmScreen />, {
      'GET /me/household/join-requests': ok([
        joinRequest({ status: 'PENDING_OWNER', documents: [{ id: 1, docType: 'AADHAAR' }] }),
      ]),
      'GET /me/move-requests': ok([move({ status: 'PENDING_OWNER' })]),
      'POST /me/household/join-requests/913/confirm': ok({}),
      'POST /me/household/join-requests/913/decline': ok({}),
      'POST /me/move-requests/3101/owner-confirm': ok({}),
    });
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Documents: Aadhaar')).toBeInTheDocument();
    expect(screen.getByText(/Move-out NOC/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Confirm' })[0]);
    await waitFor(() =>
      expect(api.last('POST', '/me/household/join-requests/913/confirm')?.body).toEqual({ version: 1 }),
    );
    await screen.findByText('Asha Rao');
    await userEvent.click(screen.getAllByRole('button', { name: 'Confirm' })[1]);
    await waitFor(() =>
      expect(api.last('POST', '/me/move-requests/3101/owner-confirm')?.body).toEqual({ version: 1 }),
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Decline' })[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Reason/ }), 'I do not know them');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Decline' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/household/join-requests/913/decline')?.body).toEqual({
        version: 1,
        reason: 'I do not know them',
      }),
    );
  });
  it('shows the empty state', async () => {
    show(<ConfirmScreen />, { 'GET /me/household/join-requests': ok([]), 'GET /me/move-requests': ok([]) });
    expect(await screen.findByText('Nothing to confirm')).toBeInTheDocument();
  });
  it('shows OWNER_ACTION_ONLY when a non-primary owner confirms a move', async () => {
    show(<ConfirmScreen />, {
      'GET /me/household/join-requests': ok([]),
      'GET /me/move-requests': ok([move({ status: 'PENDING_OWNER' })]),
      'POST /me/move-requests/3101/owner-confirm': err(403, 'OWNER_ACTION_ONLY'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText(/Only an owner, or the primary owner/)).toBeInTheDocument();
  });
  it('shows the error state', async () => {
    show(<ConfirmScreen />, {
      'GET /me/household/join-requests': err(500, 'INTERNAL_ERROR'),
      'GET /me/move-requests': ok([]),
    });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
});

describe('My tenant', () => {
  const routes: Routes = { ...household, 'GET /me/tenancies': ok([tenancy({ status: 'DRAFT' })]) };
  it('shows the tenancy card with status words and police verification', async () => {
    show(<TenantScreen />, routes);
    expect(await screen.findByText('Neha Verma')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Police verification not submitted')).toBeInTheDocument();
  });
  it('submits the draft', async () => {
    const api = show(<TenantScreen />, { ...routes, 'POST /me/tenancies/701/submit': ok({}) });
    await userEvent.click(await screen.findByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(api.last('POST', '/me/tenancies/701/submit')?.body).toEqual({ version: 4 }));
  });
  it('adds a tenant with the agreement', async () => {
    const api = show(<TenantScreen />, { ...routes, 'POST /me/tenancies': ok({}) });
    await userEvent.click(await screen.findByRole('button', { name: 'Add tenant' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Tenant name/ }), 'Neha Verma');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Tenant mobile/ }), '9923456789');
    await userEvent.type(within(dlg).getByLabelText(/Agreement end/), '2027-09-30');
    await userEvent.upload(
      within(dlg).getByLabelText('Rent agreement (PDF or photo)'),
      new File(['x'], 'a.pdf', { type: 'application/pdf' }),
    );
    await within(dlg).findByText('Attached: a.pdf');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save tenancy' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/tenancies')?.body).toMatchObject({
        unitId: 101,
        tenant: { name: 'Neha Verma', mobile: '9923456789' },
        agreementEnd: '2027-09-30',
        fileIds: [{ fileId: 55, docType: 'RENT_AGREEMENT' }],
      }),
    );
  });
  it('shows TENANCY_DATES_INVALID from the API', async () => {
    show(<TenantScreen />, { ...routes, 'POST /me/tenancies': err(422, 'TENANCY_DATES_INVALID') });
    await userEvent.click(await screen.findByRole('button', { name: 'Add tenant' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Tenant name/ }), 'Neha Verma');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Tenant mobile/ }), '9923456789');
    await userEvent.type(within(dlg).getByLabelText(/Agreement end/), '2099-09-30');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save tenancy' }));
    expect(await within(dlg).findByText(/agreement dates are not valid/)).toBeInTheDocument();
  });
  it('rejects an end date before the start before sending', async () => {
    const api = show(<TenantScreen />, { ...routes, 'POST /me/tenancies': ok({}) });
    await userEvent.click(await screen.findByRole('button', { name: 'Add tenant' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Tenant name/ }), 'Neha Verma');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Tenant mobile/ }), '9923456789');
    await userEvent.type(within(dlg).getByLabelText(/Agreement end/), '2020-01-01');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save tenancy' }));
    expect(await within(dlg).findByText('The end date must be after the start date.')).toBeInTheDocument();
    expect(api.last('POST', '/me/tenancies')).toBeUndefined();
  });
  it('uploads police verification for an active tenancy', async () => {
    const api = show(<TenantScreen />, {
      ...household,
      'GET /me/tenancies': ok([tenancy({ status: 'ACTIVE' })]),
      'POST /me/tenancies/701/documents': ok({}),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Upload police verification' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.upload(
      within(dlg).getByLabelText('Document'),
      new File(['x'], 'pv.pdf', { type: 'application/pdf' }),
    );
    await within(dlg).findByText('Attached: pv.pdf');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/tenancies/701/documents')?.body).toEqual({
        fileIds: [{ fileId: 55, docType: 'POLICE_VERIFICATION' }],
      }),
    );
  });
  it('shows the empty state and tells a tenant that only owners add tenants', async () => {
    show(<TenantScreen />, {
      'GET /me/household': ok({ units: [householdUnit({ myRelation: 'TENANT' })] }),
      'GET /me/tenancies': ok([]),
    });
    expect(await screen.findByText('No tenant yet')).toBeInTheDocument();
    expect(screen.getByText('Only the owner of a flat can add a tenant.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add tenant' })).toBeNull();
  });
  it('shows the error state', async () => {
    show(<TenantScreen />, { ...household, 'GET /me/tenancies': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
  it('shows the plan prompt when tenancies are not in the plan', async () => {
    show(<TenantScreen />, routes, RESIDENT_PERMS, []);
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
  });
});

describe('Requests', () => {
  const routes: Routes = {
    ...household,
    'GET /me/move-requests': ok([
      move(),
      move({ id: 3102, status: 'APPROVED', type: 'MOVE_IN', gatePassCode: 'AB12CD34' }),
      move({ id: 3103, status: 'PENDING_DEPOSIT', depositPaise: 500000, duesBalancePaise: 0 }),
    ]),
    'GET /me/renovation-permits': ok([permit(), permit({ id: 2202, status: 'SUSPENDED' })]),
    'GET /me/ownership-transfers': ok([transfer()]),
  };
  it('shows move cards with the dues, deposit buttons and the gate pass code card', async () => {
    show(<MyRequestsScreen />, routes);
    expect(await screen.findByText('Dues to pay: ₹4,825')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay dues' })).toHaveAttribute('href', '/pay?unitId=101');
    expect(screen.getByRole('link', { name: 'Pay deposit' })).toBeInTheDocument();
    expect(screen.getByText('AB12CD34')).toBeInTheDocument();
    expect(screen.getByText('Gate pass code')).toBeInTheDocument();
  });
  it('checks dues again and cancels a move with a reason', async () => {
    const api = show(<MyRequestsScreen />, {
      ...routes,
      'POST /me/move-requests/3101/recheck-dues': ok({}),
      'POST /me/move-requests/3101/cancel': ok({}),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/move-requests/3101/recheck-dues')?.body).toEqual({ version: 1 }),
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel request' })[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Reason/ }), 'Plans changed');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel request' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/move-requests/3101/cancel')?.body).toEqual({
        reason: 'Plans changed',
        version: 1,
      }),
    );
  });
  it('requests a move with the slot and shows MOVE_SLOT_NOT_ALLOWED', async () => {
    const api = show(<MyRequestsScreen />, {
      ...routes,
      'POST /me/move-requests': err(422, 'MOVE_SLOT_NOT_ALLOWED'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Request a move' }));
    const dlg = await screen.findByRole('dialog');
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await userEvent.type(within(dlg).getByLabelText(/Move date/), future);
    await userEvent.click(within(dlg).getByRole('button', { name: /Morning 09:00 to 12:00/ }));
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Lift/ }), 'Tower A service lift');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request move' }));
    expect(await within(dlg).findByText(/Moves are not allowed at this time/)).toBeInTheDocument();
    expect(api.last('POST', '/me/move-requests')?.body).toMatchObject({
      unitId: 101,
      slotStart: '09:00',
      slotEnd: '12:00',
      liftLabel: 'Tower A service lift',
      moveDate: future,
    });
  });
  it('hides the lift field without the Premium feature', async () => {
    show(
      <MyRequestsScreen />,
      routes,
      RESIDENT_PERMS,
      RES_FEATURES.filter(f => f !== 'residents.moving_slot_and_lift_booking'),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Request a move' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).queryByRole('textbox', { name: /Lift/ })).toBeNull();
  });
  it('shows permit progress in words, "Work done" and the suspended warning', async () => {
    const api = show(<MyRequestsScreen />, {
      ...routes,
      'POST /me/renovation-permits/2201/work-done': ok({}),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Renovation' }));
    expect(await screen.findAllByRole('list', { name: 'Progress' })).toHaveLength(2);
    expect(screen.getByText(/Work is stopped/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Work done' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/renovation-permits/2201/work-done')?.body).toEqual({ version: 5 }),
    );
  });
  it('applies for a permit and shows PERMIT_EXISTS', async () => {
    show(<MyRequestsScreen />, { ...routes, 'POST /me/renovation-permits': err(409, 'PERMIT_EXISTS') });
    await userEvent.click(await screen.findByRole('button', { name: 'Renovation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Apply for a permit' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(
      within(dlg).getByRole('textbox', { name: 'What will be done' }),
      'Replace kitchen tiles and platform',
    );
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Contractor name/ }), 'Sunil Patil');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Contractor mobile/ }), '9823456789');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Number of workers/ }), '6');
    await userEvent.type(within(dlg).getByLabelText(/Start date/), '2026-11-10');
    await userEvent.type(within(dlg).getByLabelText(/End date/), '2026-11-30');
    await userEvent.upload(
      within(dlg).getByLabelText('Contractor ID'),
      new File(['x'], 'c.pdf', { type: 'application/pdf' }),
    );
    await within(dlg).findByText('Attached: c.pdf');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Apply for permit' }));
    expect(await within(dlg).findByText(/already has an open renovation permit/)).toBeInTheDocument();
  });
  it('shows the transfer fee preview, checklist and submits', async () => {
    const api = show(<MyRequestsScreen />, { ...routes, 'POST /me/ownership-transfers/41/submit': ok({}) });
    await userEvent.click(await screen.findByRole('button', { name: 'Ownership transfer' }));
    expect(await screen.findByText('Total ₹25,600')).toBeInTheDocument();
    expect(screen.getByText('Sale deed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/ownership-transfers/41/submit')?.body).toEqual({ version: 1 }),
    );
  });
  it('hides the transfer segment for tenants (BR-09-60)', async () => {
    show(<MyRequestsScreen />, {
      ...routes,
      'GET /me/household': ok({ units: [householdUnit({ myRelation: 'TENANT' })] }),
    });
    await screen.findByRole('button', { name: 'Moves' });
    expect(screen.queryByRole('button', { name: 'Ownership transfer' })).toBeNull();
  });
  it('shows the empty state and the error state', async () => {
    show(<MyRequestsScreen />, { ...household, 'GET /me/move-requests': ok([]) });
    expect(await screen.findByText('No move requests')).toBeInTheDocument();
  });
  it('shows the error state when moves fail', async () => {
    show(<MyRequestsScreen />, { ...household, 'GET /me/move-requests': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
  it('asks for access without resident.requests.view', async () => {
    show(<MyRequestsScreen />, household, ['resident.home.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('Directory', () => {
  it('lists neighbours with the contacts they allow and searches', async () => {
    const api = show(<DirectoryScreen />, {
      'GET /me/directory': ok(
        [
          { name: 'Priya Nair', unitLabel: 'B-12', relation: 'OWNER', mobile: '98XXXXX555' },
          { name: 'Amit Rao', unitLabel: 'C-3', relation: 'TENANT' },
        ],
        'OK',
        page(2, 1, 20),
      ),
    });
    expect(await screen.findByText('Priya Nair')).toBeInTheDocument();
    expect(screen.getByText('98XXXXX555')).toBeInTheDocument();
    expect(screen.getByText('Amit Rao')).toBeInTheDocument();
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search name or flat' }), 'Priya');
    await waitFor(() => expect(api.fn.mock.calls.some(c => String(c[0]).includes('q=Priya'))).toBe(true));
  });
  it('shows DIRECTORY_DISABLED in words', async () => {
    show(<DirectoryScreen />, { 'GET /me/directory': err(403, 'DIRECTORY_DISABLED') });
    expect(await screen.findByText(/turned the neighbour directory off/)).toBeInTheDocument();
  });
  it('shows the empty state and the plan prompt', async () => {
    show(<DirectoryScreen />, { 'GET /me/directory': ok([], 'OK', page(0)) });
    expect(await screen.findByText('No neighbours found')).toBeInTheDocument();
  });
  it('is locked outside the Standard plan', async () => {
    show(<DirectoryScreen />, {}, RESIDENT_PERMS, ['residents.person_registry']);
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
  });
});

describe('Privacy', () => {
  const privacy = {
    directoryVisible: true,
    showMobileInDirectory: false,
    showEmailInDirectory: false,
    showPhotoInDirectory: true,
    version: 2,
  };
  it('shows four switches and saves a change with the version', async () => {
    const api = show(<PrivacyScreen />, {
      'GET /me/privacy': ok(privacy),
      'PATCH /me/privacy': ok({ ...privacy, showMobileInDirectory: true, version: 3 }),
    });
    const sw = await screen.findByRole('switch', { name: 'Show my mobile number' });
    expect(screen.getAllByRole('switch')).toHaveLength(4);
    expect(sw).not.toBeChecked();
    await userEvent.click(sw);
    await waitFor(() =>
      expect(api.last('PATCH', '/me/privacy')?.body).toEqual({ showMobileInDirectory: true, version: 2 }),
    );
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Show my mobile number' })).toBeChecked());
  });
  it('shows the API error when saving fails', async () => {
    show(<PrivacyScreen />, {
      'GET /me/privacy': ok(privacy),
      'PATCH /me/privacy': err(409, 'STALE_VERSION'),
    });
    await userEvent.click(await screen.findByRole('switch', { name: 'Show my email' }));
    expect(await screen.findByText(/Someone else changed this/)).toBeInTheDocument();
  });
  it('shows the error state', async () => {
    show(<PrivacyScreen />, { 'GET /me/privacy': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
});

describe('Emergency profile', () => {
  const empty = { exists: false, bloodGroup: null, medicalNotes: null, contacts: [] };
  it('needs consent for health details and then saves', async () => {
    const api = show(<EmergencyScreen />, {
      'GET /me/emergency-profile': ok(empty),
      'PUT /me/emergency-profile': ok({}),
    });
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Blood group' }), 'B_POS');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Tick the consent to save health details.')).toBeInTheDocument();
    expect(api.last('PUT', '/me/emergency-profile')).toBeUndefined();
    await userEvent.click(screen.getByRole('checkbox', { name: /I agree that my health details/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() =>
      expect(api.last('PUT', '/me/emergency-profile')?.body).toMatchObject({
        bloodGroup: 'B_POS',
        consent: true,
        isSeniorCitizen: false,
      }),
    );
  });
  it('adds at most three contacts and validates the mobile', async () => {
    show(<EmergencyScreen />, { 'GET /me/emergency-profile': ok(empty) });
    const add = await screen.findByRole('button', { name: 'Add contact' });
    await userEvent.click(add);
    await userEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect((await screen.findAllByText('Enter a 10 digit Indian mobile number.')).length).toBe(3);
  });
  it('hides care flags without the Premium feature', async () => {
    show(
      <EmergencyScreen />,
      { 'GET /me/emergency-profile': ok(empty) },
      RESIDENT_PERMS,
      RES_FEATURES.filter(f => f !== 'residents.care_flags'),
    );
    await screen.findByRole('combobox', { name: 'Blood group' });
    expect(screen.queryByRole('checkbox', { name: 'Senior citizen' })).toBeNull();
  });
  it('withdraws consent with the version', async () => {
    const api = show(<EmergencyScreen />, {
      'GET /me/emergency-profile': ok({
        ...empty,
        exists: true,
        consent: true,
        bloodGroup: 'A_POS',
        version: 3,
      }),
      'PUT /me/emergency-profile': ok({}),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw consent' }));
    await waitFor(() =>
      expect(api.last('PUT', '/me/emergency-profile')?.body).toEqual({
        withdrawConsent: true,
        keepContacts: true,
        version: 3,
      }),
    );
  });
  it('shows CONSENT_REQUIRED from the API', async () => {
    show(<EmergencyScreen />, {
      'GET /me/emergency-profile': ok(empty),
      'PUT /me/emergency-profile': err(422, 'CONSENT_REQUIRED'),
    });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Preferred hospital' }), 'Ruby Hall');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText(/Tick the consent before saving health details/)).toBeInTheDocument();
  });
  it('shows the plan prompt below Standard', async () => {
    show(<EmergencyScreen />, {}, RESIDENT_PERMS, ['residents.person_registry']);
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
  });
});

describe('My pets', () => {
  const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const pets = [
    {
      id: 1,
      name: 'Rex',
      species: 'DOG',
      unitLabel: 'A-1203',
      vaccinationValidUntil: '2999-01-01',
      version: 1,
    },
    { id: 2, name: 'Tom', species: 'CAT', vaccinationValidUntil: '2000-01-01', version: 1 },
    { id: 3, name: 'Coco', species: 'DOG', vaccinationValidUntil: soon, version: 1 },
  ];
  it('shows vaccination chips with words: valid, due in N days, expired', async () => {
    show(<PetsScreen />, { 'GET /me/pets': ok(pets), ...household });
    expect(await screen.findByText('Vaccination valid')).toBeInTheDocument();
    expect(screen.getByText('Vaccination expired')).toBeInTheDocument();
    expect(screen.getByText('Vaccination due in 10 days')).toBeInTheDocument();
  });
  it('adds a dog and needs the vaccination date', async () => {
    const api = show(<PetsScreen />, { 'GET /me/pets': ok([]), ...household, 'POST /me/pets': ok({}) });
    await userEvent.click(await screen.findByRole('button', { name: 'Add pet' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Name/ }), 'Rex');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    expect(
      await within(dlg).findByText('A dog needs the date its vaccination is valid until.'),
    ).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText('Valid until'), '2027-01-10');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/pets')?.body).toMatchObject({
        name: 'Rex',
        species: 'DOG',
        vaccinationValidUntil: '2027-01-10',
        unitId: 101,
      }),
    );
  });
  it('shows PET_VACCINATION_REQUIRED from the API', async () => {
    show(<PetsScreen />, {
      'GET /me/pets': ok([]),
      ...household,
      'POST /me/pets': err(422, 'PET_VACCINATION_REQUIRED'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add pet' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Name/ }), 'Tom');
    await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: 'Kind' }), 'CAT');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    expect(await within(dlg).findByText(/dog needs a valid vaccination/)).toBeInTheDocument();
  });
  it('edits with the version and removes after confirming', async () => {
    const api = show(<PetsScreen />, {
      'GET /me/pets': ok([pets[0]]),
      ...household,
      'PATCH /me/pets/1': ok({}),
      'DELETE /me/pets/1': { status: 200, data: null },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/me/pets/1')?.body).toMatchObject({ name: 'Rex', version: 1 }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const confirm = await screen.findByRole('dialog');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.last('DELETE', '/me/pets/1')).toBeTruthy());
  });
  it('shows the empty state and the Premium prompt', async () => {
    show(<PetsScreen />, { 'GET /me/pets': ok([]), ...household });
    expect(await screen.findByText('No pets registered')).toBeInTheDocument();
  });
  it('is locked below Premium', async () => {
    show(<PetsScreen />, {}, RESIDENT_PERMS, ['residents.person_registry']);
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
  });
});

describe('My documents', () => {
  const docs = [
    {
      id: 61,
      docType: 'AADHAAR',
      title: null,
      idLast4: '1234',
      expiresOn: null,
      verificationStatus: 'REJECTED',
      uploadedAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 62,
      docType: 'PAN',
      title: null,
      idLast4: null,
      expiresOn: null,
      verificationStatus: 'VERIFIED',
      uploadedAt: '2026-10-02T10:00:00Z',
    },
  ];
  it('lists documents with a masked ID hint and verification words, and downloads', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    show(<MyDocumentsScreen />, {
      'GET /me/documents': ok(docs),
      'GET /me/documents/61/download-url': ok({ url: 'https://f/61', expiresAt: 'x' }),
    });
    expect(await screen.findByText('Aadhaar ····1234')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Download' })[0]);
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://f/61', '_blank', 'noopener'));
  });
  it('uploads an ID with the last 4 characters', async () => {
    const api = show(<MyDocumentsScreen />, { 'GET /me/documents': ok([]), 'POST /me/documents': ok({}) });
    expect(await screen.findByText('No documents yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Upload ID' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Last 4/ }), 'ab12');
    await userEvent.upload(
      within(dlg).getByLabelText('Photo or PDF'),
      new File(['x'], 'id.jpg', { type: 'image/jpeg' }),
    );
    await within(dlg).findByText('Attached: id.jpg');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Upload' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/documents')?.body).toEqual({
        fileId: 55,
        docType: 'AADHAAR',
        idLast4: 'AB12',
      }),
    );
  });
  it('shows DOCUMENT_TYPE_NOT_ALLOWED and the error state', async () => {
    show(<MyDocumentsScreen />, {
      'GET /me/documents': ok([]),
      'POST /me/documents': err(422, 'DOCUMENT_TYPE_NOT_ALLOWED'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Upload ID' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.upload(
      within(dlg).getByLabelText('Photo or PDF'),
      new File(['x'], 'id.jpg', { type: 'image/jpeg' }),
    );
    await within(dlg).findByText('Attached: id.jpg');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Upload' }));
    expect(await within(dlg).findByText(/cannot be uploaded here/)).toBeInTheDocument();
  });
  it('shows the error state', async () => {
    show(<MyDocumentsScreen />, { 'GET /me/documents': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
});
