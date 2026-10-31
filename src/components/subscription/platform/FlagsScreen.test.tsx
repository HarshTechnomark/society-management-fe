import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { flag } from '@/test/subscriptionFixtures';
import { FlagsScreen } from './FlagsScreen';

const ALL = ['platform.feature_flags.view', 'platform.feature_flags.create', 'platform.feature_flags.edit'];
const page = { pagination: { page: 1, limit: 100, total: 3, totalPages: 1 } };
const flags = [
  flag(),
  flag({
    id: 2,
    flagKey: 'payments.gateway_kill',
    description: 'Stops online payments',
    type: 'KILL_SWITCH',
    isEnabled: false,
    rolloutPercent: 0,
    overrideCount: 0,
    version: 1,
  }),
  flag({
    id: 3,
    flagKey: 'amenities.new_calendar',
    description: 'New booking calendar',
    type: 'PLAN',
    minPlanCode: 'STANDARD',
    rolloutPercent: 0,
    overrideCount: 0,
    ownerTeam: null,
  }),
];
const subs = ok(
  [
    { id: 1, society: { id: 4, name: 'Sky Heights' }, planCode: 'STANDARD', planVersionNo: 2 },
    { id: 2, society: { id: 5, name: 'Lake View' }, planCode: 'STARTER', planVersionNo: 1 },
  ],
  'OK',
  page,
);
const routes = (extra: object = {}) => ({
  'GET /platform/feature-flags': ok(flags, 'OK', page),
  ...extra,
});
const mount = (perms = ALL) => {
  setMe(sampleMe({ platformPermissions: perms, platformRole: 'super_admin', permissions: [] }));
  return render(
    <ToastProvider>
      <FlagsScreen />
    </ToastProvider>,
  );
};
const row = (key: string) => screen.getByText(key).closest('tr')!;

beforeEach(resetAll);

