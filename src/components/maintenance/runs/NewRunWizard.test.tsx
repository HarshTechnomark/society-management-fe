import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import {
  RUN_FEATURES,
  RUN_PERMS,
  cycleSettings,
  exceptionItemRaw,
  itemRaw,
  splitRateRulesRaw,
  runRaw,
  splitRulesRaw,
} from '@/test/billingRunsFixtures';
import { err, mockApi, navigationMock, ok, resetAll, router } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { NewRunWizard } from './NewRunWizard';
import { runPolling } from './useRunData';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const page = (items: unknown[]) =>
  ok(items, 'OK', { pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } });
const created = (over: object = {}) =>
  ok(
    {
      id: 88,
      runLabel: 'BR-2026-11',
      runType: 'REGULAR',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      billDate: '2026-11-01',
      status: 'DRAFT',
      version: 1,
      ...over,
    },
    'Billing run created; computing',
  );

function renderIt(routes: Routes = {}, perms = RUN_PERMS, features = RUN_FEATURES) {
  signInAs(perms, features);
  const api = mockApi({
    'GET /society/settings': ok(cycleSettings()),
    'GET /billing/rules': ok(splitRateRulesRaw()),
    'GET /billing/split-rules': ok(splitRulesRaw()),
    'POST /billing/runs': created(),
    'GET /billing/runs/88': ok(runRaw()),
    'GET /billing/runs/88/items': page([itemRaw()]),
    ...routes,
  });
  render(
    <ToastProvider>
      <NewRunWizard />
    </ToastProvider>,
  );
  return api;
}

const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }));
async function fillAndCreate() {
  await userEvent.type(await screen.findByLabelText(/Water tanker bill/), '84321');
  await next();
}
const toPreview = async () => {
  await fillAndCreate();
  await screen.findByRole('heading', { name: /Preview of BR-2026-11/ });
};

beforeEach(() => {
  resetAll();
  router.push.mockReset();
  runPolling.intervalMs = 3000;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28));
});
afterEach(() => vi.useRealTimers());

