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
    const r = await apiList<unknown>(OB, { query: { ...q } });
    return mapOpeningList(r.data, undefined, r.pagination?.total);
  },
  /** Dry run: replaces earlier draft and invalid rows and returns the counts. */
  async importOpening(fileId: number, asOfDate: string): Promise<OpeningImportResult> {
    return mapImportResult(
      await api<unknown>(`${OB}/import`, { method: 'POST', body: { fileId, asOfDate }, idempotent: true }),
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
