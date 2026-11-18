import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMM_FEATURES,
  COMM_PERMS,
  noticeItemRaw,
  noticeRaw,
  pagination,
  previewRaw,
  receiptsRaw,
} from '@/test/communicationFixtures';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { fakeUploader, signInAs } from '@/test/residentsHelpers';
import { ToastProvider } from '@/components/ui/Toast';
import { NoticesScreen } from './admin/NoticesScreen';
import { composerProblems, toInput } from './admin/NoticeComposer';
import { EMPTY_AUDIENCE, audienceInput } from './admin/AudienceBuilder';
import { isoToLocal, localToIso, noticeError, pct, stripTags } from './admin/format';
import { sanitizeNoticeHtml } from './admin/sanitize';
import { ApiError } from '@/lib/apiClient';

vi.mock('next/navigation', () => navigationMock());
beforeEach(() => {
  resetAll();
  signInAs(COMM_PERMS, COMM_FEATURES);
});

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const list = (items: unknown[] = [noticeItemRaw()]) => ({
  data: items,
  extra: { pagination: pagination(items.length) },
});
const baseRoutes = (items?: unknown[]) => ({
  'GET /notices': list(items),
  'GET /locations': ok([]),
  'GET /notices/templates': ok([]),
  'GET /collections': { data: [], extra: { pagination: pagination(0, 1) } },
});

