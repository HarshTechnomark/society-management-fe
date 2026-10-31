import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/lib/apiClient';
import { setMe } from '@/lib/auth';
import { entitlementsStore } from '@/lib/entitlements';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { useFeature } from '@/hooks/useFeature';
import { FeatureGate } from './FeatureGate';
import { PaymentRequiredPrompt } from './PaymentRequiredPrompt';
import { UsageWarnings } from './UsageBanners';
import { UsageMeter } from './UsageMeter';
import { describePlanLock } from './planLock';
import { ApiError } from '@/lib/apiClient';
import type { UsageItem } from '@/types/subscriptions';

beforeEach(resetAll);

const notInPlan = [
  {
    field: 'entitlementKey',
    message: 'amenities.amenity_catalogue',
    currentPlan: 'STARTER',
    availableIn: ['STANDARD', 'PREMIUM', 'ENTERPRISE'],
    unlockAddon: 'FEATURE_UNLOCK',
  },
];
const item = (over: Partial<UsageItem> = {}): UsageItem => ({
  limitKey: 'limit.sms_per_month',
  unit: 'messages',
  period: 'MONTHLY',
  enforcement: 'SOFT',
  limit: 2000,
  used: 1610,
  percent: 80,
  addonIncrement: 0,
  overrideApplied: false,
  overageUnits: 0,
  ...over,
});

function Probe() {
  return <p>{useFeature('a.b') ? 'on' : 'off'}</p>;
}

describe('useFeature and FeatureGate', () => {
  it('uses me.features until the entitlements arrive, then the entitlements', () => {
    setMe(sampleMe({ features: ['a.b'] }));
    render(<Probe />);
    expect(screen.getByText('on')).toBeInTheDocument();
    act(() =>
      entitlementsStore.set({
        planCode: 'STARTER',
        status: 'ACTIVE',
        generation: 2,
        features: [],
        readOnlyFeatures: [],
        flags: {},
      }),
    );
    expect(screen.getByText('off')).toBeInTheDocument();
  });

  it('shows the children when the feature is on and the See plans prompt for viewers when off', () => {
    setMe(sampleMe({ features: ['a.b'], permissions: ['settings.subscription.view'] }));
    const { rerender } = render(<FeatureGate feature="a.b">inside</FeatureGate>);
    expect(screen.getByText('inside')).toBeInTheDocument();
    rerender(<FeatureGate feature="x.y">inside</FeatureGate>);
    expect(screen.getByText('Not in your plan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute(
      'href',
      '/admin/settings/subscription',
    );
  });

  it('shows plain wording and no link to people without settings.subscription.view', () => {
    setMe(sampleMe({ features: [] }));
    render(<FeatureGate feature="x.y">inside</FeatureGate>);
    expect(screen.getByText('Not available in your plan')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'See plans' })).toBeNull();
  });
});

describe('global 402 handling', () => {
  it('describes FEATURE_NOT_IN_PLAN and USAGE_LIMIT_EXCEEDED from errors[]', () => {
    const f = new ApiError(
      402,
      'FEATURE_NOT_IN_PLAN',
      'Amenity booking is not included in your plan.',
      notInPlan,
    );
    expect(describePlanLock(f, true)?.text).toContain('It comes with Standard, Premium, Enterprise.');
    expect(describePlanLock(f, true)?.canUnlock).toBe(true);
    expect(describePlanLock(f, false)?.text).toBe('Not available in your plan.');
    const l = new ApiError(402, 'USAGE_LIMIT_EXCEEDED', 'x', [
      { field: 'limitKey', message: 'limit.guard_devices', limit: 3, used: 3, requested: 1 },
    ]);
    expect(describePlanLock(l, true)?.text).toContain(
      'Guard consoles has reached the limit of your plan (3 of 3 used)',
    );
    expect(describePlanLock(new ApiError(404, 'X', 'x'), true)).toBeNull();
  });

  it('opens the upgrade prompt on a 402 for a subscription viewer in the admin app', async () => {
    setMe(sampleMe({ permissions: ['settings.subscription.view'] }));
    mockApi({
      'GET /amenities': err(
        402,
        'FEATURE_NOT_IN_PLAN',
        notInPlan,
        'Amenity booking is not included in your plan.',
      ),
    });
    render(<PaymentRequiredPrompt />);
    await act(async () => {
      await api('/amenities').catch(() => null);
    });
    expect(screen.getByRole('dialog', { name: 'Not in your plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See plans' })).toBeInTheDocument();
  });

  it('shows "Not available in your plan" without a link to others and to residents', async () => {
    setMe(sampleMe({ permissions: [] }));
    mockApi({ 'GET /x': err(402, 'FEATURE_NOT_IN_PLAN', notInPlan) });
    render(<PaymentRequiredPrompt />);
    await act(async () => {
      await api('/x').catch(() => null);
    });
    expect(screen.getByRole('dialog', { name: 'Not available in your plan' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'See plans' })).toBeNull();
  });

  it('never offers an upgrade in the resident app even with the permission', async () => {
    const me = sampleMe({ permissions: ['settings.subscription.view'] });
    me.session.clientApp = 'RESIDENT';
    setMe(me);
    mockApi({ 'GET /x': err(402, 'FEATURE_NOT_IN_PLAN', notInPlan) });
    render(<PaymentRequiredPrompt />);
    await act(async () => {
      await api('/x').catch(() => null);
    });
    expect(screen.queryByRole('link', { name: 'See plans' })).toBeNull();
  });

  it('stays quiet when the caller passes plan: false', async () => {
    setMe(sampleMe());
    mockApi({ 'GET /x': err(402, 'USAGE_LIMIT_EXCEEDED') });
    render(<PaymentRequiredPrompt />);
    await act(async () => {
      await api('/x', { plan: false }).catch(() => null);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('usage meters and warning banners', () => {
  it('shows used of limit with 80 % and 100 % styling', () => {
    mockApi({ 'GET /x': ok(null) });
    render(
      <>
        <UsageMeter item={item()} />
        <UsageMeter item={item({ limitKey: 'limit.guard_devices', limit: null, used: 4, percent: null })} />
      </>,
    );
    expect(screen.getByText('1,610 of 2,000')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'SMS this month used' })).toHaveAttribute(
      'aria-valuenow',
      '80',
    );
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
  });

  it('warns at 80 % and 100 % and stays silent below or when unlimited', () => {
    const { rerender } = render(<UsageWarnings items={[item({ percent: 79, used: 1580 })]} />);
    expect(screen.queryByTestId('usage-banners')).toBeNull();
    rerender(
      <UsageWarnings
        items={[
          item(),
          item({ limitKey: 'limit.flats', limit: 300, used: 300, percent: 100 }),
          item({ limitKey: 'limit.api_keys', limit: null, used: 9, percent: null }),
        ]}
      />,
    );
    expect(screen.getByText(/SMS this month is at 80 % of your plan/)).toBeInTheDocument();
    expect(screen.getByText(/Flats has reached 100 % of your plan/)).toBeInTheDocument();
    expect(screen.queryByText(/API keys/)).toBeNull();
  });
});
