/**
 * All response mapping for sub-module 11.2 lives here, so the real backend shapes are reconciled in one place.
 * Amounts may arrive as numbers or numeric strings; ids as numbers or strings.
 */
import type {
  OpeningBalanceRow,
  OpeningImportResult,
  OpeningList,
  OpeningPostResult,
  OpeningStatus,
  OpeningTotals,
  Statement,
  StatementEntry,
} from '@/types/ledger';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const STATUSES: OpeningStatus[] = ['DRAFT', 'INVALID', 'POSTED', 'REVERSED'];

export function mapOpeningRow(raw: unknown): OpeningBalanceRow {
  const r = obj(raw);
  const unit = obj(r.unit);
  const status = str(r.status) as OpeningStatus;
  return {
    id: num(r.id),
    unitId: r.unitId == null && unit.id == null ? null : num(r.unitId ?? unit.id),
    unitLabel: str(r.unitLabel ?? unit.label ?? r.unitLabelInput),
    rowNo: num(r.importRowNo ?? r.rowNo),
    asOfDate: str(r.asOfDate),
    arrearsPrincipalPaise: num(r.arrearsPrincipalPaise),
    arrearsInterestPaise: num(r.arrearsInterestPaise),
    advancePaise: num(r.advancePaise),
    status: STATUSES.includes(status) ? status : 'INVALID',
    validationError: strOrNull(r.validationError),
    invoiceId: r.invoiceId == null ? null : num(r.invoiceId),
    postedAt: strOrNull(r.postedAt),
    reversedAt: strOrNull(r.reversedAt),
    version: num(r.version, 1),
  };
}

export function mapOpeningTotals(raw: unknown): OpeningTotals {
  const t = obj(raw);
  return {
    draftArrearsPaise: num(t.draftArrearsPaise),
    draftAdvancePaise: num(t.draftAdvancePaise),
    invalidCount: num(t.invalidCount),
    postedCount: num(t.postedCount),
  };
}

/** `data` is either the row array (totals next to it in the envelope) or `{ items, totals }`. */
export function mapOpeningList(data: unknown, extra: unknown, total?: number): OpeningList {
  const d = obj(data);
  const rows = Array.isArray(data) ? data : Array.isArray(d.items) ? (d.items as unknown[]) : [];
  const totals = mapOpeningTotals(d.totals ?? obj(extra).totals);
  return { items: rows.map(mapOpeningRow), totals, total: total ?? rows.length };
}

const count = (v: unknown) => (Array.isArray(v) ? v.length : num(v));

/** Spec 8.23 answers `{ draft, invalid, totals }`: counts or row arrays are both accepted. */
export function mapImportResult(raw: unknown): OpeningImportResult {
  const r = obj(raw);
  const totals = mapOpeningTotals(r.totals);
  return {
    draftCount: count(r.draft ?? r.draftCount),
    invalidCount: count(r.invalid ?? r.invalidCount ?? totals.invalidCount),
    totals,
    dryRun: r.dryRun === true,
    errors: (Array.isArray(r.errors) ? r.errors : []).map(e => ({
      rowNo: num(obj(e).rowNo),
      unit: str(obj(e).unit),
      message: str(obj(e).message),
    })),
  };
}

export function mapPostResult(raw: unknown): OpeningPostResult {
  const r = obj(raw);
  return {
    posted: num(r.posted),
    totalArrearsPaise: num(r.totalArrearsPaise),
    totalAdvancePaise: num(r.totalAdvancePaise),
  };
}

export function mapStatementEntry(raw: unknown): StatementEntry {
  const e = obj(raw);
  return {
    id: num(e.id),
    entryDate: str(e.entryDate),
    entryType: str(e.entryType),
    refType: str(e.refType),
    refId: num(e.refId),
    narration: str(e.narration),
    debitPaise: num(e.debitPaise),
    creditPaise: num(e.creditPaise),
    balancePaise: num(e.balancePaise),
  };
}

export function mapStatement(raw: unknown): Statement {
  const s = obj(raw);
  const unit = obj(s.unit);
  return {
    unit: { id: num(unit.id), label: str(unit.label) },
    from: str(s.from),
    to: str(s.to),
    openingBalancePaise: num(s.openingBalancePaise),
    entries: (Array.isArray(s.entries) ? s.entries : []).map(mapStatementEntry),
    closingBalancePaise: num(s.closingBalancePaise),
  };
}