describe('Notices list', () => {
  it('shows a card with its chips, excerpt, ack chip and read meter', async () => {
    mockApi(baseRoutes());
    wrap(<NoticesScreen />);
    const card = await screen.findByRole('button', { name: /Open Water cut Tower A/ });
    expect(within(card).getByText('Published')).toBeInTheDocument();
    expect(within(card).getByText('Maintenance')).toBeInTheDocument();
    expect(within(card).getByText('Ack required')).toBeInTheDocument();
    expect(within(card).getByText('70% read')).toBeInTheDocument();
    expect(within(card).getByText('29 acknowledged')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar', { name: 'Read' })).toHaveAttribute('aria-valuenow', '70');
  });

  it('shows audience, author and send time on a scheduled card instead of the meter', async () => {
    mockApi(
      baseRoutes([
        noticeItemRaw({ status: 'SCHEDULED', scheduledAt: '2026-12-01T04:30:00.000Z', requiresAck: false }),
      ]),
    );
    wrap(<NoticesScreen />);
    const card = await screen.findByRole('button', { name: /Open Water cut/ });
    expect(within(card).getByText('Scheduled')).toBeInTheDocument();
    expect(within(card).getByText(/Tower A · Arjun Shah · sends/)).toBeInTheDocument();
    expect(within(card).queryByTestId('read-meter')).not.toBeInTheDocument();
  });

  it('filters by segment, category and search with strict query names', async () => {
    const api = mockApi(baseRoutes());
    wrap(<NoticesScreen />);
    await screen.findByRole('button', { name: /Open Water cut/ });
    await userEvent.click(screen.getByRole('button', { name: 'Drafts' }));
    await waitFor(() =>
      expect(new URL(String(api.fn.mock.calls.at(-1)![0])).searchParams.get('status')).toBe('DRAFT'),
    );
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'FINANCE');
    await userEvent.type(screen.getByLabelText('Search'), 'wa');
    await waitFor(() => {
      const u = new URL(String(api.fn.mock.calls.at(-1)![0]));
      expect(u.searchParams.get('category')).toBe('FINANCE');
      expect(u.searchParams.get('q')).toBe('wa');
    });
    const u = new URL(String(api.fn.mock.calls.at(-1)![0]));
    expect([...u.searchParams.keys()].sort()).toEqual([
      'category',
      'limit',
      'page',
      'q',
      'sortBy',
      'sortOrder',
      'status',
    ]);
  });

  it('has the eight segments of the spec', async () => {
    mockApi(baseRoutes());
    wrap(<NoticesScreen />);
    const group = await screen.findByRole('group', { name: 'Notice views' });
    expect(
      within(group)
        .getAllByRole('button')
        .map(b => b.textContent),
    ).toEqual([
      'All',
      'Published',
      'Awaiting approval',
      'Scheduled',
      'Drafts',
      'Expired',
      'Recalled',
      'Archived',
    ]);
  });

  it('shows the empty state, and an error with retry', async () => {
    mockApi({ ...baseRoutes([]) });
    wrap(<NoticesScreen />);
    expect(await screen.findByText('No notices')).toBeInTheDocument();
    expect(screen.getByText('Write one and reach everyone in minutes.')).toBeInTheDocument();
  });

  it('shows an error with the reference and retries', async () => {
    const api = mockApi({ ...baseRoutes(), 'GET /notices': [err(500, 'INTERNAL_ERROR'), list()] });
    wrap(<NoticesScreen />);
    expect(await screen.findByText('Reference:', { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /Open Water cut/ })).toBeInTheDocument();
    expect(api.calls.filter(c => c.path === '/notices')).toHaveLength(2);
  });

  it('hides New notice without the create permission and shows the emergency slots', async () => {
    signInAs(['communication.notices.view'], COMM_FEATURES);
    mockApi(baseRoutes());
    wrap(
      <NoticesScreen emergencyAction={<button>Emergency broadcast</button>} banner={<p>Fire banner</p>} />,
    );
    await screen.findByRole('button', { name: /Open Water cut/ });
    expect(screen.queryByRole('button', { name: 'New notice' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emergency broadcast' })).toBeInTheDocument();
    expect(screen.getByText('Fire banner')).toBeInTheDocument();
  });
});

describe('Notice drawer', () => {
  const open = async (n: Record<string, unknown> = {}, extra: Record<string, never> = {}) => {
    const api = mockApi({
      ...baseRoutes(),
      'GET /notices/412': ok(noticeRaw(n)),
      'GET /notices/412/receipts': { data: receiptsRaw(), extra: { pagination: pagination(141, 8) } },
      ...extra,
    });
    wrap(<NoticesScreen />);
    await userEvent.click(await screen.findByRole('button', { name: /Open Water cut/ }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByRole('heading', { name: /Water cut Tower A/ });
    return { api, dlg };
  };

  it('renders the sanitised body and the details', async () => {
    const { dlg } = await open({ approvedBy: 'Sanjay Patil' });
    const body = within(dlg).getByTestId('notice-body');
    expect(body.querySelector('strong')).toHaveTextContent('Store water');
    expect(body.querySelector('script')).toBeNull();
    expect(within(dlg).getByText('Tower A', { selector: 'dd' })).toBeInTheDocument();
    expect(within(dlg).getByText(/Arjun Shah · approved by Sanjay Patil/)).toBeInTheDocument();
  });

  it('shows the three meters and tower bars, and the full table on View all', async () => {
    const { dlg } = await open();
    const rec = await within(dlg).findByRole('region', { name: 'Read receipts' });
    expect(await within(rec).findByRole('progressbar', { name: 'Reached' })).toBeInTheDocument();
    expect(within(rec).getByText('132 of 141')).toBeInTheDocument();
    expect(within(rec).getByText('101 of 141')).toBeInTheDocument();
    expect(within(rec).getByText('64 of 141')).toBeInTheDocument();
    expect(within(rec).getByText('51/64')).toBeInTheDocument();
    await userEvent.click(within(rec).getByRole('button', { name: 'View all' }));
    const table = within(rec).getByRole('table');
    expect(within(table).getByText('A-101')).toBeInTheDocument();
    expect(within(table).getByText('98XXXXX111')).toBeInTheDocument();
    expect(within(rec).getByRole('button', { name: 'Unreached' })).toBeInTheDocument();
  });

  it('filters receipts and exports the csv with the same filter and no paging', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const { api, dlg } = await open({}, { 'GET /notices/412/receipts/export': ok('csv') as never });
    const rec = await within(dlg).findByRole('region', { name: 'Read receipts' });
    await within(rec).findByRole('progressbar', { name: 'Reached' });
    await userEvent.click(within(rec).getByRole('button', { name: 'View all' }));
    await userEvent.click(within(rec).getByRole('button', { name: 'Not acknowledged' }));
    await waitFor(() =>
      expect(
        new URL(
          String(api.fn.mock.calls.filter(c => String(c[0]).includes('/receipts?')).at(-1)![0]),
        ).searchParams.get('filter'),
      ).toBe('NOT_ACKED'),
    );
    await userEvent.click(within(rec).getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/notices/412/receipts/export')).toBe(true));
  });

  it('hides Export CSV and Unreached without edit permission and plan', async () => {
    signInAs(['communication.notices.view'], ['communication.read_receipt_dashboard']);
    mockApi({
      ...baseRoutes(),
      'GET /notices/412': ok(noticeRaw()),
      'GET /notices/412/receipts': { data: receiptsRaw(), extra: { pagination: pagination() } },
    });
    wrap(<NoticesScreen />);
    await userEvent.click(await screen.findByRole('button', { name: /Open Water cut/ }));
    const rec = await screen.findByRole('region', { name: 'Read receipts' });
    await within(rec).findByRole('progressbar', { name: 'Reached' });
    await userEvent.click(within(rec).getByRole('button', { name: 'View all' }));
    expect(within(rec).queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    expect(within(rec).queryByRole('button', { name: 'Unreached' })).not.toBeInTheDocument();
  });

  it('offers actions by state: published', async () => {
    const { dlg } = await open();
    for (const n of ['Edit text', 'Remind unacknowledged', 'Pin', 'Recall', 'Archive', 'Duplicate'])
      expect(within(dlg).getByRole('button', { name: n })).toBeInTheDocument();
    expect(within(dlg).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(dlg).queryByRole('button', { name: 'Mark restored' })).not.toBeInTheDocument();
  });

  it('offers Withdraw and an approval link while waiting', async () => {
    const { dlg } = await open({
      status: 'PENDING_APPROVAL',
      approval: { requestId: 77, status: 'PENDING', statusLabel: 'Waiting for Chairman' },
    });
    expect(within(dlg).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    expect(within(dlg).getByTestId('approval-status')).toHaveTextContent('Waiting for Chairman');
    expect(within(dlg).getByRole('link', { name: 'Review and decide' })).toHaveAttribute(
      'href',
      '/admin/approvals/77',
    );
    expect(within(dlg).queryByRole('button', { name: 'Recall' })).not.toBeInTheDocument();
  });

  it('shows Mark restored for an unrestored utility notice', async () => {
    const { dlg } = await open({
      kind: 'UTILITY_SHUTDOWN',
      utility: {
        type: 'WATER',
        startsAt: '2026-12-01T04:30:00.000Z',
        endsAt: '2026-12-01T08:30:00.000Z',
        restoredAt: null,
      },
    });
    expect(within(dlg).getByRole('button', { name: 'Mark restored' })).toBeInTheDocument();
  });

  it('recalls only with a reason of 10 characters, sending notifyRecall', async () => {
    const { api, dlg } = await open(
      {},
      { 'POST /notices/412/recall': ok(noticeRaw({ status: 'RECALLED' })) as never },
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'Recall' }));
    const modal = await screen.findAllByRole('dialog').then(d => d.at(-1)!);
    const go = within(modal).getByRole('button', { name: 'Recall' });
    expect(go).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText(/Reason/), 'Wrong dat');
    expect(go).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText(/Reason/), 'e');
    await userEvent.click(within(modal).getByLabelText('Tell residents it was withdrawn'));
    await userEvent.click(go);
    await waitFor(() =>
      expect(api.last('POST', '/notices/412/recall')?.body).toEqual({
        version: 3,
        reason: 'Wrong date',
        notifyRecall: false,
      }),
    );
  });

  it('reminds, and shows the API wording when it is too soon', async () => {
    const { api, dlg } = await open(
      {},
      { 'POST /notices/412/remind': [err(422, 'NOTICE_REMIND_TOO_SOON'), ok({ queuedFor: 35 })] as never },
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'Remind unacknowledged' }));
    expect(await within(dlg).findByRole('alert')).toHaveTextContent(
      'A reminder went out in the last 6 hours',
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'Remind unacknowledged' }));
    await waitFor(() => expect(api.calls.filter(c => c.path === '/notices/412/remind')).toHaveLength(2));
    expect(api.last('POST', '/notices/412/remind')?.body).toEqual({ version: 3 });
  });

  it('pins with the current version', async () => {
    const { api, dlg } = await open(
      {},
      { 'POST /notices/412/pin': ok(noticeRaw({ isPinned: true })) as never },
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'Pin' }));
    await waitFor(() => expect(api.last('POST', '/notices/412/pin')?.body).toEqual({ version: 3 }));
  });

  it('shows a not found drawer when the notice is gone', async () => {
    mockApi({ ...baseRoutes(), 'GET /notices/412': err(404, 'NOTICE_NOT_FOUND') });
    wrap(<NoticesScreen />);
    await userEvent.click(await screen.findByRole('button', { name: /Open Water cut/ }));
    expect(await screen.findByText('Not found')).toBeInTheDocument();
  });
});

