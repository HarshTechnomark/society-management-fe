/**
 * Normalisers from the module 11 backend shapes (spec 8.11 to 8.17) to the screen shapes in
 * `types/billingInvoices.ts`. All shape guessing lives here; none of them throws.
 *
 * Checked against the backend (`billing.invoices.detail.ts`, `billing.notes.shared.ts`, `billing.notes.cancel.ts`):
 * - the detail has `unit {id,label}`, `billTo {residentId,name,relation}`, `lines[]`, `notes[]` as summaries
 *   `{id, noteType, noteNo, status, reasonCode, noteDate, totalPaise, pdfStatus}` (no lines: those come from
 *   `GET /billing/notes/:id`), `allocations[] {paymentId, allocatedOn, amountPaise}` and `ledger[]`;
 * - a line's `computation.text` is the explain-my-bill text (the object is left out when the feature is off);
 * - cancel answers `202 {approvalRequestId,status:'PENDING'}` or `200` with the cancelled invoice detail.
 */
import type {
  CancelResult,
  HeadOption,
  InvoiceDetail,
  InvoiceLine,
  InvoiceRow,
  InvoiceStatus,
  InvoiceType,
  LineKind,
  NoteStatus,
  NoteSummary,
  PaymentRow,
  PdfStatus,
  UnitOption,
} from '@/types/billingInvoices';

export { normalisePagination, rows } from './billingRunsMappers';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const list = (v: unknown): R[] => (Array.isArray(v) ? v.map(obj) : []);
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
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d);

export function normaliseRow(raw: unknown): InvoiceRow {
  const r = obj(raw);
  return {
    id: num(r.id),
    invoiceNo: str(r.invoiceNo),
    invoiceType: str(r.invoiceType, 'REGULAR') as InvoiceType,
    unitId: num(r.unitId),
    unitLabel: str(r.unitLabel),
    billToName: str(r.billToName),
    billToRelation: str(r.billToRelation),
    periodLabel: str(r.periodLabel),
    invoiceDate: str(r.invoiceDate),
    dueDate: str(r.dueDate),
    totalPaise: num(r.totalPaise),
    paidPaise: num(r.paidPaise),
    outstandingPaise: num(r.outstandingPaise),
    status: str(r.status, 'ISSUED') as InvoiceStatus,
    isOverdue: bool(r.isOverdue),
    isDisputed: bool(r.isDisputed),
  };
}

export function normaliseLine(raw: unknown): InvoiceLine {
  const l = obj(raw);
  const comp = obj(l.computation);
  return {
    id: num(l.id),
    lineNo: num(l.lineNo),
    lineKind: str(l.lineKind, 'CHARGE') as LineKind,
    headKey: strN(l.headKey),
    description: str(l.description),
    quantity: strN(l.quantity),
    ratePaise: numN(l.ratePaise),
    amountPaise: num(l.amountPaise),
    isTaxable: bool(l.isTaxable),
    creditedPaise: num(l.creditedPaise),
    explanation: strN(comp.text) ?? strN(l.explanation),
  };
}

export function normaliseNote(raw: unknown): NoteSummary {
  const n = obj(raw);
  return {
    id: num(n.id),
    noteType: str(n.noteType, 'CREDIT') === 'DEBIT' ? 'DEBIT' : 'CREDIT',
    noteNo: strN(n.noteNo),
    status: str(n.status, 'ISSUED') as NoteStatus,
    reasonCode: str(n.reasonCode),
    remarks: str(n.remarks),
    totalPaise: num(n.totalPaise),
    noteDate: strN(n.noteDate),
    appliedToInvoicePaise: num(n.appliedToInvoicePaise),
    excessToAdvancePaise: num(n.excessToAdvancePaise),
    pdfStatus: str(n.pdfStatus, 'PENDING') as PdfStatus,
    lines: list(n.lines).map(normaliseLine),
  };
}

