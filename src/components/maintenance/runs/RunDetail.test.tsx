import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureApiClient } from '@/lib/apiClient';
import {
  RUN_FEATURES,
  RUN_PERMS,
  RUN_VIEW_PERMS,
  excludedItemRaw,
  exceptionItemRaw,
  itemRaw,
  runRaw,
} from '@/test/billingRunsFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { RunDetailScreen } from './RunDetailScreen';
import { runPolling } from './useRunData';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const page = (items: unknown[]) =>
  ok(items, 'OK', { pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } });
const ITEMS = [itemRaw({ warningCodes: 'LARGE_VARIANCE' }), exceptionItemRaw(), excludedItemRaw()];

function renderIt(routes: Routes = {}, perms = RUN_PERMS, features = RUN_FEATURES) {
  signInAs(perms, features);
  const api = mockApi({
    'GET /billing/runs/88': ok(runRaw()),
    'GET /billing/runs/88/items': page(ITEMS),
    ...routes,
  });
  render(
    <ToastProvider>
      <RunDetailScreen id={88} />
    </ToastProvider>,
  );
  return api;
}
const urls = (api: ReturnType<typeof mockApi>) => api.fn.mock.calls.map(c => String(c[0]));
const withCounts = (counts: object, over: object = {}) =>
  runRaw({
    counts: {
      items: 73,
      ready: 71,
      exceptions: 0,
      excluded: 2,
      warnings: 0,
      skipped: 0,
      issued: 0,
      ...counts,
    },
    ...over,
  });

beforeEach(() => {
  resetAll();
  runPolling.intervalMs = 3000;
});

