import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { building, society, unit } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { page } from '@/test/societyFixtures';
import { BuildingsScreen } from './BuildingsScreen';

vi.mock('next/navigation', () => navigationMock());

const wing = building({
  id: 32,
  code: 'AW',
  name: 'A Wing',
  kind: 'WING',
  parentBuildingId: 31,
  unitCounts: { active: 0, archived: 0, countable: 0 },
});

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms?: string[], features?: string[]) {
  signIn(perms, features);
  const api = mockApi({
    'GET /buildings': ok(
      [
        building(),
        building({
          id: 40,
          code: 'B',
          name: 'Tower B',
          unitCounts: { active: 0, archived: 0, countable: 0 },
          floorLabels: { min: 'G', max: '6' },
        }),
      ],
      'OK',
      page(2),
    ),
    ...routes,
  });
  render(
    <ToastProvider>
      <BuildingsScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Buildings (11.6)', () => {
  beforeEach(resetAll);

  it('shows skeleton rows while loading', () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('lists buildings with floors, active flats and status', async () => {
    renderIt();
    const table = await screen.findByRole('table', { name: 'Buildings' });
    expect(within(table).getByText('Tower A')).toBeInTheDocument();
    expect(within(table).getByText('B1 … 20')).toBeInTheDocument();
    expect(within(table).getByText('76')).toBeInTheDocument();
    expect(within(table).getAllByText('Active')).toHaveLength(2);
  });

  it('flattens wings that are only nested in their tower', async () => {
    renderIt({ 'GET /buildings': ok([building({ wings: [wing] })], 'OK', page(1)) });
    const table = await screen.findByRole('table', { name: 'Buildings' });
    expect(within(table).getByText('A Wing')).toBeInTheDocument();
  });

  it('shows the empty state with an Add building action', async () => {
    renderIt({ 'GET /buildings': ok([], 'OK', page(0)) });
    expect(await screen.findByText('No buildings yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add building' }).length).toBe(2);
  });

  it('shows the error state with the reference', async () => {
    renderIt({ 'GET /buildings': err(500, 'INTERNAL_ERROR') });
    expect((await screen.findAllByText('req_test')).length).toBeGreaterThan(0);
  });

  it('adds a building (code upper-cased, defaults sent)', async () => {
    const api = renderIt({ 'POST /buildings': ok(building({ id: 50 })) });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add building' }))[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Code/ }), 'c');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Name/ }), 'Tower C');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add building' }));
    await waitFor(() => expect(api.last('POST', '/buildings')).toBeTruthy());
    expect(api.last('POST', '/buildings')!.body).toEqual({
      code: 'C',
      name: 'Tower C',
      kind: 'TOWER',
      parentBuildingId: null,
      floorsAboveGround: 10,
      basements: 0,
      liftCount: 0,
      sortOrder: 0,
    });
  });

  it('validates the code and name before sending', async () => {
    const api = renderIt();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add building' }))[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add building' }));
    expect(await within(dlg).findByText('Use 1 to 6 letters or digits.')).toBeInTheDocument();
    expect(api.last('POST', '/buildings')).toBeUndefined();
  });

  it('asks for the parent tower when the kind is Wing', async () => {
    const api = renderIt({ 'POST /buildings': ok(wing) });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add building' }))[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Code/ }), 'AW');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Name/ }), 'A Wing');
    await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: 'Kind' }), 'WING');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add building' }));
    expect(await within(dlg).findByText('Choose the tower this wing belongs to.')).toBeInTheDocument();
    await userEvent.selectOptions(within(dlg).getByRole('combobox', { name: 'Parent tower' }), '31');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add building' }));
    await waitFor(() => expect(api.last('POST', '/buildings')).toBeTruthy());
    expect(api.last('POST', '/buildings')!.body).toMatchObject({ kind: 'WING', parentBuildingId: 31 });
  });

  it('shows BUILDING_CODE_TAKEN', async () => {
    renderIt({ 'POST /buildings': err(409, 'BUILDING_CODE_TAKEN') });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add building' }))[0]);
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Code/ }), 'A');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /^Name/ }), 'Again');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add building' }));
    expect(await within(dlg).findByText(/code is already used/)).toBeInTheDocument();
  });

  it('locks the code once flats exist and saves edits with the version', async () => {
    const api = renderIt({ 'PATCH /buildings/31': ok(building({ version: 4 })) });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Tower A' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('textbox', { name: /^Code/ })).toBeDisabled();
    expect(within(dlg).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    const lifts = within(dlg).getByRole('spinbutton', { name: 'Lifts' });
    await userEvent.clear(lifts);
    await userEvent.type(lifts, '3');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/buildings/31')).toBeTruthy());
    expect(api.last('PATCH', '/buildings/31')!.body).toMatchObject({ liftCount: 3, version: 3, code: 'A' });
  });

  it('archives with a reason and reports active flats', async () => {
    renderIt({ 'POST /buildings/31/archive': err(409, 'BUILDING_HAS_ACTIVE_UNITS') });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Tower A' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Archive' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Demolished');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText(/Archive or move the active flats/)).toBeInTheDocument();
  });

  it('archives successfully with reason and version', async () => {
    const api = renderIt({
      'GET /buildings': ok(
        [
          building({
            id: 40,
            code: 'B',
            name: 'Tower B',
            unitCounts: { active: 0, archived: 0, countable: 0 },
          }),
        ],
        'OK',
        page(1),
      ),
      'POST /buildings/40/archive': ok(building({ id: 40, status: 'ARCHIVED' })),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Tower B' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(confirm).getByRole('textbox', { name: /Reason/ }), 'Not built');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(api.last('POST', '/buildings/40/archive')).toBeTruthy());
    expect(api.last('POST', '/buildings/40/archive')!.body).toEqual({ reason: 'Not built', version: 3 });
  });

  it('restores an archived building and keeps it read only', async () => {
    const api = renderIt({
      'GET /buildings': ok([building({ status: 'ARCHIVED' })], 'OK', page(1)),
      'POST /buildings/31/restore': ok(building()),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Tower A' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/This building is archived/)).toBeInTheDocument();
    expect(within(dlg).getByRole('textbox', { name: /^Name/ })).toBeDisabled();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Restore' }));
    await userEvent.click(
      within((await screen.findAllByRole('dialog')).at(-1)!).getByRole('button', { name: 'Restore' }),
    );
    await waitFor(() => expect(api.last('POST', '/buildings/31/restore')).toBeTruthy());
    expect(api.last('POST', '/buildings/31/restore')!.body).toEqual({ version: 3 });
  });

  it('deletes an empty building', async () => {
    const api = renderIt({ 'DELETE /buildings/40': { status: 204 } });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Tower B' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await userEvent.click(
      within((await screen.findAllByRole('dialog')).at(-1)!).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(api.last('DELETE', '/buildings/40')).toBeTruthy());
  });

  it('opens the grid with Area missing flagged by text and icon, and opens a flat', async () => {
    renderIt({
      'GET /buildings/31/grid': ok({
        building: { id: 31, code: 'A', name: 'Tower A' },
        floors: [
          {
            floor: 2,
            floorLabel: '2',
            units: [
              {
                id: 9105,
                label: 'A-201',
                unitNumber: '201',
                positionOnFloor: 1,
                unitType: 'FLAT',
                bhk: '3BHK',
                areaSqft: '1150.000',
                isBillable: true,
                status: 'ACTIVE',
              },
              {
                id: 9106,
                label: 'A-202',
                unitNumber: '202',
                positionOnFloor: 2,
                unitType: 'FLAT',
                bhk: '2BHK',
                areaSqft: null,
                isBillable: true,
                status: 'ACTIVE',
              },
            ],
          },
        ],
        totals: { units: 2, missingArea: 1 },
      }),
      'GET /units/9106': ok(unit({ id: 9106, label: 'A-202', areaSqft: null })),
      'GET /society': ok(society()),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Tower A' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'View flats grid' }),
    );
    const grid = await screen.findByTestId('grid-scroll');
    expect(await within(grid).findByText('Area missing')).toBeInTheDocument();
    expect(within(grid).getByText('1,150 sq ft')).toBeInTheDocument();
    await userEvent.click(within(grid).getByRole('button', { name: /A-202/ }));
    expect(await screen.findByRole('heading', { name: 'A-202' })).toBeInTheDocument();
  });

  it('hides editing buttons without settings.society.edit', async () => {
    renderIt({}, ['residents.units.view']);
    await screen.findByRole('table', { name: 'Buildings' });
    expect(screen.queryByRole('button', { name: 'Add building' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate units' })).not.toBeInTheDocument();
  });

  it('shows the plan lock without property.property_hierarchy', async () => {
    renderIt({}, undefined, []);
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });

  it('shows no access without residents.units.view', async () => {
    renderIt({}, ['settings.society.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});
