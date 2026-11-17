import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll, router, search } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { JournalEditorScreen, totals } from './journals/JournalEditorScreen';
import { JournalsScreen } from './journals/JournalsScreen';
import { LedgerScreen, filterTree } from './ledger/LedgerScreen';
import { OpeningBalancesScreen, openingTotals } from './opening/OpeningBalancesScreen';
import { normaliseTree } from '@/services/accountsJournalMappers';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);
vi.setConfig({ testTimeout: 30000 });

const PERMS = [
  'finance.accounts.view',
  'finance.accounts.create',
  'finance.accounts.edit',
  'finance.accounts.approve',
];
const FEATURES = ['accounting.chart_of_accounts', 'accounting.journal_engine', 'accounting.manual_journals'];
const acc = (id: number, code: string, name: string, over: object = {}) => ({
  id,
  code,
  name,
  accountType: 'ASSET',
  subtype: 'OTHER',
  isGroup: false,
  isActive: true,
  isSystem: false,
  balancePaise: 0,
  version: 1,
  children: [],
  ...over,
});
const CHART = [
  acc(1, '1000', 'Assets', {
    isGroup: true,
    isSystem: true,
    balancePaise: 150000,
    children: [
      acc(2, '1110', 'Bank - HDFC', { subtype: 'BANK', isSystem: true, balancePaise: 100000 }),
      acc(3, '1120', 'Cash in hand', { subtype: 'CASH', isSystem: true, balancePaise: 50000 }),
    ],
  }),
  acc(4, '5000', 'Expenses', {
    accountType: 'EXPENSE',
    isGroup: true,
    balancePaise: 0,
    children: [
      acc(5, '5100', 'Repairs', { accountType: 'EXPENSE', isCashBookCategory: true }),
      acc(6, '5200', 'Old stationery', { accountType: 'EXPENSE', isActive: false }),
    ],
  }),
  acc(7, '3900', 'Opening balance equity', { accountType: 'FUND', subtype: 'OPENING' }),
];
const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('pure helpers', () => {
  it('filters the tree by code or name and hides switched-off accounts', () => {
    const tree = normaliseTree(CHART);
    expect(filterTree(tree, '', false)[1]!.children.map(c => c.code)).toEqual(['5100']);
    expect(filterTree(tree, 'bank', false).map(a => a.code)).toEqual(['1000']);
    expect(filterTree(tree, '5200', true)[0]!.children[0]!.code).toBe('5200');
  });
  it('totals the grid and flags bad amounts', () => {
    expect(
      totals([
        { debit: '1,180', credit: '' },
        { debit: '', credit: '1080' },
      ]).difference,
    ).toBe(10000);
    expect(totals([{ debit: 'x', credit: '' }]).bad).toBe(true);
  });
  it('puts the opening difference on the other side', () => {
    const t = openingTotals(
      [
        { side: 'DR', amount: '1000000' },
        { side: 'DR', amount: '5000' },
        { side: 'CR', amount: '600000' },
        { side: 'CR', amount: '200000' },
      ],
      true,
    );
    expect(t.autoPaise).toBe(20500000);
    expect(t.autoSide).toBe('CR');
  });
});

