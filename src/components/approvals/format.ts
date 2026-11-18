import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import type { ApprovalRow, ApprovalStatus } from '@/types/approvals';

/** Plain names for every type the engine and the development stand-in know (spec 8.4). */
export const TYPE_LABEL: Record<string, string> = {
  EXPENSE: 'Expense',
  REFUND: 'Refund',
  PAYMENT_REFUND: 'Payment refund',
  OFFLINE_PAYMENT: 'Offline payment',
  INVOICE_CANCEL: 'Invoice cancellation',
  BILLING_RUN: 'Billing run',
  BILLING_RUN_PUBLISH: 'Billing run publish',
  CREDIT_NOTE: 'Credit note',
  WRITE_OFF: 'Write-off',
  COLLECTION: 'Collection',
  COLLECTION_PUBLISH: 'Collection publish',
  JOIN_REQUEST: 'Join request',
  MOVE_IN: 'Move in',
  MOVE_OUT: 'Move out',
  RENOVATION: 'Renovation',
  RENOVATION_PERMIT: 'Renovation permit',
  OWNERSHIP_TRANSFER: 'Ownership transfer',
  PURCHASE_ORDER: 'Purchase order',
  VENDOR_BILL: 'Vendor bill',
  NOTICE_PUBLISH: 'Notice',
  BOOKING: 'Booking',
  SUBSCRIPTION_CANCEL: 'Subscription cancellation',
  DEPOSIT_REFUND: 'Deposit refund',
  FINE_WAIVER: 'Fine waiver',
  MANUAL_JOURNAL: 'Manual journal',
  FUND_TRANSFER: 'Fund transfer',
  PERIOD_UNLOCK: 'Period unlock',
  BILLING_RULE_CHANGE: 'Billing rule change',
  LATE_FEE_POLICY_CHANGE: 'Late fee policy change',
};

const humanise = (t: string) => {
  const s = t.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/** The label the API sent, else our own name for the type, else the key in words. */
export const typeLabel = (type: string, apiLabel?: string | null) =>
  apiLabel || TYPE_LABEL[type] || humanise(type);

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes requested',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};
export const STATUS_TONE: Record<ApprovalStatus, Tone> = {
  PENDING: 'info',
  APPROVED: 'ok',
  REJECTED: 'bad',
  CHANGES_REQUESTED: 'warn',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

export const ACTION_LABEL: Record<string, string> = {
  SUBMITTED: 'Sent for approval',
  RESUBMITTED: 'Sent again',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Asked for changes',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  REASSIGNED: 'Handed to another approver',
  ESCALATED: 'Escalated',
  REMINDED: 'Reminder sent',
  AUTO_APPROVED: 'Approved automatically',
};

const REASON_TEXT: Record<string, string> = {
  MAKER_CHECKER: 'You created this. A different person must approve.',
  ALREADY_ACTED: 'You already approved this item.',
  NOT_IN_STEP: 'It is waiting for another approver.',
  NO_PERMISSION: 'You do not have permission to approve this kind of item.',
};
export const reasonText = (r: string | null | undefined, step?: string | null) =>
  !r ? '' : r === 'NOT_IN_STEP' && step ? `Waiting for ${step}` : (REASON_TEXT[r] ?? r);

const ERROR_TEXT: Record<string, string> = {
  STALE_VERSION: 'This item changed. Showing the latest.',
  APPROVAL_NOT_PENDING: 'This item was already actioned.',
  MAKER_CHECKER_VIOLATION: 'You created this item. A different person must approve it.',
  APPROVER_ALREADY_ACTED: 'You already approved this item.',
  NOT_ELIGIBLE_APPROVER: 'You are not one of the approvers for this step.',
  NO_ACTIVE_DELEGATION: 'You are not covering for that person right now.',
  NOT_THE_REQUESTER: 'Only the person who sent this request can withdraw it.',
  CHANGES_NOT_SUPPORTED: 'This kind of request cannot be sent back for changes. Reject it instead.',
  CANCEL_NOT_SUPPORTED: 'This kind of request cannot be cancelled here.',
  ON_BEHALF_REQUIRED: 'Choose whose approval you are giving.',
  REASSIGN_TARGET_NOT_ELIGIBLE: 'That member cannot approve this item.',
  SLOT_NOT_VACANT: 'Choose a seat that is still empty.',
  APPROVAL_NOT_FOUND: 'This request was not found.',
  IDEMPOTENCY_KEY_REUSED: 'This was already sent. Reload and check.',
  REQUEST_IN_PROGRESS: 'This is still being saved. Wait a moment.',
  BULK_NOT_ALLOWED: 'Needs a fresh code: approve it on its own.',
  SOCIETY_SUSPENDED: 'The society is suspended, so decisions cannot be saved.',
};
export const approvalError = (e: unknown): string => {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  const detail = e.errors?.map(x => x.message).filter(Boolean);
  if (e.code === 'VALIDATION_FAILED' && detail?.length) return detail.join(' ');
  return ERROR_TEXT[e.code] ?? e.message;
};
/** The same error in plain words, for `ErrorState` (keeps the support reference). */
export const plainError = (e: unknown): unknown =>
  e instanceof ApiError
    ? new ApiError(e.status, e.code, approvalError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
/** True when the item moved on while we looked: reload instead of showing a failure. */
export const isStale = (e: unknown) =>
  e instanceof ApiError && (e.code === 'STALE_VERSION' || e.code === 'APPROVAL_NOT_PENDING');

/** "12 Nov 2026, 3:40 pm" in India time, whatever the browser's zone. */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** "3 hours", "2 days": how long ago, kept short. */
export function ago(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.max(0, Math.floor((now - t) / 60000));
  if (m < 60) return m <= 1 ? 'just now' : `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

/** One readable line about what is asked: the API's summary, else the title with the amount. */
export function summaryLine(r: Pick<ApprovalRow, 'title' | 'summary' | 'amountPaise'>): string {
  const parts = [r.title];
  if (r.summary && r.summary !== r.title) parts.push(r.summary);
  if (r.amountPaise && !parts.some(p => p.includes('₹'))) parts.push(inr(r.amountPaise));
  return parts.join(' · ');
}

/** "Step 1 of 2" or "1 of 2 approvals" for the row chips. */
export function progressChip(r: ApprovalRow): string | null {
  if (r.status !== 'PENDING') return null;
  if (r.totalSteps > 1) return `Step ${r.currentStepNo} of ${r.totalSteps}`;
  if (r.approvalsNeeded > 1) return `${r.approvalsGiven} of ${r.approvalsNeeded} approvals`;
  return null;
}