describe('New run wizard: step 1, heads', () => {
  it('defaults to the next period, shows approved rates read-only and the split input', async () => {
    renderIt();
    const period = await screen.findByLabelText('Billing period');
    expect(period).toHaveValue('2026-11-01');
    expect(within(period).getByRole('option', { name: 'November 2026 (next)' })).toBeInTheDocument();
    const rates = await screen.findByRole('list', { name: 'Approved rates' });
    expect(within(rates).getByText('₹3.20 per sq ft')).toBeInTheDocument();
    expect(within(rates).getByText('₹900 per flat')).toBeInTheDocument();
    expect(
      within(rates).getByText('Waiting for approval: ₹3.50 per sq ft from 2027-04-01'),
    ).toBeInTheDocument();
    expect(within(rates).queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('link', { name: /Change rates in Settings/ })).toHaveAttribute(
      'href',
      '/admin/settings/billing',
    );
    expect(await screen.findByLabelText(/Water tanker bill/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Fixed lift fund/)).toBeNull();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('1. Heads');
  });

  it('offers quarterly periods for a quarterly society', async () => {
    renderIt({ 'GET /society/settings': ok(cycleSettings('QUARTERLY')) });
    const period = await screen.findByLabelText('Billing period');
    await waitFor(() => expect(period).toHaveValue('2027-01-01'));
    expect(within(period).getByRole('option', { name: 'Jan 2027 to Mar 2027 (next)' })).toBeInTheDocument();
  });

  it('keeps going when the rates cannot be loaded, and warns when there are none', async () => {
    renderIt({ 'GET /billing/rules': err(403, 'PERMISSION_DENIED') });
    expect(await screen.findByText(/The rates could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('warns when no billing rule exists yet', async () => {
    renderIt({ 'GET /billing/rules': ok([]) });
    expect(await screen.findByText(/No billing rule is set up yet/)).toBeInTheDocument();
  });

  it('needs an amount for every run-input split rule, in rupees', async () => {
    const api = renderIt();
    await screen.findByLabelText(/Water tanker bill/);
    await next();
    expect(await screen.findByText(/Enter the total amount in rupees/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Water tanker bill/), '12.345');
    await next();
    expect(screen.getByText(/Enter the total amount in rupees/)).toBeInTheDocument();
    expect(api.last('POST', '/billing/runs')).toBeUndefined();
  });

  it('creates the run with paise, an idempotency key and moves to the preview', async () => {
    const api = renderIt();
    await fillAndCreate();
    await waitFor(() =>
      expect(api.last('POST', '/billing/runs')?.body).toEqual({
        runType: 'REGULAR',
        periodStart: '2026-11-01',
        splitInputs: [{ billSplitRuleId: 4, amountPaise: 8432100 }],
      }),
    );
    const call = api.fn.mock.calls.find(
      c => String(c[0]).endsWith('/billing/runs') && (c[1] as RequestInit).method === 'POST',
    )!;
    expect((call[1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': expect.any(String) });
    expect(
      await screen.findByRole('heading', { name: /Preview of BR-2026-11: November 2026/ }),
    ).toBeInTheDocument();
  });

  it.each([
    ['RUN_PERIOD_EXISTS', 409, /A billing run for this period already exists/],
    ['RUN_PERIOD_INVALID', 422, /This period cannot be billed/],
    ['RUN_PERIOD_TOO_FAR', 422, /at most one period ahead/],
    ['RUN_SPLIT_INPUT_MISSING', 422, /Enter the total amount for every split rule/],
    ['FEATURE_NOT_IN_PLAN', 402, /not part of your plan/],
    ['IDEMPOTENCY_KEY_REUSED', 409, /already sent with different details/],
    ['VALIDATION_FAILED', 400, /Some details are not valid/],
    ['PERMISSION_DENIED', 403, /do not have permission/],
    ['SOCIETY_SUSPENDED', 423, /suspended/],
  ])('shows %s on step 1 and stays there', async (code, status, text) => {
    renderIt({ 'POST /billing/runs': err(status, code) });
    await fillAndCreate();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('Cancel goes back to the list of runs', async () => {
    renderIt();
    await screen.findByLabelText('Billing period');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(router.push).toHaveBeenCalledWith('/admin/billing/runs');
  });

  it('an extra run needs the plan feature, and needs the building or flat numbers', async () => {
    const api = renderIt({ 'GET /billing/split-rules': ok([]) });
    await userEvent.selectOptions(await screen.findByLabelText('Run type'), 'SUPPLEMENTARY');
    await next();
    expect(await screen.findByText(/Enter 1 to 200 building numbers/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Building numbers'), '3, 4,4');
    await next();
    await waitFor(() =>
      expect(api.last('POST', '/billing/runs')?.body).toEqual({
        runType: 'SUPPLEMENTARY',
        periodStart: '2026-11-01',
        scopeType: 'BUILDINGS',
        scopeValues: [3, 4],
      }),
    );
  });

  it('does not show the run type without the supplementary feature', async () => {
    renderIt({}, RUN_PERMS, ['billing.billing_run_pipeline', 'billing.exceptions_report']);
    await screen.findByLabelText('Billing period');
    expect(screen.queryByLabelText('Run type')).toBeNull();
  });

  it('needs finance.billing.create', async () => {
    renderIt({}, ['finance.billing.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });
});

describe('New run wizard: step 2, preview', () => {
  it('shows a progress bar while computing and the preview when it is ready', async () => {
    runPolling.intervalMs = 20;
    renderIt({
      'GET /billing/runs/88': [
        ok(runRaw({ status: 'COMPUTING', counts: { items: 25 } })),
        ok(runRaw({ status: 'COMPUTING', counts: { items: 25 } })),
        ok(runRaw()),
      ],
    });
    await fillAndCreate();
    const bar = await screen.findByRole('progressbar', { name: 'Computing the run' });
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringContaining('25 flats done so far'));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(await screen.findByRole('heading', { name: /Preview of BR-2026-11/ })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByTestId('run-summary')).toHaveTextContent('₹3,33,631');
    expect(screen.getByTestId('run-change')).toHaveTextContent('+1.2 % higher');
    expect(await screen.findByText('A-101')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('2. Preview');
  });

  it('shows why a failed compute failed and lets you recompute', async () => {
    const api = renderIt({
      'GET /billing/runs/88': ok(runRaw({ status: 'FAILED', computeError: 'SPLIT_NO_ELIGIBLE_UNITS' })),
      'POST /billing/runs/88/recompute': ok(runRaw({ status: 'DRAFT', version: 4 })),
    });
    await fillAndCreate();
    expect(await screen.findByText(/A split rule has no flat to share its total with/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Recompute' }));
    await waitFor(() => expect(api.last('POST', '/billing/runs/88/recompute')?.body).toEqual({ version: 3 }));
    expect(await screen.findByRole('progressbar', { name: 'Computing the run' })).toBeInTheDocument();
  });

  it('blocks Continue while exceptions remain; excluding the flat unblocks it', async () => {
    const withException = runRaw({
      counts: { items: 73, ready: 71, exceptions: 1, excluded: 1, warnings: 0, skipped: 0, issued: 0 },
    });
    const api = renderIt({
      'GET /billing/runs/88': [ok(withException), ok(runRaw())],
      'GET /billing/runs/88/items': page([exceptionItemRaw()]),
      'POST /billing/runs/88/items/502/exclude': ok({}),
    });
    await fillAndCreate();
    expect(await screen.findByText(/1 flat needs attention/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(await screen.findByText(/Add the area of the flat/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exclude A-102' }));
    const d = await screen.findByRole('dialog');
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Area not measured yet');
    await userEvent.click(within(d).getByRole('button', { name: 'Exclude flat' }));
    await waitFor(() =>
      expect(api.last('POST', '/billing/runs/88/items/502/exclude')?.body).toEqual({
        reason: 'Area not measured yet',
        version: 1,
      }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
  });

  it('recomputes from the preview', async () => {
    const api = renderIt({ 'POST /billing/runs/88/recompute': ok(runRaw({ status: 'DRAFT', version: 4 })) });
    await toPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Recompute' }));
    await waitFor(() => expect(api.last('POST', '/billing/runs/88/recompute')).toBeDefined());
    expect(await screen.findByRole('progressbar', { name: 'Computing the run' })).toBeInTheDocument();
  });

  it('warns about a stale preview and blocks Continue', async () => {
    renderIt({ 'GET /billing/runs/88': ok(runRaw({ isStale: true })) });
    await toPreview();
    expect(screen.getAllByText(/changed after this (preview|run was computed)/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('blocks Continue when no flat is ready', async () => {
    renderIt({
      'GET /billing/runs/88': ok(
        runRaw({
          counts: { items: 3, ready: 0, exceptions: 0, excluded: 3, warnings: 0, skipped: 0, issued: 0 },
        }),
      ),
    });
    await toPreview();
    expect(screen.getByText('No flat is ready to be billed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('going back keeps the run: the period is fixed and a changed amount updates the run', async () => {
    const api = renderIt({ 'PATCH /billing/runs/88': ok(runRaw({ status: 'DRAFT', version: 4 })) });
    await toPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Billing period')).toBeDisabled();
    expect(screen.getByText(/already created/)).toBeInTheDocument();
    await next();
    await screen.findByRole('heading', { name: /Preview of BR-2026-11/ });
    expect(api.last('POST', '/billing/runs')).toBeDefined();
    expect(api.calls.filter(c => c.method === 'POST' && c.path === '/billing/runs')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    const field = screen.getByLabelText(/Water tanker bill/);
    expect(field).toHaveValue('84321');
    await userEvent.clear(field);
    await userEvent.type(field, '90000');
    await next();
    await waitFor(() =>
      expect(api.last('PATCH', '/billing/runs/88')?.body).toEqual({
        version: 3,
        splitInputs: [{ billSplitRuleId: 4, amountPaise: 9000000 }],
        notes: '',
      }),
    );
  });
});

describe('New run wizard: step 3, confirm', () => {
  const toConfirm = async () => {
    await toPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    return screen.findByLabelText(/Type BR-2026-11 to confirm/);
  };

  it('asks for a different approver and the run label before submitting', async () => {
    const api = renderIt();
    const box = await toConfirm();
    expect(screen.getByText(/A different committee member must approve this run/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('3. Confirm');
    await userEvent.type(box, 'BR-2026-1');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(screen.getByText('Type BR-2026-11 exactly.')).toBeInTheDocument();
    expect(api.last('POST', '/billing/runs/88/publish')).toBeUndefined();
  });

  it('submits with label and version, then shows the result and the approvals link', async () => {
    const api = renderIt({
      'POST /billing/runs/88/publish': ok(runRaw({ status: 'PENDING_APPROVAL', approvalRequestId: 5 })),
    });
    const box = await toConfirm();
    await userEvent.type(box, 'BR-2026-11');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const result = await screen.findByTestId('publish-result');
    expect(api.last('POST', '/billing/runs/88/publish')?.body).toEqual({
      confirmLabel: 'BR-2026-11',
      version: 3,
      previewHash: 'a'.repeat(64),
    });
    expect(result).toHaveTextContent('BR-2026-11 was submitted.');
    expect(within(result).getByRole('link', { name: 'Open in approvals' })).toHaveAttribute(
      'href',
      '/admin/dev-approvals',
    );
    expect(within(result).getByRole('link', { name: 'Open the run' })).toHaveAttribute(
      'href',
      '/admin/billing/runs/88',
    );
  });

  it('shows RUN_STALE and goes back to the preview through Recompute now', async () => {
    renderIt({
      'POST /billing/runs/88/publish': err(409, 'RUN_STALE'),
      'POST /billing/runs/88/recompute': ok(runRaw({ status: 'DRAFT', version: 4 })),
    });
    const box = await toConfirm();
    await userEvent.type(box, 'BR-2026-11');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByText(/Rates, settings or resident details changed/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recompute now' }));
    expect(await screen.findByRole('progressbar', { name: 'Computing the run' })).toBeInTheDocument();
  });

  it('shows a refused submit without leaving step 3, and Back returns to the preview', async () => {
    renderIt({ 'POST /billing/runs/88/publish': err(422, 'RUN_HAS_EXCEPTIONS') });
    const box = await toConfirm();
    await userEvent.type(box, 'BR-2026-11');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByText(/Some flats still need attention/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: /Preview of BR-2026-11/ })).toBeInTheDocument();
  });
});
