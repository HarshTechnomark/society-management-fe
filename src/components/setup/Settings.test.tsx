import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { setting } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { SettingsScreen } from './SettingsScreen';

vi.mock('next/navigation', () => navigationMock());

const ITEMS = [
  setting('billing.dueDays'),
  setting('billing.invoicePrefix', {
    type: 'STRING',
    value: 'INV',
    default: 'INV',
    isDefault: true,
    version: 0,
    rules: {},
    appliesFrom: '2027-28',
    description: 'Invoice number prefix',
  }),
  setting('billing.applyGst', { type: 'BOOL', value: false, rules: {}, description: 'Add GST' }),
  setting('billing.areaBasis', {
    type: 'ENUM',
    value: 'CARPET',
    rules: { oneOf: ['CARPET', 'BUILT_UP', 'SUPER_BUILT_UP'] },
    requiresReason: true,
  }),
  setting('security.adminIdleMinutes', {
    namespace: 'security',
    value: 30,
    rules: { oneOf: [5, 15, 30, 60] },
    requiresStepUp: true,
    requiresReason: true,
    version: 0,
  }),
  setting('office.openTime', { namespace: 'office', type: 'TIME', value: '09:00', rules: {} }),
  setting('profile.pan', { namespace: 'profile', type: 'STRING', value: null, editVia: 'PROFILE' }),
  setting('visitors.patrolPlans', { namespace: 'visitors', type: 'JSON', value: [], editVia: 'MODULE17' }),
  setting('finance.maxUnlockHours', { namespace: 'finance', value: 72, canEdit: false }),
];

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms?: string[], features?: string[]) {
  signIn(perms, features);
  const api = mockApi({ 'GET /society/settings': ok({ items: ITEMS }), ...routes });
  render(
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Settings (typed editor)', () => {
  beforeEach(resetAll);

  it('shows a skeleton while loading', () => {
    renderIt();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows the error state', async () => {
    renderIt({ 'GET /society/settings': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });

  it('groups editable keys by namespace and hides profile and module 17 keys', async () => {
    renderIt();
    const tabs = await screen.findByRole('tablist', { name: 'Settings groups' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map(t => t.textContent),
    ).toEqual(['Billing', 'Finance', 'Security', 'Office']);
    expect(screen.queryByText('Pan')).not.toBeInTheDocument();
  });

  it('renders each type: number, text, switch, select and the FY hint', async () => {
    renderIt();
    expect(await screen.findByRole('spinbutton', { name: 'Due days' })).toHaveValue(9);
    expect(screen.getByRole('textbox', { name: 'Invoice prefix' })).toHaveValue('INV');
    expect(screen.getByText(/Applies from FY 2027-28/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Apply gst' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('combobox', { name: 'Area basis' })).toHaveValue('CARPET');
  });

  it('saves only changed keys with their versions', async () => {
    const api = renderIt({
      'PATCH /society/settings': ok({ items: [setting('billing.dueDays', { value: 12, version: 3 })] }),
    });
    const days = await screen.findByRole('spinbutton', { name: 'Due days' });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await userEvent.clear(days);
    await userEvent.type(days, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/society/settings')).toBeTruthy());
    expect(api.last('PATCH', '/society/settings')!.body).toEqual({
      changes: [{ key: 'billing.dueDays', value: 12, version: 2 }],
    });
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
    expect(screen.getByText('No changes yet')).toBeInTheDocument();
  });

  it('asks for a reason for keys that need one', async () => {
    const api = renderIt({ 'PATCH /society/settings': ok({ items: [] }) });
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Area basis' }), 'BUILT_UP');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const dlg = await screen.findByRole('dialog');
    expect(api.last('PATCH', '/society/settings')).toBeUndefined();
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Reason/ }), 'Committee decision');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/society/settings')).toBeTruthy());
    expect(api.last('PATCH', '/society/settings')!.body).toEqual({
      changes: [{ key: 'billing.areaBasis', value: 'BUILT_UP', version: 2 }],
      reason: 'Committee decision',
    });
  });

  it('sends numbers for INT keys with a fixed list (security tab)', async () => {
    const api = renderIt({ 'PATCH /society/settings': ok({ items: [] }) });
    await userEvent.click(await screen.findByRole('tab', { name: 'Security' }));
    expect(screen.getByText('Fresh code needed')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Admin idle minutes' }), '15');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Reason/ }), 'Safer sessions');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/society/settings')).toBeTruthy());
    expect((api.last('PATCH', '/society/settings')!.body as { changes: unknown[] }).changes).toEqual([
      { key: 'security.adminIdleMinutes', value: 15, version: 0 },
    ]);
  });

  it('shows the cross-key error from the API', async () => {
    renderIt({ 'PATCH /society/settings': err(422, 'PREFIX_CLASH') });
    const prefix = await screen.findByRole('textbox', { name: 'Invoice prefix' });
    await userEvent.clear(prefix);
    await userEvent.type(prefix, 'RCT');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Invoice and receipt prefixes must be different.')).toBeInTheDocument();
  });

  it('offers a reload after STALE_VERSION', async () => {
    renderIt({ 'PATCH /society/settings': err(409, 'STALE_VERSION') });
    const days = await screen.findByRole('spinbutton', { name: 'Due days' });
    await userEvent.clear(days);
    await userEvent.type(days, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('button', { name: 'Reload settings' })).toBeInTheDocument();
  });

  it('disables keys the caller cannot edit', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('tab', { name: 'Finance' }));
    expect(screen.getByRole('spinbutton', { name: 'Max unlock hours' })).toBeDisabled();
    expect(screen.getByText('View only')).toBeInTheDocument();
  });

  it('shows the plan lock without property.society_settings', async () => {
    renderIt({}, undefined, []);
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
});
