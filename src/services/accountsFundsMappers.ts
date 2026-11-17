/** Response mapping for the module 13 fund routes (spec 8.13), so the real shapes are reconciled in one place. */
import type {
  Fund,
  FundOption,
  FundStatement,
  FundStatementRow,
  FundTransferResult,
  FundType,
} from '@/types/accountsFunds';

type Obj = Record<string, unknown>;
export const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
export const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
export const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
export const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
/** A list that arrives bare, as `{ items }` or under a named key. */
export const rowsOf = (v: unknown, key = 'items'): unknown[] => {
  const o = obj(v);
  return Array.isArray(v) ? v : Array.isArray(o[key]) ? (o[key] as unknown[]) : [];
};

export function mapFund(raw: unknown): Fund {
  const r = obj(raw);
  return {
    id: num(r.id),
    name: str(r.name),
    fundType: str(r.fundType, 'CUSTOM') as FundType,
    ledgerCode: str(r.ledgerCode),
    balancePaise: num(r.balancePaise),
    inflowFyPaise: num(r.inflowFyPaise),
    outflowFyPaise: num(r.outflowFyPaise),
    movedOutFyPaise: num(r.movedOutFyPaise ?? r.movedOutPaise),
    showToResidents: r.showToResidents !== false && r.showToResidents !== 0,
    status: str(r.status, 'ACTIVE') === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
    version: num(r.version, 1),
    purpose: str(r.purpose),
    usageRequiresResolution: r.usageRequiresResolution === true || r.usageRequiresResolution === 1,
  };
}

export function mapFundOption(raw: unknown): FundOption & { active: boolean } {
  const f = mapFund(raw);
  const r = obj(raw);
  return {
    id: f.id,
    label: str(r.name, str(r.label)),
    fundType: f.fundType,
    balancePaise: r.balancePaise === undefined || r.balancePaise === null ? undefined : f.balancePaise,
    active: r.isActive !== false && f.status === 'ACTIVE',
  };
}

export function mapStatement(raw: unknown): FundStatement {
  const r = obj(raw);
  return {
    openingPaise: num(r.openingPaise),
    closingPaise: num(r.closingPaise),
    rows: rowsOf(r, 'rows').map((x): FundStatementRow => {
      const o = obj(x);
      return {
        date: str(o.date),
        voucherNo: str(o.voucherNo),
        narration: str(o.narration),
        inPaise: num(o.inPaise),
        outPaise: num(o.outPaise),
        runningPaise: num(o.runningPaise),
      };
    }),
  };
}

/** `202 { approvalRequestId, status }` means waiting for approval; a voucher (`201`) means it is posted. */
export function mapTransfer(raw: unknown): FundTransferResult {
  const r = obj(raw);
  const approvalRequestId = r.approvalRequestId == null ? null : num(r.approvalRequestId);
  const status = str(r.status, approvalRequestId == null ? 'POSTED' : 'PENDING');
  const done = approvalRequestId == null || status === 'APPROVED' || status === 'POSTED';
  return { done, approvalRequestId, status };
}
