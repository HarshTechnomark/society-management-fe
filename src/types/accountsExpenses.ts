/** Module 13 expenses and cash book (spec 8.4 to 8.9). Money is integer paise. */
export type ExpenseStatus =
  'DRAFT' | 'PENDING_APPROVAL' | 'CHANGES_REQUESTED' | 'POSTED' | 'REJECTED' | 'REVERSED' | 'CANCELLED';
export type ExpenseType = 'DIRECT' | 'VENDOR_BILL' | 'STATUTORY_DUE';
export type PaymentMode = 'CASH' | 'CHEQUE' | 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CARD';

export interface LedgerRef {
  id: number;
  code: string;
  name: string;
}

export interface ExpenseItem {
  id: number;
  displayId: string;
  status: ExpenseStatus;
  voucherNo: string | null;
  expenseType: ExpenseType;
  expenseDate: string;
  payee: string;
  ledgerAccount: LedgerRef | null;
  grossAmountPaise: number;
  gstPaise: number;
  tdsPaise: number;
  netPaidPaise: number;
  paidFrom: LedgerRef | null;
  paymentMode: string;
  fundId: number | null;
  fundName: string | null;
  collectionId: number | null;
  collectionTitle: string | null;
  billFileCount: number;
  approvalRequestId: number | null;
  createdByName: string | null;
  version: number;
}

export interface ExpenseFile {
  id: number;
  name: string;
  mimeType: string;
  status: string;
  url: string | null;
}

export interface ApprovalAction {
  action: string;
  by: string;
  at: string | null;
  note: string | null;
}

export interface ExpenseDetail extends ExpenseItem {
  description: string | null;
  paymentReference: string | null;
  tdsSection: string | null;
  challanNo: string | null;
  rejectionReason: string | null;
  approvedByName: string | null;
  reversalVoucherNo: string | null;
  reversalReason: string | null;
  files: ExpenseFile[];
  approval: { status: string; levels: number | null; actions: ApprovalAction[] } | null;
  journalLines: { account: string; debitPaise: number; creditPaise: number }[];
  canApprove: boolean;
  canReverse: boolean;
  createdById: number | null;
}

export interface ExpensePage {
  items: ExpenseItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ExpenseQuery {
  page?: number;
  limit?: number;
  status?: string;
  expenseType?: string;
  from?: string;
  to?: string;
  ledgerAccountId?: number;
  fundId?: number;
  paidFrom?: string;
  createdByMe?: boolean;
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExpenseInput {
  expenseType?: ExpenseType;
  expenseDate: string;
  payee: string;
  ledgerAccountId?: number;
  description?: string;
  grossAmountPaise: number;
  gstPaise?: number;
  tdsPaise?: number;
  tdsSection?: string;
  challanNo?: string;
  paidFromLedgerAccountId: number;
  paymentMode: string;
  paymentReference?: string;
  fundId?: number;
  vendorId?: number;
  vendorBillId?: number;
  fileIds?: number[];
  submit?: boolean;
}

export interface ExpenseResult {
  id: number;
  displayId: string;
  status: ExpenseStatus;
  voucherNo: string | null;
  version: number;
}

export interface LedgerOption {
  id: number;
  code: string;
  name: string;
  subtype: string;
  accountType: string;
  isCashBookCategory: boolean;
  balancePaise: number | null;
}

export interface BankOption {
  id: number;
  label: string;
  ledgerAccountId: number | null;
  balancePaise: number | null;
}

export interface FundOption {
  id: number;
  name: string;
  balancePaise: number | null;
}

export interface CashBookRow {
  date: string;
  voucherNo: string;
  voucherType: string;
  narration: string;
  account: string;
  inPaise: number;
  outPaise: number;
  runningPaise: number;
  refType: string | null;
  refId: string | null;
}

export interface CashBook {
  openingPaise: number;
  closingPaise: number;
  rows: CashBookRow[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CashBookQuery {
  account: string;
  from: string;
  to: string;
  direction?: 'IN' | 'OUT';
  page?: number;
  limit?: number;
}
