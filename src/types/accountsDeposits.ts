/** Module 13 deposits (spec 7.12, 8.17). Money is integer paise. */
export type DepositStatus =
  'AWAITING_PAYMENT' | 'HELD' | 'REFUND_PENDING' | 'REFUND_APPROVED' | 'REFUNDED' | 'FORFEITED' | 'CANCELLED';
export type DepositKind = 'MOVE' | 'RENOVATION' | 'AMENITY' | 'ACCESS_CARD' | 'KEY' | 'OTHER';
export type DepositRefundMode = 'CASH' | 'UPI' | 'NEFT' | 'RTGS' | 'IMPS' | 'CHEQUE';
export type AdjustmentKind = 'DEDUCTION' | 'FORFEIT' | 'REFUND';

export interface DepositAdjustment {
  kind: AdjustmentKind;
  amountPaise: number;
  reason: string;
  at: string;
  by: string | null;
}

export interface Deposit {
  id: number;
  code: string;
  unitId: number | null;
  unitLabel: string;
  kind: DepositKind;
  title: string;
  status: DepositStatus;
  amountPaise: number;
  receivedPaise: number;
  deductedPaise: number;
  refundedPaise: number;
  refundRequestedPaise: number;
  /** What is still held for the flat: received less deducted and refunded. */
  heldPaise: number;
  isOpening: boolean;
  dueDate: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  refundMode: string | null;
  refundReference: string | null;
  cancelReason: string | null;
  notes: string | null;
  adjustments: DepositAdjustment[];
  createdAt: string;
  version: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface DepositPage {
  items: Deposit[];
  pagination: Pagination;
}
export interface DepositQuery {
  status?: string;
  kind?: string;
  unitId?: number;
  q?: string;
  page?: number;
  limit?: number;
}
export interface DepositSummary {
  heldPaise: number;
  refundedPaise: number;
  forfeitedPaise: number;
}
export interface CreateDepositInput {
  unitId: number;
  kind: DepositKind;
  title: string;
  amountPaise: number;
  dueDate?: string;
  isOpening?: boolean;
  openingDate?: string;
  notes?: string;
}
export interface PaidFromAccount {
  id: number;
  code: string;
  name: string;
}
