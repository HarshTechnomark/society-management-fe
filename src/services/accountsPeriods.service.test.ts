import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { periodsRaw } from '@/test/accountsReportsFixtures';
import { accountsPeriodsService as s } from './accountsPeriods.service';

beforeEach(resetAll);

describe('accountsPeriodsService', () => {
  it('reads periods with defaults for missing fields', async () => {
    mockApi({ 'GET /accounts/periods': ok(periodsRaw()) });
    const p = await s.get();
    expect(p.booksLockedThrough).toBe('2026-09-30');
    expect(p.unlock).toBeNull();
    expect(p.maxUnlockHours).toBe(72);
    expect(p.years).toHaveLength(3);
    expect(p.years[1].blockers).toEqual(['The year has not ended yet.']);
  });
  it('locks, requests an unlock, relocks and closes with the bodies of the spec', async () => {
    const api = mockApi({
      'POST /accounts/period-lock': ok({}),
      'POST /accounts/period-lock/unlock-requests': ok({ approvalRequestId: 5 }),
      'POST /accounts/period-lock/relock': ok({}),
      'POST /accounts/financial-years/2025-26/close': ok({ jobId: 'j1' }),
    });
    await s.lock({ lockThrough: '2026-10-31', version: 6 });
    await s.requestUnlock({ fromDate: '2026-09-01', hours: 24, reason: 'Fix a wrong entry' });
    await s.relock(6);
    expect(await s.closeYear('2025-26', 6)).toEqual({ jobId: 'j1' });
    expect(api.last('POST', '/accounts/period-lock')?.body).toEqual({
      lockThrough: '2026-10-31',
      version: 6,
    });
    expect(api.last('POST', '/accounts/period-lock/relock')?.body).toEqual({ version: 6 });
    expect(api.last('POST', '/accounts/financial-years/2025-26/close')?.body).toEqual({
      confirm: true,
      version: 6,
    });
    for (const c of api.fn.mock.calls)
      expect(new Headers((c[1] as RequestInit).headers).get('Idempotency-Key')).toBeTruthy();
  });
});
