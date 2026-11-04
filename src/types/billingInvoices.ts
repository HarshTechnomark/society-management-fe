/** Screen shapes of the invoice list, drawer and notes (spec 7.7 to 7.9, 8.11 to 8.17). Mapped in `billingInvoicesMappers.ts`. */
export type { Pagination } from '@/lib/apiClient';

export type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type InvoiceType = 'REGULAR' | 'SUPPLEMENTARY' | 'ADHOC' | 'OPENING';
export type LineKind = 'CHARGE' | 'INTEREST' | 'LATE_FEE' | 'CGST' | 'SGST' | 'ROUND_OFF' | 'WRITE_OFF';
export type NoteStatus = 'PENDING_APPROVAL' | 'CHANGES_REQUESTED' | 'ISSUED' | 'REJECTED';
export type PdfStatus = 'PENDING' | 'READY' | 'FAILED';
export type CreditReason = 'BILLING_ERROR' | 'WAIVER' | 'DISPUTE_RESOLUTION' | 'OTHER';
export type DebitReason = 'ADDITIONAL_CHARGE' | 'BILLING_ERROR' | 'OTHER';

export interface InvoiceRow {
  id: number;
  invoiceNo: string;
  invoiceType: InvoiceType;
  unitId: number;
  unitLabel: string;
  billToName: string;
  billToRelation: string;
  periodLabel: string;
  invoiceDate: string;
  dueDate: string;
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  status: InvoiceStatus;
  isOverdue: boolean;
  isDisputed: boolean;
}

export interface InvoiceLine {
  id: number;
  lineNo: number;
  lineKind: LineKind;
  headKey: string | null;
  description: string;
  quantity: string | null;
  ratePaise: number | null;
  amountPaise: number;
  isTaxable: boolean;
  creditedPaise: number;
  /** The "explain my bill" text of the line, when the API sends it. */
  explanation: string | null;
}

export interface NoteSummary {
  id: number;
  noteType: 'CREDIT' | 'DEBIT';
  noteNo: string | null;
  status: NoteStatus;
  reasonCode: string;
  remarks: string;
  totalPaise: number;
  noteDate: string | null;
  appliedToInvoicePaise: number;
  excessToAdvancePaise: number;
  pdfStatus: PdfStatus;
  lines: InvoiceLine[];
}

/** An allocation of a payment to the bill (module 12); the API sends no receipt number or mode yet. */
export interface PaymentRow {
  id: number;
  /** Unique within the bill (one payment can be allocated twice). */
  key: string;
  label: string;
  date: string | null;
  mode: string | null;
  amountPaise: number;
}

export interface InvoiceDetail {
  id: number;
  invoiceNo: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  unitId: number;
  unitLabel: string;
  billToResidentId: number | null;
  billToName: string;
  billToRelation: string;
  periodLabel: string;
  invoiceDate: string;
  dueDate: string;
  description: string | null;
  isOverdue: boolean;
  isDisputed: boolean;
  gstApplied: boolean;
  societyGstin: string | null;
  taxableValuePaise: number;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  debitedPaise: number;
  creditedPaise: number;
  writtenOffPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  previousDuesPaise: number;
  lines: InvoiceLine[];
  notes: NoteSummary[];
  payments: PaymentRow[];
  financialYear: string | null;
  settledOn: string | null;
  pdfStatus: PdfStatus;
  version: number;
}

export interface InvoiceQuery {
  status?: string;
  unitId?: number;
  periodStart?: string;
  billToResidentId?: number;
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface NoteLineInput {
  chargeHeadId: number;
  description: string;
  amountPaise: number;
}
export interface AdHocInput {
  unitId: number;
  lines: NoteLineInput[];
  dueDate: string;
  description: string;
}
export interface CreditNoteInput {
  reasonCode: CreditReason;
  remarks: string;
  lines: { invoiceLineId: number; amountPaise: number }[];
}
export interface DebitNoteInput {
  reasonCode: DebitReason;
  remarks: string;
  lines: NoteLineInput[];
}

/** What a cancel call did: waits for approval (202) or the invoice is already cancelled (200, auto-approved). */
export interface CancelResult {
  outcome: 'PENDING' | 'CANCELLED';
  approvalRequestId: number | null;
}

/** A charge head the forms offer (active, not a system head). */
export interface HeadOption {
  id: number;
  name: string;
  gstTreatment: string;
}
export interface UnitOption {
  id: number;
  label: string;
}
