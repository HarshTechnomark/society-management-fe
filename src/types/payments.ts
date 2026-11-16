/** Module 12 admin payment shapes (spec 8.1, 8.10 to 8.17). Amounts are integer paise. */

export type PaymentStatus =
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'CAPTURED'
  | 'RECEIVED'
  | 'DEPOSITED'
  | 'CLEARED'
  | 'BOUNCED'
  | 'RETURNED'
  | 'REVERSED'
  | 'REJECTED'
  | 'FAILED';

export type PaymentMethod =
  'UPI' | 'CARD' | 'NETBANKING' | 'CASH' | 'CHEQUE' | 'NEFT' | 'IMPS' | 'RTGS' | 'UPI_TO_BANK' | string;

export type PaymentSource = 'ONLINE' | 'OFFLINE' | 'AUTOPAY' | 'RESIDENT_DECLARED' | string;
export type ReceiptStatus = 'NONE' | 'ISSUED' | 'CANCELLED';

export interface PaymentItem {
  id: number;
  unitId: number;
  unitLabel: string;
  payerName: string;
  source: PaymentSource;
  method: PaymentMethod;
  status: PaymentStatus;
  amountPaise: number;
  convenienceFeePaise: number;
  grossAmountPaise: number;
  toInvoicesPaise: number;
  toCollectionsPaise: number;
  toAdvancePaise: number;
  refundedPaise: number;
  paymentDate: string;
  capturedAt: string | null;
  receiptNo: string | null;
  receiptStatus: ReceiptStatus;
  referenceNo: string | null;
  needsReview: boolean;
  isDuplicateSuspect: boolean;
  version: number;
}

export interface Allocation {
  id: number;
  source: string;
  targetType: string;
  invoiceId: number | null;
  invoiceNo: string | null;
  collectionRequestId: number | null;
  collectionTitle: string | null;
  amountPaise: number;
  reasonCode: string | null;
  reversalOfId: number | null;
  allocatedOn: string | null;
}

export interface ChequeInfo {
  bankName: string;
  chequeNo: string;
  chequeDate: string;
  depositedOn: string | null;
  depositBankAccountId: number | null;
  clearedOn: string | null;
  bouncedOn: string | null;
  bounceReason: string | null;
  bounceChargeInvoiceId: number | null;
}

export interface TimelineEntry {
  at: string;
  event: string;
  by: string;
}

export interface PaymentDetail extends PaymentItem {
  allocations: Allocation[];
  cheque: ChequeInfo | null;
  proofFiles: { id: number; name: string }[];
  approval: { requestId: number; status: string } | null;
  timeline: TimelineEntry[];
  receiptRevision: number;
  notes: string | null;
  reviewReason: string | null;
  recordedBy: string | null;
  /** Journal account the money sits in (`BANK`, `CASH_IN_HAND`, `CHEQUES_IN_CLEARING`, `GATEWAY_CLEARING`); detail only. */
  landsIn: string | null;
  reversalReason: string | null;
  reversedAt: string | null;
}

export interface PaymentQuery {
  page?: number;
  limit?: number;
  q?: string;
  unitId?: number;
  /** Comma list of statuses. */
  status?: string;
  /** Comma list of methods. */
  method?: string;
  source?: string;
  from?: string;
  to?: string;
  needsReview?: boolean;
  isDuplicateSuspect?: boolean;
  chequeStatus?: 'PENDING';
  sortBy?: 'paymentDate' | 'createdAt' | 'amountPaise' | 'receiptNo';
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentPage {
  items: PaymentItem[];
  page: number;
  totalPages: number;
  total: number;
}

export type OfflineMethod = 'CASH' | 'CHEQUE' | 'NEFT' | 'IMPS' | 'RTGS' | 'UPI_TO_BANK';

export interface OfflinePaymentInput {
  unitId: number;
  payingFor: 'DUES' | 'COLLECTION';
  collectionRequestId?: number;
  method: OfflineMethod;
  amountPaise: number;
  paymentDate: string;
  referenceNo?: string;
  cheque?: { bankName: string; chequeNo: string; chequeDate: string };
  payerName?: string;
  fileIds?: number[];
  notes?: string;
  confirmDuplicate?: boolean;
}

export interface OfflinePaymentResult {
  id: number;
  status: PaymentStatus;
  method: string;
  amountPaise: number;
  receiptNo: string | null;
  approval: { requestId: number; status: string } | null;
  version: number;
}

export interface ChequeDepositResult {
  deposited: number;
  payments: { id: number; status: PaymentStatus; version: number }[];
}

export interface BounceInput {
  bouncedOn: string;
  reason: string;
  applyBounceCharge: boolean;
  bounceChargePaise: number;
  version: number;
}

export type ReverseReasonCode = 'WRONG_ENTRY' | 'DUPLICATE_ENTRY' | 'CHARGEBACK_LOST' | 'OTHER';
export type ReceiptChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH';

export interface ReallocationTarget {
  type: 'INVOICE' | 'COLLECTION_REQUEST' | 'ADVANCE';
  id?: number;
  amountPaise: number;
}

export interface PaymentSummary {
  today: { collectedPaise: number; count: number };
  month: { collectedPaise: number; count: number; byMethod: Record<string, number> };
  efficiency: { billedPaise: number; collectedAgainstBilledPaise: number; percent: number } | null;
  pendingApprovalCount: number;
  chequesInClearing: { count: number; amountPaise: number };
  needsReviewCount: number;
  generatedAt: string | null;
}

export interface LiveFeedItem {
  id: number;
  unitLabel: string;
  amountPaise: number;
  method: string;
  what: 'maintenance' | 'contribution' | 'mixed' | 'advance' | string;
  receiptNo: string | null;
  at: string;
}

/** A published, optional collection offered in "Paying for". */
export interface CollectionOption {
  id: number;
  title: string;
  amountPerUnitPaise: number;
  minAmountPaise: number;
}

export interface CollectionRequestRef {
  id: number;
  unitId: number;
  unitLabel: string;
  amountPaise: number;
  paidPaise: number;
  status: string;
}

export interface FlatOption {
  unitId: number;
  unitLabel: string;
  duesPaise: number;
  payerName: string;
}

export interface BankAccountOption {
  id: number;
  label: string;
  isCollection: boolean;
}

export interface OpenInvoice {
  id: number;
  invoiceNo: string;
  status: string;
  outstandingPaise: number;
}
