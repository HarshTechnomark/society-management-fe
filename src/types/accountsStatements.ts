/** Bank statement imports, lines, candidates and the BRS (module 13 spec 7.10, 7.11, 8.14 BRS, 8.16). */
import type { PagedList, Pagination } from './accountsSettlements';

export type { PagedList, Pagination };
export type StatementStatus = 'UPLOADED' | 'PARSED' | 'FAILED' | 'RECONCILED';
export type LineMatchStatus = 'UNMATCHED' | 'MATCHED' | 'IGNORED';
export type MatchMethod = 'AUTO_REFERENCE' | 'AUTO_AMOUNT_DATE' | 'MANUAL' | 'CREATED_ENTRY';

export interface StatementImport {
  id: number;
  bankAccountId: number;
  bankAccountLabel: string;
  fileName: string | null;
  fileFormat: string;
  periodFrom: string | null;
  periodTo: string | null;
  openingBalancePaise: number | null;
  closingBalancePaise: number | null;
  lineCount: number;
  duplicateCount: number;
  creditTotalPaise: number;
  debitTotalPaise: number;
  /** Lines that are MATCHED or IGNORED. */
  matchedCount: number;
  status: StatementStatus;
  errorMessage: string | null;
  createdAt: string;
  version: number;
}

export interface StatementLine {
  id: number;
  importId: number;
  lineNo: number;
  txnDate: string;
  valueDate: string | null;
  description: string;
  reference: string | null;
  chequeNumber: string | null;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number | null;
  matchStatus: LineMatchStatus;
  matchMethod: MatchMethod | null;
  matchConfidence: number | null;
  matchedJournalLineId: number | null;
  matchedLabel: string | null;
  ignoredReason: string | null;
  version: number;
}

export interface Candidate {
  journalLineId: number;
  entryDate: string;
  voucherNo: string | null;
  narration: string;
  instrumentRef: string | null;
  amountPaise: number;
  score: number;
}

export interface StatementQuery {
  bankAccountId?: number;
  status?: StatementStatus | '';
  page?: number;
  limit?: number;
}
export interface LineQuery {
  matchStatus?: LineMatchStatus | '';
  direction?: 'CREDIT' | 'DEBIT' | '';
  q?: string;
  page?: number;
  limit?: number;
}

export interface ImportStatementInput {
  bankAccountId: number;
  fileId: number;
}
export interface CreateEntryInput {
  ledgerAccountCode: string;
  narration?: string;
  version: number;
}
export interface AutoMatchResult {
  matched: number;
  byReference: number;
  byAmountDate: number;
}

export interface BrsItem {
  kind:
    | 'UNCLEARED_DEBIT'
    | 'UNCLEARED_CREDIT'
    | 'UNMATCHED_STATEMENT_CREDIT'
    | 'UNMATCHED_STATEMENT_DEBIT'
    | string;
  date: string;
  description: string;
  reference: string | null;
  amountPaise: number;
}
export interface Brs {
  asOf: string | null;
  bookBalancePaise: number;
  unclearedDebitsPaise: number;
  unclearedCreditsPaise: number;
  unmatchedStatementCreditsPaise: number;
  unmatchedStatementDebitsPaise: number;
  computedBankBalancePaise: number;
  statementBalancePaise: number;
  differencePaise: number;
  items: BrsItem[];
}

/** A bank account for the upload picker. */
export interface BankAccountOption {
  id: number;
  label: string;
}
