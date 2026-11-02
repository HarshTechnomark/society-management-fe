import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { building } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { page } from '@/test/societyFixtures';
import { GeneratorDialog } from './GeneratorDialog';

vi.mock('next/navigation', () => navigationMock());

const HASH = 'a'.repeat(64);
const preview = (over: Record<string, unknown> = {}, summary: Record<string, unknown> = {}) => ({
  previewHash: HASH,
  summary: {
    buildings: 1,
    newBuildings: 1,
    units: 76,
    countableUnits: 76,
    conflicts: 0,
    limit: 1000,
    used: 0,
    limitRemaining: 1000,
    ...summary,
  },
  conflicts: [],
  sample: [
    { building: 'A', floor: 1, position: 1, unitNumber: '101', label: 'A-101', unitType: 'FLAT' },
    { building: 'A', floor: 20, position: 4, unitNumber: '2004', label: 'A-2004', unitType: 'FLAT' },
  ],
  sampleCount: 76,
  ...over,
});

const onClose = vi.fn();
const onDone = vi.fn();

function renderIt(routes: Parameters<typeof mockApi>[0] = {}) {
  signIn();
  const api = mockApi({ 'GET /buildings': ok([building()], 'OK', page(1)), ...routes });
  render(
    <ToastProvider>
      <GeneratorDialog open onClose={onClose} onDone={onDone} />
    </ToastProvider>,
  );
  return api;
}

async function fill() {
  const dlg = await screen.findByRole('dialog');
  await userEvent.type(within(dlg).getByRole('textbox', { name: /^Code 1/ }), 'a');
  const to = within(dlg).getByRole('spinbutton', { name: 'Floors to' });
  await userEvent.clear(to);
  await userEvent.type(to, '20');
  await userEvent.type(within(dlg).getByRole('textbox', { name: 'Skip floors' }), '13');
  return dlg;
}

describe('Unit generator dialog (11.6)', () => {
  beforeEach(() => {
    resetAll();
    onClose.mockReset();
    onDone.mockReset();
  });

  it('keeps Create units disabled until a preview exists', async () => {
    renderIt();
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('button', { name: 'Create units' })).toBeDisabled();
  });

  it('checks the inputs before previewing', async () => {
    const api = renderIt();
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Preview' }));
    expect(await within(dlg).findByText('Code: 1 to 6 letters or digits.')).toBeInTheDocument();
    expect(api.last('POST', '/units/generator/preview')).toBeUndefined();
  });

  it('previews counts, limit and the first labels, then creates with the preview hash', async () => {
    const api = renderIt({
      'POST /units/generator/preview': ok(preview()),
      'POST /units/generator/commit': ok({
        created: 76,
        buildingsCreated: [31],
        unitIds: [],
        used: 76,
        limit: 1000,
      }),
    });
    const dlg = await fill();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Preview' }));
    const prev = await within(dlg).findByRole('region', { name: 'Preview' });
    expect(within(prev).getByText('76 flats')).toBeInTheDocument();
    expect(within(prev).getByText('0 conflicts')).toBeInTheDocument();
    expect(within(prev).getByText('Limit remaining: 1000')).toBeInTheDocument();
    expect(within(prev).getByText('First 2 of 76 labels')).toBeInTheDocument();
    expect(within(prev).getByText('A-101, A-2004')).toBeInTheDocument();
    expect(api.last('POST', '/units/generator/preview')!.body).toMatchObject({
      buildings: [{ newBuilding: { code: 'A', name: 'Tower A', kind: 'TOWER' } }],
      floorFrom: 1,
      floorTo: 20,
      pattern: '{floor}0{pos}',
      skipFloors: [13],
    });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create units' }));
    await waitFor(() => expect(api.last('POST', '/units/generator/commit')).toBeTruthy());
    expect(api.last('POST', '/units/generator/commit')!.body).toMatchObject({
      previewHash: HASH,
      pattern: '{floor}0{pos}',
    });
    expect(onDone).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('lists conflicts and blocks Create units', async () => {
    renderIt({ 'POST /units/generator/preview': ok(preview({ conflicts: ['A-702'] }, { conflicts: 1 })) });
    const dlg = await fill();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Preview' }));
    expect(await within(dlg).findByText(/These numbers already exist: A-702/)).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Create units' })).toBeDisabled();
  });

  it('warns when the run is more than the plan allows', async () => {
    renderIt({
      'POST /units/generator/preview': ok(preview({}, { countableUnits: 20, units: 20, limitRemaining: 10 })),
    });
    const dlg = await fill();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Preview' }));
    expect(await within(dlg).findByText(/adds 20 flats but your plan has room for 10/)).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Create units' })).toBeDisabled();
  });

  it('drops the preview when an input changes', async () => {
    renderIt({ 'POST /units/generator/preview': ok(preview()) });
    const dlg = await fill();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Preview' }));
    await within(dlg).findByRole('region', { name: 'Preview' });
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Skip floors' }), ',14');
    expect(within(dlg).queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Create units' })).toBeDisabled();
  });

  it('inserts a token into the pattern', async () => {
    renderIt();
    const dlg = await screen.findByRole('dialog');
    const pattern = within(dlg).getByRole('textbox', { name: /Numbering pattern/ });
    await userEvent.clear(pattern);
    await userEvent.click(within(dlg).getByRole('button', { name: '{floor:2}' }));
    await userEvent.click(within(dlg).getByRole('button', { name: '{pos:2}' }));
    expect(pattern).toHaveValue('{floor:2}{pos:2}');
  });

  it.each([
    ['PATTERN_INVALID', 400, /pattern is not valid/],
    ['PATTERN_NOT_UNIQUE', 422, /needs a floor and a position/],
    ['GENERATOR_TOO_LARGE', 422, /limit is 2,000/],
  ])('shows %s from the preview', async (code, status, text) => {
    renderIt({ 'POST /units/generator/preview': err(status, code) });
    const dlg = await fill();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Preview' }));
    expect(await within(dlg).findByText(text)).toBeInTheDocument();
  });

  it.each([
    ['PREVIEW_STALE', 409, /Preview again before creating/],
    ['UNIT_NUMBER_CONFLICT', 409, /already exist/],
    ['USAGE_LIMIT_EXCEEDED', 402, /allows no more flats/],
  ])('shows %s from the commit', async (code, status, text) => {
    renderIt({
      'POST /units/generator/preview': ok(preview()),
      'POST /units/generator/commit': err(status, code),
    });
    const dlg = await fill();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Preview' }));
    await within(dlg).findByRole('region', { name: 'Preview' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create units' }));
    expect(await within(dlg).findByText(text)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('can target an existing building', async () => {
    const api = renderIt({ 'POST /units/generator/preview': ok(preview()) });
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      within(dlg).getByRole('combobox', { name: 'Building 1 source' }),
      'existing',
    );
    await userEvent.selectOptions(await within(dlg).findByRole('combobox', { name: 'Building 1' }), '31');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(api.last('POST', '/units/generator/preview')).toBeTruthy());
    expect(
      (api.last('POST', '/units/generator/preview')!.body as { buildings: unknown[] }).buildings,
    ).toEqual([{ buildingId: 31 }]);
  });
});