/** One allocation of the detail (8.12): `{ paymentId, allocatedOn, amountPaise }` from the module 12 port. */
const payment = (raw: unknown, i: number): PaymentRow => {
  const p = obj(raw);
  const paymentId = numN(p.paymentId) ?? numN(p.id);
  const receipt = strN(p.receiptNo) ?? strN(p.label);
  return {
    id: paymentId ?? 0,
    key: `${paymentId ?? 'x'}-${i}`,
    label: receipt ?? (paymentId ? `Payment #${paymentId}` : 'Payment'),
    date: strN(p.allocatedOn) ?? strN(p.date) ?? strN(p.paidOn),
    mode: strN(p.mode) ?? strN(p.paymentMode),
    amountPaise: num(p.amountPaise, num(p.allocatedPaise)),
  };
};

export function normaliseInvoice(raw: unknown): InvoiceDetail {
  const r = obj(raw);
  const unit = obj(r.unit);
  const billTo = obj(r.billTo);
  const lines = list(r.lines).map(normaliseLine);
  const sumKind = (k: LineKind) => lines.filter(l => l.lineKind === k).reduce((a, l) => a + l.amountPaise, 0);
  const cgst = num(r.cgstPaise, sumKind('CGST'));
  const sgst = num(r.sgstPaise, sumKind('SGST'));
  const total = num(r.totalPaise);
  const paymentsRaw = Array.isArray(r.allocations) ? r.allocations : r.payments;
  return {
    id: num(r.id),
    invoiceNo: str(r.invoiceNo),
    invoiceType: str(r.invoiceType, 'REGULAR') as InvoiceType,
    status: str(r.status, 'ISSUED') as InvoiceStatus,
    unitId: num(unit.id, num(r.unitId)),
    unitLabel: str(unit.label, str(r.unitLabel)),
    billToResidentId: numN(billTo.residentId ?? r.billToResidentId),
    billToName: str(billTo.name, str(r.billToName)),
    billToRelation: str(billTo.relation, str(r.billToRelation)),
    periodLabel: str(r.periodLabel),
    invoiceDate: str(r.invoiceDate),
    dueDate: str(r.dueDate),
    description: strN(r.description),
    isOverdue: bool(r.isOverdue),
    isDisputed: bool(r.isDisputed),
    gstApplied: bool(r.gstApplied, cgst + sgst > 0),
    societyGstin: strN(r.societyGstin),
    taxableValuePaise: num(r.taxableValuePaise),
    subtotalPaise: num(r.subtotalPaise),
    cgstPaise: cgst,
    sgstPaise: sgst,
    taxPaise: num(r.taxPaise, cgst + sgst),
    roundOffPaise: num(r.roundOffPaise, sumKind('ROUND_OFF')),
    totalPaise: total,
    debitedPaise: num(r.debitedPaise),
    creditedPaise: num(r.creditedPaise),
    writtenOffPaise: num(r.writtenOffPaise),
    paidPaise: num(r.paidPaise),
    outstandingPaise: num(r.outstandingPaise),
    previousDuesPaise: num(r.previousDuesPaise),
    lines,
    notes: list(r.notes).map(normaliseNote),
    payments: (Array.isArray(paymentsRaw) ? paymentsRaw : []).map(payment),
    financialYear: strN(r.financialYear),
    settledOn: strN(r.settledOn),
    pdfStatus: str(r.pdfStatus, 'PENDING') as PdfStatus,
    version: num(r.version, 1),
  };
}

/** `{ url, expiresAt }` of a PDF download (8.13). */
export function normalisePdfUrl(raw: unknown): { url: string; expiresAt: string | null } {
  const r = obj(raw);
  return { url: str(r.url), expiresAt: strN(r.expiresAt) };
}

/** The answer of cancel: `202 {approvalRequestId,status}` waits; a `200` with a CANCELLED invoice is done. */
export function normaliseCancel(raw: unknown): CancelResult {
  const r = obj(raw);
  const done = str(r.status) === 'CANCELLED' || str(r.invoiceNo) !== '';
  const id = numN(r.approvalRequestId);
  return { outcome: done && id === null ? 'CANCELLED' : 'PENDING', approvalRequestId: id };
}

export const normaliseHeadOption = (raw: unknown): HeadOption => {
  const h = obj(raw);
  return { id: num(h.id), name: str(h.name, str(h.key)), gstTreatment: str(h.gstTreatment, 'NONE') };
};
export const normaliseUnitOption = (raw: unknown): UnitOption => {
  const u = obj(raw);
  return { id: num(u.id), label: str(u.label, str(u.unitLabel)) };
};
