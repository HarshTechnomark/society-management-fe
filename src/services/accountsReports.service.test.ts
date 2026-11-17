import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { glRaw, trialBalanceRaw } from '@/test/accountsReportsFixtures';
import { accountsReportsService as s } from './accountsReports.service';
import { normaliseReport } from './accountsReportsMappers';

beforeEach(resetAll);

describe('accountsReportsService', () => {
  it('maps the trial balance with totals and drill-down ids', async () => {
    const api = mockApi({ 'GET /accounts/reports/trial-balance': ok(trialBalanceRaw()) });
    const v = await s.get('trial-balance', { asOf: '2026-10-31', includeZero: false });
    expect(v.balanced).toBe(true);
    expect(v.blocks[0].rows[0][0]).toMatchObject({ ledgerAccountId: 11 });
    expect(v.blocks[0].total?.[1].text).toBe('₹14,32,709');
    expect(String(api.fn.mock.calls[0][0])).toContain('asOf=2026-10-31');
    expect(String(api.fn.mock.calls[0][0])).not.toContain('includeZero');
  });
  it('maps ledger rows to journal links', async () => {
    mockApi({ 'GET /accounts/reports/general-ledger': ok(glRaw()) });
    const v = await s.get('general-ledger', { ledgerAccountId: 11, financialYear: '2026-27' });
    expect(v.heading).toContain('Bank - HDFC Current');
    expect(v.blocks[0].rows[0][1]).toMatchObject({ journalId: 77 });
    expect(v.summary.map(x => x.label)).toEqual(['Opening balance', 'Closing balance']);
  });
  it('never throws on an unknown shape', () => {
    for (const k of [
      'income-expenditure',
      'balance-sheet',
      'receipts-payments',
      'gst-summary',
      'tds-register',
    ] as const)
      expect(normaliseReport(k, null).empty).toBe(true);
  });
  it('starts an export with an idempotency key and flattens the account tree', async () => {
    const api = mockApi({
      'POST /accounts/exports': ok({ exportJobId: 'x9' }),
      'GET /accounts/ledger-accounts': ok([
        {
          id: 1,
          code: '1000',
          name: 'Assets',
          isGroup: true,
          children: [{ id: 2, code: '1120', name: 'Cash', isGroup: false }],
        },
      ]),
    });
    expect(await s.startExport('trial-balance', { asOf: '2026-10-31' }, 'xlsx')).toBe('x9');
    const init = api.fn.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy();
    expect(api.last('POST', '/accounts/exports')?.body).toEqual({
      report: 'trial-balance',
      params: { asOf: '2026-10-31' },
      format: 'xlsx',
    });
    expect(await s.ledgerAccounts()).toEqual([{ id: 2, code: '1120', name: 'Cash', isGroup: false }]);
  });
  it('reads the export status', async () => {
    mockApi({ 'GET /accounts/exports/x9': ok({ status: 'READY', downloadUrl: 'https://f/x.csv' }) });
    expect((await s.exportStatus('x9')).downloadUrl).toBe('https://f/x.csv');
  });
  it('passes API errors on', async () => {
    mockApi({ 'GET /accounts/reports/trial-balance': err(402, 'FEATURE_NOT_IN_PLAN') });
    await expect(s.get('trial-balance', {})).rejects.toMatchObject({ code: 'FEATURE_NOT_IN_PLAN' });
  });
});
