/** Module 13 reports, report exports and the ledger account picker (spec 8.10, 8.19, APIs 65 and 66). */
import { api } from '@/lib/apiClient';
import { flattenLedger, normaliseReport } from './accountsReportsMappers';
import type { ExportFormat, ExportStatus, ReportKey, ReportQuery } from '@/types/accountsReports';

type Query = Record<string, string | number | boolean | undefined>;
const clean = (q: ReportQuery): Query => {
  const out: Query = {};
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== false) out[k] = v;
  return out;
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

export const accountsReportsService = {
  get: (report: ReportKey, q: ReportQuery) =>
    api<unknown>(`/accounts/reports/${report}`, { query: clean(q), plan: false }).then(r =>
      normaliseReport(report, r),
    ),
  ledgerAccounts: () =>
    api<unknown>('/accounts/ledger-accounts', { query: { activeOnly: true }, plan: false }).then(r =>
      flattenLedger(r).filter(a => !a.isGroup),
    ),
  /** Starts an export job (202). The date range and filters are the same as the report on screen. */
  startExport: (report: ReportKey, params: ReportQuery, format: ExportFormat) =>
    api<{ exportJobId?: string | number }>('/accounts/exports', {
      method: 'POST',
      body: { report, params: clean(params), format },
      idempotent: true,
    }).then(r => String(r?.exportJobId ?? '')),
  /** Assumed status route (not in the spec): `GET /accounts/exports/:id` -> `{ status, downloadUrl, expiresAt }`. */
  exportStatus: (id: string): Promise<ExportStatus> =>
    api<unknown>(`/accounts/exports/${encodeURIComponent(id)}`, { plan: false }).then(raw => {
      const r = obj(raw);
      const s = String(r.status ?? '').toUpperCase();
      const url =
        typeof r.downloadUrl === 'string' ? r.downloadUrl : typeof r.url === 'string' ? r.url : null;
      const status =
        s === 'FAILED' || s === 'ERROR'
          ? 'FAILED'
          : url || s === 'READY' || s === 'DONE'
            ? 'READY'
            : 'PREPARING';
      return {
        status,
        downloadUrl: url,
        expiresAt: typeof r.expiresAt === 'string' ? r.expiresAt : null,
        message: typeof r.message === 'string' ? r.message : null,
      };
    }),
};
