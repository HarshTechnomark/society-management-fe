/** Normalisers for the module 13 periods shapes (spec 8.18). Never throw. */
import type { PendingUnlock, Periods, Unlock, YearRow } from '@/types/accountsPeriods';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strN = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function normaliseYear(raw: unknown): YearRow {
  const r = obj(raw);
  return {
    financialYear: str(r.financialYear),
    start: str(r.start),
    end: str(r.end),
    status: r.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    canClose: r.canClose === true,
    blockers: arr(r.blockers)
      .map(b => (typeof b === 'string' ? b : str(obj(b).message)))
      .filter(Boolean),
  };
}

function normaliseUnlock(raw: unknown): Unlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = obj(raw);
  const fromDate = strN(r.fromDate);
  if (!fromDate) return null;
  return {
    fromDate,
    until: str(r.until),
    approvalRequestId: r.approvalRequestId == null ? null : num(r.approvalRequestId),
  };
}

function normalisePending(raw: unknown): PendingUnlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = obj(raw);
  const id = num(r.approvalRequestId, num(r.id));
  if (!id) return null;
  return {
    approvalRequestId: id,
    fromDate: str(r.fromDate),
    hours: num(r.hours),
    reason: str(r.reason),
    status: str(r.status, 'PENDING'),
  };
}

export function normalisePeriods(raw: unknown): Periods {
  const r = obj(raw);
  return {
    booksLockedThrough: strN(r.booksLockedThrough),
    unlock: normaliseUnlock(r.unlock),
    pendingUnlock: normalisePending(r.pendingUnlock),
    lastClosedFinancialYear: strN(r.lastClosedFinancialYear),
    maxUnlockHours: Math.max(1, num(r.maxUnlockHours, 72)),
    years: arr(r.years).map(normaliseYear),
    version: num(r.version),
  };
}
