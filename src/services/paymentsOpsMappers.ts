/** Normalisers from the module 12 admin shapes (spec 7.4, 7.6, 7.7, 8.7, 8.16 to 8.20) to `types/paymentsOps.ts`. Never throw. */
import type {
  AdvanceEntry,
  CreatedLink,
  Mandate,
  OrderItem,
  PaymentOrder,
  Refund,
  UnitAdvances,
} from '@/types/paymentsOps';
import type { Pagination } from '@/types/paymentsOps';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
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

export function normaliseRefund(raw: unknown): Refund {
  const r = obj(raw);
  const pay = obj(r.payment);
  return {
    id: num(r.id),
    refundNo: strN(r.refundNo),
    unitId: numN(r.unitId),
    unitLabel: str(r.unitLabel, str(obj(r.unit).label)),
    paymentId: num(r.paymentId, num(pay.id)),
    receiptNo: strN(r.receiptNo) ?? strN(pay.receiptNo),
    amountPaise: num(r.amountPaise),
    mode: str(r.mode, 'BANK_TRANSFER') as Refund['mode'],
    status: str(r.status, 'PENDING_APPROVAL') as Refund['status'],
    reason: str(r.reason),
    payeeName: strN(r.payeeName),
    payeeAccountMasked: strN(r.payeeAccountMasked),
    bankReference: strN(r.bankReference),
    paidOutOn: strN(r.paidOutOn),
    failureReason: strN(r.failureReason),
    rejectedReason: strN(r.rejectedReason),
    createdAt: str(r.createdAt),
    processedAt: strN(r.processedAt),
    version: num(r.version, 1),
    approvalRequestId: numN(r.approvalRequestId) ?? numN(obj(r.approval).requestId),
  };
}

const orderItem = (raw: unknown): OrderItem => {
  const i = obj(raw);
  return { itemType: str(i.itemType), label: str(i.label), amountPaise: num(i.amountPaise) };
};

export function normaliseOrder(raw: unknown): PaymentOrder {
  const o = obj(raw);
  const id = num(o.id, num(o.orderId));
  return {
    id,
    unitLabel: str(o.unitLabel),
    sourceType: str(o.sourceType, 'PAY_LIST') as PaymentOrder['sourceType'],
    status: str(o.status, 'CREATED') as PaymentOrder['status'],
    grossAmountPaise: num(o.grossAmountPaise),
    basePaise: numN(o.basePaise),
    convenienceFeePaise: numN(o.convenienceFeePaise),
    expiresAt: strN(o.expiresAt),
    paidAt: strN(o.paidAt),
    attemptCount: num(o.attemptCount),
    linkShortCode: strN(o.linkShortCode),
    failureReason: strN(o.failureReason),
    ...('gatewayOrderId' in o ? { gatewayOrderId: strN(o.gatewayOrderId) } : {}),
    paymentId: numN(o.paymentId) ?? numN(obj((Array.isArray(o.payments) ? o.payments : [])[0]).id),
    items: (Array.isArray(o.items) ? o.items : []).map(orderItem),
    createdAt: str(o.createdAt),
  };
}

export function normaliseMandate(raw: unknown): Mandate {
  const m = obj(raw);
  return {
    id: num(m.id),
    unitLabel: str(m.unitLabel),
    payerName: str(m.payerName),
    mandateType: str(m.mandateType, 'UPI_AUTOPAY') as Mandate['mandateType'],
    maxAmountPaise: num(m.maxAmountPaise),
    status: str(m.status, 'PENDING_AUTH') as Mandate['status'],
    lastDebitAt: strN(m.lastDebitAt),
    lastDebitStatus: strN(m.lastDebitStatus) as Mandate['lastDebitStatus'],
    payerInstrumentMasked: strN(m.payerInstrumentMasked),
    version: num(m.version, 1),
  };
}

export function normaliseLink(raw: unknown): CreatedLink {
  const l = obj(raw);
  return {
    orderId: num(l.orderId),
    url: str(l.url),
    expiresAt: strN(l.expiresAt),
    amountPaise: num(l.amountPaise),
  };
}

const entry = (raw: unknown): AdvanceEntry => {
  const e = obj(raw);
  return {
    id: num(e.id),
    entryType: str(e.entryType),
    amountPaise: num(e.amountPaise),
    balanceAfterPaise: num(e.balanceAfterPaise),
    narration: str(e.narration),
    createdAt: str(e.createdAt),
  };
};

export function normaliseAdvances(raw: unknown): UnitAdvances {
  const a = obj(raw);
  return {
    unitId: num(a.unitId),
    balancePaise: num(a.balancePaise),
    entries: (Array.isArray(a.entries) ? a.entries : []).map(entry),
  };
}
