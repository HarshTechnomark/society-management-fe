import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { building, society, unit } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { page } from '@/test/societyFixtures';
import { UnitsScreen } from './UnitsScreen';

vi.mock('next/navigation', () => navigationMock());

const ROWS = [
  unit(),
  unit({ id: 9106, label: 'A-202', unitNumber: '202', areaSqft: null, bhk: '2BHK' }),
  unit({ id: 9107, label: 'A-203', status: 'ARCHIVED' }),
];

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms?: string[], features?: string[]) {
  signIn(perms, features);
  const api = mockApi({
    'GET /units': ok(ROWS, 'OK', page(3, 1, 50)),
    'GET /buildings': ok([building()], 'OK', page(1)),
    ...routes,
  });
  render(
    <ToastProvider>
      <UnitsScreen />
    </ToastProvider>,
  );
  return api;
}

const urls = (api: ReturnType<typeof mockApi>) => api.fn.mock.calls.map(c => String(c[0]));

describe('Flats list (11.6)', () => {
  beforeEach(resetAll);

  it('shows skeleton rows while loading', () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('lists flats with floor, type, BHK, area, billable, status and flags missing areas by icon and words', async () => {
    renderIt();
    const table = await screen.findByRole('table', { name: 'Flats' });
    expect(within(table).getByText('A-201')).toBeInTheDocument();
    expect(within(table).getAllByText('3 BHK').length).toBe(2);
    expect(within(table).getByText('2 BHK')).toBeInTheDocument();
    expect(within(table).getAllByText('1,150').length).toBe(2);
    expect(within(table).getByText(/Area missing/)).toBeInTheDocument();
    expect(within(table).getByText('Archived')).toBeInTheDocument();
  });

  it('shows the empty state and the error state', async () => {
    renderIt({ 'GET /units': ok([], 'OK', page(0, 1, 50)) });
    expect(await screen.findByText('No flats yet')).toBeInTheDocument();
  });

  it('shows the error with the reference', async () => {
    renderIt({ 'GET /units': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });

  it('sends the filters to the API', async () => {
    const api = renderIt();
    await screen.findByRole('table', { name: 'Flats' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Building' }), '31');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'FLAT');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ALL');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Missing area only' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search flat or tower' }), 'A-12');
    await waitFor(() => {
      const last = urls(api)
        .filter(u => u.includes('/units?'))
        .at(-1)!;
      expect(last).toContain('buildingId=31');
      expect(last).toContain('unitType=FLAT');
      expect(last).toContain('status=ALL');
      expect(last).toContain('missingArea=true');
      expect(last).toContain('q=A-12');
    });
  });

  it('pages through the server list', async () => {
    const api = renderIt({ 'GET /units': ok(ROWS, 'OK', page(120, 1, 50)) });
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(urls(api).some(u => u.includes('page=2'))).toBe(true));
  });

  it('opens a flat, edits the area and saves with the version', async () => {
    const api = renderIt({
      'GET /units/9105': ok(unit()),
      'GET /society': ok(society()),
      'PATCH /units/9105': ok(unit({ version: 5 })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-201' }));
    const dlg = await screen.findByRole('dialog');
    const carpet = await within(dlg).findByRole('textbox', { name: /Carpet area/ });
    await userEvent.clear(carpet);
    await userEvent.type(carpet, '1200');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/units/9105')).toBeTruthy());
    expect(api.last('PATCH', '/units/9105')!.body).toMatchObject({
      carpetAreaSqft: '1200',
      version: 4,
      buildingId: 31,
      unitNumber: '201',
    });
  });

  it('rejects a bad area before sending and shows AREA_ORDER_INVALID from the API', async () => {
    const api = renderIt({
      'GET /units/9105': ok(unit()),
      'GET /society': ok(society()),
      'PATCH /units/9105': err(422, 'AREA_ORDER_INVALID'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-201' }));
    const dlg = await screen.findByRole('dialog');
    const carpet = await within(dlg).findByRole('textbox', { name: /Carpet area/ });
    await userEvent.clear(carpet);
    await userEvent.type(carpet, '12.3456');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    expect(await within(dlg).findByText('A number with up to 3 decimals.')).toBeInTheDocument();
    expect(api.last('PATCH', '/units/9105')).toBeUndefined();
    await userEvent.clear(carpet);
    await userEvent.type(carpet, '2000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    expect(await within(dlg).findByText(/Carpet area cannot be more than built-up/)).toBeInTheDocument();
  });

  it('archives with a reason and shows every guard reason when blocked', async () => {
    renderIt({
      'GET /units/9105': ok(unit()),
      'GET /society': ok(society()),
      'POST /units/9105/archive': err(409, 'UNIT_ARCHIVE_BLOCKED', [
        { field: 'module', message: 'UNIT_HAS_RESIDENTS' },
        { field: 'module', message: 'UNIT_HAS_BALANCE' },
      ]),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-201' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Archive' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Merged flat');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText(/active residents/)).toBeInTheDocument();
    expect(screen.getByText(/unpaid or unsettled balance/)).toBeInTheDocument();
  });

  it('restores an archived flat', async () => {
    const api = renderIt({
      'GET /units/9107': ok(unit({ id: 9107, label: 'A-203', status: 'ARCHIVED', archivedReason: 'Merged' })),
      'GET /society': ok(society()),
      'POST /units/9107/restore': ok(unit()),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-203' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Restore' }));
    await userEvent.click(
      within((await screen.findAllByRole('dialog')).at(-1)!).getByRole('button', { name: 'Restore' }),
    );
    await waitFor(() => expect(api.last('POST', '/units/9107/restore')).toBeTruthy());
    expect(api.last('POST', '/units/9107/restore')!.body).toEqual({ version: 4 });
  });

  it('shows Delete only before go-live or within 24 hours', async () => {
    renderIt({
      'GET /units/9105': ok(unit()),
      'GET /society': ok(society({ isLive: true })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-201' }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByRole('button', { name: 'Archive' });
    expect(within(dlg).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('deletes a setup mistake before go-live', async () => {
    const api = renderIt({
      'GET /units/9105': ok(unit()),
      'GET /society': ok(society({ isLive: false })),
      'DELETE /units/9105': { status: 204 },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-201' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Delete' }));
    await userEvent.click(
      within((await screen.findAllByRole('dialog')).at(-1)!).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(api.last('DELETE', '/units/9105')).toBeTruthy());
  });

  it('adds a flat', async () => {
    const api = renderIt({ 'POST /units': ok(unit({ id: 1 })) });
    await userEvent.click(await screen.findByRole('button', { name: 'Add flat' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: 'Building' }), '31');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Flat number/ }), '301');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add flat' }));
    await waitFor(() => expect(api.last('POST', '/units')).toBeTruthy());
    expect(api.last('POST', '/units')!.body).toMatchObject({
      buildingId: 31,
      unitNumber: '301',
      floor: 1,
      unitType: 'FLAT',
      isBillable: true,
    });
  });

  it('shows USAGE_LIMIT_EXCEEDED when the plan is full', async () => {
    renderIt({ 'POST /units': err(402, 'USAGE_LIMIT_EXCEEDED') });
    await userEvent.click(await screen.findByRole('button', { name: 'Add flat' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: 'Building' }), '31');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Flat number/ }), '301');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add flat' }));
    expect(await within(dlg).findByText(/allows no more flats/)).toBeInTheDocument();
  });

  it('edits the selected flats in bulk, sending only the filled fields', async () => {
    const api = renderIt({ 'POST /units/bulk-update': ok({ updated: 2, unitIds: [9105, 9106] }) });
    await screen.findByRole('table', { name: 'Flats' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select A-201' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select A-202' }));
    expect(screen.getByRole('checkbox', { name: 'Select A-203' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Edit selected (2)' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Update 2 flats' }));
    expect(await within(dlg).findByText('Fill in at least one field to change.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Carpet area/ }), '900');
    await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: 'Billable' }), 'no');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Update 2 flats' }));
    await waitFor(() => expect(api.last('POST', '/units/bulk-update')).toBeTruthy());
    expect(api.last('POST', '/units/bulk-update')!.body).toEqual({
      unitIds: [9105, 9106],
      set: { carpetAreaSqft: '900', isBillable: false },
    });
  });

  it('starts an export for the chosen building', async () => {
    const api = renderIt({ 'POST /units/export': ok({ queued: true }) });
    await screen.findByRole('table', { name: 'Flats' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Building' }), '31');
    await userEvent.click(screen.getByRole('button', { name: 'Export units' }));
    await waitFor(() => expect(api.last('POST', '/units/export')).toBeTruthy());
    expect(api.last('POST', '/units/export')!.body).toEqual({ status: 'ACTIVE', buildingId: 31 });
    expect(await screen.findByText(/Export started/)).toBeInTheDocument();
  });

  it('shows RATE_LIMITED for an export', async () => {
    renderIt({ 'POST /units/export': err(429, 'RATE_LIMITED') });
    await userEvent.click(await screen.findByRole('button', { name: 'Export units' }));
    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
  });

  it('hides write and bulk actions with view permission only', async () => {
    renderIt({}, ['residents.units.view']);
    await screen.findByRole('table', { name: 'Flats' });
    for (const name of ['Add flat', 'Generate units', 'Import units', 'Export units'])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Select A-201' })).not.toBeInTheDocument();
  });

  it('hides the generator, import and export buttons when the plan lacks them', async () => {
    renderIt({}, undefined, ['property.unit_registry']);
    await screen.findByRole('table', { name: 'Flats' });
    for (const name of ['Generate units', 'Import units', 'Export units'])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add flat' })).toBeInTheDocument();
  });

  it('shows the plan lock without property.unit_registry', async () => {
    renderIt({}, undefined, []);
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
});
