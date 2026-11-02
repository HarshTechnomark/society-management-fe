/** Module 06 shapes (spec section 8). Money is integer paise; dates are ISO strings. */

export type DocumentType = 'INVOICE' | 'CREDIT_NOTE';
export type InvoiceKind = 'PERIOD' | 'PRORATION' | 'ONE_TIME' | 'MANUAL';
export type InvoiceStatus =
  'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID' | 'WRITTEN_OFF' | 'REJECTED';

export interface InvoiceListItem {
  id: number;
  invoiceNo: string | null;
  documentType: DocumentType;
  invoiceKind: InvoiceKind;
  societyId?: number;
  societyName?: string;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  amountDuePaise: number;
  pdfStatus: 'PENDING' | 'READY' | 'FAILED' | string;
}

export interface InvoiceLine {
  lineNo: number;
  lineType: string;
  description: string;
  quantity: string;
  unitPricePaise: number;
  amountPaise: number;
  prorationDays?: number;
  periodDays?: number;
}

export interface InvoicePaymentRef {
  id: number;
  kind?: string;
  status: string;
  method?: string | null;
  amountPaise: number;
  appliedPaise?: number;
  receivedOn?: string | null;
  capturedAt?: string | null;
  bankReference?: string | null;
  tdsSection?: string | null;
  hasCertificate?: boolean;
  version?: number;
}

export interface CreditNoteRef {
  id: number;
  invoiceNo: string | null;
  status: string;
  totalPaise: number;
  issueDate?: string | null;
}

export interface DunningEvent {
  id?: number;
  eventType: string;
  createdAt: string;
  note?: string | null;
  detail?: string | null;
}

export interface InvoiceDetail extends InvoiceListItem {
  financialYear: string;
  suspendOn: string | null;
  planKey?: string | null;
  billingCycle?: string | null;
  supplier: { legalName: string; gstin: string | null; stateCode: string };
  buyer: { name: string; gstin: string | null; address: string | null; stateName: string | null };
  placeOfSupplyStateCode: string;
  taxType: 'INTRA_STATE' | 'INTER_STATE' | string;
  gstRatePct: string;
  sacCode: string;
  lines: InvoiceLine[];
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  creditAppliedPaise: number;
  paidPaise: number;
  tdsPaise: number;
  creditNotedPaise: number;
  writtenOffPaise: number;
  excessToCreditPaise: number;
  creditNotes: CreditNoteRef[];
  payments: InvoicePaymentRef[];
  version: number;
  // platform only
  dunningEvents?: DunningEvent[];
  writeOff?: { requestedBy?: string | null; requestedAt?: string | null; reason?: string | null } | null;
  createdBy?: { id: number; name: string } | null;
}

export interface BillingSummary {
  outstandingPaise: number;
  overduePaise: number;
  openInvoiceCount: number;
  oldestDueDate: string | null;
  nextSuspensionDate: string | null;
  creditBalancePaise: number;
  societyStatus: string;
  autopayStatus: 'NONE' | 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'FAILED' | string;
  pendingManualPaymentPaise: number;
}

export type PaymentKind = 'PAYMENT' | 'TDS' | 'REFUND';
export interface PaymentItem {
  id: number;
  kind: PaymentKind;
  status: string;
  method: string | null;
  amountPaise: number;
  appliedPaise: number;
  invoiceId: number | null;
  invoiceNo: string | null;
  bankReference: string | null;
  receivedOn: string | null;
  capturedAt: string | null;
  tdsSection: string | null;
  deductedOn: string | null;
  hasCertificate: boolean;
  createdAt: string;
  version: number;
  societyId?: number;
  societyName?: string;
  origin?: string;
}

export interface CreditItem {
  id: number;
  entryType: string;
  status: string;
  amountPaise: number;
  balanceAfterPaise: number | null;
  invoiceNo: string | null;
  reason: string | null;
  postedAt: string | null;
}
export interface CreditLedger {
  balancePaise: number;
  items: CreditItem[];
}

export interface PaymentOrder {
  paymentId: number;
  gatewayOrderId: string;
  amountPaise: number;
  checkout: Record<string, unknown> & { key?: string; order_id?: string; redirect_url?: string };
  expiresAt: string;
}
export interface VerifyResult {
  paymentId: number;
  status: 'CAPTURED' | 'FAILED' | 'CREATED';
  invoice: { id: number; status: InvoiceStatus; amountDuePaise: number };
}

