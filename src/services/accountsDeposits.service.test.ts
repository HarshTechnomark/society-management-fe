import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { accountsDepositsService as svc } from './accountsDeposits.service';
import { normaliseDeposit, paidFromAccounts, summarise } from './accountsDepositsMappers';

beforeEach(resetAll);
const raw = (over: Record<string, unknown> = {}) => ({
  id: 7,
  unitId: 3,
  unitLabel: 'A-1203',
  kind: 'RENOVATION',
  title: 'Renovation deposit',
  status: 'HELD',
  amountPaise: 2500000,
  receivedPaise: 2500000,
  deductedPaise: 300000,
  refundedPaise: 0,
  refundRequestedPaise: 0,
  adjustments: [{ kind: 'DEDUCTION', amountPaise: 300000, reason: 'Damage', at: '2026-11-02T10:00:00Z' }],
  version: 2,
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
});
const list = (items: unknown[]) => ({
  data: items,
  extra: { pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } },
});

describe('deposit mappers', () => {
  it('derives code and held amount and survives garbage', () => {
    const d = normaliseDeposit(raw());
    expect(d.code).toBe('DEP-7');
    expect(d.heldPaise).toBe(2200000);
    expect(d.adjustments[0].kind).toBe('DEDUCTION');
    expect(normaliseDeposit(null).status).toBe('AWAITING_PAYMENT');
  });
  it('sums held, refunded and forfeited', () => {
    const s = summarise([
      normaliseDeposit(raw()),
      normaliseDeposit(
        raw({
          id: 8,
          status: 'REFUNDED',
          receivedPaise: 100000,
          deductedPaise: 0,
          refundedPaise: 100000,
          adjustments: [],
        }),
      ),
      normaliseDeposit(
        raw({
          id: 9,
          status: 'FORFEITED',
          receivedPaise: 50000,
          deductedPaise: 50000,
          adjustments: [{ kind: 'FORFEIT', amountPaise: 50000 }],
        }),
      ),
    ]);
    expect(s).toEqual({ heldPaise: 2200000, refundedPaise: 100000, forfeitedPaise: 50000 });
  });
  it('picks active bank and cash leaves from a tree', () => {
    const tree = [
      {
        id: 1,
        code: '1100',
        name: 'Cash and bank',
        subtype: 'OTHER',
        children: [
          { id: 2, code: '1110-001', name: 'HDFC', subtype: 'BANK', children: [] },
          { id: 3, code: '1120', name: 'Cash', subtype: 'CASH' },
          { id: 4, code: '1130', name: 'Old', subtype: 'BANK', isActive: false },
        ],
      },
    ];
    expect(paidFromAccounts(tree).map(a => a.id)).toEqual([2, 3]);
  });
});

describe('accountsDepositsService', () => {
  it('lists with filters', async () => {
    const api = mockApi({ 'GET /accounts/deposits': list([raw()]) });
    const r = await svc.list({ status: 'HELD', q: 'A-12' });
    expect(r.items).toHaveLength(1);
    expect(String(api.fn.mock.calls[0][0])).toContain('status=HELD');
  });
  it('sends money calls with an Idempotency-Key and the version', async () => {
    const api = mockApi({
      'POST /accounts/deposits/7/deduct': ok(raw()),
      'POST /accounts/deposits/7/refund-paid': ok(raw()),
    });
    await svc.deduct(7, { amountPaise: 100, reason: 'Damage', date: '2026-11-02', version: 2 });
    await svc.refundPaid(7, {
      paidFromLedgerAccountId: 2,
      refundMode: 'NEFT',
      refundReference: 'UTR123456',
      date: '2026-11-02',
      version: 2,
    });
    for (const c of api.fn.mock.calls)
      expect(new Headers((c[1] as RequestInit).headers).get('Idempotency-Key')).toBeTruthy();
    expect(api.last('POST', '/accounts/deposits/7/deduct')?.body).toMatchObject({ version: 2 });
  });
  it('returns no accounts when the list call fails', async () => {
    mockApi({ 'GET /accounts/ledger-accounts': err(404, 'NOT_FOUND') });
    expect(await svc.paidFromAccounts()).toEqual([]);
  });
});
