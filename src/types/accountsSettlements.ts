/** Gateway settlements (module 13 spec 7.9, 8.15). Money is integer paise. */
export type SettlementStatus = 'RECEIVED' | 'MISMATCH' | 'POSTED';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface PagedList<T> {
  items: T[];
  pagination: Pagination;
}

export interface SettlementItem {
  type: 'payment' | 'refund';
  gatewayPaymentId: string;
  gatewayRefundId: string | null;
  amountPaise: number;
  feePaise: number;
  taxPaise: number;
  matchedPaymentId: number | null;
  receiptNo: string | null;
  /** Why an unmatched item did not match, when the server says. */
  reason: string | null;
  /** For AMOUNT_DIFFERS: the amount of the captured payment in your records. */
  expectedPaise: number | null;
}

export interface Settlement {
  id: number;
  gatewayProvider: string;
  gatewaySettlementId: string;
  settlementDate: string;
  utr: string | null;
  grossPaise: number;
  refundsPaise: number;
  feePaise: number;
  feeGstPaise: number;
  adjustmentPaise: number;
  netPaise: number;
  paymentCount: number;
  status: SettlementStatus;
  differenceAcceptedReason: string | null;
  journalEntryId: number | null;
  postedAt: string | null;
  attempts: number;
  version: number;
  items: SettlementItem[];
  unmatchedItems: SettlementItem[];
}

export interface SettlementQuery {
  status?: SettlementStatus | '';
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
}

/** One settlement as the JSON import takes it (money in paise; the net must equal gross - refunds - fee - GST + adjustment). */
export interface ImportSettlementJson {
  gatewaySettlementId: string;
  settlementDate: string;
  utr?: string;
  netPaise: number;
  feePaise?: number;
  feeGstPaise?: number;
  adjustmentPaise?: number;
  items: {
    type: 'payment' | 'refund';
    gatewayPaymentId: string;
    gatewayRefundId?: string;
    amountPaise: number;
    feePaise?: number;
    taxPaise?: number;
  }[];
}
/** Either an uploaded report (`fileId`) or the settlements as JSON. */
export interface ImportSettlementInput {
  gatewayProvider: string;
  fileId?: number;
  settlements?: ImportSettlementJson[];
}
export interface ImportSettlementResult {
  created: number;
  skipped: number;
  errors: string[];
}
export interface AcceptDifferenceInput {
  reason: string;
  version: number;
}
