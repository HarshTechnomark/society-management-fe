import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureApiClient } from '@/lib/apiClient';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { societyPlans, subscription, upgradeQuote, usageItem } from '@/test/subscriptionFixtures';
import type { StoreAddon } from '@/types/subscriptions';
import { SubscriptionScreen, statusChip } from './SubscriptionScreen';
import { eligibleFeatures } from './FeaturePicker';

const VIEW = 'settings.subscription.view';
const EDIT = 'settings.subscription.edit';
const FEATURES = ['platform.add_on_store', 'platform.premium_feature_trial', 'platform.plan_advisor'];
const entitlements = {
  planCode: 'STARTER',
  status: 'ACTIVE',
  generation: 3,
  features: [...FEATURES, 'communication.notice_composer'],
  readOnlyFeatures: [],
  flags: {},
};
const store: StoreAddon[] = [
  {
    code: 'SMS_PACK_2000',
    name: '2,000 SMS',
    billingType: 'ONE_TIME',
    pricePaise: 90000,
    grants: [{ type: 'LIMIT_INCREMENT', key: 'limit.sms_per_month', amount: 2000 }],
    availableForPlan: true,
    remainingQuantity: 10,
  },
  {
    code: 'FEATURE_UNLOCK',
    name: 'One higher-plan feature',
    billingType: 'RECURRING',
    pricePaise: 99900,
    grants: [{ type: 'FEATURE_CHOICE' }],
    availableForPlan: true,
    remainingQuantity: 1,
  },
  {
    code: 'WHATSAPP_PACK_5000',
    name: '5,000 WhatsApp messages',
    billingType: 'ONE_TIME',
    pricePaise: 240000,
    grants: [{ type: 'LIMIT_INCREMENT', key: 'limit.whatsapp_per_month', amount: 5000 }],
    availableForPlan: false,
    remainingQuantity: 10,
  },
];
const owned = [
  {
    id: 77,
    code: 'EXTRA_STORAGE_50GB',
    quantity: 1,
    unitPricePaise: 50000,
    status: 'ACTIVE',
    startsAt: '2026-10-01',
    endsAt: null,
    featureKey: null,
    version: 2,
  },
  {
    id: 78,
    code: 'FEATURE_UNLOCK',
    quantity: 1,
    unitPricePaise: 99900,
    status: 'CANCEL_SCHEDULED',
    startsAt: '2026-10-01',
    endsAt: '2026-11-30',
    featureKey: 'amenities.amenity_catalogue',
    version: 4,
  },
];
const routes = (extra: object = {}) => ({
  'GET /subscription': ok(subscription()),
  'GET /subscription/usage': ok({
    items: [
      usageItem(),
      usageItem({
        limitKey: 'limit.flats',
        unit: 'flats',
        period: 'ABSOLUTE',
        enforcement: 'HARD',
        limit: 300,
        used: 96,
        percent: 32,
      }),
      usageItem({ limitKey: 'limit.api_keys', limit: null, used: 0, percent: null }),
      usageItem({ limitKey: 'limit.guard_devices', limit: 0, used: 0, percent: 0, enforcement: 'HARD' }),
    ],
  }),
  'GET /subscription/plans': ok(societyPlans()),
  'GET /subscription/entitlements': ok(entitlements),
  'GET /subscription/addons': ok({ store, owned }),
  ...extra,
});
const mount = (perms = [VIEW, EDIT], features = FEATURES) => {
  setMe(sampleMe({ permissions: perms, features }));
  return render(
    <ToastProvider>
      <SubscriptionScreen />
    </ToastProvider>,
  );
};
const planCard = (name: string) => screen.getByRole('article', { name: `${name} plan` });

beforeEach(resetAll);

