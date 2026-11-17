import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { mapBank, mapBankOption } from './accountsBankMappers';
import { accountsBankService } from './accountsBank.service';
import { mapFund, mapTransfer } from './accountsFundsMappers';
import { accountsFundsService } from './accountsFunds.service';

beforeEach(resetAll);

describe('funds mappers', () => {
  it('maps a fund and defaults missing fields', () => {
    const f = mapFund({
      id: '4',
      name: 'Sinking fund',
      fundType: 'SINKING',
      balancePaise: 96000000,
      showToResidents: 1,
    });
    expect(f).toMatchObject({
      id: 4,
      balancePaise: 96000000,
      showToResidents: true,
      status: 'ACTIVE',
      version: 1,
    });
    expect(mapFund(null).id).toBe(0);
  });
  it('tells an approval wait from a posted transfer', () => {
    expect(mapTransfer({ approvalRequestId: 9, status: 'PENDING' }).done).toBe(false);
    expect(mapTransfer({ voucherNo: 'JV/1' }).done).toBe(true);
  });
  it('masks nothing it was not given and maps verification', () => {
    const b = mapBank({
      id: 3,
      displayName: 'HDFC',
      maskedNumber: 'XXXXXX4821',
      verificationStatus: 'VERIFIED',
      verifiedBy: { name: 'Asha' },
    });
    expect(b).toMatchObject({
      maskedNumber: 'XXXXXX4821',
      verificationStatus: 'VERIFIED',
      verifiedByName: 'Asha',
    });
    expect(mapBankOption({ id: 3, displayName: 'HDFC', maskedNumber: 'XXXX4821' }).label).toBe(
      'HDFC XXXX4821',
    );
  });
});

describe('services', () => {
  it('lists funds and sends the idempotency key on create and transfer', async () => {
    const api = mockApi({
      'GET /accounts/funds': ok([{ id: 1, name: 'A', fundType: 'SINKING' }]),
      'POST /accounts/funds': ok({ id: 2, name: 'B' }),
      'POST /accounts/fund-transfers': ok({ approvalRequestId: 5, status: 'PENDING' }),
    });
    expect(await accountsFundsService.list()).toHaveLength(1);
    await accountsFundsService.create({
      fundType: 'COLLECTION',
      name: 'B',
      usageRequiresResolution: false,
      showToResidents: true,
    });
    const t = await accountsFundsService.transfer({
      fromFundId: null,
      toFundId: 1,
      amountPaise: 500,
      date: '2026-11-01',
      reason: 'Top up',
    });
    expect(t.done).toBe(false);
    const posts = api.fn.mock.calls.filter(c => (c[1] as RequestInit)?.method === 'POST');
    for (const c of posts) expect(JSON.stringify((c[1] as RequestInit).headers)).toContain('Idempotency-Key');
  });
  it('remembers a 404 of the fund and bank lists', async () => {
    const api = mockApi({
      'GET /accounts/funds': err(404, 'NOT_FOUND'),
      'GET /accounts/bank-accounts': err(404, 'NOT_FOUND'),
    });
    for (let i = 0; i < 2; i++) {
      await expect(accountsFundsService.options()).rejects.toMatchObject({ status: 404 });
      await expect(accountsBankService.options()).rejects.toMatchObject({ status: 404 });
    }
    expect(api.calls).toHaveLength(2);
  });
  it('reveals only the number', async () => {
    mockApi({ 'GET /accounts/bank-accounts/3/reveal': ok({ accountNumber: '123456789012' }) });
    expect(await accountsBankService.reveal(3)).toBe('123456789012');
  });
});