describe('FlagsScreen (spec 11.2)', () => {
  it('lists flags with type chips, default switch, rollout and overrides, filtered by type segments', async () => {
    const user = userEvent.setup();
    mockApi(routes());
    mount();
    await screen.findByText('billing.new_invoice_layout');
    expect(within(row('amenities.new_calendar')).getByText('Plan · Standard+')).toBeInTheDocument();
    expect(within(row('billing.new_invoice_layout')).getByText('35%')).toBeInTheDocument();
    expect(within(row('billing.new_invoice_layout')).getByText(/Owner Billing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kill switch\s*1/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Kill switch\s*1/ }));
    expect(screen.queryByText('billing.new_invoice_layout')).toBeNull();
    expect(screen.getByText('payments.gateway_kill')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tenant\s*0/ }));
    expect(screen.getByText('No flags match')).toBeInTheDocument();
  });

  it('turns on a kill switch with a reason in danger style', async () => {
    const user = userEvent.setup();
    const api = mockApi(routes({ 'POST /platform/feature-flags/2/toggle': ok(flags[1]) }));
    mount();
    await user.click(await screen.findByRole('switch', { name: 'Toggle payments.gateway_kill' }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn on payments.gateway_kill?' });
    expect(within(dialog).getByText(/changes behaviour for every society/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Turn on' });
    expect(confirm.className).toContain('bg-bad');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Gateway outage');
    await user.click(confirm);
    await waitFor(() =>
      expect(api.last('POST', '/platform/feature-flags/2/toggle')?.body).toEqual({
        isEnabled: true,
        reason: 'Gateway outage',
        version: 1,
      }),
    );
  });

  it('edits rollout with the slider, shows the diff and saves with a reason', async () => {
    const user = userEvent.setup();
    const api = mockApi(routes({ 'PATCH /platform/feature-flags/1': ok(flags[0]) }));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Edit billing.new_invoice_layout' }));
    const drawer = await screen.findByRole('dialog', { name: 'billing.new_invoice_layout' });
    expect(within(drawer).getByText(/stable bucket from 0 to 99/)).toBeInTheDocument();
    expect(within(drawer).getByText(/Evaluation order: society override/)).toBeInTheDocument();
    const slider = within(drawer).getByLabelText(/Rollout percentage/);
    expect(slider).toHaveAttribute('step', '5');
    fireEvent.change(slider, { target: { value: '45' } });
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    const review = await screen.findByRole('dialog', { name: 'Save changes to billing.new_invoice_layout' });
    expect(within(review).getByText('45%')).toBeInTheDocument();
    await user.type(within(review).getByLabelText(/Reason/), 'Widen rollout');
    await user.click(within(review).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/platform/feature-flags/1')?.body).toEqual({
        rolloutPercent: 45,
        reason: 'Widen rollout',
        version: 3,
      }),
    );
  });

  it('creates a flag and validates the key format (T04-36)', async () => {
    const user = userEvent.setup();
    const api = mockApi(routes({ 'POST /platform/feature-flags': ok(flags[0]) }));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Create flag' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create feature flag' });
    await user.type(within(dialog).getByLabelText(/Key/), 'Billing.New');
    await user.type(within(dialog).getByLabelText(/Description/), 'New thing');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Rollout plan');
    await user.click(within(dialog).getByRole('button', { name: 'Create flag' }));
    expect(within(dialog).getByText('Use the form module.feature_name in lowercase.')).toBeInTheDocument();
    expect(api.last('POST', '/platform/feature-flags')).toBeUndefined();

    await user.clear(within(dialog).getByLabelText(/Key/));
    await user.type(within(dialog).getByLabelText(/Key/), 'billing.new_layout');
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'PLAN');
    await user.selectOptions(within(dialog).getByLabelText('Minimum plan'), 'PREMIUM');
    await user.click(within(dialog).getByLabelText(/Show this flag to the web/));
    await user.type(within(dialog).getByLabelText('Owner team'), 'Billing');
    await user.click(within(dialog).getByRole('button', { name: 'Create flag' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/feature-flags')?.body).toEqual({
        flagKey: 'billing.new_layout',
        description: 'New thing',
        type: 'PLAN',
        isEnabled: false,
        minPlanCode: 'PREMIUM',
        isClientVisible: true,
        ownerTeam: 'Billing',
        reason: 'Rollout plan',
      }),
    );
  });

  it('shows FLAG_KEY_TAKEN on the key field', async () => {
    const user = userEvent.setup();
    mockApi(routes({ 'POST /platform/feature-flags': err(409, 'FLAG_KEY_TAKEN') }));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Create flag' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create feature flag' });
    await user.type(within(dialog).getByLabelText(/Key/), 'billing.new_invoice_layout');
    await user.type(within(dialog).getByLabelText(/Description/), 'Duplicate');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Testing it');
    await user.click(within(dialog).getByRole('button', { name: 'Create flag' }));
    expect(await within(dialog).findByText('A flag with this key already exists.')).toBeInTheDocument();
  });

  it('overrides drawer: evaluator shows bucket and reason, add and remove overrides (T04-48)', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'GET /platform/feature-flags/1': ok({
          ...flags[0],
          overrides: [
            {
              id: 70,
              societyId: 5,
              value: false,
              reason: 'Asked to wait',
              expiresAt: null,
              createdAt: '2026-10-20T00:00:00.000Z',
            },
          ],
        }),
        'GET /platform/subscriptions': subs,
        'GET /platform/feature-flags/1/evaluate': ok({
          on: true,
          step: 'PERCENTAGE',
          why: 'Rollout 35 %: this society falls in bucket 12 (inside)',
          bucket: 12,
        }),
        'POST /platform/feature-flags/1/overrides': ok({ id: 71 }),
        'DELETE /platform/feature-flags/1/overrides/70': ok(null),
      }),
    );
    mount();
    await user.click(
      await screen.findByRole('button', { name: '1 overrides for billing.new_invoice_layout' }),
    );
    const drawer = await screen.findByRole('dialog', { name: 'billing.new_invoice_layout' });
    expect(await within(drawer).findByText(/Lake View: ON\./)).toBeInTheDocument();
    expect(within(drawer).getByText(/bucket 12 \(inside\)/)).toBeInTheDocument();
    expect(within(drawer).getByText('Forced off')).toBeInTheDocument();
    expect(within(drawer).getByText(/Asked to wait/)).toBeInTheDocument();

    await user.selectOptions(within(drawer).getByLabelText('Value'), 'on');
    await user.type(within(drawer).getByLabelText(/^Reason/), 'Pilot society');
    await user.click(within(drawer).getByRole('button', { name: 'Add override' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/feature-flags/1/overrides')?.body).toEqual({
        societyId: 4,
        value: true,
        reason: 'Pilot society',
      }),
    );

    await user.click(within(drawer).getByRole('button', { name: 'Remove override for Lake View' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remove override?' });
    await user.type(within(confirm).getByLabelText(/Reason/), 'Pilot over');
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(api.last('DELETE', '/platform/feature-flags/1/overrides/70')?.body).toEqual({
        reason: 'Pilot over',
      }),
    );
  });

  it('is read-only for platform.feature_flags.view', async () => {
    mockApi(routes());
    mount(['platform.feature_flags.view']);
    await screen.findByText('billing.new_invoice_layout');
    expect(screen.queryByRole('button', { name: 'Create flag' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Toggle billing.new_invoice_layout' })).toBeDisabled();
  });
});