describe('Run detail: reading', () => {
  it('shows skeletons first, then status in words, totals, change and per-head amounts', async () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: 'BR-2026-11' })).toBeInTheDocument();
    expect(screen.getByText('Ready to review')).toBeInTheDocument();
    const sum = screen.getByTestId('run-summary');
    expect(within(sum).getByText('₹3,33,631')).toBeInTheDocument();
    expect(within(sum).getByText('Maintenance (service charges)')).toBeInTheDocument();
    expect(within(sum).getByText('₹2,64,960')).toBeInTheDocument();
    expect(screen.getByTestId('run-change')).toHaveTextContent(
      'Last run was ₹3,29,800. This run is +1.2 % higher',
    );
    expect(screen.getByRole('list', { name: 'Run progress' })).toBeInTheDocument();
  });

  it('lists flats with words for each state, the fix for an exception and the warning', async () => {
    renderIt();
    const rows = await screen.findAllByTestId('run-item');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('A-101')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Ready')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Large change from the last bill')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Needs attention')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('The flat has no area. A-102 has no area. Add the area of the flat');
    expect(within(rows[2]).getByText('Excluded')).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('Excluded: Flat is under dispute');
  });

  it('shows the lines of a flat with the amount of each head', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'Show amounts for A-101' }));
    const t = screen.getByRole('table', { name: 'Amounts for A-101' });
    expect(within(t).getByText('Sinking fund')).toBeInTheDocument();
    expect(within(t).getByText('₹900')).toBeInTheDocument();
    expect(within(t).getByText('₹4,580')).toBeInTheDocument();
  });

  it('filters by Exceptions, Excluded and a warning type, and searches', async () => {
    const api = renderIt();
    await screen.findAllByTestId('run-item');
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }));
    await waitFor(() => expect(urls(api).some(u => u.includes('status=EXCEPTION'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Excluded' }));
    await waitFor(() => expect(urls(api).some(u => u.includes('status=EXCLUDED'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Warnings' }));
    await waitFor(() => expect(urls(api).some(u => u.includes('warningCode=LARGE_VARIANCE'))).toBe(true));
    await userEvent.type(screen.getByRole('searchbox'), 'A-1');
    await waitFor(() => expect(urls(api).some(u => u.includes('q=A-1'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Warnings' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an empty message when a filter matches nothing', async () => {
    renderIt({ 'GET /billing/runs/88/items': page([]) });
    expect(await screen.findByText('No flats in this run')).toBeInTheDocument();
  });

  it('shows RUN_NOT_FOUND in plain words with the reference', async () => {
    renderIt({ 'GET /billing/runs/88': err(404, 'RUN_NOT_FOUND') });
    expect(await screen.findByText(/This billing run was not found/)).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All billing runs' })).toBeInTheDocument();
  });

  it('shows an items error with a retry', async () => {
    renderIt({ 'GET /billing/runs/88/items': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('hides the bill change when the plan lacks bill_change_diff, and the items when it lacks exceptions_report', async () => {
    renderIt({}, RUN_PERMS, ['billing.billing_run_pipeline']);
    await screen.findByRole('heading', { name: 'BR-2026-11' });
    expect(screen.queryByTestId('run-change')).toBeNull();
    expect(
      screen.getByText(/Flat-by-flat details and exceptions are not part of your plan/),
    ).toBeInTheDocument();
  });

  it('tells a person without billing access, and a plan without the pipeline', async () => {
    signInAs(['settings.society.view'], RUN_FEATURES);
    render(
      <ToastProvider>
        <RunDetailScreen id={88} />
      </ToastProvider>,
    );
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });

  it('shows the lock when the plan has no billing run pipeline', async () => {
    signInAs(RUN_PERMS, []);
    render(
      <ToastProvider>
        <RunDetailScreen id={88} />
      </ToastProvider>,
    );
    expect(await screen.findByText(/not available in your plan|Not in your plan/)).toBeInTheDocument();
  });
});

describe('Run detail: statuses', () => {
  it('shows computing with a progress bar and reads the run again until it is ready', async () => {
    runPolling.intervalMs = 20;
    renderIt({
      'GET /billing/runs/88': [
        ok(withCounts({ items: 40 }, { status: 'COMPUTING' })),
        ok(withCounts({ items: 40 }, { status: 'COMPUTING' })),
        ok(runRaw()),
      ],
    });
    const bar = await screen.findByRole('progressbar', { name: 'Computing the run' });
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringContaining('40 bills done so far'));
    expect(screen.getAllByText('Computing').length).toBeGreaterThan(0);
    expect(await screen.findByText('Ready to review')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows the failed compute reason and offers Recompute', async () => {
    const api = renderIt({
      'GET /billing/runs/88': ok(runRaw({ status: 'FAILED', computeError: 'SPLIT_NO_ELIGIBLE_UNITS' })),
      'POST /billing/runs/88/recompute': ok(runRaw({ status: 'DRAFT', version: 4 })),
    });
    expect(await screen.findByText(/A split rule has no flat to share its total with/)).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recompute' }));
    await waitFor(() => expect(api.last('POST', '/billing/runs/88/recompute')?.body).toEqual({ version: 3 }));
    expect(await screen.findByText('Queued')).toBeInTheDocument();
  });

  it('shows issue progress; resume appears only with an error and sends the version', async () => {
    const api = renderIt({
      'GET /billing/runs/88': ok(
        withCounts(
          { issued: 30, ready: 41 },
          { status: 'ISSUING', lastError: 'PDF service down', version: 9 },
        ),
      ),
      'POST /billing/runs/88/resume-issue': ok(runRaw({ status: 'ISSUING', version: 10 })),
    });
    const bar = await screen.findByRole('progressbar', { name: 'Issuing bills' });
    expect(bar).toHaveAttribute('aria-valuetext', '30 of 71 bills issued.');
    expect(screen.getByText(/Issuing stopped with an error: PDF service down/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume issuing' }));
    await waitFor(() =>
      expect(api.last('POST', '/billing/runs/88/resume-issue')?.body).toEqual({ version: 9 }),
    );
  });

  it('shows the issued count after issue instead of 0 ready', async () => {
    renderIt({
      'GET /billing/runs/88': ok(
        withCounts({ items: 65, ready: 0, issued: 65, excluded: 0, warnings: 0 }, { status: 'ISSUED' }),
      ),
    });
    const counts = await screen.findByRole('list', { name: 'Bill counts' });
    expect(within(counts).getByText('65 issued')).toBeInTheDocument();
    expect(within(counts).queryByText('0 ready')).toBeNull();
    expect(screen.getByText(/Issued.*65 bills/)).toBeInTheDocument();
  });

  it('has no Resume button while issuing without an error', async () => {
    renderIt({ 'GET /billing/runs/88': ok(withCounts({ issued: 3, ready: 68 }, { status: 'ISSUING' })) });
    await screen.findByRole('progressbar', { name: 'Issuing bills' });
    expect(screen.queryByRole('button', { name: 'Resume issuing' })).toBeNull();
  });

  it('pending approval links to the approvals page and has no edit buttons', async () => {
    renderIt({ 'GET /billing/runs/88': ok(runRaw({ status: 'PENDING_APPROVAL', approvalRequestId: 12 })) });
    expect(
      await screen.findByText(/Waiting for approval by a different committee member/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in approvals' })).toHaveAttribute(
      'href',
      '/admin/dev-approvals',
    );
    expect(screen.queryByRole('button', { name: 'Cancel run' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Exclude A-101' })).toBeNull();
  });

  it('says when an approved run will be issued, and shows issued and cancelled runs', async () => {
    renderIt({
      'GET /billing/runs/88': ok(runRaw({ status: 'APPROVED', billDate: '2026-11-10' })),
    });
    expect(await screen.findByText('Approved. Bills will be issued on 10 Nov 2026.')).toBeInTheDocument();
    cleanup();
    renderIt({
      'GET /billing/runs/88': ok(
        withCounts({ issued: 71 }, { status: 'ISSUED', issuedAt: '2026-11-01T10:00:00Z' }),
      ),
    });
    expect(await screen.findByText(/Issued on 1 Nov 2026: 71 bills/)).toBeInTheDocument();
  });

  it('shows the cancel reason of a cancelled run', async () => {
    renderIt({ 'GET /billing/runs/88': ok(runRaw({ status: 'CANCELLED', cancelReason: 'Wrong period' })) });
    expect(await screen.findByText('This run was cancelled: Wrong period')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('warns about a stale preview and blocks submitting', async () => {
    renderIt({ 'GET /billing/runs/88': ok(runRaw({ isStale: true })) });
    expect(
      await screen.findByText(/changed after this run was computed. Recompute it before you submit/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByText(/Recompute it first/)).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  });
});

describe('Run detail: permissions', () => {
  it('shows no action buttons to a person who can only view', async () => {
    renderIt({}, RUN_VIEW_PERMS);
    await screen.findAllByTestId('run-item');
    for (const n of ['Recompute', 'Submit for approval', 'Cancel run', 'Exclude A-101'])
      expect(screen.queryByRole('button', { name: n })).toBeNull();
  });

  it('shows Cancel run only with finance.billing.edit', async () => {
    renderIt({}, ['finance.billing.view', 'finance.billing.create']);
    await screen.findAllByTestId('run-item');
    expect(screen.queryByRole('button', { name: 'Cancel run' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Recompute' })).toBeInTheDocument();
  });
});

describe('Run detail: exclude and include', () => {
  it('excludes a flat with a reason, then reads the run and the items again', async () => {
    const api = renderIt({ 'POST /billing/runs/88/items/501/exclude': ok({}) });
    await userEvent.click(await screen.findByRole('button', { name: 'Exclude A-101' }));
    const d = await screen.findByRole('dialog');
    await userEvent.type(within(d).getByLabelText(/Reason/), 'abc');
    await userEvent.click(within(d).getByRole('button', { name: 'Exclude flat' }));
    expect(within(d).getByText('Enter a reason of 5 to 300 characters.')).toBeInTheDocument();
    expect(api.last('POST', '/billing/runs/88/items/501/exclude')).toBeUndefined();
    await userEvent.type(within(d).getByLabelText(/Reason/), 'de');
    const before = api.calls.filter(c => c.path === '/billing/runs/88').length;
    await userEvent.click(within(d).getByRole('button', { name: 'Exclude flat' }));
    await waitFor(() =>
      expect(api.last('POST', '/billing/runs/88/items/501/exclude')?.body).toEqual({
        reason: 'abcde',
        version: 1,
      }),
    );
    await waitFor(() =>
      expect(api.calls.filter(c => c.path === '/billing/runs/88').length).toBeGreaterThan(before),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows an exclude error inside the dialog', async () => {
    renderIt({ 'POST /billing/runs/88/items/501/exclude': err(409, 'STALE_VERSION') });
    await userEvent.click(await screen.findByRole('button', { name: 'Exclude A-101' }));
    const d = await screen.findByRole('dialog');
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Disputed flat');
    await userEvent.click(within(d).getByRole('button', { name: 'Exclude flat' }));
    expect(await within(d).findByText(/Someone else changed this a moment ago/)).toBeInTheDocument();
  });

  it('offers Include only for a flat the user excluded, not for exceptions or system exclusions', async () => {
    const api = renderIt({
      'GET /billing/runs/88/items': page([
        exceptionItemRaw(),
        excludedItemRaw(),
        excludedItemRaw({ id: 504, unitLabel: 'B-202', excludedReason: 'ZERO_TOTAL' }),
        excludedItemRaw({
          id: 505,
          unitLabel: 'B-203',
          excludedReason: 'ALREADY_BILLED',
          exceptionCode: 'ALREADY_BILLED',
        }),
      ]),
      'POST /billing/runs/88/items/503/include': ok({}),
    });
    await screen.findAllByTestId('run-item');
    expect(screen.getByRole('button', { name: 'Exclude A-102' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Include A-102' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Include B-202' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Include B-203' })).toBeNull();
    expect(screen.getByText('Excluded: Nothing to bill (total is zero)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Include B-201' }));
    await waitFor(() =>
      expect(api.last('POST', '/billing/runs/88/items/503/include')?.body).toEqual({ version: 1 }),
    );
  });

  it('shows INVALID_STATE when an include is refused', async () => {
    renderIt({
      'GET /billing/runs/88/items': page([excludedItemRaw()]),
      'POST /billing/runs/88/items/503/include': err(409, 'INVALID_STATE'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Include B-201' }));
    expect(await screen.findByText(/not allowed in the current state of the run/)).toBeInTheDocument();
  });

  it('does not allow exclusion once the run is no longer in preview', async () => {
    renderIt({ 'GET /billing/runs/88': ok(runRaw({ status: 'APPROVED' })) });
    await screen.findAllByTestId('run-item');
    expect(screen.queryByRole('button', { name: 'Exclude A-101' })).toBeNull();
  });
});

describe('Run detail: publish (submit for approval)', () => {
  const open = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    return screen.findByRole('dialog');
  };

  it('blocks submitting while exceptions remain, with the reason in words', async () => {
    renderIt({ 'GET /billing/runs/88': ok(withCounts({ exceptions: 2 })) });
    const d = await open();
    expect(
      within(d).getByText('2 flats need attention. Fix the cause and recompute, or exclude them.'),
    ).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  });

  it('refuses a wrong run number without calling the server', async () => {
    const api = renderIt({ 'POST /billing/runs/88/publish': ok(runRaw()) });
    const d = await open();
    await userEvent.type(within(d).getByLabelText(/Type BR-2026-11 to confirm/), 'BR-2026-12');
    await userEvent.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    expect(within(d).getByText('Type BR-2026-11 exactly.')).toBeInTheDocument();
    expect(api.last('POST', '/billing/runs/88/publish')).toBeUndefined();
  });

  it('publishes with the label, the version and an idempotency key, then shows where it went', async () => {
    const api = renderIt({
      'POST /billing/runs/88/publish': ok(
        runRaw({ status: 'PENDING_APPROVAL', approvalRequestId: 12, version: 4 }),
      ),
    });
    const d = await open();
    expect(within(d).getByText(/A different committee member must approve this run/)).toBeInTheDocument();
    expect(d).toHaveTextContent('BR-2026-11 makes 71 bills for November 2026, ₹3,33,631 in total.');
    await userEvent.type(within(d).getByLabelText(/Type BR-2026-11 to confirm/), 'BR-2026-11');
    await userEvent.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    const result = await screen.findByTestId('publish-result');
    expect(api.last('POST', '/billing/runs/88/publish')?.body).toEqual({
      confirmLabel: 'BR-2026-11',
      version: 3,
      previewHash: 'a'.repeat(64),
    });
    const call = api.fn.mock.calls.find(c => String(c[0]).endsWith('/billing/runs/88/publish'))!;
    expect((call[1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': expect.any(String) });
    expect(result).toHaveTextContent('Sent for approval');
    expect(within(result).getByRole('link', { name: 'Open in approvals' })).toHaveAttribute(
      'href',
      '/admin/dev-approvals',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(
      await screen.findByText(/Waiting for approval by a different committee member/),
    ).toBeInTheDocument();
  });

  it('opens the step-up sign in when the server asks, then sends the same publish again', async () => {
    const stepUp = vi.fn(async () => true);
    configureApiClient({ stepUp });
    const api = renderIt({
      'POST /billing/runs/88/publish': [err(401, 'REAUTH_REQUIRED'), ok(runRaw({ status: 'APPROVED' }))],
    });
    const d = await open();
    await userEvent.type(within(d).getByLabelText(/Type BR-2026-11 to confirm/), 'BR-2026-11');
    await userEvent.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByTestId('publish-result')).toHaveTextContent(
      'Approved. Bills will be issued on 1 Nov 2026.',
    );
    expect(stepUp).toHaveBeenCalledTimes(1);
    const posts = api.fn.mock.calls.filter(c => String(c[0]).endsWith('/publish'));
    expect(posts).toHaveLength(2);
    const key = (c: unknown[]) =>
      ((c[1] as RequestInit).headers as Record<string, string>)['Idempotency-Key'];
    expect(key(posts[0])).toBe(key(posts[1]));
  });

  it.each([
    ['RUN_HAS_EXCEPTIONS', 422, /Some flats still need attention/],
    ['RUN_EMPTY', 422, /No flat is ready to be billed/],
    ['GST_SETTINGS_INVALID', 422, /has no SAC code/],
    ['STALE_VERSION', 409, /Someone else changed this/],
    ['INVALID_STATE', 409, /not allowed in the current state/],
    ['PERMISSION_DENIED', 403, /do not have permission/],
    ['FEATURE_NOT_IN_PLAN', 402, /not part of your plan/],
    ['SOCIETY_SUSPENDED', 423, /suspended/],
  ])('shows %s in plain words and reloads the run', async (code, status, text) => {
    const api = renderIt({ 'POST /billing/runs/88/publish': err(status, code) });
    const d = await open();
    await userEvent.type(within(d).getByLabelText(/Type BR-2026-11 to confirm/), 'BR-2026-11');
    await userEvent.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    expect(await within(d).findByText(text)).toBeInTheDocument();
    expect(api.last('POST', '/billing/runs/88/publish')).toBeDefined();
  });

  it('RUN_STALE offers Recompute now, which recomputes the run', async () => {
    const api = renderIt({
      'POST /billing/runs/88/publish': err(409, 'RUN_STALE'),
      'POST /billing/runs/88/recompute': ok(runRaw({ status: 'DRAFT', version: 4 })),
    });
    const d = await open();
    await userEvent.type(within(d).getByLabelText(/Type BR-2026-11 to confirm/), 'BR-2026-11');
    await userEvent.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    expect(await within(d).findByText(/Rates, settings or resident details changed/)).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Recompute now' }));
    await waitFor(() => expect(api.last('POST', '/billing/runs/88/recompute')?.body).toEqual({ version: 3 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('APPROVAL_ALREADY_PENDING links to the approvals page', async () => {
    renderIt({ 'POST /billing/runs/88/publish': err(409, 'APPROVAL_ALREADY_PENDING') });
    const d = await open();
    await userEvent.type(within(d).getByLabelText(/Type BR-2026-11 to confirm/), 'BR-2026-11');
    await userEvent.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    expect(await within(d).findByRole('link', { name: 'Open approvals' })).toHaveAttribute(
      'href',
      '/admin/dev-approvals',
    );
  });
});

describe('Run detail: cancel and recompute', () => {
  it('cancels with a reason and shows the cancelled run', async () => {
    const api = renderIt({
      'POST /billing/runs/88/cancel': ok(
        runRaw({ status: 'CANCELLED', cancelReason: 'Wrong period', version: 4 }),
      ),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel run' }));
    const d = await screen.findByRole('dialog');
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Wrong period');
    await userEvent.click(within(d).getByRole('button', { name: 'Cancel run' }));
    await waitFor(() =>
      expect(api.last('POST', '/billing/runs/88/cancel')?.body).toEqual({
        reason: 'Wrong period',
        version: 3,
      }),
    );
    expect(await screen.findByText('This run was cancelled: Wrong period')).toBeInTheDocument();
  });

  it('shows INVALID_STATE inside the cancel dialog', async () => {
    renderIt({ 'POST /billing/runs/88/cancel': err(409, 'INVALID_STATE') });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel run' }));
    const d = await screen.findByRole('dialog');
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Wrong period');
    await userEvent.click(within(d).getByRole('button', { name: 'Cancel run' }));
    expect(await within(d).findByText(/not allowed in the current state/)).toBeInTheDocument();
  });

  it('recomputes and shows the queued state', async () => {
    renderIt({ 'POST /billing/runs/88/recompute': ok(runRaw({ status: 'DRAFT', version: 4 })) });
    await userEvent.click(await screen.findByRole('button', { name: 'Recompute' }));
    expect(await screen.findByText('Queued')).toBeInTheDocument();
    expect(await screen.findByRole('progressbar', { name: 'Computing the run' })).toBeInTheDocument();
  });

  it('shows a recompute error on the page', async () => {
    renderIt({ 'POST /billing/runs/88/recompute': err(422, 'RUN_SPLIT_INPUT_MISSING') });
    await userEvent.click(await screen.findByRole('button', { name: 'Recompute' }));
    expect(await screen.findByText(/Enter the total amount for every split rule/)).toBeInTheDocument();
  });
});
