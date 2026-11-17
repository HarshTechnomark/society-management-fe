/** Module 13 periods, lock and year close (spec 8.18, 11.7, 6.7). */
export interface YearRow {
  financialYear: string;
  start: string;
  end: string;
  status: 'OPEN' | 'CLOSED';
  canClose: boolean;
  blockers: string[];
}
export interface Unlock {
  fromDate: string;
  until: string;
  approvalRequestId: number | null;
}
export interface PendingUnlock {
  approvalRequestId: number;
  fromDate: string;
  hours: number;
  reason: string;
  status: string;
}
export interface Periods {
  booksLockedThrough: string | null;
  unlock: Unlock | null;
  /** An unlock request waiting for approval, when the server reports one. */
  pendingUnlock: PendingUnlock | null;
  lastClosedFinancialYear: string | null;
  maxUnlockHours: number;
  years: YearRow[];
  version: number;
}
export interface LockInput {
  lockThrough: string;
  version: number;
}
export interface UnlockRequestInput {
  fromDate: string;
  hours: number;
  reason: string;
}
