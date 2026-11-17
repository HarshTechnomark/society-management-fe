import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { accountsBankService } from './accountsBank.service';
import { accountsDepositsService } from './accountsDeposits.service';
import { accountsExpensesService } from './accountsExpenses.service';
import { accountsFundsService } from './accountsFunds.service';
import { accountsJournalService } from './accountsJournal.service';
import { accountsSettlementsService } from './accountsSettlements.service';
import { accountsStatementsService } from './accountsStatements.service';

beforeEach(resetAll);

/** The query fields the backend `.strict()` list schemas accept (accounts.*.validation.ts). Anything else answers 400. */
const ALLOWED: Record<string, string[]> = {
  '/accounts/bank-accounts': ['status', 'isCollectionAccount', 'verificationStatus'],
  '/accounts/funds': ['status', 'fundType'],
  '/accounts/ledger-accounts': ['type', 'activeOnly', 'cashBookOnly'],
  '/expenses': [
    'status',
    'expenseType',
    'from',
    'to',
    'ledgerAccountId',
    'fundId',
    'collectionId',
    'vendorId',
    'paidFrom',
    'createdByMe',
    'q',
    'sortBy',
    'sortOrder',
    'page',
    'limit',
  ],
  '/accounts/deposits': ['status', 'kind', 'unitId', 'q', 'sortBy', 'page', 'limit'],
  '/accounts/settlements': ['status', 'from', 'to', 'q', 'page', 'limit'],
  '/accounts/bank-statements': ['bankAccountId', 'status', 'page', 'limit', 'sortBy', 'sortOrder'],
  '/accounts/bank-statements/5/lines': [
    'matchStatus',
    'direction',
    'from',
    'to',
    'q',
    'page',
    'limit',
    'sortBy',
    'sortOrder',
  ],
  '/accounts/journals': [
    'from',
    'to',
    'voucherType',
    'status',
    'source',
    'refType',
    'ledgerAccountId',
    'fundId',
    'q',
    'minAmountPaise',
    'maxAmountPaise',
    'sortBy',
    'sortOrder',
    'page',
    'limit',
  ],
};

const CALLS: [string, () => Promise<unknown>][] = [
  ['/accounts/bank-accounts', () => accountsBankService.list()],
  ['/accounts/bank-accounts', () => accountsBankService.options()],
  ['/accounts/bank-accounts', () => accountsStatementsService.bankAccounts()],
  ['/accounts/funds', () => accountsFundsService.list()],
  ['/accounts/funds', () => accountsFundsService.options()],
  ['/accounts/ledger-accounts', () => accountsJournalService.chart({ activeOnly: false })],
  ['/expenses', () => accountsExpensesService.list({ page: 1, limit: 20, status: 'POSTED', q: 'ab' })],
  ['/accounts/deposits', () => accountsDepositsService.list({ page: 1, limit: 20, status: 'HELD' })],
  ['/accounts/settlements', () => accountsSettlementsService.list({ page: 1, limit: 20, status: 'POSTED' })],
  [
    '/accounts/bank-statements',
    () => accountsStatementsService.list({ page: 1, limit: 20, bankAccountId: 1 }),
  ],
  [
    '/accounts/bank-statements/5/lines',
    () => accountsStatementsService.lines(5, { matchStatus: 'UNMATCHED', page: 1, limit: 50 }),
  ],
  ['/accounts/journals', () => accountsJournalService.journals({ page: 1, limit: 20, status: 'POSTED' })],
];

describe('list queries send only the fields the backend allows', () => {
  it.each(CALLS.map(([p], i) => [p, i] as const))('%s (call %i)', async (path, i) => {
    const routes: Record<string, ReturnType<typeof ok>> = {};
    for (const [p] of CALLS) routes[`GET ${p}`] = ok([]);
    routes['GET /accounts/bank-accounts'] = ok([]);
    const api = mockApi(routes);
    await CALLS[i]![1]().catch(() => undefined);
    const hits = api.fn.mock.calls.map(c => new URL(String(c[0]))).filter(u => u.pathname.endsWith(path));
    expect(hits.length).toBeGreaterThan(0);
    for (const u of hits)
      for (const k of u.searchParams.keys()) expect(ALLOWED[path], `${path} ?${k}`).toContain(k);
  });
});
