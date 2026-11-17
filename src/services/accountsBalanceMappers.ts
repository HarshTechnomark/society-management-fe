/** Response mapping for the society balance calls: tolerant of missing fields. */
import type {
  BalanceBankAccount,
  BalanceFund,
  BalanceMovement,
  BalancePoint,
  CategoryAmount,
  FundLineKind,
  FundStatement,
  ResidentFinances,
  SocietyBalance,
} from '@/types/accountsBalance';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

function mapBank(raw: unknown): BalanceBankAccount {
  const r = obj(raw);
  return {
    id: num(r.id),
    displayName: str(r.displayName, str(r.bankName)),
    bankName: str(r.bankName),
    maskedNumber: str(r.maskedNumber),
    balancePaise: num(r.balancePaise),
    isCollectionAccount: r.isCollectionAccount === true,
    verificationStatus: str(r.verificationStatus),
    lastReconciledDate: strOrNull(r.lastReconciledDate),
    lastReconciledBalancePaise:
      r.lastReconciledBalancePaise == null ? null : num(r.lastReconciledBalancePaise),
  };
}
const mapFund = (raw: unknown): BalanceFund => {
  const r = obj(raw);
  return { id: num(r.id), name: str(r.name), fundType: str(r.fundType), balancePaise: num(r.balancePaise) };
};
function mapMovement(raw: unknown): BalanceMovement {
  const r = obj(raw);
  const delta = num(r.deltaTotalPaise);
  const d = r.direction;
  return {
    journalEntryId: num(r.journalEntryId),
    changedAt: str(r.changedAt),
    // the API says IN, OUT, MOVE or FUND_ONLY (spec 8.1); the card shows up, down or move
    direction:
      d === 'IN' || d === 'UP'
        ? 'UP'
        : d === 'OUT' || d === 'DOWN'
          ? 'DOWN'
          : d === 'MOVE' || d === 'FUND_ONLY'
            ? 'MOVE'
            : delta > 0
              ? 'UP'
              : delta < 0
                ? 'DOWN'
                : 'MOVE',
    deltaTotalPaise: delta,
    label: str(r.label),
    totalPaise: num(r.totalPaise),
  };
}
export function mapBalance(raw: unknown): SocietyBalance {
  const r = obj(raw);
  return {
    totalPaise: num(r.totalPaise),
    inBankPaise: num(r.inBankPaise),
    clearingPaise: num(r.clearingPaise),
    cashPaise: num(r.cashPaise),
    chequesPaise: num(r.chequesPaise),
    investmentsPaise: num(r.investmentsPaise),
    earmarkedFundsPaise: num(r.earmarkedFundsPaise),
    generalPaise: num(r.generalPaise),
    lastChangedAt: strOrNull(r.lastChangedAt),
    bankAccounts: arr(r.bankAccounts).map(mapBank),
    funds: arr(r.funds).map(mapFund),
    movements: arr(r.movements).map(mapMovement),
  };
}
export function mapHistory(raw: unknown): BalancePoint[] {
  return arr(obj(raw).points).map(p => {
    const r = obj(p);
    return {
      date: str(r.date),
      totalPaise: num(r.totalPaise),
      inBankPaise: num(r.inBankPaise),
      clearingPaise: num(r.clearingPaise),
      cashPaise: num(r.cashPaise),
      chequesPaise: num(r.chequesPaise),
    };
  });
}
const mapCats = (v: unknown): CategoryAmount[] | null =>
  Array.isArray(v)
    ? v.map(c => {
        const r = obj(c);
        return {
          category: str(r.category),
          financialYear: strOrNull(r.financialYear),
          amountPaise: num(r.amountPaise),
        };
      })
    : null;
export function mapResidentFinances(raw: unknown): ResidentFinances {
  const r = obj(raw);
  return {
    level: r.level === 'FULL' ? 'FULL' : 'BALANCE',
    totalPaise: num(r.totalPaise),
    inBankPaise: num(r.inBankPaise),
    clearingPaise: num(r.clearingPaise),
    cashPaise: num(r.cashPaise),
    chequesPaise: num(r.chequesPaise),
    changedAt: strOrNull(r.changedAt),
    funds: arr(r.funds).map(f => {
      const o = obj(f);
      return { id: num(o.id), name: str(o.name), balancePaise: num(o.balancePaise) };
    }),
    spendByCategory: mapCats(r.spendByCategory),
    incomeByCategory: mapCats(r.incomeByCategory),
  };
}
export function mapFundStatement(raw: unknown): FundStatement {
  const r = obj(raw);
  const f = obj(r.fund);
  return {
    fund: { id: num(f.id), name: str(f.name) },
    collectedPaise: num(r.collectedPaise),
    spentPaise: num(r.spentPaise),
    movedInPaise: num(r.movedInPaise),
    movedOutPaise: num(r.movedOutPaise),
    balancePaise: num(r.balancePaise),
    contributors: num(r.contributors),
    spend: arr(r.spend).map(s => {
      const o = obj(s);
      return { category: str(o.category), amountPaise: num(o.amountPaise) };
    }),
    lines: arr(r.lines)
      .map(l => {
        const o = obj(l);
        return {
          kind: str(o.kind) as FundLineKind,
          date: str(o.date),
          label: str(o.label ?? o.description ?? o.narration ?? o.category),
          amountPaise: num(o.amountPaise),
        };
      })
      .filter(l => LINE_KINDS.includes(l.kind)),
  };
}
const LINE_KINDS: string[] = ['EXPENSE', 'TRANSFER_OUT', 'TRANSFER_IN', 'CONTRIBUTION'];