describe('Chart of accounts', () => {
  it('shows the tree with balances, system locks, and searches', async () => {
    signInAs(PERMS, FEATURES);
    mockApi({ 'GET /accounts/ledger-accounts': ok(CHART) });
    wrap(<LedgerScreen />);
    const rows = await screen.findAllByTestId('account-row');
    expect(rows[1]).toHaveTextContent('1110');
    expect(rows[1]).toHaveTextContent('Locked');
    expect(rows[1]).toHaveTextContent('₹1,000');
    expect(screen.queryByText('Old stationery')).toBeNull();
    await userEvent.type(screen.getByLabelText('Search'), 'repairs');
    expect(screen.getAllByTestId('account-row')).toHaveLength(2);
  });
  it('adds a custom account under a group with an idempotent call, and maps DUPLICATE_LEDGER_CODE', async () => {
    signInAs(PERMS, FEATURES);
    const api = mockApi({
      'GET /accounts/ledger-accounts': ok(CHART),
      'POST /accounts/ledger-accounts': [err(409, 'DUPLICATE_LEDGER_CODE'), ok({ id: 9 })],
    });
    wrap(<LedgerScreen />);
    await screen.findAllByTestId('account-row');
    await userEvent.click(screen.getByRole('button', { name: 'Add under Expenses' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText('Code'), '5300');
    await userEvent.type(within(dlg).getByLabelText('Name'), 'Garden');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add account' }));
    expect(await within(dlg).findByText(/code is already used/)).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add account' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.last('POST', '/accounts/ledger-accounts')?.body).toMatchObject({
      parentId: 4,
      code: '5300',
      name: 'Garden',
    });
  });
  it('lets a custom account be added under a system group (every seeded group is a system account)', async () => {
    signInAs(PERMS, FEATURES);
    const sys = [
      acc(1, '2000', 'Liabilities', {
        accountType: 'LIABILITY',
        isGroup: true,
        isSystem: true,
        children: [
          acc(2, '2600', 'Other liabilities', { accountType: 'LIABILITY', isGroup: true, isSystem: true }),
        ],
      }),
    ];
    mockApi({ 'GET /accounts/ledger-accounts': ok(sys) });
    wrap(<LedgerScreen />);
    await screen.findAllByTestId('account-row');
    expect(screen.getByRole('button', { name: 'Add an account' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add under Other liabilities' })).toBeInTheDocument();
  });
  it('is read-only with an upgrade note on a lower plan', async () => {
    signInAs(PERMS, []);
    mockApi({ 'GET /accounts/ledger-accounts': ok(CHART) });
    wrap(<LedgerScreen />);
    await screen.findAllByTestId('account-row');
    expect(screen.getByText(/part of the Premium plan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add an account' })).toBeNull();
  });
  it('rejects a code that does not start like its group before calling the API', async () => {
    signInAs(PERMS, FEATURES);
    const api = mockApi({ 'GET /accounts/ledger-accounts': ok(CHART) });
    wrap(<LedgerScreen />);
    await screen.findAllByTestId('account-row');
    await userEvent.click(screen.getByRole('button', { name: 'Add under Expenses' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText('Code'), '1300');
    await userEvent.type(within(dlg).getByLabelText('Name'), 'Garden');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add account' }));
    expect(await within(dlg).findByText(/must start with 5/)).toBeInTheDocument();
    expect(api.last('POST', '/accounts/ledger-accounts')).toBeUndefined();
  });
});

const JOURNALS = [
  {
    id: 1,
    voucherNo: 'VCH/1',
    voucherType: 'RECEIPT',
    entryDate: '2026-11-02',
    narration: 'Receipt A-101',
    source: 'SYSTEM',
    status: 'POSTED',
    totalPaise: 250000,
    refType: 'payment',
    refId: '7',
  },
  {
    id: 2,
    voucherNo: null,
    voucherType: 'JOURNAL',
    entryDate: '2026-11-03',
    narration: 'Fix entry',
    source: 'MANUAL',
    status: 'DRAFT',
    totalPaise: 118000,
    refType: 'manual_journal',
    refId: 'u',
    version: 3,
  },
  {
    id: 3,
    voucherNo: 'JV/3',
    voucherType: 'JOURNAL',
    entryDate: '2026-11-04',
    narration: 'Manual posted',
    source: 'MANUAL',
    status: 'POSTED',
    totalPaise: 5000,
    refType: 'manual_journal',
    refId: 'v',
    version: 2,
  },
];
const lines = [
  { lineNo: 1, ledgerAccountCode: '1110', ledgerAccountName: 'Bank', debitPaise: 118000, creditPaise: 0 },
  {
    lineNo: 2,
    ledgerAccountCode: '4100',
    ledgerAccountName: 'Maintenance',
    debitPaise: 0,
    creditPaise: 108000,
  },
];

describe('Journals', () => {
  it('links a journal waiting for approval to its request', async () => {
    signInAs(PERMS, FEATURES);
    mockApi({
      'GET /accounts/journals': ok({ items: JOURNALS }),
      'GET /accounts/journals/2': ok({
        ...JOURNALS[1],
        status: 'PENDING_APPROVAL',
        lines,
        difference: 0,
        approvalRequestId: 61,
      }),
    });
    wrap(<JournalsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: /Open (draft )?2/ }));
    expect(await screen.findByRole('link', { name: 'Open the approval' })).toHaveAttribute(
      'href',
      '/admin/approvals/61',
    );
  });
  it('lists system and manual entries with chips and opens a system voucher with its source link', async () => {
    signInAs(PERMS, FEATURES);
    mockApi({
      'GET /accounts/journals': ok({ items: JOURNALS }),
      'GET /accounts/journals/1': ok({
        ...JOURNALS[0],
        lines,
        sourceLink: { refType: 'payment', refId: '7', label: 'Payment 7' },
      }),
    });
    wrap(<JournalsScreen />);
    const rows = await screen.findAllByTestId('journal-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('System');
    expect(rows[1]).toHaveTextContent('Manual');
    expect(rows[1]).toHaveTextContent('Draft');
    await userEvent.click(screen.getByRole('button', { name: 'Open VCH/1' }));
    expect(await screen.findByRole('link', { name: 'Payment 7' })).toHaveAttribute('href', '/admin/payments');
    expect(screen.getAllByTestId('journal-line')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Reverse' })).toBeNull();
    expect(screen.getByText(/reversed from the place it came from/)).toBeInTheDocument();
  });
  it('blocks submit of an unbalanced draft and submits a balanced one with its version', async () => {
    signInAs(PERMS, FEATURES);
    const api = mockApi({
      'GET /accounts/journals': ok({ items: JOURNALS }),
      'GET /accounts/journals/2': ok({ ...JOURNALS[1], lines, difference: 10000 }),
      'POST /accounts/journals/2/submit': ok({ id: 2, status: 'PENDING_APPROVAL' }),
    });
    wrap(<JournalsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open draft 2' }));
    const submit = await screen.findByRole('button', { name: 'Submit for approval' });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Difference ₹100/)).toBeInTheDocument();
    expect(api.last('POST', '/accounts/journals/2/submit')).toBeUndefined();
  });
  it('opens the voucher drawer from ?open=<id> (the report links)', async () => {
    signInAs(PERMS, FEATURES);
    search.current = new URLSearchParams('open=1');
    mockApi({
      'GET /accounts/journals': ok({ items: JOURNALS }),
      'GET /accounts/journals/1': ok({ ...JOURNALS[0], lines }),
    });
    wrap(<JournalsScreen />);
    expect(await screen.findAllByTestId('journal-line')).toHaveLength(2);
  });
  it('hides the draft actions from a user who is not the maker, and labels the totals', async () => {
    signInAs(PERMS, FEATURES);
    mockApi({
      'GET /accounts/journals': ok({ items: JOURNALS }),
      'GET /accounts/journals/2': ok({ ...JOURNALS[1], lines, difference: 0, createdBy: 999 }),
    });
    wrap(<JournalsScreen />);
    expect(await screen.findAllByTitle('Voucher total')).toHaveLength(3);
    await userEvent.click(await screen.findByRole('button', { name: 'Open draft 2' }));
    expect(await screen.findByText('Total debits / credits')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel draft' })).toBeNull();
  });
  it('shows the draft actions to the maker', async () => {
    signInAs(PERMS, FEATURES);
    mockApi({
      'GET /accounts/journals': ok({ items: JOURNALS }),
      'GET /accounts/journals/2': ok({ ...JOURNALS[1], lines, difference: 0, createdBy: 101 }),
    });
    wrap(<JournalsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open draft 2' }));
    expect(await screen.findByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
  });
  it('reverses a posted manual journal with a reason and the version', async () => {
    signInAs(PERMS, FEATURES);
    const api = mockApi({
      'GET /accounts/journals': ok({ items: JOURNALS }),
      'GET /accounts/journals/3': ok({ ...JOURNALS[2], lines }),
      'POST /accounts/journals/3/reverse': ok({ id: 3 }),
    });
    wrap(<JournalsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open JV/3' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reverse' }));
    const dlg = await screen.findByRole('dialog', { name: /Reverse JV\/3/ });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reverse journal' }));
    expect(await within(dlg).findByText(/reason of 5 to 500/)).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText('Reason'), 'Posted twice');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reverse journal' }));
    await waitFor(() =>
      expect(api.last('POST', '/accounts/journals/3/reverse')?.body).toMatchObject({
        reason: 'Posted twice',
        version: 2,
      }),
    );
  });
  it('shows the lock state on a plan without the journal engine', async () => {
    signInAs(PERMS, []);
    mockApi({});
    wrap(<JournalsScreen />);
    expect(await screen.findByText(/not available in your plan/)).toBeInTheDocument();
  });
});

describe('New journal', () => {
  const routes = { 'GET /accounts/ledger-accounts': ok(CHART), 'GET /accounts/funds': err(404, 'NOT_FOUND') };
  async function fill(api: ReturnType<typeof mockApi>, credit: string) {
    await screen.findByText('Lines');
    await userEvent.click(screen.getByLabelText('Narration'));
    await userEvent.paste('Correct the bank entry');
    await userEvent.selectOptions(screen.getByLabelText('Account, line 1'), '5100');
    await userEvent.click(screen.getByLabelText('Debit, line 1'));
    await userEvent.paste('1000');
    await userEvent.selectOptions(screen.getByLabelText('Account, line 2'), '1110');
    await userEvent.click(screen.getByLabelText('Credit, line 2'));
    await userEvent.paste(credit);
    void api;
  }
  it('shows the running difference and enables submit only when balanced', async () => {
    signInAs(PERMS, FEATURES);
    const api = mockApi(routes);
    wrap(<JournalEditorScreen />);
    await fill(api, '900');
    expect(screen.getByTestId('difference')).toHaveTextContent('Difference ₹100');
    expect(screen.getAllByRole('button', { name: 'Submit for approval' })[0]).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Credit, line 2'));
    await userEvent.click(screen.getByLabelText('Credit, line 2'));
    await userEvent.paste('1000');
    expect(screen.getByTestId('difference')).toHaveTextContent('Difference ₹0');
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
  });
  it('saves an unbalanced draft', async () => {
    signInAs(PERMS, FEATURES);
    const api = mockApi({ ...routes, 'POST /accounts/journals': ok({ id: 9, version: 1, status: 'DRAFT' }) });
    wrap(<JournalEditorScreen />);
    await fill(api, '900');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/accounts/journals'));
    expect(api.last('POST', '/accounts/journals')?.body).toMatchObject({
      narration: 'Correct the bank entry',
      lines: [
        { ledgerAccountCode: '5100', debitPaise: 100000, creditPaise: 0 },
        { ledgerAccountCode: '1110', debitPaise: 0, creditPaise: 90000 },
      ],
    });
  });
  it('creates then submits a balanced journal, and shows JOURNAL_NOT_BALANCED from the API', async () => {
    signInAs(PERMS, FEATURES);
    const api = mockApi({
      ...routes,
      'POST /accounts/journals': ok({ id: 9, version: 1, status: 'DRAFT' }),
      'POST /accounts/journals/9/submit': err(422, 'JOURNAL_NOT_BALANCED'),
    });
    wrap(<JournalEditorScreen />);
    await fill(api, '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByText(/debits and total credits are not equal/)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
  it('edits an existing draft with PATCH and its version', async () => {
    signInAs(PERMS, FEATURES);
    search.current = new URLSearchParams('draft=2');
    const api = mockApi({
      ...routes,
      'GET /accounts/journals/2': ok({ ...JOURNALS[1], lines, instrumentRef: null }),
      'PATCH /accounts/journals/2': ok({ id: 2, version: 4 }),
    });
    wrap(<JournalEditorScreen />);
    await screen.findByText('Lines');
    expect(screen.getByLabelText('Narration')).toHaveValue('Fix entry');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/accounts/journals/2')?.body).toMatchObject({ version: 3 }),
    );
  });
});

describe('Opening balances', () => {
  const OB_CHART = [...CHART, acc(10, '2201', 'Sinking fund', { accountType: 'FUND', subtype: 'FUND' })];
  it('builds the auto-balance line and posts once after confirmation', async () => {
    signInAs(PERMS, ['accounting.journal_engine']);
    const api = mockApi({
      'GET /accounts/ledger-accounts': ok(OB_CHART),
      'GET /accounts/journals': ok({ items: [] }),
      'POST /accounts/opening-balances': ok({ journalId: 5, voucherNo: 'OB/1', totalPaise: 10050000 }),
    });
    wrap(<OpeningBalancesScreen />);
    await userEvent.type(await screen.findByLabelText('Amount for 1110'), '1000000');
    await userEvent.type(screen.getByLabelText('Amount for 1120'), '5000');
    await userEvent.type(screen.getByLabelText('Amount for 2201'), '600000');
    expect(screen.getByTestId('auto-line')).toHaveTextContent('3900');
    expect(screen.getByTestId('auto-line')).toHaveTextContent('₹4,05,000');
    await userEvent.click(screen.getByRole('button', { name: 'Review and post' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Post opening balances' }));
    expect(await screen.findByTestId('posted')).toHaveTextContent('OB/1');
    expect(api.last('POST', '/accounts/opening-balances')?.body).toMatchObject({
      autoBalance: true,
      lines: [
        { ledgerAccountCode: '1110', debitPaise: 100000000, creditPaise: 0 },
        { ledgerAccountCode: '1120', debitPaise: 500000, creditPaise: 0 },
        { ledgerAccountCode: '2201', debitPaise: 0, creditPaise: 60000000 },
      ],
    });
  });
  it('shows the posted state when an opening voucher exists', async () => {
    signInAs(PERMS, ['accounting.journal_engine']);
    mockApi({
      'GET /accounts/ledger-accounts': ok(OB_CHART),
      'GET /accounts/journals': ok({
        items: [
          {
            id: 5,
            voucherNo: 'OB/1',
            voucherType: 'OPENING_BALANCE',
            status: 'POSTED',
            entryDate: '2026-04-01',
            totalPaise: 100,
          },
        ],
      }),
    });
    wrap(<OpeningBalancesScreen />);
    expect(await screen.findByTestId('posted')).toHaveTextContent('OB/1');
    expect(screen.queryByRole('button', { name: 'Review and post' })).toBeNull();
  });
  it('asks for an amount before posting', async () => {
    signInAs(PERMS, []);
    const api = mockApi({
      'GET /accounts/ledger-accounts': ok(OB_CHART),
      'GET /accounts/journals': err(402, 'FEATURE_NOT_IN_PLAN'),
    });
    wrap(<OpeningBalancesScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Review and post' }));
    expect(await screen.findByText('Enter at least one balance.')).toBeInTheDocument();
    expect(api.last('POST', '/accounts/opening-balances')).toBeUndefined();
  });
});
