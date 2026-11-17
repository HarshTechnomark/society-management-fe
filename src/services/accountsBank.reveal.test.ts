import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApiClient } from '@/lib/apiClient';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { accountsBankService } from './accountsBank.service';

beforeEach(resetAll);
afterEach(() => configureApiClient({ stepUp: null }));

describe('reveal step-up', () => {
  it('asks for the step-up on a 401 REAUTH_REQUIRED of the GET and retries once', async () => {
    const stepUp = vi.fn(async () => true);
    configureApiClient({ stepUp });
    const api = mockApi({
      'GET /accounts/bank-accounts/1/reveal': [
        err(401, 'REAUTH_REQUIRED'),
        ok({ accountNumber: '123456789012' }),
      ],
    });
    expect(await accountsBankService.reveal(1)).toBe('123456789012');
    expect(stepUp).toHaveBeenCalledTimes(1);
    expect(api.calls.filter(c => c.path.endsWith('/reveal'))).toHaveLength(2);
  });
});
