import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { addon, plan, starterPlan, version, versionRows } from '@/test/subscriptionFixtures';
import { PlansScreen } from './PlansScreen';

const ALL = ['platform.plans.view', 'platform.plans.create', 'platform.plans.edit', 'platform.plans.approve'];
const routes = (extra: object = {}) => ({
  'GET /platform/plans': ok([plan(), starterPlan]),
  'GET /platform/plan-versions/6': ok(version()),
  'GET /platform/plan-versions/5': ok(version({ id: 5, versionNo: 1, entitlements: versionRows('STARTER') })),
  'GET /platform/entitlement-catalogue': err(500, 'INTERNAL_ERROR'),
  ...extra,
});
const mount = (perms = ALL) => {
  setMe(sampleMe({ platformPermissions: perms, platformRole: 'super_admin', permissions: [] }));
  return render(
    <ToastProvider>
      <PlansScreen />
    </ToastProvider>,
  );
};
const card = (name: string) => screen.getByRole('article', { name: `${name} plan` });
const headerOf = (fn: ReturnType<typeof mockApi>['fn'], method: string, path: string) =>
  fn.mock.calls
    .map(c => ({ url: String(c[0]), init: c[1] as RequestInit }))
    .find(c => c.init?.method === method && c.url.includes(path))?.init.headers as Record<string, string>;

beforeEach(resetAll);

