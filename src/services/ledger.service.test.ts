import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiList = vi.fn();
const api = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  api: (...a: unknown[]) => api(...a),
  apiList: (...a: unknown[]) => apiList(...a),
  apiBlob: vi.fn(),
}));

import { ledgerService } from './ledger.service';

const page = (n: number, totalPages: number) => ({
  data: { items: [{ id: n, status: 'DRAFT' }], totals: {} },
  pagination: { page: n, limit: 100, total: 150, totalPages },
});

describe('ledgerService against the real routes', () => {
  beforeEach(() => {
    apiList.mockReset();
    api.mockReset();
  });
  it('never asks for more than 100 rows a page and reads the next pages', async () => {
    apiList.mockResolvedValueOnce(page(1, 2)).mockResolvedValueOnce(page(2, 2));
    const r = await ledgerService.openingBalances({ limit: 1000 });
    expect(apiList.mock.calls[0]![1].query).toMatchObject({ limit: 100, page: 1 });
    expect(apiList.mock.calls[1]![1].query).toMatchObject({ limit: 100, page: 2 });
    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(150);
  });
  it('sends dryRun only when asked and keeps the body strict', async () => {
    api.mockResolvedValue({ draft: 0, invalid: 0, totals: {}, dryRun: false, errors: [] });
    await ledgerService.importOpening(5, '2026-03-31');
    expect(api.mock.calls[0]![1].body).toEqual({ fileId: 5, asOfDate: '2026-03-31' });
    await ledgerService.importOpening(5, '2026-03-31', true);
    expect(api.mock.calls[1]![1].body).toEqual({ fileId: 5, asOfDate: '2026-03-31', dryRun: true });
  });
  it('posts the confirm total and reverses and deletes with the row version', async () => {
    api.mockResolvedValue({ posted: 1 });
    await ledgerService.postOpening(-5);
    expect(api.mock.calls[0]![1].body).toEqual({ confirmTotalPaise: -5 });
    await ledgerService.reverseOpening(3, 'Wrong amounts typed', 4);
    expect(api.mock.calls[1]![1].body).toEqual({ reason: 'Wrong amounts typed', version: 4 });
    await ledgerService.deleteOpening(3, 4);
    expect(api.mock.calls[2]![1]).toMatchObject({ method: 'DELETE', body: { version: 4 } });
  });
});
