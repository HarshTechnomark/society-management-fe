/**
 * All response mapping for sub-module 11.5 lives here, so the real backend shapes are reconciled in one place.
 * Amounts may arrive as numbers or numeric strings; ids as numbers or strings.
 */
import type {
  AgeingBucket,
  AgeingBucketKey,
  BulkReminderResult,
  Defaulter,
  DefaulterPage,
  DuesSummary,
  InvoiceLine,
  InvoiceStatus,
  LineComputation,
  MyDuesUnit,
  MyInvoice,
  MyInvoiceItem,
  MyInvoiceList,
  OpenInvoiceRef,
  PdfUrl,
} from '@/types/billingDues';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** A list that arrives bare or as `{ items }`. */
export const rowsOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : arr(obj(v).items));

const BUCKETS: AgeingBucketKey[] = ['0_30', '31_60', '61_90', '90_PLUS'];

export function mapSummary(raw: unknown): DuesSummary {
  const r = obj(raw);
  const given = new Map<string, number>();
  if (Array.isArray(r.ageing)) {
    for (const a of r.ageing) given.set(str(obj(a).bucket), num(obj(a).amountPaise));
  } else {
    // also accept `{ '0_30': 123, ... }`
    for (const [k, v] of Object.entries(obj(r.ageing))) given.set(k, num(obj(v).amountPaise ?? v));
  }
  const ageing: AgeingBucket[] = BUCKETS.map(bucket => ({ bucket, amountPaise: given.get(bucket) ?? 0 }));
  const eff = r.efficiencyPct;
  return {
    billedPaise: num(r.billedPaise),
    collectedPaise: num(r.collectedPaise),
    efficiencyPct: eff == null || eff === '' ? null : num(eff),
    outstandingPaise: num(r.outstandingPaise),
    overdueFlats: num(r.overdueFlats),
    ageing,
  };
}

export function mapDefaulter(raw: unknown): Defaulter {
  const d = obj(raw);
  // the backend sends one text, the names already joined by ", " (GROUP_CONCAT), or ''
  const names = Array.isArray(d.billToNames)
    ? d.billToNames.map(n => str(n))
    : str(d.billToNames)
      ? [str(d.billToNames)]
      : [];
  return {
    unitId: num(d.unitId),
    unitLabel: str(d.unitLabel),
    ownerName: str(d.ownerName),
    billToNames: names,
    overduePaise: num(d.overduePaise),
    oldestDueDate: str(d.oldestDueDate),
    daysOverdue: num(d.daysOverdue),
    invoiceCount: num(d.invoiceCount),
  };
}
/** `data: { items, totals: { flats, overduePaise } }` plus the envelope's `pagination`. */
export function mapDefaulters(data: unknown, pagination?: unknown): DefaulterPage {
  const items = rowsOf(data).map(mapDefaulter);
  const t = obj(obj(data).totals);
  const p = obj(pagination);
  return {
    items,
    totals: {
      flats: num(t.flats, items.length),
      overduePaise: num(
        t.overduePaise,
        items.reduce((a, d) => a + d.overduePaise, 0),
      ),
    },
    page: num(p.page, 1),
    totalPages: Math.max(1, num(p.totalPages, 1)),
  };
}

export function mapBulkReminder(raw: unknown): BulkReminderResult {
  const r = obj(raw);
  return { flats: num(r.flats), invoices: num(r.invoices) };
}

export function mapOpenInvoiceRef(raw: unknown): OpenInvoiceRef {
  const r = obj(raw);
  return { id: num(r.id), invoiceNo: str(r.invoiceNo), outstandingPaise: num(r.outstandingPaise) };
}

export function mapMyDues(raw: unknown): MyDuesUnit[] {
  return arr(obj(raw).units ?? raw).map(u => {
    const r = obj(u);
    return {
      unitId: num(r.unitId),
      unitLabel: str(r.unitLabel),
      relation: str(r.relation),
      outstandingPaise: num(r.outstandingPaise),
      overduePaise: num(r.overduePaise),
      nextDueDate: strOrNull(r.nextDueDate),
      openInvoiceCount: num(r.openInvoiceCount),
    };
  });
}

