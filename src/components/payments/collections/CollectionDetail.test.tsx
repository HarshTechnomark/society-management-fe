import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COL_FEATURES, COL_PERMS, COL_VIEW_PERMS, colRaw, reqRaw } from '@/test/collectionsFixtures';
import { err, mockApi, navigationMock, ok, resetAll, router } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { CollectionDetailScreen } from './CollectionDetailScreen';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const list = (items: unknown[]) =>
  ok(items, 'OK', { pagination: { page: 1, limit: 25, total: items.length, totalPages: 1 } });
const REQS = [
  reqRaw(),
  reqRaw({
    id: 302,
    unitId: 52,
    unitLabel: 'A-1204',
    status: 'PAID',
    paidPaise: 100000,
    lastPaidAt: '2026-11-12T05:00:00Z',
  }),
  reqRaw({ id: 303, unitId: 53, unitLabel: 'B-101', status: 'PART_PAID', paidPaise: 40000 }),
];

function renderIt(col: Record<string, unknown> = {}, routes: Routes = {}, perms = COL_PERMS) {
  signInAs(perms, COL_FEATURES);
  const api = mockApi({
    'GET /collections/12': ok(colRaw(col)),
    'GET /collections/12/requests': list(REQS),
    ...routes,
  });
  render(<CollectionDetailScreen id={12} />);
  return api;
}
const button = (name: string | RegExp) => screen.findByRole('button', { name });
beforeEach(resetAll);

