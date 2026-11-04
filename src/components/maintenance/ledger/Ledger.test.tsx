import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResidentsScreen } from '@/components/residents/ResidentsScreen';
import { ToastProvider } from '@/components/ui/Toast';
import { configureFileUploader } from '@/lib/fileUpload';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { LEDGER_FEATURES, LEDGER_PERMS, obList, obRow, obTotals, statement } from '@/test/ledgerFixtures';
import { flat, panel, stats } from '@/test/residentsFixtures';
import { building } from '@/test/setupFixtures';
import { ADMIN_PERMS, RES_FEATURES } from '@/test/residentsFixtures';
import { page } from '@/test/societyFixtures';
import { signIn } from '@/test/setupHelpers';
import { OpeningBalancesScreen } from './OpeningBalancesScreen';
import { StatementDrawer } from './StatementDrawer';

vi.mock('next/navigation', () => navigationMock());

type Routes = Parameters<typeof mockApi>[0];
const upload = vi.fn(async () => ({ fileId: 9 }));

function renderOb(routes: Routes = {}, perms = LEDGER_PERMS, features = LEDGER_FEATURES) {
  signIn(perms, features);
  const api = mockApi({
    'GET /billing/opening-balances': ok(obList()),
    'GET /billing/runs': ok([]),
    ...routes,
  });
  render(
    <ToastProvider>
      <OpeningBalancesScreen />
    </ToastProvider>,
  );
  return api;
}

beforeEach(() => {
  resetAll();
  upload.mockClear();
  configureFileUploader({ upload });
});

