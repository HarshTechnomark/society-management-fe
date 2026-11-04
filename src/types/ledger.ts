/** Module 11 (sub-module 11.2): unit ledger statement and opening balances. Money is integer paise. */

export type OpeningStatus = 'DRAFT' | 'INVALID' | 'POSTED' | 'REVERSED';

export interface OpeningBalanceRow {
  id: number;
  unitId: number | null;
  /** The flat label (from the file when the flat is unknown). */
  unitLabel: string;
  rowNo: number;
  asOfDate: string;
  arrearsPrincipalPaise: number;
  arrearsInterestPaise: number;
  advancePaise: number;
  status: OpeningStatus;
  validationError: string | null;
  invoiceId: number | null;
  postedAt: string | null;
  reversedAt: string | null;
  version: number;
}

export interface OpeningTotals {
  draftArrearsPaise: number;
  draftAdvancePaise: number;
  invalidCount: number;
  postedCount: number;
}

export interface OpeningList {
  items: OpeningBalanceRow[];
  totals: OpeningTotals;
  total: number;
}

export interface OpeningQuery {
  status?: OpeningStatus;
  page?: number;
  limit?: number;
}

export interface OpeningImportResult {
  draftCount: number;
  invalidCount: number;
  totals: OpeningTotals;
  dryRun: boolean;
  /** The first 50 invalid rows. */
  errors: { rowNo: number; unit: string; message: string }[];
}

export interface OpeningPostResult {
  posted: number;
  totalArrearsPaise: number;
  totalAdvancePaise: number;
}

export type LedgerEntryType =
  | 'OPENING_BALANCE'
  | 'INVOICE'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE'
  | 'PAYMENT'
  | 'PAYMENT_REVERSAL'
  | 'REFUND'
  | 'ADJUSTMENT';

export interface StatementEntry {
  id: number;
  entryDate: string;
  entryType: LedgerEntryType | string;
  refType: string;
  refId: number;
  narration: string;
  debitPaise: number;
  creditPaise: number;
  /** Running balance after this entry: positive = dues, negative = advance. */
  balancePaise: number;
}

export interface Statement {
  unit: { id: number; label: string };
  from: string;
  to: string;
  openingBalancePaise: number;
  entries: StatementEntry[];
  closingBalancePaise: number;
}
