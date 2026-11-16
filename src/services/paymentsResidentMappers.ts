/** Response mapping for the module 12 resident calls: one place that reconciles backend shapes. */
import type {
  Advances,
  Checkout,
  Collection,
  CollectionDetail,
  Mandate,
  MandateCreated,
  OrderCreated,
  OrderLine,
  OrderState,
  PaymentPage,
  Payable,
  Payables,
  PublicLink,
  PublicLinkStatus,
  ReceiptUrl,
  ResidentPayment,
} from '@/types/paymentsResident';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : arr(obj(v).items));

export function mapPayable(raw: unknown): Payable {
  const r = obj(raw);
  const type = r.type === 'COLLECTION_REQUEST' ? 'COLLECTION_REQUEST' : 'INVOICE';
  return {
    type,
    id: num(r.id),
    label: str(r.label),
    dueDate: strOrNull(r.dueDate),
    outstandingPaise: numOrNull(r.outstandingPaise),
    suggestedPaise: numOrNull(r.suggestedPaise),
    isOverdue: r.isOverdue === true,
    isDisputed: r.isDisputed === true,
    minPaise: num(r.minPaise, 100),
    maxPaise: num(r.maxPaise, num(r.outstandingPaise)),
    paidPaise: num(r.paidPaise),
  };
}

export function mapPayables(raw: unknown): Payables {
  const r = obj(raw);
  const unit = obj(r.unit);
  const fee = obj(r.fee);
  const live = obj(r.liveOrder);
  const methods: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(fee.methods))) methods[k] = num(v);
  return {
    unit: { id: num(unit.id), label: str(unit.label) },
    items: arr(r.items).map(mapPayable),
    totalDuesPaise: num(r.totalDuesPaise),
    advanceBalancePaise: num(r.advanceBalancePaise),
    payListVersion: str(r.payListVersion),
    allowPartial: r.allowPartial !== false,
    allowAdvance: r.allowAdvance !== false,
    fee: { mode: str(fee.mode, 'ABSORBED'), methods },
    gatewayReady: r.gatewayReady === true,
    offlineInstructions: strOrNull(r.offlineInstructions),
    liveOrder: r.liveOrder ? { orderId: num(live.orderId ?? live.id), status: str(live.status) } : null,
  };
}

export function mapCheckout(raw: unknown): Checkout {
  const c = obj(raw);
  const keyId = strOrNull(c.keyId ?? c.key);
  const upi = strOrNull(c.upiIntentUrl);
  const redirect = strOrNull(c.redirectUrl ?? c.redirect_url);
  return {
    provider: str(c.provider),
    gatewayOrderId: str(c.gatewayOrderId ?? c.order_id),
    keyId,
    name: str(c.name),
    description: str(c.description),
    methods: arr(c.methods).map(m => str(m)),
    upiIntentUrl: upi,
    qrPayload: strOrNull(c.qrPayload),
    redirectUrl: redirect,
    isFake: !keyId && !upi && !redirect && !c.qrPayload,
    raw: c,
  };
}

const mapLine = (l: unknown): OrderLine => ({
  label: str(obj(l).label),
  amountPaise: num(obj(l).amountPaise),
});

export function mapOrderCreated(raw: unknown): OrderCreated {
  const r = obj(raw);
  return {
    orderId: num(r.orderId),
    status: str(r.status, 'CREATED'),
    basePaise: num(r.basePaise),
    convenienceFeePaise: num(r.convenienceFeePaise),
    convenienceFeeGstPaise: num(r.convenienceFeeGstPaise),
    grossAmountPaise: num(r.grossAmountPaise),
    expiresAt: strOrNull(r.expiresAt),
    lines: arr(r.lines).map(mapLine),
    checkout: mapCheckout(r.checkout),
  };
}

export function mapOrderState(raw: unknown): OrderState {
  const r = obj(raw);
  const p = r.payment ? obj(r.payment) : null;
  return {
    orderId: num(r.orderId),
    status: str(r.status, 'CREATED'),
    payment: p
      ? {
          id: num(p.id),
          receiptNo: strOrNull(p.receiptNo),
          amountPaise: num(p.amountPaise),
          paymentDate: str(p.paymentDate),
        }
      : null,
    message: strOrNull(r.message),
    expiresAt: strOrNull(r.expiresAt),
    lines: arr(r.lines).map(mapLine),
    grossAmountPaise: numOrNull(r.grossAmountPaise),
  };
}