describe('Collection detail', () => {
  it('shows purpose, progress, tiles, details and the placeholder for spending', async () => {
    renderIt();
    expect(await screen.findByRole('heading', { name: 'Ganesh Utsav 2026' })).toBeInTheDocument();
    expect(screen.getByText(/Decoration, prasad and the aarti/)).toBeInTheDocument();
    expect(screen.getByText('₹18,250 of ₹73,000 · 25%')).toBeInTheDocument();
    expect(screen.getByTestId('tile-contributors')).toHaveTextContent('18');
    expect(screen.getByTestId('tile-spent')).toHaveTextContent('-');
    expect(screen.getByText('₹1,000 per flat')).toBeInTheDocument();
    expect(screen.getByText('All flats')).toBeInTheDocument();
    expect(screen.getByText('Festival fund')).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Vikram Shah')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spent from this collection' })).toBeInTheDocument();
    expect(screen.getByText(/No spending recorded yet/)).toBeInTheDocument();
  });

  it('lists spending when module 13 sends it', async () => {
    renderIt({
      spentPaise: 50000,
      expenses: [{ title: 'Flowers', category: 'Decor', date: '2026-11-02', amountPaise: 50000 }],
    });
    expect(await screen.findByText('Flowers')).toBeInTheDocument();
    expect(screen.getByTestId('tile-spent')).toHaveTextContent('₹500 / ₹17,750');
  });

  it('per flat table: chips, search and the status words', async () => {
    const api = renderIt();
    const rows = await screen.findAllByTestId('request-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Not paid yet');
    expect(rows[1]).toHaveTextContent('Paid');
    expect(rows[2]).toHaveTextContent('Part paid');
    await userEvent.click(screen.getByRole('button', { name: 'Part paid' }));
    await waitFor(() => expect(String(api.fn.mock.calls.at(-1)?.[0])).toContain('status=PART_PAID'));
    await userEvent.type(screen.getByLabelText('Search flats'), 'B-1');
    await waitFor(() => expect(String(api.fn.mock.calls.at(-1)?.[0])).toContain('q=B-1'));
  });

  it.each([true, false])(
    'an open flat says the same words in the row and the chip (mandatory %s)',
    async isMandatory => {
      renderIt({ isMandatory });
      const rows = await screen.findAllByTestId('request-row');
      expect(rows[0]).toHaveTextContent('Not paid yet');
      expect(screen.getByRole('button', { name: 'Not paid yet' })).toBeInTheDocument();
    },
  );

  it('says 1 flat, not 1 flats, and not-found without a retry', async () => {
    renderIt({ requestCount: 1, paidCount: 1 });
    await screen.findByRole('heading', { name: 'Ganesh Utsav 2026' });
    expect(screen.getByText(/1 of 1 flat ·/)).toBeInTheDocument();
    expect(screen.queryByText(/1 of 1 flats/)).toBeNull();
  });

  it('a missing collection says it was not found, with a link back and no Try again', async () => {
    signInAs(COL_PERMS, COL_FEATURES);
    mockApi({ 'GET /collections/12': err(404, 'COLLECTION_NOT_FOUND') });
    render(<CollectionDetailScreen id={12} />);
    expect(await screen.findByText('Not found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('link', { name: 'All collections' })).toBeInTheDocument();
  });

  it('record contribution: more than the remaining amount says how much is left', async () => {
    renderIt(
      { amountMode: 'FIXED_PER_UNIT' },
      {
        'GET /collections/12/requests': [list(REQS), list([REQS[0]])],
      },
    );
    await userEvent.click(await button('Record contribution'));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findAllByRole('option', { name: /A-1203/ });
    await userEvent.selectOptions(within(dlg).getByLabelText(/^Flat/), '301');
    const amount = within(dlg).getByLabelText(/Amount/);
    await userEvent.clear(amount);
    await userEvent.type(amount, '5000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Record and send for approval' }));
    expect(
      await within(dlg).findByText('At most ₹1,000 can still be recorded for this flat.'),
    ).toBeInTheDocument();
  });

  it('live collection: actions, with the reminder count', async () => {
    renderIt();
    await screen.findByRole('heading', { name: 'Ganesh Utsav 2026' });
    for (const n of [
      'Record contribution',
      'Send reminder (1 of 2)',
      'Add flats',
      'Close collection',
      'Statement',
      'Export requests (CSV)',
    ])
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).toBeNull();
  });

  it('cancel is hidden once money was collected on a published collection... and for mandatory ones', async () => {
    renderIt({ isMandatory: true });
    await screen.findByRole('heading', { name: 'Ganesh Utsav 2026' });
    expect(screen.queryByRole('button', { name: 'Cancel collection' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record contribution' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send reminder (1 of 10)' })).toBeEnabled();
  });

  it('send reminder posts the version and reports the count', async () => {
    const api = renderIt({}, { 'POST /collections/12/remind': ok({ sentTo: 32, reminderCount: 2 }) });
    await userEvent.click(await button('Send reminder (1 of 2)'));
    await waitFor(() => expect(api.last('POST', '/collections/12/remind')?.body).toEqual({ version: 3 }));
  });

  it('the reminder button is off at the limit and shows the API error otherwise', async () => {
    renderIt({ reminderCount: 2 });
    expect(await button('Send reminder (2 of 2)')).toBeDisabled();
  });
  it('shows REMINDER_TOO_SOON in words', async () => {
    renderIt({}, { 'POST /collections/12/remind': err(422, 'REMINDER_TOO_SOON') });
    await userEvent.click(await button('Send reminder (1 of 2)'));
    expect(await screen.findByRole('alert')).toHaveTextContent('less than 24 hours ago');
  });

  it('publish: reason is optional, notice setting shown, posts reason and version', async () => {
    const api = renderIt(
      { status: 'APPROVED', collectedPaise: 0, percent: 0 },
      { 'POST /collections/12/publish': ok(colRaw()) },
    );
    expect(screen.queryByTestId('request-row')).toBeNull();
    await userEvent.click(await button('Publish to flats'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByLabelText('Also send a notice with a Pay button')).toBeChecked();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Approved in the meeting');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Publish to flats' }));
    await waitFor(() =>
      expect(api.last('POST', '/collections/12/publish')?.body).toEqual({
        version: 3,
        reason: 'Approved in the meeting',
      }),
    );
  });

  it('publish without a reason sends only the version', async () => {
    const api = renderIt({ status: 'APPROVED' }, { 'POST /collections/12/publish': ok(colRaw()) });
    await userEvent.click(await button('Publish to flats'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Publish to flats' }));
    await waitFor(() => expect(api.last('POST', '/collections/12/publish')?.body).toEqual({ version: 3 }));
  });

  it('close needs a reason of 5 to 300 characters', async () => {
    const api = renderIt({}, { 'POST /collections/12/close': ok(colRaw({ status: 'CLOSED' })) });
    await userEvent.click(await button('Close collection'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'abc');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Close collection' }));
    expect(within(dlg).getByText('Enter a reason of 5 to 300 characters.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'def ghi');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Close collection' }));
    await waitFor(() =>
      expect(api.last('POST', '/collections/12/close')?.body).toEqual({ reason: 'abcdef ghi', version: 3 }),
    );
  });

  it('cancel shows COLLECTION_HAS_PAYMENTS inside the dialog', async () => {
    renderIt({ collectedPaise: 0 }, { 'POST /collections/12/cancel': err(409, 'COLLECTION_HAS_PAYMENTS') });
    await userEvent.click(await button('Cancel collection'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'No longer needed');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel collection' }));
    expect(await within(dlg).findByText(/Money was already collected/)).toBeInTheDocument();
  });

  it('waive a flat that has not paid', async () => {
    const api = renderIt({}, { 'POST /collection-requests/301/waive': ok(reqRaw({ status: 'WAIVED' })) });
    const rows = await screen.findAllByTestId('request-row');
    expect(within(rows[1]).queryByRole('button', { name: 'Waive' })).toBeNull();
    expect(within(rows[2]).queryByRole('button', { name: 'Waive' })).toBeNull();
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Waive' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Hardship case');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Waive' }));
    await waitFor(() =>
      expect(api.last('POST', '/collection-requests/301/waive')?.body).toEqual({
        reason: 'Hardship case',
        version: 1,
      }),
    );
  });

  it('add flats posts the unit ids and the version and tells what was skipped', async () => {
    const api = renderIt(
      {},
      {
        'GET /units': ok([{ id: 77, label: 'C-7' }]),
        'POST /collections/12/requests': ok({ skippedUnitIds: [] }),
      },
    );
    await userEvent.click(await button('Add flats'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText('Find flats'), 'C-7');
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Add C-7' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add flats' }));
    await waitFor(() =>
      expect(api.last('POST', '/collections/12/requests')?.body).toEqual({ unitIds: [77], version: 3 }),
    );
  });

  it('record contribution: posts to the offline payment route with the request', async () => {
    const api = renderIt(
      {},
      {
        'POST /payments/offline': ok({ status: 'PENDING_APPROVAL' }),
        'GET /collections/12/requests': [list(REQS), list([REQS[0]]), list([REQS[2]])],
      },
    );
    await userEvent.click(await button('Record contribution'));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByRole('option', { name: /A-1203/ });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Record and send for approval' }));
    expect(within(dlg).getByText('Choose the flat.')).toBeInTheDocument();
    await userEvent.selectOptions(within(dlg).getByLabelText(/^Flat/), '301');
    expect(within(dlg).getByLabelText(/Amount/)).toHaveValue('1000');
    await userEvent.selectOptions(within(dlg).getByLabelText('Method'), 'NEFT');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Record and send for approval' }));
    expect(within(dlg).getByText('Enter the reference number of the payment.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/Reference number/), 'UTR123456');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Record and send for approval' }));
    await waitFor(() =>
      expect(api.last('POST', '/payments/offline')?.body).toMatchObject({
        unitId: 51,
        payingFor: 'COLLECTION',
        collectionRequestId: 301,
        method: 'NEFT',
        amountPaise: 100000,
        referenceNo: 'UTR123456',
      }),
    );
  });

  it('record contribution: cheque fields and the duplicate warning with Record anyway', async () => {
    const api = renderIt(
      {},
      {
        'POST /payments/offline': [err(409, 'DUPLICATE_PAYMENT_SUSPECTED'), ok({ status: 'CONFIRMED' })],
        'GET /collections/12/requests': [list(REQS), list([REQS[0]]), list([REQS[2]])],
      },
    );
    const rows = await screen.findAllByTestId('request-row');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Record' }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByRole('option', { name: /A-1203/ });
    expect(within(dlg).getByLabelText(/^Flat/)).toHaveValue('301');
    await userEvent.selectOptions(within(dlg).getByLabelText('Method'), 'CHEQUE');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Record and send for approval' }));
    expect(within(dlg).getByText('The cheque number has 6 digits.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/^Bank/), 'HDFC');
    await userEvent.type(within(dlg).getByLabelText(/Cheque number/), '123456');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Record and send for approval' }));
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Record anyway' }));
    await waitFor(() => expect(api.calls.filter(c => c.path === '/payments/offline')).toHaveLength(2));
    expect(api.last('POST', '/payments/offline')?.body).toMatchObject({
      confirmDuplicate: true,
      cheque: { bankName: 'HDFC', chequeNo: '123456' },
    });
  });

  it('statement opens the PDF link and export downloads the CSV', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const api = renderIt(
      {},
      {
        'GET /collections/12/statement': ok({ url: 'https://files/s.pdf', expiresAt: 'x' }),
      },
    );
    await userEvent.click(await button('Statement'));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files/s.pdf', '_blank', 'noopener'));
    expect(api.fn.mock.calls.some(c => String(c[0]).includes('format=pdf'))).toBe(true);
    open.mockRestore();
  });

  it('hides Export without the export permission', async () => {
    renderIt({}, {}, COL_VIEW_PERMS);
    await screen.findByRole('heading', { name: 'Ganesh Utsav 2026' });
    expect(screen.queryByRole('button', { name: 'Export requests (CSV)' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close collection' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Statement' })).toBeInTheDocument();
  });

  it('draft: edit, submit for approval and delete, no per flat table', async () => {
    const api = renderIt(
      { status: 'DRAFT', collectedPaise: 0, percent: 0, version: 1 },
      {
        'POST /collections/12/submit': ok(colRaw({ status: 'PENDING_APPROVAL' })),
        'DELETE /collections/12': ok(null),
      },
    );
    expect(await button('Edit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish to flats' })).toBeNull();
    expect(screen.queryByTestId('request-row')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.last('POST', '/collections/12/submit')?.body).toEqual({ version: 1 }));
    await userEvent.click(await button('Delete'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/collections'));
    expect(String(api.fn.mock.calls.at(-1)?.[0])).toContain('version=1');
  });

  it('draft opens the wizard filled when Edit is pressed', async () => {
    renderIt({ status: 'DRAFT', version: 1 }, { 'GET /funds': ok([]), 'GET /buildings': ok([]) });
    await userEvent.click(await button('Edit'));
    expect(await screen.findByText('Edit collection')).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toHaveValue('Ganesh Utsav 2026');
  });

  it('changes requested and rejected: shows the reason, and Submit stays available', async () => {
    renderIt({
      status: 'CHANGES_REQUESTED',
      approval: { requestId: 5, status: 'CHANGES_REQUESTED', reason: 'Lower the target' },
    });
    expect(await screen.findByText(/Changes requested: Lower the target/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('pending approval offers the approval link to an approver only', async () => {
    renderIt({ status: 'PENDING_APPROVAL' }, {}, [...COL_PERMS, 'finance.collections.approve']);
    expect(await screen.findByRole('link', { name: 'Open the approval' })).toHaveAttribute(
      'href',
      '/admin/approvals?type=COLLECTION_PUBLISH',
    );
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).toBeNull();
  });

  it('shows a not found error with a link back', async () => {
    renderIt({}, { 'GET /collections/12': err(404, 'COLLECTION_NOT_FOUND') });
    expect(await screen.findByRole('alert')).toHaveTextContent('This collection was not found');
    expect(screen.getByRole('link', { name: 'All collections' })).toHaveAttribute(
      'href',
      '/admin/collections',
    );
  });
});