describe('Notice composer', () => {
  const openComposer = async (extra: Record<string, never> = {}) => {
    const api = mockApi({ ...baseRoutes(), 'POST /notices/audience-preview': ok(previewRaw()), ...extra });
    wrap(<NoticesScreen />);
    await screen.findByRole('button', { name: /Open Water cut/ });
    await userEvent.click(screen.getByRole('button', { name: 'New notice' }));
    const dlg = await screen.findByRole('dialog');
    return { api, dlg };
  };
  const type = (dlg: HTMLElement, html: string) => {
    const box = within(dlg).getByRole('textbox', { name: 'Message' });
    box.innerHTML = html;
    box.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('shows the validation messages of the spec on submit', async () => {
    const { dlg } = await openComposer();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit for approval' }));
    expect(await within(dlg).findByText('Add a title (5+ characters).')).toBeInTheDocument();
    expect(within(dlg).getByText('Write the message (10+ characters).')).toBeInTheDocument();
  });

  it('shows the live flat count for the audience', async () => {
    const { dlg } = await openComposer();
    expect(await within(dlg).findByText(/64 flats will receive this\./)).toBeInTheDocument();
  });

  it('saves a draft with the strict create body and an Idempotency-Key', async () => {
    const { api, dlg } = await openComposer({ 'POST /notices': ok(noticeRaw({ status: 'DRAFT' })) as never });
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Water cut in Tower A');
    type(dlg, '<p>Tank cleaning on Saturday.</p>');
    await userEvent.selectOptions(within(dlg).getByLabelText('Category'), 'MAINTENANCE');
    await userEvent.click(within(dlg).getByLabelText('Residents must acknowledge'));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.last('POST', '/notices')).toBeTruthy());
    expect(api.last('POST', '/notices')?.body).toEqual({
      kind: 'STANDARD',
      title: 'Water cut in Tower A',
      body: '<p>Tank cleaning on Saturday.</p>',
      category: 'MAINTENANCE',
      priority: 'NORMAL',
      locale: 'en-IN',
      audience: { type: 'ALL', relation: 'ANY' },
      channels: [],
      actions: [],
      requiresAck: true,
      isPinned: false,
      fileIds: [],
    });
    const call = api.fn.mock.calls.find(
      c => (c[1] as RequestInit)?.method === 'POST' && String(c[0]).endsWith('/notices'),
    )!;
    expect(new Headers((call[1] as RequestInit).headers).get('Idempotency-Key')).toBeTruthy();
    expect(api.calls.some(c => c.path.endsWith('/publish'))).toBe(false);
  });

  it('submits: creates, then publishes with the new version, and tells it was sent for approval', async () => {
    const { api, dlg } = await openComposer({
      'POST /notices': ok(noticeRaw({ id: 500, status: 'DRAFT', version: 1 })) as never,
      'POST /notices/500/publish': ok(
        noticeRaw({ id: 500, status: 'PENDING_APPROVAL', version: 2 }),
      ) as never,
    });
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Water cut in Tower A');
    type(dlg, '<p>Tank cleaning on Saturday.</p>');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.last('POST', '/notices/500/publish')?.body).toEqual({ version: 1 }));
    expect(await screen.findByText('Sent for approval')).toBeInTheDocument();
  });

  it('schedules for later and rejects a time less than 5 minutes ahead', async () => {
    const { api, dlg } = await openComposer();
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Water cut in Tower A');
    type(dlg, '<p>Tank cleaning on Saturday.</p>');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Schedule for later' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit for approval' }));
    expect(await within(dlg).findByText('Pick a time at least 5 minutes from now.')).toBeInTheDocument();
    expect(api.calls.some(c => c.method === 'POST' && c.path === '/notices')).toBe(false);
  });

  it('limits the buttons to two', async () => {
    const { dlg } = await openComposer();
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Water cut in Tower A');
    type(dlg, '<p>Tank cleaning on Saturday.</p>');
    await userEvent.click(within(dlg).getByLabelText('Pay dues'));
    await userEvent.click(within(dlg).getByLabelText('Link to a web page'));
    await userEvent.click(within(dlg).getByLabelText(/Pay \(a live collection\)/));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Submit for approval' }));
    expect(await within(dlg).findByText('Choose at most 2 buttons.')).toBeInTheDocument();
  });

  it('shows the API error text when the server refuses', async () => {
    const { dlg } = await openComposer({
      'POST /notices': err(
        402,
        'FEATURE_NOT_IN_PLAN',
        undefined,
        'Your plan does not include audience targeting.',
      ) as never,
    });
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Water cut in Tower A');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save draft' }));
    expect(
      await within(dlg).findByText('Your plan does not include audience targeting.'),
    ).toBeInTheDocument();
  });

  it('uploads attachments as NOTICE_ATTACHMENT and sends their ids, up to 5', async () => {
    fakeUploader();
    const { api, dlg } = await openComposer({ 'POST /notices': ok(noticeRaw({ status: 'DRAFT' })) as never });
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Water cut in Tower A');
    const input = within(dlg).getByLabelText('Attachments') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'quotes.pdf', { type: 'application/pdf' }));
    expect(await within(dlg).findByText('quotes.pdf')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect((api.last('POST', '/notices')?.body as { fileIds: number[] }).fileIds).toEqual([55]),
    );
  });

  it('prefills the form from a template', async () => {
    const { dlg } = await openComposer({
      'GET /notices/templates': ok([
        {
          key: 'water_cut',
          locale: 'en-IN',
          title: 'Water supply cut',
          body: '<p>No water between ...</p>',
          category: 'MAINTENANCE',
          kind: 'UTILITY_SHUTDOWN',
          utilityType: 'WATER',
        },
      ]) as never,
    });
    await userEvent.selectOptions(await within(dlg).findByLabelText('Start from a template'), 'water_cut');
    expect(within(dlg).getByLabelText('Title')).toHaveValue('Water supply cut');
    expect(within(dlg).getByLabelText('Outage starts')).toBeInTheDocument();
  });

  it('edits only text after publish and needs a note', async () => {
    const api = mockApi({
      ...baseRoutes(),
      'GET /notices/412': ok(noticeRaw()),
      'GET /notices/412/receipts': { data: receiptsRaw(), extra: { pagination: pagination() } },
      'PATCH /notices/412': ok(noticeRaw({ version: 4 })),
    });
    wrap(<NoticesScreen />);
    await userEvent.click(await screen.findByRole('button', { name: /Open Water cut/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit text' }));
    const dlg = await screen.findByRole('dialog', { name: 'Edit notice text' });
    expect(within(dlg).queryByLabelText('Category')).not.toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    expect(await within(dlg).findByText('Say what you changed (5+ characters).')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText('What did you change?'), 'Fixed the time');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PATCH', '/notices/412')).toBeTruthy());
    const body = api.last('PATCH', '/notices/412')!.body as Record<string, unknown>;
    expect(body).toMatchObject({ editNote: 'Fixed the time', version: 3, expiresAt: null });
    expect(Object.keys(body).sort()).toEqual([
      'body',
      'editNote',
      'expiresAt',
      'fileIds',
      'title',
      'version',
    ]);
  });
});

describe('Notice helpers', () => {
  const form = (over = {}) => ({
    title: 'Water cut in Tower A',
    body: '<p>Tank cleaning on Saturday.</p>',
    category: 'GENERAL' as const,
    priority: 'NORMAL' as const,
    locale: 'en-IN',
    kind: 'STANDARD' as const,
    utilityType: 'WATER',
    outageStartsAt: '',
    outageEndsAt: '',
    audience: EMPTY_AUDIENCE,
    channels: [],
    payCollection: false,
    collectionId: '',
    payDues: false,
    link: false,
    linkUrl: '',
    linkLabel: '',
    requiresAck: false,
    ackDueAt: '',
    isPinned: false,
    expiresAt: '',
    sendMode: 'ASAP' as const,
    scheduledAt: '',
    files: [],
    editNote: '',
    ...over,
  });
  it('accepts a complete notice and reports the spec wording otherwise', () => {
    expect(composerProblems(form())).toEqual({});
    expect(composerProblems(form({ title: 'abc', body: '<p>short</p>' }))).toMatchObject({
      title: 'Add a title (5+ characters).',
      body: 'Write the message (10+ characters).',
    });
    expect(
      composerProblems(form({ audience: { ...EMPTY_AUDIENCE, type: 'BUILDINGS' } })).audience,
    ).toBeTruthy();
    expect(composerProblems(form({ kind: 'UTILITY_SHUTDOWN' })).outage).toBeTruthy();
    expect(composerProblems(form({ link: true, linkUrl: 'http://x', linkLabel: 'Go' })).link).toBeTruthy();
  });
  it('builds action, ack, expiry and outage fields only when used', () => {
    const b = toInput(
      form({
        requiresAck: true,
        ackDueAt: '2026-12-01T10:00',
        payDues: true,
        link: true,
        linkUrl: 'https://a.in',
        linkLabel: 'Open',
      }),
    );
    expect(b.actions).toEqual([{ type: 'PAY_DUES' }, { type: 'LINK', url: 'https://a.in', label: 'Open' }]);
    expect(b.ackDueAt).toBeTruthy();
    expect('expiresAt' in b).toBe(false);
    expect('utilityType' in b).toBe(false);
    expect(
      'utilityType' in
        toInput(
          form({
            kind: 'UTILITY_SHUTDOWN',
            outageStartsAt: '2026-12-01T10:00',
            outageEndsAt: '2026-12-01T12:00',
          }),
        ),
    ).toBe(true);
  });
  it('maps each audience to the API shape and null while empty', () => {
    expect(audienceInput(EMPTY_AUDIENCE)).toEqual({ type: 'ALL', relation: 'ANY' });
    expect(
      audienceInput({ ...EMPTY_AUDIENCE, type: 'BUILDINGS', relation: 'OWNERS', buildingIds: [1, 2] }),
    ).toEqual({ type: 'BUILDINGS', relation: 'OWNERS', ids: [1, 2] });
    expect(audienceInput({ ...EMPTY_AUDIENCE, type: 'UNITS', units: [{ id: 5, label: 'A-5' }] })).toEqual({
      type: 'UNITS',
      relation: 'ANY',
      ids: [5],
    });
    expect(audienceInput({ ...EMPTY_AUDIENCE, type: 'ROLES', roleKeys: ['treasurer'] })).toEqual({
      type: 'ROLES',
      relation: 'ANY',
      roleKeys: ['treasurer'],
    });
    expect(audienceInput({ ...EMPTY_AUDIENCE, type: 'UNITS' })).toBeNull();
  });
  it('sanitises like the server allow-list', () => {
    const out = sanitizeNoticeHtml(
      '<p onclick="x()">Hi <b>there</b></p><img src=x><a href="javascript:alert(1)">bad</a><a href="https://a.in">ok</a><a href="/admin">in</a><script>1</script>',
    );
    expect(out).not.toMatch(/onclick|<img|javascript|<script/);
    expect(out).toContain('<b>there</b>');
    expect(out).toContain('href="https://a.in"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('href="/admin"');
  });
  it('formats percent, text, dates and API errors', () => {
    expect(pct(45, 64)).toBe(70);
    expect(pct(1, 0)).toBe(0);
    expect(stripTags('<p>a&nbsp;<b>b</b></p>')).toBe('a b');
    expect(isoToLocal(localToIso('2026-12-01T10:30'))).toBe('2026-12-01T10:30');
    expect(isoToLocal(null)).toBe('');
    expect(noticeError(new ApiError(409, 'STALE_VERSION', 'x'))).toMatch(/Someone changed this notice/);
    expect(
      noticeError(new ApiError(400, 'VALIDATION_FAILED', 'x', [{ field: 'title', message: 'Too short' }])),
    ).toBe('Too short');
    expect(noticeError(new ApiError(500, 'ODD', 'Odd thing'))).toBe('Odd thing');
  });
});