describe('PlansScreen (spec 11.1)', () => {
  it('shows a card per plan in tier order with version, price, limits, modules and MRR', async () => {
    mockApi(routes());
    mount();
    const std = await screen.findByRole('article', { name: 'Standard plan' });
    expect(within(std).getByText('v2')).toBeInTheDocument();
    expect(within(std).getByText('₹15')).toBeInTheDocument();
    expect(within(std).getByText('2 months free')).toBeInTheDocument();
    expect(within(std).getByText('1,000')).toBeInTheDocument();
    expect(within(std).getByText('25 GB')).toBeInTheDocument();
    expect(within(std).getByText(/41/)).toBeInTheDocument();
    expect(within(std).getByText('₹1,12,500')).toBeInTheDocument();
    // module 16 and 18 are in; 22 is not
    expect(within(std).getByText(/^2 of \d+$/)).toBeInTheDocument();
    const articles = screen.getAllByRole('article');
    expect(articles[0]).toHaveAccessibleName('Starter plan');
  });

  it('offers Migrate N only to platform.plans.approve and only with subscriptions on older versions', async () => {
    mockApi(routes());
    const { unmount } = mount();
    await screen.findByRole('article', { name: 'Standard plan' });
    expect(within(card('Standard')).getByRole('button', { name: 'Migrate 7' })).toBeInTheDocument();
    expect(within(card('Starter')).queryByRole('button', { name: /Migrate/ })).toBeNull();
    unmount();
    mount(['platform.plans.view']);
    await screen.findByRole('article', { name: 'Standard plan' });
    expect(screen.queryByRole('button', { name: /Migrate/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit plan' })).toBeNull();
  });

  it('builds the "What each plan includes" matrix with tick, Some and -', async () => {
    mockApi(routes());
    mount();
    const table = await screen.findByRole('table', { name: 'What each plan includes' });
    const amenities = within(table).getByRole('row', { name: /Amenities/ });
    expect(within(amenities).getByLabelText('Not included')).toBeInTheDocument();
    expect(within(amenities).getByLabelText('Included')).toBeInTheDocument();
    const notices = within(table).getByRole('row', { name: /Notices/ });
    expect(within(notices).getByText('Some')).toBeInTheDocument();
  });

  it('shows the error state with the request id', async () => {
    mockApi({ 'GET /platform/plans': err(500, 'INTERNAL_ERROR') });
    mount();
    expect(await screen.findByText('Plans could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
  });

  it('hides the page without platform.plans.view', async () => {
    mockApi(routes());
    mount([]);
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });
});

describe('Edit plan (T04-47)', () => {
  it('creates a draft, patches price, sets entitlements and publishes after the diff and reason', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'POST /platform/plans/2/versions': ok(version({ id: 7, versionNo: 3, status: 'DRAFT', version: 1 })),
        'PATCH /platform/plan-versions/7': ok(version({ id: 7, versionNo: 3, status: 'DRAFT', version: 2 })),
        'PUT /platform/plan-versions/7/entitlements': ok({ updated: 3, version: 3 }),
        'POST /platform/plan-versions/7/publish': ok({
          ...version({ id: 7 }),
          subscriptionsOnOlderVersions: 41,
        }),
      }),
    );
    mount();
    await user.click(
      await within(await screen.findByRole('article', { name: 'Standard plan' })).findByRole('button', {
        name: 'Edit plan',
      }),
    );
    const drawer = await screen.findByRole('dialog', { name: 'Edit Standard plan' });
    expect(drawer).toHaveAccessibleDescription('Version 2. Saving creates version 3.');
    const price = await within(drawer).findByLabelText(/Price per flat per month/);
    await user.clear(price);
    await user.type(price, '16');
    await user.clear(within(drawer).getByLabelText('SMS this month'));
    await user.click(within(drawer).getByLabelText(/18 · Amenities.*: all features/));
    // always-on keys stay checked and disabled, PLANNED keys are hidden
    await user.click(within(drawer).getAllByRole('button', { name: 'Show keys' })[0]!);
    expect(within(drawer).getByRole('checkbox', { name: /Emergency broadcast/ })).toBeDisabled();
    expect(within(drawer).queryByText('Chat groups')).toBeNull();
    await user.click(within(drawer).getByRole('button', { name: 'Review and save' }));

    const review = await screen.findByRole('dialog', { name: 'Publish Standard v3' });
    expect(within(review).getByText('₹16')).toBeInTheDocument();
    expect(within(review).getByText('Unlimited')).toBeInTheDocument();
    expect(within(review).getByText(/Amenity catalogue/)).toBeInTheDocument();
    await user.type(within(review).getByLabelText(/Reason/), 'Price revision 2027');
    await user.click(within(review).getByRole('button', { name: 'Publish v3' }));

    await waitFor(() => expect(api.last('POST', '/platform/plan-versions/7/publish')).toBeTruthy());
    const order = api.calls.filter(c => c.method !== 'GET').map(c => `${c.method} ${c.path}`);
    expect(order).toEqual([
      'POST /platform/plans/2/versions',
      'PATCH /platform/plan-versions/7',
      'PUT /platform/plan-versions/7/entitlements',
      'POST /platform/plan-versions/7/publish',
    ]);
    expect(api.last('PATCH', '/platform/plan-versions/7')?.body).toEqual({
      pricePerFlatPaise: 1600,
      version: 1,
    });
    expect(api.last('PUT', '/platform/plan-versions/7/entitlements')?.body).toEqual({
      items: [
        { entitlementKey: 'limit.sms_per_month', limitValue: null },
        { entitlementKey: 'amenities.amenity_catalogue', isEnabled: false },
        { entitlementKey: 'amenities.slot_types', isEnabled: false },
      ],
      version: 2,
    });
    expect(api.last('POST', '/platform/plan-versions/7/publish')?.body).toEqual({
      reason: 'Price revision 2027',
      version: 3,
    });
    expect(headerOf(api.fn, 'POST', '/platform/plans/2/versions')['Idempotency-Key']).toBeTruthy();
    expect(await screen.findByText('Standard v3 published.')).toBeInTheDocument();
  });

  it('opens the existing draft instead of creating one', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'GET /platform/plans': ok([plan({ draftVersionId: 9 })]),
        'GET /platform/plan-versions/9': ok(version({ id: 9, versionNo: 3, status: 'DRAFT', version: 5 })),
        'PATCH /platform/plan-versions/9': ok(version({ id: 9, status: 'DRAFT', version: 6 })),
        'POST /platform/plan-versions/9/publish': ok(version({ id: 9 })),
      }),
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Edit plan' }));
    const drawer = await screen.findByRole('dialog', { name: 'Edit Standard plan' });
    const min = await within(drawer).findByLabelText(/Minimum billable flats/);
    await user.clear(min);
    await user.type(min, '60');
    await user.click(within(drawer).getByRole('button', { name: 'Review and save' }));
    const review = await screen.findByRole('dialog', { name: /Publish/ });
    await user.type(within(review).getByLabelText(/Reason/), 'Raise minimum');
    await user.click(within(review).getByRole('button', { name: /Publish/ }));
    await waitFor(() => expect(api.last('POST', '/platform/plan-versions/9/publish')).toBeTruthy());
    expect(api.last('POST', '/platform/plans/2/versions')).toBeUndefined();
    expect(api.last('PATCH', '/platform/plan-versions/9')?.body).toEqual({
      minBillableFlats: 60,
      version: 5,
    });
  });

  it('validates price, free months and limits before review, and shows API errors in the review', async () => {
    const user = userEvent.setup();
    mockApi(
      routes({
        'POST /platform/plans/2/versions': ok(version({ id: 7, status: 'DRAFT', version: 1 })),
        'PATCH /platform/plan-versions/7': ok(version({ id: 7, status: 'DRAFT', version: 2 })),
        'POST /platform/plan-versions/7/publish': err(422, 'CATALOGUE_INCOMPLETE'),
      }),
    );
    mount();
    await screen.findByRole('article', { name: 'Standard plan' });
    await user.click(within(card('Standard')).getByRole('button', { name: 'Edit plan' }));
    const drawer = await screen.findByRole('dialog', { name: 'Edit Standard plan' });
    const price = await within(drawer).findByLabelText(/Price per flat per month/);
    await user.clear(price);
    await user.type(price, '600');
    const free = within(drawer).getByLabelText(/Months free/);
    await user.clear(free);
    await user.type(free, '7');
    await user.type(within(drawer).getByLabelText('Flats'), 'x');
    await user.click(within(drawer).getByRole('button', { name: 'Review and save' }));
    expect(within(drawer).getByText('Price must be between ₹1 and ₹500.')).toBeInTheDocument();
    expect(within(drawer).getByText('Between 0 and 6 months.')).toBeInTheDocument();
    expect(within(drawer).getByText('Leave blank for unlimited or enter 0 or more.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Publish/ })).toBeNull();

    await user.clear(price);
    await user.type(price, '16');
    await user.clear(free);
    await user.type(free, '2');
    await user.clear(within(drawer).getByLabelText('Flats'));
    await user.type(within(drawer).getByLabelText('Flats'), '1000');
    await user.click(within(drawer).getByRole('button', { name: 'Review and save' }));
    const review = await screen.findByRole('dialog', { name: /Publish/ });
    await user.type(within(review).getByLabelText(/Reason/), 'Price change');
    await user.click(within(review).getByRole('button', { name: /Publish/ }));
    expect(await within(review).findByText(/missing some catalogue keys/)).toBeInTheDocument();
  });
});