export interface TdsClaimInput {
  tdsSection: '194J' | '194C' | 'OTHER';
  tdsRatePct?: string;
  amountPaise: number;
  deductedOn: string;
  certificateFileId?: number;
  notes?: string;
}

export type ApprovalType =
  | 'MANUAL_PAYMENT'
  | 'REFUND'
  | 'MANUAL_INVOICE'
  | 'CREDIT_NOTE'
  | 'GOODWILL_CREDIT'
  | 'WRITE_OFF'
  | 'PAYMENT_MISMATCH';
export interface ApprovalItem {
  type: ApprovalType;
  id: number;
  societyId: number;
  societyName: string;
  amountPaise: number;
  createdBy: { id: number; name: string };
  createdAt: string;
  canApprove: boolean;
  /** Not in the contract; used when the backend sends it, else the screen reads the current version first. */
  version?: number;
}

export interface DunningItem {
  societyId: number;
  societyName: string;
  city: string;
  status: 'PAST_DUE' | 'SUSPENDED';
  overduePaise: number;
  overdueInvoiceCount: number;
  oldestDueDate: string | null;
  daysLate: number;
  lastStep: string | null;
  nextSuspensionDate: string | null;
  holdUntil: string | null;
  pendingManualPaymentPaise: number;
}

export interface RevenueReport {
  asOf: string;
  mrrPaise: number;
  arrPaise: number;
  payingSocieties: number;
  collectedThisMonthPaise: number;
  billedThisMonthPaise: number;
  outstandingPaise: number;
  overduePaise: number;
  gstThisMonthPaise: number;
  creditBalancesPaise: number;
  mrrByPlan: { planKey: string; mrrPaise: number }[];
  ageing: {
    notDuePaise: number;
    d1to15Paise: number;
    d16to30Paise: number;
    d31to60Paise: number;
    over60Paise: number;
  };
  series: {
    month: string;
    startMrrPaise: number;
    newPaise: number;
    expansionPaise: number;
    contractionPaise: number;
    churnedPaise: number;
    endMrrPaise: number;
    logoChurnPct: string;
    revenueChurnPct: string;
  }[];
  topSocieties: { societyId: number; name: string; mrrPaise: number }[];
}

export interface GstRow {
  supplyType?: 'B2B' | 'B2C' | string;
  placeOfSupplyStateCode?: string;
  documentType: DocumentType | string;
  count: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}
export interface TdsRow {
  societyId: number;
  societyName: string;
  tdsSection: string;
  claimedPaise: number;
  verifiedPaise: number;
  rejectedPaise: number;
  missingCertificates: number;
}

export interface InvoiceQuery {
  page?: number;
  limit?: number;
  documentType?: DocumentType;
  status?: string;
  invoiceKind?: InvoiceKind;
  issueFrom?: string;
  issueTo?: string;
  q?: string;
  societyId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
export interface PaymentQuery {
  page?: number;
  limit?: number;
  kind?: PaymentKind;
  status?: string;
  method?: string;
  invoiceId?: number;
  societyId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ManualPaymentInput {
  societyId: number;
  invoiceId?: number;
  method: 'NEFT' | 'RTGS' | 'IMPS' | 'CHEQUE' | 'UPI' | 'DD';
  amountPaise: number;
  receivedOn: string;
  bankReference: string;
  payerBankName?: string;
  attachmentFileId?: number;
  notes?: string;
}
export interface ManualInvoiceInput {
  societyId: number;
  subscriptionId?: number;
  lines: { description: string; quantity: string; unitPricePaise: number }[];
  notes?: string;
  serviceDate?: string;
}
export interface CreditNoteInput {
  reason: 'PRICE_CORRECTION' | 'SERVICE_CREDIT' | 'DUPLICATE_INVOICE' | 'CANCELLATION' | 'GOODWILL' | 'OTHER';
  subtotalPaise: number;
  notes: string;
}
export interface RefundInput {
  amountPaise: number;
  mode: 'GATEWAY' | 'BANK_TRANSFER';
  sourcePaymentId?: number;
  payeeReference?: string;
  reason: string;
}
