/** Response mapping for the module 13 expense and cash book routes, so real backend shapes are reconciled in one place. */
import type { Pagination } from '@/lib/apiClient';
import type {
  ApprovalAction,
  BankOption,
  CashBook,
  CashBookRow,
  ExpenseDetail,
  ExpenseFile,
  ExpenseItem,
  ExpensePage,
  ExpenseResult,
  ExpenseStatus,
  ExpenseType,
  FundOption,
  LedgerOption,
  LedgerRef,
} from '@/types/accountsExpenses';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const rowsOf = (v: unknown, key = 'items'): unknown[] => (Array.isArray(v) ? v : arr(obj(v)[key]));

const ref = (v: unknown): LedgerRef | null => {
  const r = obj(v);
  return r.id == null ? null : { id: num(r.id), code: str(r.code), name: str(r.name) };
};
const nameOf = (v: unknown): string | null => {
  if (typeof v === 'string') return v || null;
  const r = obj(v);
  return strOrNull(r.name ?? r.displayName ?? r.fullName);
};

export function mapExpense(raw: unknown): ExpenseItem {
  const r = obj(raw);
  const id = num(r.id);
  const fund = obj(r.fund);
  const col = obj(r.collection);
  return {
    id,
    displayId: str(r.displayId, `EXP-${id}`),
    status: str(r.status, 'DRAFT') as ExpenseStatus,
    voucherNo: strOrNull(r.voucherNo),
    expenseType: str(r.expenseType, 'DIRECT') as ExpenseType,
    expenseDate: str(r.expenseDate),
    payee: str(r.payee),
    ledgerAccount: ref(r.ledgerAccount),
    grossAmountPaise: num(r.grossAmountPaise),
    gstPaise: num(r.gstPaise),
    tdsPaise: num(r.tdsPaise),
    netPaidPaise: num(r.netPaidPaise, num(r.grossAmountPaise) - num(r.tdsPaise)),
    paidFrom: ref(r.paidFrom),
    paymentMode: str(r.paymentMode),
    fundId: numOrNull(r.fundId ?? fund.id),
    fundName: strOrNull(r.fundName ?? fund.name),
    collectionId: numOrNull(r.collectionId ?? col.id),
    collectionTitle: strOrNull(r.collectionTitle ?? col.title),
    billFileCount: num(r.billFileCount, arr(r.files).length),
    approvalRequestId: numOrNull(r.approvalRequestId),
    approvalRequired: typeof r.approvalRequired === 'boolean' ? r.approvalRequired : null,
    approvalThresholdPaise: numOrNull(r.approvalThresholdPaise),
    createdByName: strOrNull(r.createdByName) ?? nameOf(r.createdBy),
    version: num(r.version, 1),
  };
}

/** Bills have no URL in the API answer yet (module 01 files); outside production the development store serves them. */
const devFileUrl = (id: number): string | null =>
  process.env.NODE_ENV === 'production' || !id ? null : `/api/v1/dev/files/${id}`;

const mapFile = (raw: unknown): ExpenseFile => {
  const r = obj(raw);
  return {
    id: num(r.id),
    name: str(r.name ?? r.fileName, 'Bill'),
    mimeType: str(r.mimeType),
    status: str(r.status),
    url: strOrNull(r.url ?? r.downloadUrl) ?? devFileUrl(num(r.id)),
  };
};

const mapAction = (raw: unknown): ApprovalAction => {
  const r = obj(raw);
  return {
    action: str(r.action ?? r.type ?? r.status),
    by: nameOf(r.by ?? r.actor ?? r.user) ?? str(r.byName),
    at: strOrNull(r.at ?? r.createdAt ?? r.actedAt),
    note: strOrNull(r.note ?? r.reason ?? r.comment),
  };
};

