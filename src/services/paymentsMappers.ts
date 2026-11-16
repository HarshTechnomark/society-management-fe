/** Response mapping for the module 12 admin payment routes, so the real backend shapes are reconciled in one place. */
import type {
  Allocation,
  BankAccountOption,
  ChequeDepositResult,
  ChequeInfo,
  CollectionOption,
  CollectionRequestRef,
  LiveFeedItem,
  OpenInvoice,
  OfflinePaymentResult,
  PaymentDetail,
  PaymentItem,
  PaymentPage,
  PaymentStatus,
  PaymentSummary,
  ReceiptStatus,
  TimelineEntry,
} from '@/types/payments';
import type { Pagination } from '@/lib/apiClient';

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
/** A list that arrives bare, as `{ items }` or under a named key. */
export const rowsOf = (v: unknown, key = 'items'): unknown[] => (Array.isArray(v) ? v : arr(obj(v)[key]));

export function mapPayment(raw: unknown): PaymentItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    unitId: num(r.unitId),
    unitLabel: str(r.unitLabel),
    payerName: str(r.payerName),
    source: str(r.source, 'OFFLINE'),
    method: str(r.method),
    status: str(r.status, 'PENDING_APPROVAL') as PaymentStatus,
    amountPaise: num(r.amountPaise),
    convenienceFeePaise: num(r.convenienceFeePaise),
    grossAmountPaise: num(r.grossAmountPaise, num(r.amountPaise)),
    toInvoicesPaise: num(r.toInvoicesPaise),
    toCollectionsPaise: num(r.toCollectionsPaise),
    toAdvancePaise: num(r.toAdvancePaise),
    refundedPaise: num(r.refundedPaise),
    paymentDate: str(r.paymentDate),
    capturedAt: strOrNull(r.capturedAt),
    receiptNo: strOrNull(r.receiptNo),
    receiptStatus: str(r.receiptStatus, 'NONE') as ReceiptStatus,
    referenceNo: strOrNull(r.referenceNo),
    needsReview: r.needsReview === true,
    isDuplicateSuspect: r.isDuplicateSuspect === true,
    version: num(r.version, 1),
  };
}

function mapAllocation(raw: unknown): Allocation {
  const a = obj(raw);
  return {
    id: num(a.id),
    source: str(a.source),
    targetType: str(a.targetType),
    invoiceId: numOrNull(a.invoiceId),
    invoiceNo: strOrNull(a.invoiceNo),
    collectionRequestId: numOrNull(a.collectionRequestId),
    collectionTitle: strOrNull(a.collectionTitle),
    amountPaise: num(a.amountPaise),
    reasonCode: strOrNull(a.reasonCode),
    reversalOfId: numOrNull(a.reversalOfId),
    allocatedOn: strOrNull(a.allocatedOn),
  };
}

function mapCheque(raw: unknown): ChequeInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = obj(raw);
  return {
    bankName: str(c.bankName),
    chequeNo: str(c.chequeNo),
    chequeDate: str(c.chequeDate),
    depositedOn: strOrNull(c.depositedOn),
    depositBankAccountId: numOrNull(c.depositBankAccountId),
    clearedOn: strOrNull(c.clearedOn),
    bouncedOn: strOrNull(c.bouncedOn),
    bounceReason: strOrNull(c.bounceReason),
    bounceChargeInvoiceId: numOrNull(c.bounceChargeInvoiceId),
  };
}

export function mapPaymentDetail(raw: unknown): PaymentDetail {
  const r = obj(raw);
  const approval = obj(r.approval);
  return {
    ...mapPayment(raw),
    allocations: arr(r.allocations).map(mapAllocation),
    cheque: mapCheque(r.cheque),
    proofFiles: arr(r.proofFiles).map(f => ({
      id: num(obj(f).id),
      name: str(obj(f).name ?? obj(f).fileName, 'Proof'),
    })),
    approval: approval.requestId
      ? { requestId: num(approval.requestId), status: str(approval.status) }
      : null,
    timeline: arr(r.timeline).map((t): TimelineEntry => ({
      at: str(obj(t).at),
      event: str(obj(t).event),
      by: str(obj(t).by),
    })),
    receiptRevision: num(r.receiptRevision, 1),
    notes: strOrNull(r.notes),
    reviewReason: strOrNull(r.reviewReason),
    recordedBy:
      strOrNull(r.recordedByName ?? r.recordedBy ?? r.createdByName) ??
      (arr(r.timeline)
        .map(t => obj(t))
        .find(t => /recorded|created/i.test(str(t.event)) && str(t.by))?.by as string | undefined) ??
      null,
    landsInAccount: strOrNull(
      r.landsInAccount ?? r.bankAccountName ?? obj(r.bankAccount).label ?? obj(r.bankAccount).name,
    ),
    landsIn: strOrNull(r.landsIn),
    reversalReason: strOrNull(r.reversalReason),
    reversedAt: strOrNull(r.reversedAt),
  };
}