describe('Opening balances screen', () => {
  it('shows the grid with totals, status words and the posting explanation', async () => {
    renderOb({
      'GET /billing/opening-balances': ok(
        obList(
          [
            obRow(),
            obRow({
              id: 3,
              status: 'INVALID',
              unitId: null,
              unitLabel: 'Z-9',
              validationError: 'Unknown flat',
              importRowNo: 4,
            }),
          ],
          obTotals({ invalidCount: 1 }),
        ),
      ),
    });
    const table = await screen.findByRole('table', { name: 'Opening balances' });
    expect(within(table).getByText('A-1203')).toBeInTheDocument();
    expect(within(table).getAllByText('₹12,500').length).toBeGreaterThan(0);
    expect(within(table).getByText('Draft')).toBeInTheDocument();
    expect(within(table).getByText('Invalid')).toBeInTheDocument();
    expect(within(table).getByText('Unknown flat')).toBeInTheDocument();
    expect(screen.getByText('Draft arrears ₹12,850.50')).toBeInTheDocument();
    expect(screen.getByText(/1 rows have errors/)).toBeInTheDocument();
    expect(screen.getByText(/arrears invoice numbered/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post opening balances' })).toBeDisabled();
  });

  it('shows the skeleton, the empty state and the error', async () => {
    renderOb({
      'GET /billing/opening-balances': ok(
        obList([], obTotals({ draftArrearsPaise: 0, draftAdvancePaise: 0 })),
      ),
    });
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(await screen.findByText('No opening balances yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post opening balances' })).toBeDisabled();
  });

  it('shows the error with the reference', async () => {
    renderOb({ 'GET /billing/opening-balances': err(500, 'INTERNAL_ERROR') });
    expect(await screen.findByText('req_test')).toBeInTheDocument();
  });

  it('is blocked without the view permission and without the plan', async () => {
    renderOb({}, ['settings.society.view']);
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });

  it('says not in your plan without the entitlement', async () => {
    renderOb({}, LEDGER_PERMS, []);
    expect((await screen.findAllByText(/plan/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('hides upload, post and row actions without finance.billing.import', async () => {
    renderOb({ 'GET /billing/opening-balances': ok(obList([obRow({ status: 'POSTED' })])) }, [
      'finance.billing.view',
    ]);
    await screen.findByRole('table', { name: 'Opening balances' });
    expect(screen.queryByRole('button', { name: 'Post opening balances' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check file' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reverse\s+A-/ })).toBeNull();
  });

  it('offers the template and cannot start without a file or an uploader', async () => {
    configureFileUploader(null);
    renderOb();
    expect(await screen.findByRole('link', { name: /Download template/ })).toHaveAttribute(
      'href',
      '/templates/opening-balances-template.csv',
    );
    expect(screen.getByRole('button', { name: 'Check file' })).toBeDisabled();
    expect(screen.getByText(/File upload is not available yet/)).toBeInTheDocument();
  });

  it('checks the file with a dry run first and imports only on Import N rows', async () => {
    const api = renderOb({
      'POST /billing/opening-balances/import': body =>
        (body as { dryRun?: boolean }).dryRun
          ? ok({
              draft: 70,
              invalid: 2,
              dryRun: true,
              totals: obTotals(),
              errors: [
                { rowNo: 4, unit: 'A-999', message: 'Unknown flat' },
                { rowNo: 9, unit: 'B-101', message: 'Arrears and advance together' },
              ],
            })
          : ok({ draft: 70, invalid: 2, dryRun: false, totals: obTotals({ invalidCount: 2 }), errors: [] }),
    });
    await screen.findByRole('table', { name: 'Opening balances' });
    const gets = () =>
      api.calls.filter(c => c.method === 'GET' && c.path === '/billing/opening-balances').length;
    const before = gets();
    await userEvent.upload(screen.getByLabelText('File'), new File(['a'], 'ob.csv', { type: 'text/csv' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check file' }));
    const result = await screen.findByTestId('check-result');
    expect(result).toHaveTextContent('nothing is saved yet: 70 valid rows and 2 rows with errors');
    const errors = within(result).getByRole('list', { name: 'Rows with errors' });
    expect(errors).toHaveTextContent('Row 4 (A-999): Unknown flat');
    expect(errors).toHaveTextContent('Row 9 (B-101): Arrears and advance together');
    expect(result).toHaveTextContent(/Importing replaces every draft row and every row with errors/);
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'IMPORT_FILE');
    const dry = api.last('POST', '/billing/opening-balances/import')!;
    expect(dry.body).toMatchObject({ fileId: 9, dryRun: true });
    expect((dry.body as { asOfDate: string }).asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(gets()).toBe(before);

    await userEvent.click(screen.getByRole('button', { name: 'Import 72 rows' }));
    expect(await screen.findByText(/70 valid rows and 2 rows with errors imported/)).toBeInTheDocument();
    const real = api.last('POST', '/billing/opening-balances/import')!;
    expect(real.body).toEqual({ fileId: 9, asOfDate: (dry.body as { asOfDate: string }).asOfDate });
    expect(upload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
    expect(screen.queryByRole('button', { name: /^Import \d+ rows?$/ })).toBeNull();
  });

  it('asks for a new check when the date changes after a check', async () => {
    renderOb({
      'POST /billing/opening-balances/import': ok({
        draft: 3,
        invalid: 0,
        dryRun: true,
        totals: obTotals(),
        errors: [],
      }),
    });
    await screen.findByRole('table', { name: 'Opening balances' });
    await userEvent.upload(screen.getByLabelText('File'), new File(['a'], 'ob.csv'));
    await userEvent.click(screen.getByRole('button', { name: 'Check file' }));
    expect(await screen.findByRole('button', { name: 'Import 3 rows' })).toBeInTheDocument();
    const d = screen.getByLabelText('Balances as of');
    await userEvent.clear(d);
    await userEvent.type(d, '2026-01-31');
    expect(screen.queryByRole('button', { name: 'Import 3 rows' })).toBeNull();
  });

  describe('the default as-of date', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 4));
    });
    afterEach(() => vi.useRealTimers());

    it('is the last day of the previous month before any regular run', async () => {
      renderOb();
      await waitFor(() => expect(screen.getByLabelText('Balances as of')).toHaveValue('2026-10-31'));
      expect(screen.getByText(/The day the old dues and advances were counted/)).toBeInTheDocument();
    });

    it('is the day before the billing start once a regular run exists', async () => {
      renderOb({
        'GET /billing/runs': ok([
          { id: 2, runType: 'REGULAR', status: 'ISSUED', periodStart: '2026-12-01' },
          { id: 1, runType: 'REGULAR', status: 'ISSUED', periodStart: '2026-11-01' },
          { id: 3, runType: 'REGULAR', status: 'CANCELLED', periodStart: '2026-09-01' },
        ]),
      });
      await waitFor(() => expect(screen.getByLabelText('Balances as of')).toHaveValue('2026-10-31'));
      expect(
        screen.getByText(/Billing started on 1 Nov 2026, so this must be the day before/),
      ).toBeInTheDocument();
    });
  });

  it('refuses a future as-of date before calling the API', async () => {
    const api = renderOb();
    await screen.findByRole('table', { name: 'Opening balances' });
    await userEvent.upload(screen.getByLabelText('File'), new File(['a'], 'ob.csv'));
    const d = screen.getByLabelText('Balances as of');
    await waitFor(() => expect(d).toBeEnabled());
    await userEvent.clear(d);
    await userEvent.type(d, '2999-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Check file' }));
    expect(await screen.findByText('The as-of date cannot be in the future.')).toBeInTheDocument();
    expect(api.last('POST', '/billing/opening-balances/import')).toBeUndefined();
  });

  it('shows the server error of a bad import file', async () => {
    renderOb({ 'POST /billing/opening-balances/import': err(422, 'IMPORT_FILE_INVALID') });
    await screen.findByRole('table', { name: 'Opening balances' });
    await userEvent.upload(screen.getByLabelText('File'), new File(['a'], 'ob.csv'));
    await userEvent.click(screen.getByRole('button', { name: 'Check file' }));
    expect(await screen.findByText(/could not be read, or a column heading is missing/)).toBeInTheDocument();
  });

  it('posts only after the typed total matches arrears minus advances', async () => {
    const api = renderOb({
      'POST /billing/opening-balances/post': ok({
        posted: 2,
        totalArrearsPaise: 1285050,
        totalAdvancePaise: 200000,
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Post opening balances' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('₹10,850.50')).toBeInTheDocument();
    const post = within(dlg).getByRole('button', { name: 'Post' });
    expect(post).toBeDisabled();
    await userEvent.type(within(dlg).getByLabelText('Total in rupees'), '10,850');
    expect(post).toBeDisabled();
    expect(within(dlg).getByText('This does not match the total above.')).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText('Total in rupees'), '.50');
    await userEvent.click(post);
    await waitFor(() => expect(api.last('POST', '/billing/opening-balances/post')).toBeDefined());
    expect(api.last('POST', '/billing/opening-balances/post')!.body).toEqual({ confirmTotalPaise: 1085050 });
    expect(await screen.findByText('2 opening balances posted')).toBeInTheDocument();
  });

  it('shows a post error inside the dialog', async () => {
    renderOb({ 'POST /billing/opening-balances/post': err(422, 'OPENING_BALANCE_TOTAL_MISMATCH') });
    await userEvent.click(await screen.findByRole('button', { name: 'Post opening balances' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText('Total in rupees'), '10850.50');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Post' }));
    expect(await within(dlg).findByText(/does not match the draft rows/)).toBeInTheDocument();
  });

  it('reverses a posted arrears row with a reason and no advance reversal', async () => {
    const api = renderOb({
      'GET /billing/opening-balances': ok(
        obList(
          [
            obRow({ status: 'POSTED', version: 3 }),
            obRow({
              id: 2,
              status: 'POSTED',
              unitLabel: 'A-1204',
              arrearsPrincipalPaise: 0,
              arrearsInterestPaise: 0,
              advancePaise: 5000,
              importRowNo: 3,
            }),
          ],
          obTotals({ draftArrearsPaise: 0, draftAdvancePaise: 0, postedCount: 2 }),
        ),
      ),
      'POST /billing/opening-balances/1/reverse': ok({}),
    });
    expect(await screen.findByText('Advance, cannot be reversed')).toBeInTheDocument();
    expect(screen.getAllByText('Posted').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /Reverse\s+A-1203/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Posted by mistake');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reverse' }));
    await waitFor(() => expect(api.last('POST', '/billing/opening-balances/1/reverse')).toBeDefined());
    expect(api.last('POST', '/billing/opening-balances/1/reverse')!.body).toEqual({
      reason: 'Posted by mistake',
      version: 3,
    });
  });

  it('shows the reverse error', async () => {
    renderOb({
      'GET /billing/opening-balances': ok(obList([obRow({ status: 'POSTED' })])),
      'POST /billing/opening-balances/1/reverse': err(422, 'OPENING_BALANCE_HAS_PAYMENTS'),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Reverse\s+A-1203/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Posted by mistake');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reverse' }));
    expect(await screen.findByText(/already has a payment or credit note/)).toBeInTheDocument();
  });

  it('deletes a draft row with its version', async () => {
    const api = renderOb({ 'DELETE /billing/opening-balances/1': ok(null) });
    await userEvent.click(await screen.findByRole('button', { name: /Delete\s+row 2/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.last('DELETE', '/billing/opening-balances/1')).toBeDefined());
    expect(api.last('DELETE', '/billing/opening-balances/1')!.body).toEqual({ version: 1 });
  });

  it('filters by status on the server', async () => {
    const api = renderOb();
    await userEvent.click(await screen.findByRole('button', { name: 'Posted' }));
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('status=POSTED'))).toBe(true),
    );
  });
});

describe('Statement of account', () => {
  function renderSt(routes: Routes = {}, perms = LEDGER_PERMS) {
    signIn(perms, LEDGER_FEATURES);
    const api = mockApi({ 'GET /billing/units/101/statement': ok(statement()), ...routes });
    render(
      <ToastProvider>
        <StatementDrawer unitId={101} unitLabel="A-1203" onClose={vi.fn()} />
      </ToastProvider>,
    );
    return api;
  }

  it('shows opening and closing balance and running balance in words and Dr/Cr', async () => {
    const api = renderSt();
    const table = await screen.findByRole('table', { name: 'Statement of account' });
    expect(within(table).getByText('Bill INV/2026-27/000150 (Nov 2026)')).toBeInTheDocument();
    expect(within(table).getByText('Receipt')).toBeInTheDocument();
    expect(within(table).getByText('₹5,380 Dr')).toBeInTheDocument();
    expect(within(table).getByText('₹1,000 Cr')).toBeInTheDocument();
    expect(screen.getByText('Nil')).toBeInTheDocument();
    expect(screen.getByText('₹1,000 advance')).toBeInTheDocument();
    const url = String(api.fn.mock.calls[0][0]);
    expect(url).toMatch(/from=\d{4}-04-01/);
    expect(url).toMatch(/to=\d{4}-\d{2}-\d{2}/);
  });

  it('shows the empty period', async () => {
    renderSt({ 'GET /billing/units/101/statement': ok(statement({ entries: [] })) });
    expect(await screen.findByText('No entries in this period.')).toBeInTheDocument();
  });

  it('reloads for a new period and validates the range', async () => {
    const api = renderSt();
    await screen.findByRole('table');
    const from = screen.getByLabelText('From');
    await userEvent.clear(from);
    await userEvent.type(from, '2020-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Show statement' }));
    expect(screen.getByText('The period can be at most 1,100 days.')).toBeInTheDocument();
    await userEvent.clear(from);
    await userEvent.type(from, '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Show statement' }));
    await waitFor(() =>
      expect(api.fn.mock.calls.some(c => String(c[0]).includes('from=2026-10-01'))).toBe(true),
    );
  });

  it('shows the error in plain words with the reference', async () => {
    renderSt({ 'GET /billing/units/101/statement': err(404, 'UNIT_NOT_FOUND') });
    expect(await screen.findByText('This flat no longer exists or is archived.')).toBeInTheDocument();
    expect(screen.getByText('req_test')).toBeInTheDocument();
  });

  it('exports CSV only with finance.billing.export', async () => {
    renderSt({}, ['finance.billing.view']);
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('downloads the CSV with format=csv', async () => {
    const create = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const api = renderSt();
    await screen.findByRole('table');
    // The mock replies with JSON; fetch needs a blob for raw requests.
    api.fn.mockImplementationOnce(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers(),
          blob: async () => new Blob(['a']),
        }) as unknown as Response,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(String(api.fn.mock.calls.at(-1)![0])).toContain('format=csv');
    click.mockRestore();
  });
});

describe('Flat drawer: statement button and real dues', () => {
  async function openDrawer(
    duesPaise: number,
    perms = [...ADMIN_PERMS, ...LEDGER_PERMS],
    features = [...RES_FEATURES, ...LEDGER_FEATURES],
  ) {
    signIn(perms, features);
    mockApi({
      'GET /residents/stats': ok(stats()),
      'GET /residents/units': ok([flat({ duesPaise })], 'OK', page(1, 1, 12)),
      'GET /buildings': ok([building()], 'OK', page(1)),
      'GET /residents/units/101': ok({ ...panel(), duesPaise }),
      'GET /billing/units/101/statement': ok(statement()),
    });
    render(
      <ToastProvider>
        <ResidentsScreen />
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Open A-1203' }));
    return screen.findByRole('dialog');
  }

  it('shows dues and opens the statement from the drawer', async () => {
    const dlg = await openDrawer(482500);
    await within(dlg).findByText('₹4,825');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Statement' }));
    expect(await screen.findByRole('table', { name: 'Statement of account' })).toBeInTheDocument();
  });

  it('shows an advance as an advance, in the drawer and the list', async () => {
    const dlg = await openDrawer(-50000);
    expect(await within(dlg).findByText('Advance ₹500')).toBeInTheDocument();
    expect(screen.getAllByText('Advance ₹500').length).toBe(2);
  });

  it('hides the Statement button without billing permission or plan', async () => {
    const dlg = await openDrawer(0, ADMIN_PERMS, RES_FEATURES);
    await within(dlg).findByText('Paid up');
    expect(within(dlg).queryByRole('button', { name: 'Statement' })).toBeNull();
  });
});