describe('Current plan and usage (spec 11.4)', () => {
  it('shows plan, status, price, charged flats with the minimum note, cycle, period and renewal', async () => {
    mockApi(
      routes({
        'GET /subscription': ok(
          subscription({ billableFlats: 20, chargedFlats: 30, billingCycle: 'ANNUAL' }),
        ),
      }),
    );
    mount();
    const current = (await screen.findByRole('heading', { name: 'Current plan' })).closest('section')!;
    expect(within(current).getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('₹9 / month')).toBeInTheDocument();
    expect(screen.getByText('30 (minimum 30; you have 20)')).toBeInTheDocument();
    expect(screen.getByText('Annual, 2 months free')).toBeInTheDocument();
    expect(screen.getByText('1 Dec 2026')).toBeInTheDocument();
  });

  it('builds the status chip from the society status', () => {
    const now = Date.parse('2026-11-01T10:00:00');
    expect(statusChip(subscription({ societyStatus: 'TRIAL', trialEndsAt: '2026-11-05' }), now).label).toBe(
      'Trial – 5 days left',
    );
    expect(statusChip(subscription({ societyStatus: 'PAST_DUE' })).label).toBe('Past due');
    expect(statusChip(subscription({ societyStatus: 'SUSPENDED' })).label).toBe('Suspended');
  });

  it('shows usage meters with Unlimited and the 80 % banner', async () => {
    mockApi(
      routes({
        'GET /subscription/usage': ok({
          items: [
            usageItem({ used: 450, percent: 90 }),
            usageItem({ limitKey: 'limit.api_keys', limit: null, used: 0, percent: null }),
          ],
        }),
      }),
    );
    mount();
    expect(await screen.findByRole('progressbar', { name: 'SMS this month used' })).toHaveAttribute(
      'aria-valuenow',
      '90',
    );
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
    expect(screen.getByText(/SMS this month is at 90 % of your plan/)).toBeInTheDocument();
  });

  it('cancels a scheduled downgrade and withdraws a cancellation', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'GET /subscription': ok(
          subscription({
            pendingChange: { type: 'DOWNGRADE', planCode: 'STARTER', at: '2026-12-01' },
            cancelAtPeriodEnd: true,
          }),
        ),
        'DELETE /subscription/pending-change': ok(null),
        'POST /subscription/cancel/withdraw': ok(null),
      }),
    );
    mount();
    expect(await screen.findByText(/Moving to Starter on 1 Dec 2026/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel change' }));
    await waitFor(() => expect(api.last('DELETE', '/subscription/pending-change')).toBeTruthy());
    const url = String(api.fn.mock.calls.find(c => (c[1] as RequestInit)?.method === 'DELETE')![0]);
    expect(url).toContain('type=PLAN');
    expect(url).toContain('version=6');
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() =>
      expect(api.last('POST', '/subscription/cancel/withdraw')?.body).toEqual({ version: 6 }),
    );
  });

  it('shows the empty state when there is no live subscription', async () => {
    mockApi(routes({ 'GET /subscription': err(404, 'SUBSCRIPTION_NOT_FOUND') }));
    mount();
    expect(await screen.findByText('No active subscription')).toBeInTheDocument();
  });

  it('hides every action button for view-only members', async () => {
    mockApi(routes());
    mount([VIEW]);
    await screen.findByRole('article', { name: 'Standard plan' });
    expect(screen.queryByRole('button', { name: 'Upgrade' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Buy/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start 14-day trial' })).toBeNull();
    expect(await screen.findByText('2,000 SMS')).toBeInTheDocument();
  });

  it('hides the page without settings.subscription.view', async () => {
    mockApi(routes());
    mount([]);
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });
});

describe('Compare plans', () => {
  it('upgrades with the prorated quote, GST, step-up and a success toast (T04-46)', async () => {
    const user = userEvent.setup();
    const stepUp = vi.fn(async () => true);
    configureApiClient({ stepUp });
    const api = mockApi(
      routes({
        'GET /subscription/quote': ok(upgradeQuote),
        'POST /subscription/change-plan': [
          err(401, 'REAUTH_REQUIRED'),
          ok({
            effect: 'IMMEDIATE',
            planCode: 'STANDARD',
            effectiveDate: '2026-11-17',
            proration: upgradeQuote.proration,
            invoiceId: 5521,
            version: 7,
          }),
        ],
      }),
    );
    mount();
    await screen.findByRole('article', { name: 'Standard plan' });
    expect(within(planCard('Standard')).getByText('Recommended')).toBeInTheDocument();
    expect(within(planCard('Starter')).getByText('Current')).toBeInTheDocument();
    expect(within(planCard('Enterprise')).getByRole('link', { name: 'Contact sales' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:'),
    );
    expect(within(planCard('Starter')).queryByRole('button')).toBeNull();

    await user.click(within(planCard('Standard')).getByRole('button', { name: 'Upgrade' }));
    const dialog = await screen.findByRole('dialog', { name: 'Upgrade to Standard' });
    const proration = await within(dialog).findByTestId('proration');
    expect(within(proration).getByText('₹672')).toBeInTheDocument();
    expect(within(proration).getByText('-₹403.20')).toBeInTheDocument();
    expect(within(proration).getByText('₹268.80')).toBeInTheDocument();
    expect(within(dialog).getAllByText('₹129.60')).toHaveLength(2);
    expect(within(dialog).getByText('₹1,699.20')).toBeInTheDocument();

    const entCallsBefore = api.calls.filter(c => c.path === '/subscription/entitlements').length;
    await user.click(within(dialog).getByRole('button', { name: 'Upgrade now' }));
    expect(
      await screen.findByText('Upgraded to Standard. ₹268.80 plus GST is invoiced now.'),
    ).toBeInTheDocument();
    expect(stepUp).toHaveBeenCalledTimes(1);
    const posts = api.fn.mock.calls.filter(c => String(c[0]).includes('/subscription/change-plan'));
    expect(posts).toHaveLength(2);
    const keys = posts.map(c => ((c[1] as RequestInit).headers as Record<string, string>)['Idempotency-Key']);
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
    expect(api.last('POST', '/subscription/change-plan')?.body).toEqual({ planCode: 'STANDARD', version: 6 });
    // the entitlements are reloaded so newly unlocked menus appear
    await waitFor(() =>
      expect(api.calls.filter(c => c.path === '/subscription/entitlements').length).toBeGreaterThan(
        entCallsBefore,
      ),
    );
  });

  it('blocks a downgrade with the conflict list from the impact preview', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'GET /subscription': ok(
          subscription({ plan: { ...subscription().plan, code: 'PREMIUM', name: 'Premium' } }),
        ),
        'GET /subscription/plans': ok(societyPlans('PREMIUM')),
        'GET /subscription/downgrade-preview': ok({
          targetPlan: 'STANDARD',
          effectiveDate: '2026-12-01',
          readOnlyUntil: '2027-03-01',
          featuresLost: [
            {
              key: 'governance.polls_engine',
              moduleNo: 22,
              title: 'Polls engine',
              recordsInUse: 4,
              stopsJobs: true,
            },
          ],
          limitConflicts: [{ limitKey: 'limit.automation_rules', used: 12, targetLimit: 0 }],
          limitChanges: [{ limitKey: 'limit.sms_per_month', current: 5000, target: 2000 }],
          addonsEnding: [{ code: 'AI_PACK_5000', reason: 'PLAN_CHANGED' }],
          canSchedule: false,
        }),
      }),
    );
    mount();
    await screen.findByRole('article', { name: 'Standard plan' });
    await user.click(within(planCard('Standard')).getByRole('button', { name: 'Downgrade' }));
    const dialog = await screen.findByRole('dialog', { name: 'Downgrade to Standard' });
    expect(
      await within(dialog).findByText(/Automation rules: 12 in use, Standard allows 0/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Polls engine \(4 in use\)/)).toBeInTheDocument();
    expect(within(dialog).getByText(/SMS this month: 5,000 to 2,000/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Schedule downgrade' })).toBeDisabled();
    expect(api.last('POST', '/subscription/change-plan')).toBeUndefined();
  });

  it('schedules a downgrade without conflicts and reports a late conflict from the API', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'GET /subscription': ok(
          subscription({ plan: { ...subscription().plan, code: 'PREMIUM', name: 'Premium' } }),
        ),
        'GET /subscription/plans': ok(societyPlans('PREMIUM')),
        'GET /subscription/downgrade-preview': ok({
          targetPlan: 'STANDARD',
          effectiveDate: '2026-12-01',
          readOnlyUntil: null,
          featuresLost: [],
          limitConflicts: [],
          limitChanges: [],
          addonsEnding: [],
          canSchedule: true,
        }),
        'POST /subscription/change-plan': {
          status: 409,
          code: 'DOWNGRADE_LIMIT_CONFLICT',
          message: 'x',
          errors: [{ field: 'limit.guard_devices', message: 'x', used: 5, targetLimit: 3 } as never],
        },
      }),
    );
    mount();
    await screen.findByRole('article', { name: 'Standard plan' });
    await user.click(within(planCard('Standard')).getByRole('button', { name: 'Downgrade' }));
    const dialog = await screen.findByRole('dialog', { name: 'Downgrade to Standard' });
    await within(dialog).findByTestId('downgrade-preview');
    await user.click(within(dialog).getByRole('button', { name: 'Schedule downgrade' }));
    expect(await within(dialog).findByText(/Guard consoles 5 in use, new limit 3/)).toBeInTheDocument();
    expect(api.last('POST', '/subscription/change-plan')?.body).toEqual({ planCode: 'STANDARD', version: 6 });
  });

  it('starts a paid plan from the trial with the chosen cycle', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'GET /subscription': ok(
          subscription({ status: 'TRIALING', societyStatus: 'TRIAL', trialEndsAt: '2026-11-14' }),
        ),
        'GET /subscription/quote': ok({ ...upgradeQuote, billingCycle: 'ANNUAL', proration: null }),
        'POST /subscription/activate': ok({
          subscription: subscription(),
          invoice: { id: 9, invoiceNo: 'SA/26-27/0042', totalPaise: 169920, dueDate: '2026-11-10' },
        }),
      }),
    );
    mount();
    await screen.findByRole('article', { name: 'Standard plan' });
    await user.click(screen.getByRole('button', { name: 'Annual' }));
    await screen.findByRole('article', { name: 'Standard plan' });
    await user.click(within(planCard('Standard')).getByRole('button', { name: 'Choose' }));
    const dialog = await screen.findByRole('dialog', { name: 'Start Standard, annual' });
    await within(dialog).findByText('First period: 1 Dec 2026 to 31 Dec 2026');
    await user.click(within(dialog).getByRole('button', { name: 'Start Standard' }));
    await waitFor(() =>
      expect(api.last('POST', '/subscription/activate')?.body).toEqual({
        planCode: 'STANDARD',
        billingCycle: 'ANNUAL',
        version: 6,
      }),
    );
    expect(
      await screen.findByText(/Invoice SA\/26-27\/0042 for ₹1,699.20 is due on 10 Nov 2026/),
    ).toBeInTheDocument();
  });

  it('switches the billing cycle from the next period', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'POST /subscription/billing-cycle': ok({
          pendingBillingCycle: 'ANNUAL',
          effectiveDate: '2026-12-01',
          version: 7,
        }),
      }),
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Switch to annual' }));
    const dialog = await screen.findByRole('dialog', { name: 'Switch to annual billing?' });
    await user.click(within(dialog).getByRole('button', { name: 'Switch' }));
    await waitFor(() =>
      expect(api.last('POST', '/subscription/billing-cycle')?.body).toEqual({
        billingCycle: 'ANNUAL',
        version: 6,
      }),
    );
  });
});