const STATUSES: InvoiceStatus[] = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];

export function mapInvoiceItem(raw: unknown): MyInvoiceItem {
  const r = obj(raw);
  const unit = obj(r.unit);
  const billTo = obj(r.billTo);
  const status = str(r.status) as InvoiceStatus;
  return {
    id: num(r.id),
    invoiceNo: str(r.invoiceNo),
    invoiceType: str(r.invoiceType, 'REGULAR'),
    unitId: num(r.unitId ?? unit.id),
    unitLabel: str(r.unitLabel ?? unit.label),
    billToName: str(r.billToName ?? billTo.name),
    periodLabel: str(r.periodLabel),
    invoiceDate: str(r.invoiceDate),
    dueDate: str(r.dueDate),
    totalPaise: num(r.totalPaise),
    paidPaise: num(r.paidPaise),
    outstandingPaise: num(r.outstandingPaise),
    status: STATUSES.includes(status) ? status : 'ISSUED',
    isOverdue: r.isOverdue === true,
    isDisputed: r.isDisputed === true,
  };
}

export function mapInvoiceList(rows: unknown, pagination?: unknown): MyInvoiceList {
  const items = rowsOf(rows).map(mapInvoiceItem);
  const p = obj(pagination);
  return {
    items,
    page: num(p.page, 1),
    totalPages: Math.max(1, num(p.totalPages, 1)),
    total: num(p.total, items.length),
  };
}

function mapComputation(raw: unknown): LineComputation | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = obj(raw);
  const inputs = Object.entries(obj(c.inputs)).map(([key, value]) => ({
    key,
    value: typeof value === 'object' && value !== null ? JSON.stringify(value) : str(value),
  }));
  return {
    method: str(c.method),
    ruleVersionId: c.ruleVersionId == null ? null : num(c.ruleVersionId),
    ruleVersionNo: c.ruleVersionNo == null ? null : num(c.ruleVersionNo),
    ruleEffectiveFrom: strOrNull(c.ruleEffectiveFrom),
    inputs,
    formula: str(c.formula),
    text: str(c.text),
  };
}

export function mapInvoiceLine(raw: unknown): InvoiceLine {
  const l = obj(raw);
  return {
    id: num(l.id),
    lineNo: num(l.lineNo),
    lineKind: str(l.lineKind, 'CHARGE'),
    description: str(l.description),
    quantity: strOrNull(l.quantity),
    ratePaise: l.ratePaise == null ? null : num(l.ratePaise),
    amountPaise: num(l.amountPaise),
    creditedPaise: num(l.creditedPaise),
    computation: mapComputation(l.computation),
  };
}

export function mapInvoice(raw: unknown): MyInvoice {
  const r = obj(raw);
  const billTo = obj(r.billTo);
  const pdf = str(r.pdfStatus);
  return {
    ...mapInvoiceItem(raw),
    billToRelation: str(r.billToRelation ?? billTo.relation),
    periodStart: strOrNull(r.periodStart),
    periodEnd: strOrNull(r.periodEnd),
    gstApplied: r.gstApplied === true,
    societyGstin: strOrNull(r.societyGstin),
    subtotalPaise: num(r.subtotalPaise),
    cgstPaise: num(r.cgstPaise),
    sgstPaise: num(r.sgstPaise),
    taxPaise: num(r.taxPaise),
    roundOffPaise: num(r.roundOffPaise),
    debitedPaise: num(r.debitedPaise),
    creditedPaise: num(r.creditedPaise),
    previousDuesPaise: num(r.previousDuesPaise),
    lines: arr(r.lines).map(mapInvoiceLine),
    pdfStatus: pdf === 'READY' || pdf === 'FAILED' ? pdf : 'PENDING',
  };
}

export function mapPdfUrl(raw: unknown): PdfUrl {
  const r = obj(raw);
  return { url: str(r.url), expiresAt: strOrNull(r.expiresAt) };
}
