import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { opsError } from '@/components/payments/ops/format';
import type { DepositKind, DepositRefundMode, DepositStatus } from '@/types/accountsDeposits';

export const STATUS_LABEL: Record<DepositStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  HELD: 'Held',
  REFUND_PENDING: 'Refund waiting for approval',
  REFUND_APPROVED: 'Refund approved, to pay',
  REFUNDED: 'Refunded',
  FORFEITED: 'Forfeited',
  CANCELLED: 'Cancelled',
};
export const STATUS_TONE: Record<DepositStatus, Tone> = {
  AWAITING_PAYMENT: 'warn',
  HELD: 'info',
  REFUND_PENDING: 'gold',
  REFUND_APPROVED: 'gold',
  REFUNDED: 'ok',
  FORFEITED: 'bad',
  CANCELLED: 'neutral',
};
export const KIND_LABEL: Record<DepositKind, string> = {
  RENOVATION: 'Renovation',
  MOVE: 'Move-in or move-out',
  AMENITY: 'Amenity booking',
  ACCESS_CARD: 'Access card',
  KEY: 'Key',
  OTHER: 'Other',
};
export const MODE_LABEL: Record<DepositRefundMode, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  IMPS: 'IMPS',
  CHEQUE: 'Cheque',
};

const TEXT: Record<string, string> = {
  DEPOSIT_NOT_FOUND: 'This deposit was not found.',
  DEPOSIT_INSUFFICIENT_HELD: 'The amount is more than what is held for this deposit.',
  INSUFFICIENT_BALANCE: 'The account you pay from does not have enough balance.',
  INVALID_PAYMENT_SOURCE:
    'This payment mode does not match the account. Use cash with a cash account and other modes with a bank account.',
  DUPLICATE: 'A deposit of this kind already exists for this source.',
  PERIOD_LOCKED: 'The books are locked for this date. Choose a later date.',
  FEATURE_NOT_IN_PLAN: 'Deposits are not part of your plan.',
};
export function depositError(e: unknown): string {
  if (e instanceof ApiError && TEXT[e.code]) return TEXT[e.code];
  return opsError(e);
}
export const needsReference = (m: DepositRefundMode) => m !== 'CASH';
