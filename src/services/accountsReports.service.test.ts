import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { bsRaw, glRaw, gstRaw, ieRaw, rpRaw, tdsRaw, trialBalanceRaw } from '@/test/accountsReportsFixtures';
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
  it('maps the flat sectioned rows of the other reports', () => {
    const ie = normaliseReport('income-expenditure', ieRaw());
    expect(ie.blocks.map(b => b.title)).toEqual(['Income', 'Expenditure']);
    expect(ie.blocks[0].rows[0][0]).toMatchObject({ ledgerAccountId: 5 });
    expect(ie.blocks[0].total?.[1].text).toBe('₹32,250');
    expect(ie.summary[0]).toEqual({ label: 'Surplus for the period', value: '₹31,070' });
    const bs = normaliseReport('balance-sheet', bsRaw());
    expect(bs.balanced).toBe(true);
    expect(bs.blocks.map(b => b.title)).toEqual(['Assets', 'Funds', 'Reserves and surplus']);
    expect(bs.blocks[2].rows[0][0].text).toBe('Surplus (deficit) of the current year');
    const rp = normaliseReport('receipts-payments', rpRaw());
    expect(rp.blocks[0].rows).toHaveLength(1);
    expect(rp.blocks[1].rows).toHaveLength(1);
    expect(rp.summary.map(x => x.label)).toEqual(['Cash and bank at the start', 'Cash and bank at the end']);
    const gst = normaliseReport('gst-summary', gstRaw());
    expect(gst.blocks[0].rows[0][4].text).toBe('₹18');
    expect(gst.blocks[0].total?.[6].text).toBe('₹13');
    const tds = normaliseReport('tds-register', tdsRaw());
    expect(tds.blocks[0].rows[0][1]).toMatchObject({ journalId: 41 });
    expect(tds.blocks[0].rows[0][3].text).toBe('194C');
    expect(tds.blocks[0].total?.[4].text).toBe('₹200');
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

describe('negative report amounts', () => {
  it('shows a minus sign on a negative line and keeps both directions in their sections', () => {
    const v = normaliseReport('receipts-payments', {
      rows: [
        { section: 'RECEIPT', code: '4100', name: 'Maintenance', amountPaise: 100000 },
        { section: 'RECEIPT', code: '5400', name: 'Payment gateway charges', amountPaise: -20416 },
        { section: 'PAYMENT', code: '5300', name: 'Repairs', amountPaise: 50000 },
      ],
      totals: { receiptsPaise: 79584, paymentsPaise: 50000 },
    });
    expect(v.blocks[0].rows[1][1].text).toBe('-₹204.16');
    expect(v.blocks[0].rows).toHaveLength(2);
    expect(v.blocks[1].rows).toHaveLength(1);
  });
});
