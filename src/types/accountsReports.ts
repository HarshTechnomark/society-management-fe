/** Module 13 reports and exports (spec 8.19, 11.7). The screens show one generic table view for every report. */
export type ReportKey =
  | 'trial-balance'
  | 'income-expenditure'
  | 'balance-sheet'
  | 'general-ledger'
  | 'receipts-payments'
  | 'gst-summary'
  | 'tds-register';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportQuery {
  asOf?: string;
  from?: string;
  to?: string;
  financialYear?: string;
  ledgerAccountId?: number;
  fundId?: number;
  level?: number;
  includeZero?: boolean;
}

/** One table cell: text, optional right alignment and an optional drill-down. */
export interface ReportCell {
  text: string;
  right?: boolean;
  bold?: boolean;
  /** Drill-down: open the ledger of this account inside the reports screen. */
  ledgerAccountId?: number;
  ledgerCode?: string;
  /** Drill-down: open this journal voucher. */
  journalId?: number;
}
export interface ReportBlock {
  title: string | null;
  columns: { label: string; right?: boolean }[];
  rows: ReportCell[][];
  total: ReportCell[] | null;
}
export interface ReportView {
  report: ReportKey;
  heading: string;
  /** "As of 31 Oct 2026" or "1 Apr 2026 to 31 Oct 2026". */
  periodText: string;
  /** Trial balance and balance sheet only; null when the report has no such check. */
  balanced: boolean | null;
  blocks: ReportBlock[];
  /** Plain lines under the tables, for example "Surplus for the period". */
  summary: { label: string; value: string }[];
  empty: boolean;
}

export interface ExportJob {
  exportJobId: string;
}
export interface ExportStatus {
  status: 'PREPARING' | 'READY' | 'FAILED';
  downloadUrl: string | null;
  expiresAt: string | null;
  message: string | null;
}

export interface LedgerOption {
  id: number;
  code: string;
  name: string;
  isGroup: boolean;
}
