/** Module 12 admin operations: refunds, payment orders, AutoPay mandates, payment links and unit advances (spec 8.7, 8.16 to 8.20). */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

export type RefundStatus =
  'PENDING_APPROVAL' | 'REJECTED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'CANCELLED';
export type RefundMode = 'GATEWAY' | 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';

export interface Refund {
  id: number;
  refundNo: string | null;
  unitId: number | null;
  unitLabel: string;
  paymentId: number;
  receiptNo: string | null;
  amountPaise: number;
  mode: RefundMode;
  status: RefundStatus;
  reason: string;
  payeeName: string | null;
  payeeAccountMasked: string | null;
  bankReference: string | null;
  paidOutOn: string | null;
  failureReason: string | null;
  rejectedReason: string | null;
  createdAt: string;
  processedAt: string | null;
  version: number;
}
export interface RefundQuery {
  status?: string;
  mode?: string;
  unitId?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'amountPaise';
}
export interface RequestRefundInput {
  paymentId: number;
  amountPaise: number;
  mode: RefundMode;
  reason: string;
  reallocate?: boolean;
  payeeName?: string;
  payeeAccountMasked?: string;
}
export interface CompleteRefundInput {
  paidOutOn: string;
  bankReference?: string;
  version: number;
}

export type OrderStatus = 'CREATED' | 'ATTEMPTED' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED';
export type OrderSource = 'PAY_LIST' | 'MODULE' | 'PAYMENT_LINK' | 'AUTOPAY';
export interface OrderItem {
  itemType: string;
  label: string;
  amountPaise: number;
}
export interface PaymentOrder {
  id: number;
  unitLabel: string;
  sourceType: OrderSource;
  status: OrderStatus;
  grossAmountPaise: number;
  basePaise: number | null;
  convenienceFeePaise: number | null;
  expiresAt: string | null;
  paidAt: string | null;
  attemptCount: number;
  linkShortCode: string | null;
  failureReason: string | null;
  paymentId: number | null;
  items: OrderItem[];
  createdAt: string;
}
export interface OrderQuery {
  status?: string;
  sourceType?: string;
  unitId?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'grossAmountPaise';
}

export type MandateStatus = 'PENDING_AUTH' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
export interface Mandate {
  id: number;
  unitLabel: string;
  payerName: string;
  mandateType: 'UPI_AUTOPAY' | 'ENACH';
  maxAmountPaise: number;
  status: MandateStatus;
  lastDebitAt: string | null;
  lastDebitStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  payerInstrumentMasked: string | null;
  version: number;
}
export interface MandateQuery {
  status?: string;
  mandateType?: string;
  unitId?: number;
  page?: number;
  limit?: number;
}

export type LinkChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';
export interface CreateLinkInput {
  unitId: number;
  amountMode: 'OUTSTANDING' | 'FIXED';
  amountPaise?: number;
  expiresInDays?: number;
  channels?: LinkChannel[];
}
export interface CreatedLink {
  orderId: number;
  url: string;
  expiresAt: string | null;
  amountPaise: number;
}

export interface AdvanceEntry {
  id: number;
  entryType: string;
  amountPaise: number;
  balanceAfterPaise: number;
  narration: string;
  createdAt: string;
}
export interface UnitAdvances {
  unitId: number;
  balancePaise: number;
  entries: AdvanceEntry[];
}