export function mapPaymentPage(data: unknown, pagination: Pagination | undefined): PaymentPage {
  const items = rowsOf(data).map(mapPayment);
  return {
    items,
    page: pagination?.page ?? 1,
    totalPages: Math.max(1, pagination?.totalPages ?? 1),
    total: pagination?.total ?? items.length,
  };
}

export function mapOfflineResult(raw: unknown): OfflinePaymentResult {
  const r = obj(raw);
  const a = obj(r.approval);
  return {
    id: num(r.id),
    status: str(r.status, 'PENDING_APPROVAL') as PaymentStatus,
    method: str(r.method),
    amountPaise: num(r.amountPaise),
    receiptNo: strOrNull(r.receiptNo),
    approval: a.requestId ? { requestId: num(a.requestId), status: str(a.status) } : null,
    version: num(r.version, 1),
  };
}

export function mapDeposit(raw: unknown): ChequeDepositResult {
  const r = obj(raw);
  return {
    deposited: num(r.deposited),
    payments: arr(r.payments).map(p => ({
      id: num(obj(p).id),
      status: str(obj(p).status) as PaymentStatus,
      version: num(obj(p).version, 1),
    })),
  };
}

export function mapSummary(raw: unknown): PaymentSummary {
  const r = obj(raw);
  const today = obj(r.today);
  const month = obj(r.month);
  const eff = r.efficiency && typeof r.efficiency === 'object' ? obj(r.efficiency) : null;
  const cheques = obj(r.chequesInClearing);
  const byMethod: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(month.byMethod))) byMethod[k] = num(v);
  return {
    today: { collectedPaise: num(today.collectedPaise), count: num(today.count) },
    month: { collectedPaise: num(month.collectedPaise), count: num(month.count), byMethod },
    efficiency: eff
      ? {
          billedPaise: num(eff.billedPaise),
          collectedAgainstBilledPaise: num(eff.collectedAgainstBilledPaise),
          percent: num(eff.percent),
        }
      : null,
    pendingApprovalCount: num(r.pendingApprovalCount),
    chequesInClearing: { count: num(cheques.count), amountPaise: num(cheques.amountPaise) },
    needsReviewCount: num(r.needsReviewCount),
    generatedAt: strOrNull(r.generatedAt),
  };
}

export function mapLiveItem(raw: unknown): LiveFeedItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    unitLabel: str(r.unitLabel),
    amountPaise: num(r.amountPaise),
    method: str(r.method),
    what: str(r.what, 'maintenance'),
    receiptNo: strOrNull(r.receiptNo),
    at: str(r.at),
  };
}

export function mapCollectionOption(raw: unknown): CollectionOption {
  const r = obj(raw);
  return {
    id: num(r.id),
    title: str(r.title),
    amountPerUnitPaise: num(r.amountPerUnitPaise),
    minAmountPaise: num(r.minAmountPaise),
  };
}

export function mapCollectionRequest(raw: unknown): CollectionRequestRef {
  const r = obj(raw);
  return {
    id: num(r.id),
    unitId: num(r.unitId),
    unitLabel: str(r.unitLabel),
    amountPaise: num(r.amountPaise),
    paidPaise: num(r.paidPaise),
    status: str(r.status),
  };
}

export function mapBankAccount(raw: unknown): BankAccountOption {
  const r = obj(raw);
  const name = str(r.displayName ?? r.bankName, 'Bank account');
  const masked = str(r.maskedNumber);
  return {
    id: num(r.id),
    label: masked ? `${name} ${masked}` : name,
    isCollection: r.isCollectionAccount === true || r.isCollection === true,
  };
}

export function mapOpenInvoice(raw: unknown): OpenInvoice {
  const r = obj(raw);
  return {
    id: num(r.id),
    invoiceNo: str(r.invoiceNo ?? r.number),
    status: str(r.status),
    outstandingPaise: num(r.outstandingPaise ?? r.balancePaise ?? r.dueAmountPaise),
  };
}