export function mapExpenseDetail(raw: unknown): ExpenseDetail {
  const r = obj(raw);
  const a = r.approval == null ? null : obj(r.approval);
  const j = obj(r.journal);
  return {
    ...mapExpense(raw),
    description: strOrNull(r.description),
    paymentReference: strOrNull(r.paymentReference),
    tdsSection: strOrNull(r.tdsSection),
    challanNo: strOrNull(r.challanNo),
    rejectionReason: strOrNull(r.rejectionReason),
    approvedByName: nameOf(r.approvedBy) ?? strOrNull(r.approvedByName),
    reversalVoucherNo: strOrNull(r.reversalVoucherNo),
    reversalReason: strOrNull(r.reversalReason),
    files: arr(r.files).map(mapFile),
    approval: a
      ? {
          status: str(a.status),
          levels: numOrNull(Array.isArray(a.levels) ? a.levels.length : a.levels),
          actions: arr(a.actions).map(mapAction),
        }
      : null,
    journalLines: arr(j.lines).map(l => {
      const x = obj(l);
      return {
        account: str(x.account ?? x.accountName ?? obj(x.ledgerAccount).name),
        debitPaise: num(x.debitPaise),
        creditPaise: num(x.creditPaise),
      };
    }),
    journalEntryId: numOrNull(j.id ?? r.journalEntryId),
    canApprove: r.canApprove === true,
    canReverse: r.canReverse === true,
    createdById: numOrNull(
      r.createdById ?? (typeof r.createdBy === 'object' ? obj(r.createdBy).id : r.createdBy),
    ),
  };
}

export const mapExpensePage = (data: unknown[], p?: Pagination): ExpensePage => ({
  items: data.map(mapExpense),
  total: p?.total ?? data.length,
  page: p?.page ?? 1,
  totalPages: p?.totalPages ?? 1,
});

export function mapExpenseResult(raw: unknown): ExpenseResult {
  const r = obj(raw);
  const id = num(r.id);
  return {
    id,
    displayId: str(r.displayId, `EXP-${id}`),
    status: str(r.status, 'DRAFT') as ExpenseStatus,
    voucherNo: strOrNull(r.voucherNo),
    version: num(r.version, 1),
  };
}

export function mapLedgerTree(raw: unknown): LedgerOption[] {
  const out: LedgerOption[] = [];
  const walk = (nodes: unknown[]) => {
    for (const n of nodes) {
      const r = obj(n);
      if (r.isGroup !== true && r.isActive !== false) {
        out.push({
          id: num(r.id),
          code: str(r.code),
          name: str(r.name),
          subtype: str(r.subtype),
          accountType: str(r.accountType),
          isCashBookCategory: r.isCashBookCategory === true,
          balancePaise: numOrNull(r.balancePaise),
        });
      }
      walk(arr(r.children));
    }
  };
  walk(rowsOf(raw, 'accounts'));
  return out;
}

export function mapBank(raw: unknown): BankOption {
  const r = obj(raw);
  const name = str(r.displayName ?? r.bankName, 'Bank account');
  const masked = str(r.maskedNumber);
  return {
    id: num(r.id),
    label: masked ? `${name} ${masked}` : name,
    ledgerAccountId: numOrNull(r.ledgerAccountId ?? obj(r.ledgerAccount).id),
    balancePaise: numOrNull(r.balancePaise),
  };
}

export const mapFund = (raw: unknown): FundOption => {
  const r = obj(raw);
  return { id: num(r.id), name: str(r.name), balancePaise: numOrNull(r.balancePaise) };
};

const mapCashRow = (raw: unknown): CashBookRow => {
  const r = obj(raw);
  return {
    date: str(r.date),
    voucherNo: str(r.voucherNo),
    voucherType: str(r.voucherType),
    narration: str(r.narration),
    account: str(r.account),
    inPaise: num(r.inPaise),
    outPaise: num(r.outPaise),
    runningPaise: num(r.runningPaise),
    refType: strOrNull(r.refType),
    refId: strOrNull(r.refId),
  };
};

export function mapCashBook(data: unknown, p?: Pagination): CashBook {
  const r = obj(data);
  const rows = arr(r.rows).map(mapCashRow);
  return {
    openingPaise: num(r.openingPaise),
    closingPaise: num(r.closingPaise),
    rows,
    total: p?.total ?? rows.length,
    page: p?.page ?? 1,
    totalPages: p?.totalPages ?? 1,
  };
}
