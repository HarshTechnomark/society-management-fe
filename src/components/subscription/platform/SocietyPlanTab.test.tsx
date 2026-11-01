import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import {
  plan,
  starterPlan,
  subscription,
  usageItem,
  version,
  versionRows,
} from '@/test/subscriptionFixtures';
import { SocietyPlanTab } from './SocietyPlanTab';

const premium = plan({
  id: 3,
  code: 'PREMIUM',
  name: 'Premium',
  tierRank: 3,
  currentVersion: {
    id: 8,
    versionNo: 1,
    pricePerFlatPaise: 2500,
    minBillableFlats: 50,
    annualFreeMonths: 2,
    publishedAt: null,
  },
});
const enterprise = plan({
  id: 4,
  code: 'ENTERPRISE',
  name: 'Enterprise',
  tierRank: 4,
  currentVersion: {
    id: 9,
    versionNo: 1,
    pricePerFlatPaise: 0,
    minBillableFlats: 1,
    annualFreeMonths: 2,
    publishedAt: null,
  },
});
const detail = {
  ...subscription({
    plan: {
      code: 'STANDARD',
      name: 'Standard',
      versionNo: 2,
      pricePerFlatPaise: 1500,
      minBillableFlats: 50,
      annualFreeMonths: 2,
    },
    billableFlats: 240,
    chargedFlats: 240,
  }),
  usage: {
    items: [
      usageItem({ limitKey: 'limit.guard_devices', enforcement: 'HARD', limit: 3, used: 2, percent: 66 }),
      usageItem({ limitKey: 'limit.flats', enforcement: 'HARD', limit: 1000, used: 400, percent: 40 }),
    ],
  },
  entitlements: [
    { key: 'amenities.amenity_catalogue', on: true, source: 'PLAN' },
    { key: 'communication.notice_composer', on: true, source: 'PLAN' },
  ],
};
const routes = (extra: object = {}) => ({
  'GET /platform/subscriptions': ok(
    [{ id: 31, status: 'ACTIVE', society: { id: 4, name: 'Sky Heights' } }],
    'OK',
    {
      pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
    },
  ),
  'GET /platform/subscriptions/31': ok(detail),
  'GET /platform/plans': ok([starterPlan, plan(), premium, enterprise]),
  'GET /platform/plan-versions/5': ok(version({ id: 5, entitlements: versionRows('STARTER') })),
  ...extra,
});
const mount = (perms = ['platform.societies.view', 'platform.societies.edit']) => {
  setMe(sampleMe({ platformPermissions: perms, platformRole: 'super_admin', permissions: [] }));
  return render(
    <ToastProvider>
      <SocietyPlanTab societyId={4} />
    </ToastProvider>,
  );
};

beforeEach(resetAll);

describe('SocietyPlanTab (spec 11.3 Plan tab)', () => {
  it('shows price, billable flats with minimum, cycle, MRR, next invoice, version and usage', async () => {
    mockApi(routes());
    mount();
    expect(await screen.findByText('₹15 / month')).toBeInTheDocument();
    expect(screen.getByText('240 (minimum 50)')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('₹3,600')).toBeInTheDocument();
    expect(screen.getByText('1 Dec 2026')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Guard consoles used' })).toBeInTheDocument();
  });

  it('upgrades now with MRR before and after, a reason and an idempotency key', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'POST /platform/subscriptions/31/change-plan': ok({
          effect: 'IMMEDIATE',
          planCode: 'PREMIUM',
          effectiveDate: '2026-11-17',
          version: 7,
        }),
      }),
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Change plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change plan' });
    await user.click(await within(dialog).findByRole('radio', { name: /Premium/ }));
    expect(within(dialog).getByTestId('mrr-after')).toHaveTextContent('₹6,000');
    expect(within(dialog).getByRole('radio', { name: 'Takes effect now, prorated' })).toBeChecked();
    await user.type(within(dialog).getByLabelText(/Reason/), 'Customer asked');
    await user.click(within(dialog).getByRole('button', { name: 'Change plan' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/subscriptions/31/change-plan')?.body).toEqual({
        planCode: 'PREMIUM',
        timing: 'IMMEDIATE',
        reason: 'Customer asked',
        version: 6,
      }),
    );
    expect(await screen.findByText('Moved to Premium.')).toBeInTheDocument();
  });

  it('previews a downgrade with hard-limit conflicts and features lost, defaulting to period end', async () => {
    const user = userEvent.setup();
    mockApi(routes());
    mount();
    await user.click(await screen.findByRole('button', { name: 'Change plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change plan' });
    await user.click(await within(dialog).findByRole('radio', { name: /Starter/ }));
    expect(within(dialog).getByRole('radio', { name: 'At the end of the billing cycle' })).toBeChecked();
    const preview = await within(dialog).findByTestId('impact-preview');
    expect(within(preview).getByText(/Guard consoles 2 in use, limit 0/)).toBeInTheDocument();
    expect(within(preview).getByText(/Amenity catalogue/)).toBeInTheDocument();
    expect(within(preview).queryByText(/Notice composer/)).toBeNull();
  });

  it('needs a custom price for Enterprise', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'POST /platform/subscriptions/31/change-plan': ok({
          effect: 'IMMEDIATE',
          planCode: 'ENTERPRISE',
          effectiveDate: '2026-11-17',
          version: 7,
        }),
      }),
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Change plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change plan' });
    await user.click(await within(dialog).findByRole('radio', { name: /Enterprise/ }));
    await user.type(within(dialog).getByLabelText(/Reason/), 'Signed contract');
    await user.click(within(dialog).getByRole('button', { name: 'Change plan' }));
    expect(within(dialog).getByText('Enter a price from ₹1 to ₹500 per flat.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Custom price per flat/), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Change plan' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/subscriptions/31/change-plan')?.body).toMatchObject({
        planCode: 'ENTERPRISE',
        customPricePerFlatPaise: 1200,
      }),
    );
  });

  it('schedules a cycle switch with a reason and is read-only without platform.societies.edit', async () => {
    const user = userEvent.setup();
    const api = mockApi(routes({ 'PATCH /platform/subscriptions/31': ok({}) }));
    const { unmount } = mount();
    await user.click(await screen.findByRole('button', { name: 'Switch to annual' }));
    const dialog = await screen.findByRole('dialog', { name: 'Switch to annual billing?' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Prefers annual');
    await user.click(within(dialog).getByRole('button', { name: 'Switch' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/platform/subscriptions/31')?.body).toEqual({
        pendingBillingCycle: 'ANNUAL',
        reason: 'Prefers annual',
        version: 6,
      }),
    );
    unmount();
    mount(['platform.societies.view']);
    await screen.findByText('₹15 / month');
    expect(screen.queryByRole('button', { name: 'Change plan' })).toBeNull();
  });

  it('shows an error with the request id', async () => {
    mockApi({ 'GET /platform/subscriptions': err(500, 'INTERNAL_ERROR') });
    mount();
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });
});
