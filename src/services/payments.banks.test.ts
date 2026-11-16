import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, resetAll } from '@/test/helpers';
import { paymentsService } from './payments.service';

beforeEach(resetAll);

describe('bankAccounts', () => {
  it('remembers a 404 for the session and does not call the route again', async () => {
    const api = mockApi({ 'GET /accounts/bank-accounts': err(404, 'NOT_FOUND') });
    await expect(paymentsService.bankAccounts()).rejects.toMatchObject({ status: 404 });
    await expect(paymentsService.bankAccounts()).rejects.toMatchObject({ status: 404 });
    expect(api.fn.mock.calls.filter(c => String(c[0]).includes('/accounts/bank-accounts'))).toHaveLength(1);
  });
});