describe('Add-on store, feature trial and cancellation', () => {
  it('buys a pack with a quantity, and a feature unlock only after picking the feature', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'POST /subscription/addons': [
          ok({
            subscriptionAddon: { ...owned[0], code: 'SMS_PACK_2000', status: 'PENDING_PAYMENT' },
            invoiceId: 3,
          }),
          ok({ subscriptionAddon: { ...owned[1], status: 'ACTIVE' }, invoiceId: 4 }),
        ],
      }),
    );
    mount();
    const pack = await screen.findByRole('article', { name: '2,000 SMS' });
    expect(
      within(screen.getByRole('article', { name: '5,000 WhatsApp messages' })).getByText(
        'Not available on your plan.',
      ),
    ).toBeInTheDocument();
    await user.click(within(pack).getByRole('button', { name: 'More' }));
    await user.click(within(pack).getByRole('button', { name: 'Buy 2,000 SMS' }));
    const buy = await screen.findByRole('dialog', { name: 'Buy 2,000 SMS' });
    await user.click(within(buy).getByRole('button', { name: 'Buy for ₹1,800' }));
    expect(
      await screen.findByText('2,000 SMS ordered. It applies when the invoice is paid.'),
    ).toBeInTheDocument();
    expect(api.last('POST', '/subscription/addons')?.body).toEqual({
      addonCode: 'SMS_PACK_2000',
      quantity: 2,
    });

    await user.click(screen.getByRole('button', { name: 'Buy One higher-plan feature' }));
    const unlock = await screen.findByRole('dialog', { name: 'Buy One higher-plan feature' });
    await user.click(within(unlock).getByRole('button', { name: /Buy for/ }));
    expect(within(unlock).getByText('Pick the feature to unlock.')).toBeInTheDocument();
    await user.type(within(unlock).getByRole('searchbox'), 'amenity catalogue');
    await user.click(within(unlock).getByRole('radio', { name: /Amenity catalogue/ }));
    await user.click(within(unlock).getByRole('button', { name: /Buy for/ }));
    await waitFor(() =>
      expect(api.last('POST', '/subscription/addons')?.body).toEqual({
        addonCode: 'FEATURE_UNLOCK',
        featureKey: 'amenities.amenity_catalogue',
      }),
    );
  });

  it('cancels a recurring add-on at period end and resumes a scheduled one', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'DELETE /subscription/addons/77': ok(null),
        'POST /subscription/addons/78/resume': ok(null),
      }),
    );
    mount();
    expect(await screen.findByText('Ends at period end')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel EXTRA_STORAGE_50GB at period end' }));
    await waitFor(() => expect(api.last('DELETE', '/subscription/addons/77')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Resume One higher-plan feature' }));
    await waitFor(() =>
      expect(api.last('POST', '/subscription/addons/78/resume')?.body).toEqual({ version: 4 }),
    );
  });

  it('starts a 14-day feature trial and explains FEATURE_TRIAL_USED', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({
        'POST /subscription/feature-trials': [
          err(409, 'FEATURE_TRIAL_USED'),
          ok({
            featureKey: 'governance.polls_engine',
            startsAt: '2026-11-01',
            expiresAt: '2026-11-15T00:00:00.000Z',
          }),
        ],
      }),
    );
    mount();
    const card = (await screen.findByRole('heading', { name: 'Try a premium feature' })).closest('section')!;
    await user.type(within(card).getByRole('searchbox'), 'polls engine');
    await user.click(within(card).getByRole('radio', { name: /Polls engine/ }));
    await user.click(within(card).getByRole('button', { name: 'Start 14-day trial' }));
    expect(await within(card).findByText('This feature has been trialled before.')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Start 14-day trial' }));
    expect(await screen.findByText('Polls engine is on until 15 Nov 2026.')).toBeInTheDocument();
    expect(api.last('POST', '/subscription/feature-trials')?.body).toEqual({
      featureKey: 'governance.polls_engine',
    });
  });

  it('says feature trials need Standard when the plan lacks the key', async () => {
    mockApi(
      routes({
        'GET /subscription/entitlements': ok({ ...entitlements, features: ['platform.add_on_store'] }),
      }),
    );
    mount([VIEW, EDIT], ['platform.add_on_store']);
    expect(
      await screen.findByText('Feature trials come with the Standard plan and higher.'),
    ).toBeInTheDocument();
  });

  it('requests cancellation with a reason; a second member must approve', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      routes({ 'POST /subscription/cancel': { status: 202, data: { approvalRequestId: 12 } } }),
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Cancel subscription' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel the subscription?' });
    await user.click(within(dialog).getByRole('button', { name: 'Request cancellation' }));
    expect(within(dialog).getByText('Enter between 5 and 500 characters.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason/), 'Moving to another vendor');
    await user.click(within(dialog).getByRole('button', { name: 'Request cancellation' }));
    expect(
      await screen.findByText('Cancellation requested. A second committee member must approve.'),
    ).toBeInTheDocument();
    expect(api.last('POST', '/subscription/cancel')?.body).toEqual({
      reason: 'Moving to another vendor',
      version: 6,
    });
  });
});

describe('eligibleFeatures (BR-04-24)', () => {
  it('lists LIVE keys above the plan, never always-on, planned, Enterprise-only or already enabled keys', () => {
    const list = eligibleFeatures('STANDARD', ['governance.eligibility_rules']);
    const keys = new Set(list.map(f => f.key));
    expect(keys.has('governance.polls_engine')).toBe(true);
    expect(keys.has('governance.eligibility_rules')).toBe(false);
    expect(keys.has('amenities.amenity_catalogue')).toBe(false);
    expect(keys.has('communication.emergency_broadcast')).toBe(false);
    expect(keys.has('communication.chat_groups')).toBe(false);
    expect(keys.has('iam.enterprise_single_sign_on')).toBe(false);
    expect(list.every(f => f.minPlan === 'PREMIUM')).toBe(true);
  });
});
