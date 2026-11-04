/** Every sub-module 11.2 network call (spec 8.20 and 8.23). Screens never call `fetch` themselves. */
import { api, apiBlob, apiList } from '@/lib/apiClient';
import { mapImportResult, mapOpeningList, mapPostResult, mapStatement } from './ledgerMappers';
import type {
  OpeningImportResult,
  OpeningList,
  OpeningPostResult,
  OpeningQuery,
  Statement,
} from '@/types/ledger';

const OB = '/billing/opening-balances';

export const ledgerService = {
  /** Opening balance rows with the totals of the draft rows (`finance.billing.view`). */
  async openingBalances(q: OpeningQuery = {}): Promise<OpeningList> {
    // the backend caps `limit` at 100 (a larger one is 400 VALIDATION_FAILED), so a long list is read page by page
    const limit = Math.min(q.limit ?? 100, 100);
    const wanted = q.limit ?? 100;
    const first = await apiList<unknown>(OB, { query: { ...q, limit, page: q.page ?? 1 } });
    const out = mapOpeningList(first.data, undefined, first.pagination?.total);
    const pages = first.pagination?.totalPages ?? 1;
    for (
      let page = (q.page ?? 1) + 1;
      page <= pages && out.items.length < wanted && q.page === undefined;
      page++
    ) {
      const more = await apiList<unknown>(OB, { query: { ...q, limit, page } });
      out.items.push(...mapOpeningList(more.data, undefined).items);
    }
    return out;
  },
  /**
   * Reads the file. Without `dryRun` the backend REPLACES the earlier draft and invalid rows with the new ones
   * (nothing is posted); with `dryRun: true` nothing is written and only the counts and the first 50 errors come back.
   */
  async importOpening(fileId: number, asOfDate: string, dryRun = false): Promise<OpeningImportResult> {
    return mapImportResult(
      await api<unknown>(`${OB}/import`, {
        method: 'POST',
        body: dryRun ? { fileId, asOfDate, dryRun } : { fileId, asOfDate },
        idempotent: true,
      }),
    );
  },
  /** Posts every draft row; the typed total must match (step-up is handled by the API client). */
  async postOpening(confirmTotalPaise: number): Promise<OpeningPostResult> {
    return mapPostResult(
      await api<unknown>(`${OB}/post`, { method: 'POST', body: { confirmTotalPaise }, idempotent: true }),
    );
  },
  reverseOpening: (id: number, reason: string, version: number) =>
    api<unknown>(`${OB}/${id}/reverse`, { method: 'POST', body: { reason, version } }),
  deleteOpening: (id: number, version: number) =>
    api<unknown>(`${OB}/${id}`, { method: 'DELETE', body: { version } }),

  async statement(unitId: number, from: string, to: string): Promise<Statement> {
    return mapStatement(await api<unknown>(`/billing/units/${unitId}/statement`, { query: { from, to } }));
  },
  /** The CSV file (needs `finance.billing.export`). */
  statementCsv: (unitId: number, from: string, to: string) =>
    apiBlob(`/billing/units/${unitId}/statement`, { query: { from, to, format: 'csv' } }),
};
