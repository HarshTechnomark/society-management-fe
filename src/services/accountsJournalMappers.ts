/** Normalisers from the module 13 chart, journal and opening shapes (spec 8.10 to 8.12) to `types/accountsJournal.ts`. Never throw. */
import type {
  AccountType,
  FundOption,
  JournalDetail,
  JournalItem,
  JournalLine,
  JournalRef,
  JournalSource,
  JournalStatus,
  LedgerAccount,
  OpeningBalanceResult,
  Pagination,
} from '@/types/accountsJournal';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const str = (v: unknown, d = ''): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : d;
const strN = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numN = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

export function normaliseAccount(raw: unknown, parentId: number | null = null): LedgerAccount {
  const r = obj(raw);
  return {
    id: num(r.id),
    code: str(r.code),
    name: str(r.name),
    accountType: str(r.accountType, 'ASSET') as AccountType,
    subtype: str(r.subtype, 'OTHER'),
    parentId: numN(r.parentId) ?? parentId,
    isGroup: r.isGroup === true,
    isActive: r.isActive !== false,
    isSystem: r.isSystem === true,
    isCashBookCategory: r.isCashBookCategory === true,
    transparencyCategory: strN(r.transparencyCategory),
    description: strN(r.description),
    balancePaise: numN(r.balancePaise),
    version: num(r.version, 1),
    children: Array.isArray(r.children) ? r.children.map(c => normaliseAccount(c, num(r.id))) : [],
  };
}

export const normaliseTree = (data: unknown): LedgerAccount[] => rows(data).map(a => normaliseAccount(a));

/** Every account of the tree in reading order. */
export function flattenTree(tree: LedgerAccount[]): LedgerAccount[] {
  const out: LedgerAccount[] = [];
  const walk = (list: LedgerAccount[]) =>
    list.forEach(a => {
      out.push(a);
      walk(a.children);
    });
  walk(tree);
  return out;
}

const ref = (raw: unknown): JournalRef | null => {
  const r = obj(raw);
  return r.id === undefined || r.id === null ? null : { id: num(r.id), voucherNo: strN(r.voucherNo) };
};

export function normaliseJournal(raw: unknown): JournalItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    voucherNo: strN(r.voucherNo),
    voucherType: str(r.voucherType, 'JOURNAL'),
    entryDate: str(r.entryDate, str(r.date)),
    narration: str(r.narration),
    source: str(r.source, 'MANUAL') as JournalSource,
    status: str(r.status, 'DRAFT') as JournalStatus,
    totalPaise: num(r.totalPaise),
    refType: str(r.refType),
    refId: str(r.refId),
    version: num(r.version, 1),
    createdBy: numN(r.createdBy),
  };
}

export function normaliseLine(raw: unknown, i = 0): JournalLine {
  const r = obj(raw);
  const acc = obj(r.ledgerAccount);
  return {
    lineNo: num(r.lineNo, i + 1),
    ledgerAccountId: numN(r.ledgerAccountId) ?? numN(acc.id),
    ledgerAccountCode: str(r.ledgerAccountCode, str(r.code, str(acc.code))),
    ledgerAccountName: str(r.ledgerAccountName, str(r.name, str(acc.name))),
    fundId: numN(r.fundId),
    fundName: strN(r.fundName),
    debitPaise: num(r.debitPaise),
    creditPaise: num(r.creditPaise),
    lineNarration: strN(r.lineNarration),
  };
}

export function normaliseJournalDetail(raw: unknown): JournalDetail {
  const r = obj(raw);
  const base = normaliseJournal(r);
  const lines = (Array.isArray(r.lines) ? r.lines : []).map(normaliseLine);
  const link = obj(r.sourceLink ?? r.sourceRef);
  const derived = lines.reduce((s, l) => s + l.debitPaise - l.creditPaise, 0);
  return {
    ...base,
    instrumentRef: strN(r.instrumentRef),
    lines,
    differencePaise: num(r.difference, derived),
    reversalOf: ref(r.reversalOf),
    reversedBy: ref(r.reversedBy),
    reversalReason: strN(r.reversalReason),
    rejectionReason: strN(r.rejectionReason),
    approvalRequestId: numN(r.approvalRequestId),
    sourceLink: strN(link.refType)
      ? { refType: str(link.refType), refId: str(link.refId), label: str(link.label, str(link.refType)) }
      : null,
    postedAt: strN(r.postedAt),
    audit: (Array.isArray(r.timeline) ? r.timeline : Array.isArray(r.audit) ? r.audit : []).map(a => {
      const x = obj(a);
      return {
        at: str(x.at, str(x.createdAt)),
        action: str(x.action),
        by: strN(x.by) ?? strN(x.actorName),
        note: strN(x.note) ?? strN(x.reason),
      };
    }),
  };
}

export function normaliseOpening(raw: unknown): OpeningBalanceResult {
  const r = obj(raw);
  const j = obj(r.journal);
  return {
    journalId: numN(r.journalEntryId) ?? numN(r.journalId) ?? numN(j.id) ?? numN(r.id),
    voucherNo: strN(r.voucherNo) ?? strN(j.voucherNo),
    asOfDate: strN(r.entryDate) ?? strN(r.asOfDate) ?? strN(j.entryDate),
    totalPaise: num(r.totalPaise, num(j.totalPaise)),
    autoBalancePaise: num(
      r.autoBalancePaise,
      num(obj(r.balancingLine).debitPaise) + num(obj(r.balancingLine).creditPaise),
    ),
  };
}

export function normaliseFunds(data: unknown): FundOption[] {
  return rows(data)
    .map(f => ({ id: num(obj(f).id), name: str(obj(f).name) }))
    .filter(f => f.id > 0);
}