export function mapPayment(raw: unknown): ResidentPayment {
  const r = obj(raw);
  return {
    id: num(r.id),
    unitId: num(r.unitId),
    unitLabel: str(r.unitLabel),
    method: str(r.method),
    status: str(r.status),
    amountPaise: num(r.amountPaise),
    convenienceFeePaise: num(r.convenienceFeePaise),
    grossAmountPaise: num(r.grossAmountPaise, num(r.amountPaise)),
    toInvoicesPaise: num(r.toInvoicesPaise),
    toCollectionsPaise: num(r.toCollectionsPaise),
    toAdvancePaise: num(r.toAdvancePaise),
    paymentDate: str(r.paymentDate),
    receiptNo: strOrNull(r.receiptNo),
    receiptStatus: strOrNull(r.receiptStatus),
  };
}

export function mapPaymentPage(
  data: unknown,
  pagination?: { page: number; totalPages: number },
): PaymentPage {
  return {
    items: rows(data).map(mapPayment),
    page: pagination?.page ?? 1,
    totalPages: pagination?.totalPages ?? 1,
  };
}

export function mapReceiptUrl(raw: unknown): ReceiptUrl {
  const r = obj(raw);
  return { url: str(r.url), expiresAt: strOrNull(r.expiresAt) };
}

export function mapAdvances(raw: unknown): Advances {
  const r = obj(raw);
  return {
    unitId: num(r.unitId),
    balancePaise: num(r.balancePaise),
    entries: arr(r.entries).map(e => {
      const x = obj(e);
      return {
        id: num(x.id),
        entryType: str(x.entryType),
        amountPaise: num(x.amountPaise),
        balanceAfterPaise: num(x.balanceAfterPaise),
        narration: str(x.narration),
        createdAt: str(x.createdAt),
      };
    }),
  };
}

export function mapMandate(raw: unknown): Mandate {
  const r = obj(raw);
  return {
    id: num(r.id ?? r.mandateId),
    unitId: num(r.unitId),
    unitLabel: str(r.unitLabel),
    mandateType: str(r.mandateType),
    status: str(r.status),
    maxAmountPaise: num(r.maxAmountPaise),
    startDate: str(r.startDate),
    endDate: str(r.endDate),
    debitDaysBeforeDue: numOrNull(r.debitDaysBeforeDue),
    version: num(r.version, 1),
  };
}

export function mapMandateCreated(raw: unknown): MandateCreated {
  const r = obj(raw);
  const a = obj(r.authorisation);
  return {
    mandateId: num(r.mandateId),
    status: str(r.status, 'PENDING_AUTH'),
    upiIntentUrl: strOrNull(a.upiIntentUrl),
    redirectUrl: strOrNull(a.redirectUrl),
    qrPayload: strOrNull(a.qrPayload),
    expiresAt: strOrNull(r.expiresAt),
  };
}

export function mapCollection(raw: unknown): Collection {
  const r = obj(raw);
  return {
    id: num(r.id),
    title: str(r.title),
    kind: str(r.kind),
    purpose: str(r.purpose),
    isMandatory: r.isMandatory === true,
    amountMode: str(r.amountMode),
    amountPerUnitPaise: numOrNull(r.amountPerUnitPaise),
    minAmountPaise: numOrNull(r.minAmountPaise),
    dueDate: strOrNull(r.dueDate),
    status: str(r.status),
    targetPaise: num(r.targetPaise),
    collectedPaise: num(r.collectedPaise),
    percent: num(r.percent),
    contributorCount: numOrNull(r.contributorCount),
    requestCount: numOrNull(r.requestCount),
    myRequests: arr(r.myRequests).map(m => {
      const x = obj(m);
      return {
        id: num(x.id),
        unitId: num(x.unitId),
        unitLabel: str(x.unitLabel),
        status: str(x.status),
        amountPaise: num(x.amountPaise),
        paidPaise: num(x.paidPaise),
      };
    }),
  };
}

export function mapCollectionDetail(raw: unknown): CollectionDetail {
  const r = obj(raw);
  return {
    ...mapCollection(raw),
    whoPaid: Array.isArray(r.whoPaid)
      ? r.whoPaid.map(w => ({ unitLabel: str(obj(w).unitLabel), paidPaise: numOrNull(obj(w).paidPaise) }))
      : null,
    spentPaise: numOrNull(r.spentPaise),
    expenses: arr(r.expenses).map(e => {
      const x = obj(e);
      return {
        title: str(x.title),
        category: str(x.category),
        date: str(x.date),
        amountPaise: num(x.amountPaise),
      };
    }),
  };
}

const LINK_STATUS: PublicLinkStatus[] = ['PAYABLE', 'PAID', 'EXPIRED', 'CANCELLED'];
export function mapPublicLink(raw: unknown): PublicLink {
  const r = obj(raw);
  const s = str(r.status) as PublicLinkStatus;
  return {
    societyName: str(r.societyName),
    unitLabel: str(r.unitLabel),
    payerNameMasked: str(r.payerNameMasked),
    amountPaise: num(r.amountPaise),
    status: LINK_STATUS.includes(s) ? s : 'EXPIRED',
    expiresAt: strOrNull(r.expiresAt),
  };
}
