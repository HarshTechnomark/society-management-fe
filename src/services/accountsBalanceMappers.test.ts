import { describe, expect, it } from 'vitest';
import { mapBalance, mapFundStatement, mapHistory, mapResidentFinances } from './accountsBalanceMappers';

describe('accountsBalanceMappers', () => {
  it('maps the balance with defaults and derives a missing direction', () => {
    const b = mapBalance({
      totalPaise: '500',
      bankAccounts: [{ id: 3, bankName: 'HDFC', maskedNumber: 'XXXX4821', balancePaise: 400 }],
      funds: [{ id: 1, name: 'Sinking', fundType: 'SINKING', balancePaise: 100 }],
      movements: [{ journalEntryId: 1, deltaTotalPaise: -50, label: 'x' }],
    });
    expect(b.totalPaise).toBe(500);
    expect(b.cashPaise).toBe(0);
    expect(b.bankAccounts[0].displayName).toBe('HDFC');
    expect(b.movements[0].direction).toBe('DOWN');
    expect(mapBalance(null).bankAccounts).toEqual([]);
  });
  it('maps history points and tolerates junk', () => {
    expect(mapHistory({ points: [{ date: '2026-10-20', totalPaise: 5 }] })[0].totalPaise).toBe(5);
    expect(mapHistory(undefined)).toEqual([]);
  });
  it('keeps spendByCategory null at BALANCE level', () => {
    const r = mapResidentFinances({
      level: 'BALANCE',
      totalPaise: 1,
      funds: [{ id: 1, name: 'A', balancePaise: 2 }],
    });
    expect(r.spendByCategory).toBeNull();
    expect(r.funds[0].balancePaise).toBe(2);
    const f = mapResidentFinances({
      level: 'FULL',
      spendByCategory: [{ category: 'Repairs', amountPaise: 9 }],
    });
    expect(f.level).toBe('FULL');
    expect(f.spendByCategory?.[0].amountPaise).toBe(9);
  });
  it('maps a fund statement', () => {
    const s = mapFundStatement({
      fund: { id: 2, name: 'R' },
      collectedPaise: 10,
      contributors: 4,
      spend: [{ category: 'c', amountPaise: 3 }],
    });
    expect(s.fund.name).toBe('R');
    expect(s.contributors).toBe(4);
    expect(s.spend).toHaveLength(1);
  });
});
