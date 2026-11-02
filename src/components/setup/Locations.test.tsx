import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { FEATURES, tree } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { LocationsScreen } from './LocationsScreen';

vi.mock('next/navigation', () => navigationMock());

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms?: string[], features?: string[]) {
  signIn(perms, features);
  const api = mockApi({ 'GET /locations': ok({ items: tree() }), ...routes });
  render(
    <ToastProvider>
      <LocationsScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Locations (11.8)', () => {
  beforeEach(resetAll);

  it('shows a skeleton while loading', () => {
    renderIt();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('draws the tree: building, floor, area and the society gate', async () => {
    renderIt();
    const treeEl = await screen.findByRole('tree', { name: 'Locations' });
    expect(within(treeEl).getByText('Tower A')).toBeInTheDocument();
    expect(within(treeEl).getByText('Floor 3')).toBeInTheDocument();
    expect(within(treeEl).getByText('Lift lobby')).toBeInTheDocument();
    expect(within(treeEl).getByText('Main Gate')).toBeInTheDocument();
  });

  it('shows the empty and error states', async () => {
    renderIt({ 'GET /locations': ok({ items: [] }) });
    expect(await screen.findByText('No locations yet')).toBeInTheDocument();
  });

  it('shows the error with its reference', async () => {
    renderIt({ 'GET /locations': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });

  it('adds a floor to a building', async () => {
    const api = renderIt({ 'POST /locations': ok({ id: 9 }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Add floor to Tower A' }));
    const dlg = await screen.findByRole('dialog');
    const floor = within(dlg).getByRole('spinbutton', { name: 'Floor number' });
    await userEvent.clear(floor);
    await userEvent.type(floor, '4');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(api.last('POST', '/locations')).toBeTruthy());
    expect(api.last('POST', '/locations')!.body).toEqual({ parentId: 501, nodeType: 'FLOOR', floor: 4 });
  });

  it('adds an area under a floor and shows LOCATION_NAME_TAKEN', async () => {
    renderIt({ 'POST /locations': err(409, 'LOCATION_NAME_TAKEN') });
    await userEvent.click(await screen.findByRole('button', { name: 'Add area under Floor 3' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Name' }), 'Lift lobby');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('A location with this name already exists here.')).toBeInTheDocument();
  });

  it('adds a gate at society level only when the plan has the gates registry', async () => {
    renderIt(
      {},
      undefined,
      FEATURES.filter(f => f !== 'property.gates_registry'),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Add area or gate' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).queryByRole('option', { name: 'Gate' })).not.toBeInTheDocument();
  });

  it('renames an area', async () => {
    const api = renderIt({ 'PATCH /locations/641': ok({ id: 641 }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Rename Lift lobby' }));
    const dlg = await screen.findByRole('dialog');
    const name = within(dlg).getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'North lobby');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/locations/641')).toBeTruthy());
    expect(api.last('PATCH', '/locations/641')!.body).toMatchObject({ name: 'North lobby', version: 1 });
  });

  it('moves an area, excluding itself from the parent list', async () => {
    const api = renderIt({ 'PATCH /locations/641': ok({ id: 641 }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Move Lift lobby' }));
    const dlg = await screen.findByRole('dialog');
    const select = within(dlg).getByRole('combobox', { name: 'New parent' });
    expect(within(select).queryByRole('option', { name: /Lift lobby/ })).not.toBeInTheDocument();
    await userEvent.selectOptions(select, '501');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(api.last('PATCH', '/locations/641')).toBeTruthy());
    expect(api.last('PATCH', '/locations/641')!.body).toEqual({ parentId: 501, version: 1 });
  });

  it('archives a node and reports LOCATION_MANAGED for buildings by not offering it', async () => {
    const api = renderIt({ 'POST /locations/520/archive': ok({ id: 520 }) });
    await screen.findByRole('tree', { name: 'Locations' });
    expect(screen.queryByRole('button', { name: 'Archive Tower A' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archive Main Gate' }));
    await waitFor(() => expect(api.last('POST', '/locations/520/archive')).toBeTruthy());
    expect(api.last('POST', '/locations/520/archive')!.body).toEqual({ version: 1 });
  });

  it('shows archived nodes with Restore when asked', async () => {
    const archived = tree();
    archived[1].status = 'ARCHIVED';
    const api = renderIt({
      'GET /locations': ok({ items: archived }),
      'POST /locations/520/restore': ok({ id: 520 }),
    });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore Main Gate' }));
    await waitFor(() => expect(api.last('POST', '/locations/520/restore')).toBeTruthy());
  });

  it('prints a QR and regenerates it', async () => {
    const api = renderIt({
      'POST /locations/641/regenerate-qr': ok({ id: 641, qrToken: 'NEWTOKEN1234', version: 2 }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Print QR for Lift lobby' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Q7k2Lm9Pa0Zx')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Make a new code' }));
    expect(await within(dlg).findByText('NEWTOKEN1234')).toBeInTheDocument();
    expect(api.last('POST', '/locations/641/regenerate-qr')!.body).toEqual({ version: 1 });
  });

  it('hides the QR button when the plan has no unit_qr_codes', async () => {
    renderIt(
      {},
      undefined,
      FEATURES.filter(f => f !== 'property.unit_qr_codes'),
    );
    await screen.findByRole('tree', { name: 'Locations' });
    expect(screen.queryByRole('button', { name: /Print QR/ })).not.toBeInTheDocument();
  });

  it('is view only without the edit permission', async () => {
    renderIt({}, ['settings.society.view', 'residents.units.view']);
    await screen.findByRole('tree', { name: 'Locations' });
    expect(screen.queryByRole('button', { name: /^Add/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Archive/ })).not.toBeInTheDocument();
  });

  it('shows the plan lock without the registry', async () => {
    renderIt({}, undefined, []);
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
});
