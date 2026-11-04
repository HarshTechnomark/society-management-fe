/** Module 11 (sub-module 11.5): dues dashboard, defaulters, reminders and resident bills. Money is integer paise. */

export type AgeingBucketKey = '0_30' | '31_60' | '61_90' | '90_PLUS';
export interface AgeingBucket {
  bucket: AgeingBucketKey;
  amountPaise: number;
}
export interface DuesSummary {
  billedPaise: number;
  collectedPaise: number;
  /** One decimal, null when nothing was billed in the month. */
  efficiencyPct: number | null;
  outstandingPaise: number;
  overdueFlats: number;
  ageing: AgeingBucket[];
}

export type DefaulterSort = 'overduePaise' | 'daysOverdue' | 'unitLabel';
export interface DefaulterQuery {
  minDaysOverdue: number;
  minAmountPaise: number;
  sortBy: DefaulterSort;
  page?: number;
  limit?: number;
}
export interface Defaulter {
  unitId: number;
  unitLabel: string;
  ownerName: string;
  billToNames: string[];
  overduePaise: number;
  oldestDueDate: string;
  daysOverdue: number;
  invoiceCount: number;
}

/** `GET /billing/defaulters` answers `data: { items, totals }` and `pagination`; the totals cover every page. */
export interface DefaulterPage {
  items: Defaulter[];
  totals: { flats: number; overduePaise: number };
  page: number;
  totalPages: number;
}

export interface BulkReminderResult {
  flats: number;
  invoices: number;
}
export interface OpenInvoiceRef {
  id: number;
  invoiceNo: string;
  outstandingPaise: number;
}
export interface FlatReminderResult {
  sent: number;
  tooSoon: number;
  failed: number;
  firstError: unknown;
}

export type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export interface MyDuesUnit {
  unitId: number;
  unitLabel: string;
  relation: string;
  outstandingPaise: number;
  overduePaise: number;
  nextDueDate: string | null;
  openInvoiceCount: number;
}

export interface MyInvoiceItem {
  id: number;
  invoiceNo: string;
  invoiceType: string;
  unitId: number;
  unitLabel: string;
  billToName: string;
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
export interface MyInvoiceList {
  items: MyInvoiceItem[];
  page: number;
  totalPages: number;
  total: number;
}
export interface MyInvoiceQuery {
  unitId?: number;
  status?: 'OPEN' | 'PAID' | 'ALL';
  page?: number;
  limit?: number;
}

/** How a line was worked out; present only when the plan includes explain-my-bill. */
export interface LineComputation {
  method: string;
  ruleVersionId: number | null;
  /** Number of the rate rule version (1, 2, ...) and the date it took effect. */
  ruleVersionNo: number | null;
  ruleEffectiveFrom: string | null;
  inputs: { key: string; value: string }[];
  formula: string;
  text: string;
}
export interface InvoiceLine {
  id: number;
  lineNo: number;
  lineKind: string;
  description: string;
  quantity: string | null;
  ratePaise: number | null;
  amountPaise: number;
  creditedPaise: number;
  computation: LineComputation | null;
}
export interface MyInvoice extends MyInvoiceItem {
  billToRelation: string;
  periodStart: string | null;
  periodEnd: string | null;
  gstApplied: boolean;
  societyGstin: string | null;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  debitedPaise: number;
  creditedPaise: number;
  previousDuesPaise: number;
  lines: InvoiceLine[];
  pdfStatus: 'PENDING' | 'READY' | 'FAILED';
}
export interface PdfUrl {
  url: string;
  expiresAt: string | null;
}
