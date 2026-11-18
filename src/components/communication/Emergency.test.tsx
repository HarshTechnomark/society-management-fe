import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { ToastProvider } from '@/components/ui/Toast';
import {
  EMERGENCY_ADMIN_PERMS,
  GATE_PERMS,
  RESIDENT_COMM_PERMS,
  activeRaw,
  broadcastRaw,
  rollCallRaw,
} from '@/test/communicationResidentFixtures';
import { EmergencyScreen } from './emergency/EmergencyScreen';
import { HoldToSend } from './emergency/HoldToSend';
import { EmergencyDrawer } from './emergency/EmergencyDrawer';
import { EmergencyTakeover } from './resident/EmergencyTakeover';
import { GateEmergencyBanner } from './gate/GateEmergencyBanner';
import { GateRollCallScreen } from './gate/GateRollCallScreen';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);
afterEach(() => vi.useRealTimers());

type Routes = Parameters<typeof mockApi>[0];
const roll = () =>
  ok(rollCallRaw().data, 'OK', { byFloor: rollCallRaw().byFloor, pagination: rollCallRaw().pagination });
function show(ui: React.ReactElement, routes: Routes, perms: string[]) {
  signInAs(perms, []);
  const api = mockApi(routes);
  render(<ToastProvider>{ui}</ToastProvider>);
  return api;
}

