/** Module 13 chart of accounts, journals and opening balances (spec 7.1 to 7.3, 8.10 to 8.12). */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'FUND' | 'INCOME' | 'EXPENSE';

export interface LedgerAccount {
  id: number;
  code: string;
  name: string;
  accountType: AccountType;
  subtype: string;
  parentId: number | null;
  isGroup: boolean;
  isActive: boolean;
  isSystem: boolean;
  isCashBookCategory: boolean;
  transparencyCategory: string | null;
  description: string | null;
  /** Absent when the user may not view balances (expense pickers). */
  balancePaise: number | null;
  version: number;
  children: LedgerAccount[];
}

export interface CreateLedgerAccountInput {
  parentId: number;
  code: string;
  name: string;
  isGroup?: boolean;
  subtype?: string;
  isCashBookCategory?: boolean;
  transparencyCategory?: string;
  description?: string;
}
export interface UpdateLedgerAccountInput {
  name?: string;
  isActive?: boolean;
  isCashBookCategory?: boolean;
  transparencyCategory?: string | null;
  description?: string | null;
  version: number;
}

export type JournalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REJECTED' | 'CANCELLED';
export type JournalSource = 'SYSTEM' | 'MANUAL';
export type VoucherType = 'JOURNAL' | 'CONTRA' | 'PAYMENT' | 'RECEIPT';

export interface JournalSourceLink {
  refType: string;
  refId: string;
  label: string;
}
export interface JournalRef {
  id: number;
  voucherNo: string | null;
}

export interface JournalItem {
  id: number;
  voucherNo: string | null;
  voucherType: string;
  entryDate: string;
  narration: string;
  source: JournalSource;
  status: JournalStatus;
  totalPaise: number;
  refType: string;
  refId: string;
  version: number;
  /** User id of the maker; null when unknown. */
  createdBy: number | null;
}

export interface JournalLine {
  lineNo: number;
  ledgerAccountId: number | null;
  ledgerAccountCode: string;
  ledgerAccountName: string;
  fundId: number | null;
  fundName: string | null;
  debitPaise: number;
  creditPaise: number;
  lineNarration: string | null;
}

export interface JournalDetail extends JournalItem {
  instrumentRef: string | null;
  lines: JournalLine[];
  differencePaise: number;
  reversalOf: JournalRef | null;
  reversedBy: JournalRef | null;
  reversalReason: string | null;
  rejectionReason: string | null;
  /** The module 14 request while it waits for approval (or after it was decided). */
  approvalRequestId: number | null;
  sourceLink: JournalSourceLink | null;
  postedAt: string | null;
  audit: { at: string; action: string; by: string | null; note: string | null }[];
}

export interface JournalQuery {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  voucherType?: string;
  status?: string;
  source?: string;
  refType?: string;
  ledgerAccountId?: number;
  fundId?: number;
  q?: string;
  minAmountPaise?: number;
  maxAmountPaise?: number;
  sortBy?: 'entryDate' | 'voucherNo' | 'totalPaise' | 'createdAt';
}

export interface JournalLineInput {
  ledgerAccountCode: string;
  debitPaise: number;
  creditPaise: number;
  fundId?: number;
  lineNarration?: string;
}
export interface JournalInput {
  date: string;
  voucherType?: VoucherType;
  narration: string;
  instrumentRef?: string;
  lines: JournalLineInput[];
}

export interface OpeningBalanceInput {
  asOfDate: string;
  narration?: string;
  autoBalance: boolean;
  lines: { ledgerAccountCode: string; debitPaise: number; creditPaise: number; fundId?: number }[];
}
export interface OpeningBalanceResult {
  journalId: number | null;
  voucherNo: string | null;
  asOfDate: string | null;
  totalPaise: number;
  autoBalancePaise: number;
}

/** An optional pick list entry (funds); the list may not exist yet. */
export interface FundOption {
  id: number;
  name: string;
}
