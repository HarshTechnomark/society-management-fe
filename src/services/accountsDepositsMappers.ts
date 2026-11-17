/** Normalisers from the module 13 deposit shapes (spec 7.12, 8.17) to `types/accountsDeposits.ts`. Never throw. */
import type {
  Deposit,
  DepositAdjustment,
  DepositKind,
  DepositStatus,
  DepositSummary,
  PaidFromAccount,
  Pagination,
} from '@/types/accountsDeposits';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strN = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};

export const rows = (data: unknown): unknown[] =>
  Array.isArray(data) ? data : Array.isArray(obj(data).items) ? (obj(data).items as unknown[]) : [];

export function normalisePagination(raw: unknown, shown: number): Pagination {
  const p = obj(raw);
  return {
    page: num(p.page, 1),
    limit: num(p.limit, shown || 20),
    total: num(p.total, shown),
    totalPages: Math.max(1, num(p.totalPages, 1)),
  };
}

function adjustment(raw: unknown): DepositAdjustment {
  const a = obj(raw);
  const by = obj(a.by);
  return {
    kind: str(a.kind, 'DEDUCTION') as DepositAdjustment['kind'],
    amountPaise: num(a.amountPaise),
    reason: str(a.reason),
    at: str(a.at),
    by: strN(a.by) ?? strN(by.name) ?? strN(a.byName),
  };
}

export function normaliseDeposit(raw: unknown): Deposit {
  const r = obj(raw);
  const id = num(r.id);
  const received = num(r.receivedPaise);
  const deducted = num(r.deductedPaise);
  const refunded = num(r.refundedPaise);
  return {
    id,
    code: str(r.code, `DEP-${id}`),
    unitId: r.unitId == null ? null : num(r.unitId),
    unitLabel: str(r.unitLabel, str(obj(r.unit).label)),
    kind: str(r.kind, 'OTHER') as DepositKind,
    title: str(r.title),
    status: str(r.status, 'AWAITING_PAYMENT') as DepositStatus,
    amountPaise: num(r.amountPaise),
    receivedPaise: received,
    deductedPaise: deducted,
    refundedPaise: refunded,
    refundRequestedPaise: num(r.refundRequestedPaise),
    heldPaise: r.heldPaise == null ? Math.max(received - deducted - refunded, 0) : num(r.heldPaise),
    isOpening: r.isOpening === true || r.isOpening === 1,
    dueDate: strN(r.dueDate),
    receivedAt: strN(r.receivedAt),
    refundedAt: strN(r.refundedAt),
    refundMode: strN(r.refundMode),
    refundReference: strN(r.refundReference),
    cancelReason: strN(r.cancelReason),
    notes: strN(r.notes),
    adjustments: Array.isArray(r.adjustments) ? r.adjustments.map(adjustment) : [],
    createdAt: str(r.createdAt),
    version: num(r.version, 1),
  };
}

export const normaliseSummary = (raw: unknown): DepositSummary => {
  const r = obj(raw);
  return {
    heldPaise: num(r.heldPaise),
    refundedPaise: num(r.refundedPaise),
    forfeitedPaise: num(r.forfeitedPaise),
  };
};

/** Flattens the chart of accounts (tree or list) to active BANK, CASH and PETTY_CASH leaves. */
export function paidFromAccounts(data: unknown): PaidFromAccount[] {
  const out: PaidFromAccount[] = [];
  const walk = (raw: unknown) => {
    const a = obj(raw);
    const kids = Array.isArray(a.children) ? a.children : [];
    if (kids.length) kids.forEach(walk);
    else if (
      a.isGroup !== true &&
      ['BANK', 'CASH', 'PETTY_CASH'].includes(str(a.subtype)) &&
      a.isActive !== false &&
      a.status !== 'INACTIVE'
    )
      out.push({ id: num(a.id), code: str(a.code), name: str(a.name) });
  };
  const list = Array.isArray(data) ? data : Array.isArray(obj(data).items) ? obj(data).items : [data];
  (list as unknown[]).forEach(walk);
  return out.filter(a => a.id > 0);
}
