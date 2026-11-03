import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { building } from '@/test/setupFixtures';
import { page } from '@/test/societyFixtures';
import {
  ADMIN_PERMS,
  RES_FEATURES,
  flat,
  joinRequest,
  move,
  panel,
  permit,
  residentDetail,
  resident,
  stats,
  tenancy,
  transfer,
  vacantFlat,
} from '@/test/residentsFixtures';
import { fakeUploader, signInAs } from '@/test/residentsHelpers';
import { ResidentsScreen } from './ResidentsScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
function renderIt(routes: Routes = {}, perms?: string[], features?: string[]) {
  signInAs(perms, features);
  const api = mockApi({
    'GET /residents/stats': ok(stats()),
    'GET /residents/units': ok([flat(), vacantFlat()], 'OK', page(2, 1, 12)),
    'GET /buildings': ok([building()], 'OK', page(1)),
    ...routes,
  });
  render(
    <ToastProvider>
      <ResidentsScreen />
    </ToastProvider>,
  );
  return api;
}
const urls = (api: ReturnType<typeof mockApi>) => api.fn.mock.calls.map(c => String(c[0]));
const tab = (name: RegExp | string) => userEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => {
  resetAll();
  fakeUploader();
});

describe('Residents page: states and gates', () => {
  it('shows skeleton rows while loading', () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('shows the header sub-line from the stats and the flats with status and dues', async () => {
    renderIt();
    expect(await screen.findByText('72 flats · 63 occupied')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Flats' });
    expect(within(table).getByText('A-1203')).toBeInTheDocument();
    expect(within(table).getAllByText('3 BHK · 1150 sq ft').length).toBe(2);
    expect(within(table).getByText('Neha Verma')).toBeInTheDocument();
    expect(within(table).getByText('Tenant · owner Ravi Shah')).toBeInTheDocument();
    expect(within(table).getByText('Rented')).toBeInTheDocument();
    expect(within(table).getByText('₹4,825')).toBeInTheDocument();
    expect(within(table).getByText('Paid up')).toBeInTheDocument();
    expect(within(table).getByText('Vacant', { selector: 'span.rounded-full' })).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    renderIt({ 'GET /residents/units': ok([], 'OK', page(0, 1, 12)) });
    expect(await screen.findByText('No flats yet')).toBeInTheDocument();
  });

  it('shows the error with the reference', async () => {
    renderIt({ 'GET /residents/units': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });

  it('asks for access without the view permission', async () => {
    renderIt({}, ['settings.society.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });

  it('shows the plan prompt when the registry is not in the plan', async () => {
    renderIt({}, ADMIN_PERMS, ['residents.tenancies']);
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
  });

  it('hides the tabs the plan or permission does not allow, and the buttons without permission', async () => {
    renderIt({}, ['residents.people.view'], ['residents.person_registry']);
    await screen.findByRole('table', { name: 'Flats' });
    expect(screen.queryByRole('tab', { name: 'Tenancies' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Requests' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Join requests/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add resident' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'People' })).toBeInTheDocument();
  });

  it('lists the five tabs with the pending join count', async () => {
    renderIt();
    await screen.findByRole('table', { name: 'Flats' });
    for (const n of ['Flats', 'Join requests (3)', 'People', 'Tenancies', 'Requests'])
      expect(screen.getByRole('tab', { name: n })).toBeInTheDocument();
  });

  it('sends the flat filters and segments to the API', async () => {
    const api = renderIt();
    await screen.findByRole('table', { name: 'Flats' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tower' }), '31');
    await userEvent.click(screen.getByRole('button', { name: /^Tenant/ }));
    await waitFor(() => {
      const last = urls(api)
        .filter(u => u.includes('/residents/units?'))
        .at(-1)!;
      expect(last).toContain('buildingId=31');
      expect(last).toContain('occupancy=RENTED');
      expect(last).toContain('limit=12');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Overdue' }));
    await waitFor(() =>
      expect(
        urls(api)
          .filter(u => u.includes('/residents/units?'))
          .at(-1),
      ).toContain('hasDues=true'),
    );
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search flat, name or tower' }), 'A-12');
    await waitFor(() =>
      expect(
        urls(api)
          .filter(u => u.includes('/residents/units?'))
          .at(-1),
      ).toContain('q=A-12'),
    );
  });

  it('exports the CSV with the Export CSV button', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const api = renderIt({
      'GET /residents/export': ok({ fileId: 1, downloadUrl: 'https://f/x.csv', expiresAt: 'x', rowCount: 3 }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(urls(api).some(u => u.includes('/residents/export'))).toBe(true));
    expect(open).toHaveBeenCalledWith('https://f/x.csv', '_blank', 'noopener');
  });
});

describe('Unit drawer', () => {
  const open = async (routes: Routes = {}, perms?: string[]) => {
    const api = renderIt({ 'GET /residents/units/101': ok(panel()), ...routes }, perms);
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203' }));
    return { api, dlg: await screen.findByRole('dialog') };
  };

  it('shows dues, occupancy, owners with shares, tenant with police chip, household and open requests', async () => {
    const { dlg } = await open();
    await within(dlg).findByText('₹4,825');
    expect(within(dlg).getAllByText('50.00% share').length).toBe(2);
    expect(within(dlg).getByText('Primary')).toBeInTheDocument();
    expect(within(dlg).getByText('Tenant Neha Verma')).toBeInTheDocument();
    expect(within(dlg).getByText('Police verification not submitted')).toBeInTheDocument();
    expect(within(dlg).getByText('Kabir Verma')).toBeInTheDocument();
    expect(within(dlg).getByText('Move-out')).toBeInTheDocument();
  });

  it('reveals contacts with the reveal query', async () => {
    const { api, dlg } = await open();
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Reveal contacts' }));
    await waitFor(() => expect(urls(api).some(u => u.includes('reveal=contacts'))).toBe(true));
  });

  it('hides Reveal contacts without residents.contacts.view', async () => {
    const { dlg } = await open(
      {},
      ADMIN_PERMS.filter(p => p !== 'residents.contacts.view'),
    );
    await within(dlg).findByText('₹4,825');
    expect(within(dlg).queryByRole('button', { name: 'Reveal contacts' })).toBeNull();
  });

  it('marks the flat vacant with a reason', async () => {
    const { api, dlg } = await open({
      'POST /residents/units/101/vacate': ok({ occupancy: 'VACANT', endedLinks: 3, endedTenancyId: 701 }),
    });
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Mark vacant' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Owner sold the flat');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Mark vacant' }));
    await waitFor(() =>
      expect(api.last('POST', '/residents/units/101/vacate')?.body).toEqual({
        reason: 'Owner sold the flat',
      }),
    );
  });

  it('shows the API error when marking vacant fails with MOVE_REQUEST_EXISTS', async () => {
    const { dlg } = await open({ 'POST /residents/units/101/vacate': err(409, 'MOVE_REQUEST_EXISTS') });
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Mark vacant' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Owner sold the flat');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Mark vacant' }));
    expect(await screen.findByText(/open move request already exists/)).toBeInTheDocument();
  });

  it('saves ownership shares only when they total 100', async () => {
    const { api, dlg } = await open({ 'PUT /residents/units/101/ownership-shares': ok([]) });
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Edit shares' }));
    const form = (await screen.findAllByRole('dialog')).at(-1)!;
    const first = within(form).getByRole('textbox', { name: /Share % of Ravi Shah/ });
    await userEvent.clear(first);
    await userEvent.type(first, '60');
    await userEvent.click(within(form).getByRole('button', { name: 'Save shares' }));
    expect(await within(form).findByText('Shares must add up to exactly 100%.')).toBeInTheDocument();
    expect(api.last('PUT', '/residents/units/101/ownership-shares')).toBeUndefined();
    const second = within(form).getByRole('textbox', { name: /Share % of Meera Shah/ });
    await userEvent.clear(second);
    await userEvent.type(second, '40');
    await userEvent.click(within(form).getByRole('button', { name: 'Save shares' }));
    await waitFor(() =>
      expect(api.last('PUT', '/residents/units/101/ownership-shares')?.body).toMatchObject({
        primaryLinkId: 8801,
        shares: [
          { linkId: 8801, sharePercent: '60.00' },
          { linkId: 8802, sharePercent: '40.00' },
        ],
      }),
    );
  });

  it('loads the timeline on request', async () => {
    const { dlg } = await open({
      'GET /residents/units/101/timeline': ok([
        {
          at: '2026-12-15',
          kind: 'OWNERSHIP_TRANSFERRED',
          label: 'A-1203 transferred to Kiran Desai (SALE)',
        },
      ]),
    });
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Show timeline' }));
    expect(await within(dlg).findByText(/transferred to Kiran Desai/)).toBeInTheDocument();
  });

  it('shows an error state when the flat cannot be loaded', async () => {
    renderIt({ 'GET /residents/units/101': err(404, 'UNIT_NOT_FOUND') });
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('req_test')).toBeInTheDocument();
  });
});

describe('Add resident', () => {
  const fill = async (dlg: HTMLElement) => {
    await userEvent.type(within(dlg).getByRole('searchbox', { name: 'Search flat' }), 'A-12');
    await userEvent.selectOptions(await within(dlg).findByRole('combobox', { name: 'Flat' }), '102');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Name/ }), 'Ravi Shah');
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Mobile' }), '9820011121');
  };
  const routes: Routes = { 'GET /residents/units': ok([vacantFlat()], 'OK', page(1, 1, 12)) };

  it('shows inline errors before sending', async () => {
    const api = renderIt(routes);
    await userEvent.click(await screen.findByRole('button', { name: 'Add resident' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add and invite' }));
    expect(await within(dlg).findByText('Enter the full name.')).toBeInTheDocument();
    expect(within(dlg).getByText('Enter a 10 digit Indian mobile number.')).toBeInTheDocument();
    expect(api.last('POST', '/residents')).toBeUndefined();
  });

  it('creates the resident with the link and invite', async () => {
    const api = renderIt({ ...routes, 'POST /residents': ok({ id: 5101, name: 'Ravi Shah', warnings: [] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Add resident' }));
    const dlg = await screen.findByRole('dialog');
    await fill(dlg);
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add and invite' }));
    await waitFor(() =>
      expect(api.last('POST', '/residents')?.body).toMatchObject({
        name: 'Ravi Shah',
        mobile: '9820011121',
        invite: true,
        link: { unitId: 102, relation: 'OWNER' },
      }),
    );
    expect(await screen.findByText('Resident added and invited')).toBeInTheDocument();
  });

  it('offers to link the existing person on RESIDENT_MOBILE_EXISTS', async () => {
    const api = renderIt({
      ...routes,
      'POST /residents': err(409, 'RESIDENT_MOBILE_EXISTS', [
        { field: 'residentId', message: '5101', residentId: 5101 } as never,
      ]),
      'GET /residents/5101': ok(residentDetail()),
      'POST /residents/5101/links': ok({}),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add resident' }));
    const dlg = await screen.findByRole('dialog');
    await fill(dlg);
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add and invite' }));
    expect(
      await within(dlg).findByText(/This number belongs to Ravi Shah. Link them instead\?/),
    ).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Link existing person' }));
    await waitFor(() =>
      expect(api.last('POST', '/residents/5101/links')?.body).toMatchObject({
        unitId: 102,
        relation: 'OWNER',
      }),
    );
  });

  it('opens the tenancy form when Tenant is chosen', async () => {
    renderIt(routes);
    await userEvent.click(await screen.findByRole('button', { name: 'Add resident' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: 'Living as' }), 'TENANT');
    expect(await screen.findByRole('dialog', { name: 'Add tenant' })).toBeInTheDocument();
  });
});

describe('People tab', () => {
  const routes: Routes = {
    'GET /residents': ok([resident()], 'OK', page(1)),
    'GET /residents/5101': ok(residentDetail()),
  };
  it('lists people and sends the filters', async () => {
    const api = renderIt(routes);
    await tab('People');
    const table = await screen.findByRole('table', { name: 'People' });
    expect(within(table).getByText('A-1203 (Owner)')).toBeInTheDocument();
    expect(within(table).getByText('ID waiting for check')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Relation' }), 'TENANT');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'ID check' }), 'VERIFIED');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'App login' }), 'yes');
    await waitFor(() => {
      const last = urls(api)
        .filter(u => u.includes('/residents?'))
        .at(-1)!;
      expect(last).toContain('relation=TENANT');
      expect(last).toContain('kycStatus=VERIFIED');
      expect(last).toContain('hasLogin=true');
    });
  });
  it('shows the empty state', async () => {
    renderIt({ ...routes, 'GET /residents': ok([], 'OK', page(0)) });
    await tab('People');
    expect(await screen.findByText('No residents yet')).toBeInTheDocument();
  });
  it('opens the person drawer with links, documents and the emergency indicator without contents', async () => {
    renderIt(routes);
    await tab('People');
    await userEvent.click(await screen.findByRole('button', { name: 'Open Ravi Shah' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('Emergency profile saved · care flags')).toBeInTheDocument();
    expect(within(dlg).getByText(/Aadhaar ····1234/)).toBeInTheDocument();
    expect(within(dlg).getByText('Waiting for check')).toBeInTheDocument();
  });
  it('verifies a document and rejects another with a reason', async () => {
    const api = renderIt({ ...routes, 'POST /resident-documents/61/verify': ok({}) });
    await tab('People');
    await userEvent.click(await screen.findByRole('button', { name: 'Open Ravi Shah' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Verify' }));
    await waitFor(() =>
      expect(api.last('POST', '/resident-documents/61/verify')?.body).toEqual({
        decision: 'VERIFIED',
        version: 1,
      }),
    );
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Reject' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Photo is blurred');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(api.last('POST', '/resident-documents/61/verify')?.body).toEqual({
        decision: 'REJECTED',
        reason: 'Photo is blurred',
        version: 1,
      }),
    );
  });
  it('ends a link and shows the API error in the dialog', async () => {
    const api = renderIt({ ...routes, 'POST /residents/links/8801/end': err(422, 'OWNER_REQUIRED') });
    await tab('People');
    await userEvent.click(await screen.findByRole('button', { name: 'Open Ravi Shah' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'End link' }));
    const form = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(form).getByRole('button', { name: 'End link' }));
    expect(await within(form).findByText(/needs an owner/)).toBeInTheDocument();
    expect(api.last('POST', '/residents/links/8801/end')?.body).toMatchObject({
      endReason: 'MOVED_OUT',
      version: 2,
    });
  });
  it('uploads a document', async () => {
    const api = renderIt({ ...routes, 'POST /residents/5101/documents': ok({}) });
    await tab('People');
    await userEvent.click(await screen.findByRole('button', { name: 'Open Ravi Shah' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Upload' }));
    const form = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.upload(
      within(form).getByLabelText('File'),
      new File(['x'], 'id.pdf', { type: 'application/pdf' }),
    );
    await within(form).findByText('Attached: id.pdf');
    await userEvent.click(within(form).getByRole('button', { name: 'Upload' }));
    await waitFor(() =>
      expect(api.last('POST', '/residents/5101/documents')?.body).toMatchObject({
        fileId: 55,
        docType: 'AADHAAR',
      }),
    );
  });
  it('deletes a person with a reason and the version', async () => {
    const api = renderIt({ ...routes, 'DELETE /residents/5101': { status: 200, data: null } });
    await tab('People');
    await userEvent.click(await screen.findByRole('button', { name: 'Open Ravi Shah' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Delete person' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Entered twice');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete person' }));
    await waitFor(() =>
      expect(api.last('DELETE', '/residents/5101')?.body).toEqual({ reason: 'Entered twice', version: 3 }),
    );
  });
});

describe('Join requests tab', () => {
  it('shows cards with the document chip and approves through module 14', async () => {
    const api = renderIt({
      'GET /join-requests': ok([joinRequest()], 'OK', page(1)),
      'POST /approvals/555/approve': ok({}),
    });
    await tab(/Join requests/);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Agreement and ID received')).toBeInTheDocument();
    expect(screen.getByText('Waiting for the committee')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.last('POST', '/approvals/555/approve')).toBeTruthy());
  });
  it('rejects with a reason', async () => {
    const api = renderIt({
      'GET /join-requests': ok([joinRequest()], 'OK', page(1)),
      'POST /approvals/555/reject': ok({}),
    });
    await tab(/Join requests/);
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const confirm = await screen.findByRole('dialog');
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Not a resident');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(api.last('POST', '/approvals/555/reject')?.body).toEqual({ reason: 'Not a resident' }),
    );
  });
  it('disables the buttons with the reason without the approver permission or while the owner has not confirmed', async () => {
    renderIt(
      {
        'GET /join-requests': ok(
          [joinRequest(), joinRequest({ id: 914, status: 'PENDING_OWNER' })],
          'OK',
          page(2),
        ),
      },
      ADMIN_PERMS.filter(p => p !== 'residents.requests.approve'),
    );
    await tab(/Join requests/);
    await screen.findAllByText('Asha Rao');
    for (const b of screen.getAllByRole('button', { name: 'Approve' })) expect(b).toBeDisabled();
    expect(screen.getAllByText('You need permission to approve resident requests.').length).toBe(2);
  });
  it('shows the owner wait reason when allowed to approve', async () => {
    renderIt({ 'GET /join-requests': ok([joinRequest({ status: 'PENDING_OWNER' })], 'OK', page(1)) });
    await tab(/Join requests/);
    expect(await screen.findByText('Waiting for the owner to confirm first.')).toBeInTheDocument();
  });
  it('shows the empty text', async () => {
    renderIt({ 'GET /join-requests': ok([], 'OK', page(0)) });
    await tab(/Join requests/);
    expect(
      await screen.findByText('New residents who sign up appear here for approval.'),
    ).toBeInTheDocument();
  });
  it('shows the error state', async () => {
    renderIt({ 'GET /join-requests': err(500, 'INTERNAL_ERROR') });
    await tab(/Join requests/);
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
});

describe('Tenancies tab', () => {
  const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const rows = [
    tenancy(),
    tenancy({
      id: 702,
      status: 'EXPIRED_OVERSTAY',
      unit: { id: 5, label: 'B-5' },
      agreementEnd: '2026-01-01',
    }),
    tenancy({ id: 703, status: 'ACTIVE', unit: { id: 6, label: 'C-6' }, agreementEnd: soon }),
  ];
  const routes: Routes = { 'GET /tenancies': ok(rows, 'OK', page(3)), 'GET /tenancies/701': ok(tenancy()) };

  it('lists tenancies with status words, amber within 30 days and red overstay', async () => {
    renderIt(routes);
    await tab('Tenancies');
    const table = await screen.findByRole('table', { name: 'Tenancies' });
    expect(within(table).getByText('Waiting for approval')).toBeInTheDocument();
    expect(within(table).getByText(/overstaying/)).toBeInTheDocument();
    expect(within(table).getByText(/ends in 10 days/)).toBeInTheDocument();
    expect(within(table).getAllByText('Police verification not submitted').length).toBe(3);
  });
  it('applies the verification tracker filter', async () => {
    const api = renderIt(routes);
    await tab('Tenancies');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Verification tracker/ }));
    await waitFor(() => {
      const last = urls(api)
        .filter(u => u.includes('/tenancies?'))
        .at(-1)!;
      expect(last).toContain('status=ACTIVE');
      expect(last).toContain('policeVerificationStatus=NOT_SUBMITTED');
    });
  });
  it('shows the empty state', async () => {
    renderIt({ 'GET /tenancies': ok([], 'OK', page(0)) });
    await tab('Tenancies');
    expect(await screen.findByText('No tenancies')).toBeInTheDocument();
  });
  it('approves a pending tenancy with the version', async () => {
    const api = renderIt({ ...routes, 'POST /tenancies/701/approve': ok(tenancy({ status: 'APPROVED' })) });
    await tab('Tenancies');
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 Neha Verma' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Approve' }));
    const form = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(form).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.last('POST', '/tenancies/701/approve')?.body).toEqual({ version: 4 }));
  });
  it('shows MAKER_CHECKER_VIOLATION in plain words', async () => {
    renderIt({ ...routes, 'POST /tenancies/701/approve': err(409, 'MAKER_CHECKER_VIOLATION') });
    await tab('Tenancies');
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 Neha Verma' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Approve' }));
    const form = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.click(within(form).getByRole('button', { name: 'Approve' }));
    expect(await within(form).findByText(/different person must approve/)).toBeInTheDocument();
  });
  it('rejects with a reason and cancels', async () => {
    const api = renderIt({ ...routes, 'POST /tenancies/701/reject': ok({}) });
    await tab('Tenancies');
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 Neha Verma' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Reject' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Agreement unclear');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(api.last('POST', '/tenancies/701/reject')?.body).toEqual({
        reason: 'Agreement unclear',
        version: 4,
      }),
    );
  });
  it('submits a draft tenancy', async () => {
    const api = renderIt({
      ...routes,
      'GET /tenancies/701': ok(tenancy({ status: 'DRAFT' })),
      'POST /tenancies/701/submit': ok({}),
    });
    await tab('Tenancies');
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 Neha Verma' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(api.last('POST', '/tenancies/701/submit')?.body).toEqual({ version: 4 }));
  });
  it('requires the verification date and reference for VERIFIED, then saves', async () => {
    const api = renderIt({
      ...routes,
      'GET /tenancies/701': ok(tenancy({ status: 'ACTIVE' })),
      'PATCH /tenancies/701/police-verification': ok({}),
    });
    await tab('Tenancies');
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 Neha Verma' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Update police verification' }));
    const form = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.selectOptions(within(form).getByRole('combobox', { name: 'Status' }), 'VERIFIED');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByText('Add the verification date and reference.')).toBeInTheDocument();
    await userEvent.type(within(form).getByRole('textbox', { name: 'Reference' }), 'PV/2026/118');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/tenancies/701/police-verification')?.body).toMatchObject({
        status: 'VERIFIED',
        reference: 'PV/2026/118',
        version: 4,
      }),
    );
  });
  it('hides actions without the edit permission', async () => {
    renderIt(routes, ['residents.people.view', 'residents.requests.view']);
    await tab('Tenancies');
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 Neha Verma' }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByText('Maintenance paid by');
    expect(within(dlg).queryByRole('button', { name: 'Approve' })).toBeNull();
  });
});

describe('Requests tab', () => {
  const routes: Routes = {
    'GET /move-requests': ok(
      [
        move(),
        move({
          id: 3102,
          type: 'MOVE_IN',
          status: 'APPROVED',
          unitLabel: 'B-5',
          gatePassCode: 'AB12CD34',
          moveDate: new Date().toISOString().slice(0, 10),
        }),
      ],
      'OK',
      page(2),
    ),
    'GET /renovation-permits': ok([permit(), permit({ id: 2202, status: 'SUSPENDED' })], 'OK', page(2)),
    'GET /ownership-transfers': ok([transfer()], 'OK', page(1)),
    'GET /ownership-transfers/41': ok(transfer({ balancePaise: 0 })),
  };
  it('lists moves with status words, a blocked-dues hint and the lift', async () => {
    renderIt(routes);
    await tab('Requests');
    const table = await screen.findByRole('table', { name: 'Moves' });
    expect(within(table).getByText('Blocked: dues unpaid')).toBeInTheDocument();
    expect(within(table).getAllByText('Tower A service lift').length).toBe(2);
  });
  it('shows the week calendar by lift', async () => {
    const api = renderIt(routes);
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: 'Week calendar' }));
    expect(await screen.findByRole('table', { name: 'Moves this week by lift' })).toBeInTheDocument();
    await waitFor(() =>
      expect(urls(api).some(u => u.includes('dateFrom=') && u.includes('dateTo='))).toBe(true),
    );
  });
  it('rechecks dues, and overrides with a reason', async () => {
    const api = renderIt({
      ...routes,
      'POST /move-requests/3101/recheck-dues': ok({}),
      'POST /move-requests/3101/override-dues': ok({}),
    });
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 2027-09-30' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Check dues again' }));
    await waitFor(() =>
      expect(api.last('POST', '/move-requests/3101/recheck-dues')?.body).toEqual({ version: 1 }),
    );
  });
  it('overrides dues with a reason', async () => {
    const api = renderIt({ ...routes, 'POST /move-requests/3101/override-dues': ok({}) });
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 2027-09-30' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Override dues' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Committee agreed');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Override' }));
    await waitFor(() =>
      expect(api.last('POST', '/move-requests/3101/override-dues')?.body).toEqual({
        reason: 'Committee agreed',
        version: 1,
      }),
    );
  });
  it('starts an approved move', async () => {
    const api = renderIt({ ...routes, 'POST /move-requests/3102/start': ok({}) });
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: /Open B-5/ }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('AB12CD34')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mark started' }));
    await waitFor(() => expect(api.last('POST', '/move-requests/3102/start')?.body).toEqual({ version: 1 }));
  });
  it('shows MOVE_SLOT_CONFLICT when a new move clashes', async () => {
    renderIt({
      ...routes,
      'POST /move-requests': err(409, 'MOVE_SLOT_CONFLICT'),
      'GET /residents/units': ok([flat()], 'OK', page(1, 1, 12)),
    });
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: 'New move' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('searchbox', { name: 'Search flat' }), 'A-12');
    await userEvent.selectOptions(await within(dlg).findByRole('combobox', { name: 'Flat' }), '101');
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await userEvent.type(within(dlg).getByLabelText(/Move date/), future);
    await userEvent.click(within(dlg).getByRole('button', { name: 'Request move' }));
    expect(await within(dlg).findByText(/already booked/)).toBeInTheDocument();
  });
  it('lists permits, stops work with a reason and shows words for a suspended permit', async () => {
    const api = renderIt({ ...routes, 'POST /renovation-permits/2201/suspend': ok({}) });
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: 'Renovation' }));
    const table = await screen.findByRole('table', { name: 'Renovation permits' });
    expect(within(table).getByText('Stopped: work suspended')).toBeInTheDocument();
    await userEvent.click(within(table).getAllByRole('button', { name: 'Open A-1203 Kitchen' })[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Stop work' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Drilling at night');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Stop work' }));
    await waitFor(() =>
      expect(api.last('POST', '/renovation-permits/2201/suspend')?.body).toEqual({
        reason: 'Drilling at night',
        version: 5,
      }),
    );
  });
  it('records a violation with stop work', async () => {
    const api = renderIt({ ...routes, 'POST /renovation-permits/2201/violations': ok({}) });
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: 'Renovation' }));
    const table = await screen.findByRole('table', { name: 'Renovation permits' });
    await userEvent.click(within(table).getAllByRole('button', { name: 'Open A-1203 Kitchen' })[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Record violation' }));
    const form = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(form).getByRole('textbox', { name: 'Note' }), 'Drilling at 20:00');
    await userEvent.click(within(form).getByRole('checkbox', { name: 'Stop work now' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Record' }));
    await waitFor(() =>
      expect(api.last('POST', '/renovation-permits/2201/violations')?.body).toMatchObject({
        category: 'OUTSIDE_HOURS',
        stopWork: true,
        finePaise: 0,
      }),
    );
  });
  it('shows transfer fee figures, missing documents and submits a draft', async () => {
    const api = renderIt({ ...routes, 'POST /ownership-transfers/41/submit': ok({}) });
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: 'Transfers' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 Sale' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('₹25,600')).toBeInTheDocument();
    expect(within(dlg).getByText('Sale deed')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() =>
      expect(api.last('POST', '/ownership-transfers/41/submit')?.body).toEqual({ version: 1 }),
    );
  });
  it('shows TRANSFER_DUES_PENDING when completing with dues', async () => {
    renderIt({
      ...routes,
      'GET /ownership-transfers/41': ok(transfer({ status: 'APPROVED' })),
      'POST /ownership-transfers/41/complete': err(422, 'TRANSFER_DUES_PENDING'),
    });
    await tab('Requests');
    await userEvent.click(await screen.findByRole('button', { name: 'Transfers' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203 Sale' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Complete transfer' }));
    expect(await screen.findByText(/Dues or fees are still unpaid/)).toBeInTheDocument();
  });
  it('hides sub-segments the plan does not include', async () => {
    renderIt(
      routes,
      ADMIN_PERMS,
      RES_FEATURES.filter(f => f !== 'residents.ownership_transfer' && f !== 'residents.renovation_permits'),
    );
    await tab('Requests');
    await screen.findByRole('table', { name: 'Moves' });
    expect(screen.queryByRole('button', { name: 'Renovation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Transfers' })).toBeNull();
  });
  it('shows the empty state for moves', async () => {
    renderIt({ ...routes, 'GET /move-requests': ok([], 'OK', page(0)) });
    await tab('Requests');
    expect(await screen.findByText('No move requests')).toBeInTheDocument();
  });
});
