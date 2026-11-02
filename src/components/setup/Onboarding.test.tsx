import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { onboarding, setting, society, unit } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { OnboardingScreen } from './OnboardingScreen';
import { SetupBanner } from './SetupBanner';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];

function renderIt(routes: Routes = {}, perms?: string[]) {
  signIn(perms);
  const api = mockApi({
    'GET /onboarding': ok(onboarding()),
    'GET /society': ok(society()),
    ...routes,
  });
  render(
    <ToastProvider>
      <OnboardingScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Onboarding wizard (11.1)', () => {
  beforeEach(resetAll);

  it('shows a skeleton while loading', () => {
    renderIt();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows the error with its reference when loading fails', async () => {
    renderIt({ 'GET /onboarding': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
  });

  it('opens step 1 with progress 0 and the eight steps', async () => {
    renderIt();
    expect(await screen.findByText(/Sky Heights CHS · step 1 of 8/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Setup progress' })).toHaveAttribute('aria-valuenow', '0');
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button');
    expect(steps.map(b => b.textContent?.replace(/^\d+|✓/, ''))).toEqual([
      'Society profile',
      'Structure',
      'Flats',
      'Residents',
      'Billing',
      'Payments',
      'Committee',
      'Go live',
    ]);
    expect(screen.getByRole('textbox', { name: /Society name/ })).toHaveValue('Sky Heights CHS');
  });

  it('saves the profile, completes PROFILE and moves to step 2', async () => {
    const api = renderIt({
      'PATCH /society': ok(society({ name: 'Sky Heights Towers', version: 8 })),
      'POST /onboarding/steps/PROFILE/complete': ok(onboarding(['PROFILE'])),
    });
    const name = await screen.findByRole('textbox', { name: /Society name/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'Sky Heights Towers');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(api.last('POST', '/onboarding/steps/PROFILE/complete')).toBeTruthy());
    expect(api.last('PATCH', '/society')!.body).toEqual({ version: 7, name: 'Sky Heights Towers' });
    expect(await screen.findByText('Towers and flats')).toBeInTheDocument();
  });

  it('asks for a reason before a legal change is saved', async () => {
    const api = renderIt({
      'PATCH /society': ok(society({ registrationNo: 'NEW/1', version: 8 })),
      'POST /onboarding/steps/PROFILE/complete': ok(onboarding(['PROFILE'])),
    });
    const reg = await screen.findByRole('textbox', { name: /Registration number/ });
    await userEvent.clear(reg);
    await userEvent.type(reg, 'NEW/1');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    const dlg = await screen.findByRole('dialog');
    expect(api.last('PATCH', '/society')).toBeUndefined();
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Reason/ }), 'Corrected number');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/society')).toBeTruthy());
    expect(api.last('PATCH', '/society')!.body).toMatchObject({
      registrationNo: 'NEW/1',
      reason: 'Corrected number',
    });
  });

  it('shows the GSTIN error from the API on the profile step', async () => {
    renderIt({
      'PATCH /society': err(422, 'GSTIN_STATE_MISMATCH'),
    });
    const city = await screen.findByRole('textbox', { name: /City/ });
    await userEvent.clear(city);
    await userEvent.type(city, 'Mumbai');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText(/does not start with the state code/)).toBeInTheDocument();
  });

  it('previews the structure live, then generates, and completes STRUCTURE', async () => {
    const api = renderIt({
      'GET /onboarding': ok(onboarding(['PROFILE'])),
      'POST /units/generator/preview': ok({
        previewHash: 'h'.repeat(64),
        summary: {},
        conflicts: [],
        sample: [],
        sampleCount: 0,
      }),
      'POST /units/generator/commit': ok({ created: 48 }),
      'POST /onboarding/steps/STRUCTURE/complete': ok(onboarding(['PROFILE', 'STRUCTURE'])),
      'GET /units': ok([unit()], 'OK', { pagination: { page: 1, limit: 6, total: 48, totalPages: 8 } }),
    });
    expect(
      await screen.findByText('48 flats: towers A, B · 6 floors · 4 per floor. Example: A-101 … B-604.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(api.last('POST', '/onboarding/steps/STRUCTURE/complete')).toBeTruthy());
    const commit = api.last('POST', '/units/generator/commit')!.body as {
      pattern: string;
      previewHash: string;
      floorTo: number;
    };
    expect(commit).toMatchObject({ pattern: '{floor}0{pos}', floorTo: 6, previewHash: 'h'.repeat(64) });
    expect(await screen.findByText('Flat details')).toBeInTheDocument();
  });

  it('limits the structure shortcut to 1 to 6 towers', async () => {
    const api = renderIt({ 'GET /onboarding': ok(onboarding(['PROFILE'])) });
    const towers = await screen.findByRole('spinbutton', { name: /Number of towers/ });
    await userEvent.clear(towers);
    await userEvent.type(towers, '9');
    expect(screen.getByText(/Enter 1 to 6 towers/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('1 to 6 towers.')).toBeInTheDocument();
    expect(api.last('POST', '/units/generator/preview')).toBeUndefined();
  });

  it('shows the flat counts and first rows on step 3', async () => {
    renderIt({
      'GET /onboarding': ok(onboarding(['PROFILE', 'STRUCTURE'])),
      'GET /units': ok([unit(), unit({ id: 2, label: 'A-202', areaSqft: null })], 'OK', {
        pagination: { page: 1, limit: 6, total: 72, totalPages: 12 },
      }),
    });
    expect(await screen.findByText('72 flats generated')).toBeInTheDocument();
    expect(await screen.findByText('A-202')).toBeInTheDocument();
    expect(screen.getByText('Area missing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download template' })).toHaveAttribute(
      'href',
      '/templates/units-template.csv',
    );
  });

  it('skips an optional step with a reason and moves on', async () => {
    const api = renderIt({
      'GET /onboarding': ok(onboarding(['PROFILE', 'STRUCTURE', 'UNITS'])),
      'POST /onboarding/steps/RESIDENTS/skip': ok(
        onboarding(['PROFILE', 'STRUCTURE', 'UNITS'], ['RESIDENTS']),
      ),
      'GET /society/settings': ok({ items: [] }),
    });
    expect(await screen.findByRole('heading', { name: 'Residents' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: /Reason/ }), 'Will import after go-live');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Skip step' }));
    await waitFor(() => expect(api.last('POST', '/onboarding/steps/RESIDENTS/skip')).toBeTruthy());
    expect(api.last('POST', '/onboarding/steps/RESIDENTS/skip')!.body).toEqual({
      reason: 'Will import after go-live',
    });
    expect(await screen.findByText('Billing setup')).toBeInTheDocument();
  });

  it('does not offer Skip on required steps', async () => {
    renderIt();
    await screen.findByText(/step 1 of 8/);
    expect(screen.queryByRole('button', { name: 'Skip for now' })).not.toBeInTheDocument();
  });

  it('shows the step check message when a step is not finished', async () => {
    renderIt({
      'GET /onboarding': ok(onboarding(['PROFILE', 'STRUCTURE', 'UNITS'])),
      'POST /onboarding/steps/RESIDENTS/complete': err(422, 'ONBOARDING_STEP_INCOMPLETE', [
        { field: 'RESIDENTS', message: 'No owners linked yet' },
      ]),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as done' }));
    expect(await screen.findByText(/No owners linked yet/)).toBeInTheDocument();
  });

  it('saves billing settings on step 5', async () => {
    const api = renderIt({
      'GET /onboarding': ok(onboarding(['PROFILE', 'STRUCTURE', 'UNITS'], ['RESIDENTS'])),
      'GET /society/settings': ok({
        items: [
          setting('billing.billingDay', { value: 1, version: 0 }),
          setting('billing.dueDays', { value: 15, version: 0 }),
          setting('billing.lateFeeDefaultMode', { type: 'ENUM', value: 'NONE', version: 0 }),
          setting('billing.lateFeeGraceDays', { value: 5, version: 0 }),
        ],
      }),
      'PATCH /society/settings': ok({ items: [] }),
      'POST /onboarding/steps/BILLING/complete': ok(
        onboarding(['PROFILE', 'STRUCTURE', 'UNITS', 'BILLING'], ['RESIDENTS']),
      ),
    });
    const days = await screen.findByRole('spinbutton', { name: /Days to pay/ });
    await userEvent.clear(days);
    await userEvent.type(days, '9');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(api.last('POST', '/onboarding/steps/BILLING/complete')).toBeTruthy());
    expect(api.last('PATCH', '/society/settings')!.body).toEqual({
      changes: [{ key: 'billing.dueDays', value: 9, version: 0 }],
    });
  });

  it('keeps Go live disabled until every step is done or skipped', async () => {
    renderIt({
      'GET /onboarding': ok(
        onboarding(['PROFILE', 'STRUCTURE', 'UNITS', 'BILLING'], [], { currentStep: 'GO_LIVE' }),
      ),
    });
    await userEvent.click((await screen.findAllByRole('button', { name: /Go live/ }))[0]);
    expect(await screen.findByText('Go-live checklist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete required steps' })).toBeDisabled();
    expect(screen.getAllByText('Needed')).toHaveLength(3);
    expect(
      screen.getByText(/sends a welcome invite to every resident with a mobile number/),
    ).toBeInTheDocument();
  });

  it('lists the failing steps when go-live is refused', async () => {
    const ready = onboarding(
      ['PROFILE', 'STRUCTURE', 'UNITS', 'BILLING'],
      ['RESIDENTS', 'PAYMENTS', 'COMMITTEE'],
    );
    const api = renderIt({
      'GET /onboarding': ok({ ...ready, currentStep: 'GO_LIVE' }),
      'POST /onboarding/go-live': err(422, 'ONBOARDING_NOT_READY', [
        { field: 'UNITS', message: '12 billable units have no area' },
      ]),
    });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Go live' })).at(-1)!);
    expect(await screen.findByText(/Flats: 12 billable units have no area/)).toBeInTheDocument();
    expect(api.last('POST', '/onboarding/go-live')).toBeTruthy();
  });

  it('goes live and shows the live page', async () => {
    const ready = onboarding(
      ['PROFILE', 'STRUCTURE', 'UNITS', 'BILLING'],
      ['RESIDENTS', 'PAYMENTS', 'COMMITTEE'],
    );
    renderIt({
      'GET /onboarding': ok({ ...ready, currentStep: 'GO_LIVE' }),
      'POST /onboarding/go-live': ok({ ...ready, isLive: true, progressPercent: 100 }),
    });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Go live' })).at(-1)!);
    expect(await screen.findByText('Sky Heights CHS is live')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Today' })).toHaveAttribute('href', '/admin');
  });

  it('reopens a finished step', async () => {
    const api = renderIt({
      'GET /onboarding': ok(onboarding(['PROFILE'])),
      'POST /onboarding/steps/PROFILE/reopen': ok(onboarding()),
    });
    await screen.findByText(/Sky Heights CHS · step 2/);
    await userEvent.click(within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button')[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen step' }));
    await waitFor(() => expect(api.last('POST', '/onboarding/steps/PROFILE/reopen')).toBeTruthy());
  });

  it('is read only without settings.society.edit', async () => {
    renderIt({}, ['settings.society.view']);
    expect(await screen.findByRole('textbox', { name: /Society name/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save and continue' })).not.toBeInTheDocument();
  });

  it('shows no access without settings.society.view', async () => {
    renderIt({}, []);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('Setup banner on Today', () => {
  beforeEach(resetAll);

  it('shows progress until the society is live', async () => {
    signIn();
    mockApi({ 'GET /onboarding': ok(onboarding(['PROFILE'])) });
    render(<SetupBanner />);
    expect(await screen.findByText(/Setup in progress: step 2 of 8, 12% done/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue setup' })).toHaveAttribute('href', '/admin/setup');
  });

  it('is hidden once live', async () => {
    signIn();
    const api = mockApi({ 'GET /onboarding': ok(onboarding([], [], { isLive: true })) });
    render(<SetupBanner />);
    await waitFor(() => expect(api.last('GET', '/onboarding')).toBeTruthy());
    expect(screen.queryByText(/Setup in progress/)).not.toBeInTheDocument();
  });
});
