/** Module 13 periods, lock, unlock request, relock and year close (spec 8.18, APIs 60 to 64). */
import { api } from '@/lib/apiClient';
import { normalisePeriods } from './accountsPeriodsMappers';
import type { LockInput, UnlockRequestInput } from '@/types/accountsPeriods';

export const accountsPeriodsService = {
  get: () => api<unknown>('/accounts/periods', { plan: false }).then(normalisePeriods),
  /** Lock books through a month end (step-up is handled by the API client). */
  lock: (body: LockInput) =>
    api<unknown>('/accounts/period-lock', { method: 'POST', body, idempotent: true }).then(() => undefined),
  /** Starts a `PERIOD_UNLOCK` approval; the window opens when the committee approves. */
  requestUnlock: (body: UnlockRequestInput) =>
    api<unknown>('/accounts/period-lock/unlock-requests', { method: 'POST', body, idempotent: true }),
  relock: (version: number) =>
    api<unknown>('/accounts/period-lock/relock', {
      method: 'POST',
      body: { version },
      idempotent: true,
    }).then(() => undefined),
  /** 202 with a job id; the caller polls `get()` until `lastClosedFinancialYear` reaches the year. */
  closeYear: (fy: string, version: number) =>
    api<{ jobId?: string }>(`/accounts/financial-years/${encodeURIComponent(fy)}/close`, {
      method: 'POST',
      body: { confirm: true, version },
      idempotent: true,
    }).then(r => ({ jobId: typeof r?.jobId === 'string' ? r.jobId : null })),
};