describe('HoldToSend', () => {
  it('confirms only after the full hold and cancels on early release', () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(<HoldToSend label="Send to everyone" onConfirm={onConfirm} />);
    const b = screen.getByRole('button', { name: /Send to everyone/ });
    fireEvent.pointerDown(b);
    act(() => void vi.advanceTimersByTime(1000));
    fireEvent.pointerUp(b);
    act(() => void vi.advanceTimersByTime(1000));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.pointerDown(b);
    act(() => void vi.advanceTimersByTime(1500));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it('does nothing when disabled', () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(<HoldToSend label="Go" onConfirm={onConfirm} disabled />);
    fireEvent.pointerDown(screen.getByRole('button'));
    act(() => void vi.advanceTimersByTime(2000));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('Admin emergencies', () => {
  const base: Routes = {
    'GET /emergency-broadcasts': ok([
      broadcastRaw({ status: 'RESOLVED', title: 'Gas leak drill', isDrill: true }),
    ]),
  };
  it('lists alerts and hides the start button without the create permission', async () => {
    show(<EmergencyScreen />, base, ['security.incidents.view']);
    expect(await screen.findByText(/DRILL: Gas leak drill/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emergency broadcast' })).toBeNull();
  });

  it('starts a broadcast from the modal by holding the send button', async () => {
    const api = show(
      <EmergencyScreen />,
      {
        ...base,
        'POST /emergency-broadcasts': ok(broadcastRaw()),
        'GET /emergency-broadcasts/31': ok(broadcastRaw()),
        'GET /emergency-broadcasts/31/roll-call': roll(),
      },
      EMERGENCY_ADMIN_PERMS,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Emergency broadcast' }));
    const dialog = await screen.findByRole('dialog', { name: 'Emergency broadcast' });
    const hold = within(dialog).getByRole('button', { name: /Send to everyone/ });
    expect(hold).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Message/), 'Smoke on 4th floor, use the stairs');
    expect(hold).toBeEnabled();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.pointerDown(hold);
    await act(async () => void vi.advanceTimersByTime(1500));
    vi.useRealTimers();
    await waitFor(() =>
      expect(api.last('POST', '/emergency-broadcasts')?.body).toMatchObject({
        type: 'FIRE',
        message: 'Smoke on 4th floor, use the stairs',
        audience: { type: 'ALL' },
        includeStaff: true,
        collectResponses: true,
        isDrill: false,
        confirm: true,
      }),
    );
    expect(await screen.findByRole('dialog', { name: 'Fire' })).toBeInTheDocument();
  });

  it('shows an already-active error inside the modal', async () => {
    show(
      <EmergencyScreen />,
      { ...base, 'POST /emergency-broadcasts': err(409, 'EMERGENCY_ALREADY_ACTIVE') },
      EMERGENCY_ADMIN_PERMS,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Emergency broadcast' }));
    const dialog = await screen.findByRole('dialog', { name: 'Emergency broadcast' });
    await userEvent.type(within(dialog).getByLabelText(/Message/), 'Smoke on 4th floor');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.pointerDown(within(dialog).getByRole('button', { name: /Send to everyone/ }));
    await act(async () => void vi.advanceTimersByTime(1500));
    vi.useRealTimers();
    expect(await within(dialog).findByText(/already active/)).toBeInTheDocument();
  });
});

describe('Emergency drawer', () => {
  const routes = (over: Routes = {}): Routes => ({
    'GET /emergency-broadcasts/31': ok(broadcastRaw()),
    'GET /emergency-broadcasts/31/roll-call': roll(),
    ...over,
  });
  const open = (r: Routes, perms = EMERGENCY_ADMIN_PERMS) =>
    show(
      <EmergencyDrawer
        id={31}
        canManage={perms.includes('communication.emergency.create')}
        onClose={() => {}}
        onChanged={() => {}}
      />,
      r,
      perms,
    );

  it('shows the counts, need-help list, by-floor grid and flats', async () => {
    open(routes());
    expect(await screen.findByText('Not heard from', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Grandmother cannot use the stairs', { exact: false })).toBeInTheDocument();
    expect(await screen.findByText(/Floor 4: 3\/8/)).toBeInTheDocument();
    expect(screen.getByText('A-403')).toBeInTheDocument();
  });

  it('marks help on the way', async () => {
    const api = open(routes({ 'POST /emergency-broadcasts/31/responses/900/attend': ok({}) }));
    await userEvent.click(await screen.findByRole('button', { name: 'Help on the way' }));
    await waitFor(() =>
      expect(api.last('POST', '/emergency-broadcasts/31/responses/900/attend')).toBeTruthy(),
    );
  });

  it('sends an update, the all clear and a false alarm with the version', async () => {
    const api = open(
      routes({
        'POST /emergency-broadcasts/31/updates': ok(broadcastRaw({ version: 3 })),
        'POST /emergency-broadcasts/31/resolve': ok(broadcastRaw({ status: 'RESOLVED', version: 4 })),
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Send update' }));
    let dlg = await screen.findByRole('dialog', { name: 'Send update' });
    const send = within(dlg).getByRole('button', { name: 'Send update' });
    expect(send).toBeDisabled();
    await userEvent.type(within(dlg).getByLabelText(/Update message/), 'Fire brigade is on site.');
    await userEvent.click(send);
    await waitFor(() =>
      expect(api.last('POST', '/emergency-broadcasts/31/updates')?.body).toEqual({
        version: 2,
        message: 'Fire brigade is on site.',
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'All clear' }));
    dlg = await screen.findByRole('dialog', { name: 'All clear' });
    await userEvent.type(within(dlg).getByLabelText(/All clear message/), 'Everything is fine now.');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send all clear' }));
    await waitFor(() =>
      expect(api.last('POST', '/emergency-broadcasts/31/resolve')?.body).toEqual({
        version: 3,
        allClearMessage: 'Everything is fine now.',
      }),
    );
  });

  it('offers a false alarm only inside the first 15 minutes and re-alert shows the 3 minute rule', async () => {
    open(
      routes({
        'GET /emergency-broadcasts/31': ok(
          broadcastRaw({ startedAt: new Date(Date.now() - 20 * 60_000).toISOString() }),
        ),
        'POST /emergency-broadcasts/31/realert': err(422, 'EMERGENCY_REALERT_TOO_SOON'),
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Re-alert non-responders' }));
    expect(await screen.findByText(/once every 3 minutes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'False alarm' })).toBeNull();
  });

  it('is read only for security viewers', async () => {
    open(routes(), ['security.incidents.view']);
    await screen.findByText('Need help', { selector: 'h3' });
    expect(screen.queryByRole('button', { name: 'Send update' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Help on the way' })).toBeNull();
  });
});

describe('Resident takeover', () => {
  it('shows the full screen alert, records "I am safe" with the people count, then can be closed', async () => {
    const api = show(
      <EmergencyTakeover />,
      {
        'GET /me/emergency-broadcasts/active': ok([activeRaw()]),
        'POST /emergency-broadcasts/31/responses': ok({
          responseId: 1,
          status: 'SAFE',
          peopleCount: 3,
          respondedAt: 'x',
        }),
      },
      RESIDENT_COMM_PERMS,
    );
    const dlg = await screen.findByRole('alertdialog', { name: 'Emergency alert' });
    expect(within(dlg).getByText(/Smoke on the 4th floor/)).toBeInTheDocument();
    expect(within(dlg).getByText('Need help? Press SOS.')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'More people' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'More people' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'I’m safe' }));
    await waitFor(() =>
      expect(api.last('POST', '/emergency-broadcasts/31/responses')?.body).toEqual({
        status: 'SAFE',
        peopleCount: 3,
      }),
    );
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('sends a help request with a note and the chosen flat when there are several', async () => {
    const api = show(
      <EmergencyTakeover />,
      {
        'GET /me/emergency-broadcasts/active': ok([
          activeRaw({
            myUnits: [
              { unitId: 12, label: 'C-0801', response: null },
              { unitId: 13, label: 'D-0101', response: null },
            ],
          }),
        ]),
        'POST /emergency-broadcasts/31/responses': ok({
          responseId: 2,
          status: 'NEED_HELP',
          peopleCount: 1,
          respondedAt: 'x',
        }),
      },
      RESIDENT_COMM_PERMS,
    );
    const dlg = await screen.findByRole('alertdialog');
    await userEvent.selectOptions(within(dlg).getByLabelText('Reply for flat'), '13');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Need help' }));
    await userEvent.type(within(dlg).getByLabelText(/What help do you need/), 'Smoke in the corridor');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Send help request' }));
    await waitFor(() =>
      expect(api.last('POST', '/emergency-broadcasts/31/responses')?.body).toEqual({
        status: 'NEED_HELP',
        note: 'Smoke in the corridor',
        unitId: 13,
      }),
    );
  });

  it('labels drills and renders nothing when no alert is active', async () => {
    show(
      <EmergencyTakeover />,
      { 'GET /me/emergency-broadcasts/active': ok([activeRaw({ isDrill: true })]) },
      RESIDENT_COMM_PERMS,
    );
    expect(await screen.findByText(/DRILL · Fire/)).toBeInTheDocument();
  });
});

describe('Gate console', () => {
  it('shows the red banner only with the SOS permission', async () => {
    show(<GateEmergencyBanner />, { 'GET /gate/emergency-broadcasts/active': ok([activeRaw()]) }, GATE_PERMS);
    expect(await screen.findByRole('alert')).toHaveTextContent('Emergency: Fire');
    expect(screen.getByRole('link', { name: 'Open roll call' })).toHaveAttribute('href', '/gate/emergency');
  });
  it('hides the banner without the permission', async () => {
    const api = show(
      <GateEmergencyBanner />,
      { 'GET /gate/emergency-broadcasts/active': ok([activeRaw()]) },
      [],
    );
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.calls).toHaveLength(0);
  });
  it('records Safe and Need help (with a note) for a flat through the gate path', async () => {
    const api = show(
      <GateRollCallScreen />,
      {
        'GET /gate/emergency-broadcasts/active': ok([activeRaw()]),
        'GET /gate/emergency-broadcasts/31/roll-call': roll(),
        'POST /gate/emergency-broadcasts/31/responses': ok({
          responseId: 3,
          status: 'SAFE',
          peopleCount: 1,
          respondedAt: 'x',
        }),
      },
      GATE_PERMS,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Safe A-403' }));
    await waitFor(() =>
      expect(api.last('POST', '/gate/emergency-broadcasts/31/responses')?.body).toEqual({
        status: 'SAFE',
        unitId: 2,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Need help A-403' }));
    const rec = screen.getByRole('button', { name: 'Record help request' });
    expect(rec).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/What is needed/), 'Elderly person');
    await userEvent.click(rec);
    await waitFor(() =>
      expect(api.last('POST', '/gate/emergency-broadcasts/31/responses')?.body).toEqual({
        status: 'NEED_HELP',
        unitId: 2,
        note: 'Elderly person',
      }),
    );
    expect(screen.getByText('98XXXXX111', { exact: false })).toBeInTheDocument();
  });
});