describe('Migrate and add-on prices', () => {
  it('runs a dry run for the numbers, then migrates with notice days and an idempotency key', async () => {
    const user = userEvent.setup();
    const result = {
      status: 'DONE',
      matched: 7,
      scheduled: 7,
      skippedPendingDowngrade: 0,
      trialsSwitched: 0,
      mrrBeforePaise: 6150000,
      mrrAfterPaise: 6970000,
      earliestChangeAt: '2026-12-01',
    };
    const api = mockApi(
      routes({
        'POST /platform/plans/2/migrations': ok(result),
        'GET /platform/subscriptions': ok(
          [
            {
              id: 1,
              society: { id: 4, name: 'Sky Heights' },
              planCode: 'STANDARD',
              planVersionNo: 1,
              status: 'ACTIVE',
            },
            {
              id: 2,
              society: { id: 5, name: 'Lake View' },
              planCode: 'STANDARD',
              planVersionNo: 2,
              status: 'ACTIVE',
            },
          ],
          'OK',
          { pagination: { page: 1, limit: 100, total: 2, totalPages: 1 } },
        ),
      }),
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Migrate 7' }));
    const dialog = await screen.findByRole('dialog', { name: /Migrate 7 subscriptions to Standard v2/ });
    expect(await within(dialog).findByText('₹61,500')).toBeInTheDocument();
    expect(within(dialog).getByText('₹69,700')).toBeInTheDocument();
    expect(within(dialog).getByText('+₹8,200')).toBeInTheDocument();
    expect(within(dialog).getByText('Sky Heights (v1)')).toBeInTheDocument();
    expect(api.last('POST', '/platform/plans/2/migrations')?.body).toMatchObject({
      dryRun: true,
      noticeDays: 30,
    });
    expect(headerOf(api.fn, 'POST', '/migrations')['Idempotency-Key']).toBeUndefined();

    await user.type(within(dialog).getByLabelText(/Reason/), 'Move to new price');
    await user.click(within(dialog).getByRole('button', { name: 'Migrate subscriptions' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/plans/2/migrations')?.body).toEqual({
        noticeDays: 30,
        reason: 'Move to new price',
      }),
    );
    expect(await screen.findByText('7 subscriptions scheduled to move to v2.')).toBeInTheDocument();
  });

  it('takes an add-on off sale with a reason and edits a price', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'GET /platform/addons': ok([
          addon(),
          addon({
            id: 12,
            code: 'API_ACCESS',
            name: 'Public API access',
            minTierRank: 3,
            maxTierRank: 3,
            pricePaise: 299900,
          }),
        ]),
        'PATCH /platform/addons/11': ok(addon({ isOnSale: false })),
      }),
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Add-on prices' }));
    const drawer = await screen.findByRole('dialog', { name: 'Add-on store prices' });
    expect(await within(drawer).findByText('Starter to Enterprise')).toBeInTheDocument();
    expect(within(drawer).getByText('Premium')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('switch', { name: '50 GB extra storage on sale' }));
    const confirm = await screen.findByRole('dialog', { name: /Take off sale/ });
    await user.type(within(confirm).getByLabelText(/Reason/), 'Supplier change');
    await user.click(within(confirm).getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/platform/addons/11')?.body).toEqual({
        isOnSale: false,
        reason: 'Supplier change',
        version: 2,
      }),
    );

    await user.click(within(drawer).getAllByRole('button', { name: 'Edit' })[0]!);
    const edit = await screen.findByRole('dialog', { name: 'Edit price: 50 GB extra storage' });
    const price = within(edit).getByLabelText(/Price/);
    await user.clear(price);
    await user.type(price, '550');
    await user.type(within(edit).getByLabelText(/Reason/), 'New storage cost');
    await user.click(within(edit).getByRole('button', { name: 'Save price' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/platform/addons/11')?.body).toEqual({
        pricePaise: 55000,
        reason: 'New storage cost',
        version: 2,
      }),
    );
  });
});
