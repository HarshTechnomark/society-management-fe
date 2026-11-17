/** Module 13 bank accounts (spec 8.14). The full number only ever comes from the reveal call. */
export type BankKind = 'CURRENT' | 'SAVINGS';

export interface BankAccount {
  id: number;
  displayName: string;
  bankName: string;
  branchName: string;
  ifsc: string;
  accountKind: BankKind;
  accountHolderName: string;
  maskedNumber: string;
  isCollectionAccount: boolean;
  statementFormat: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED';
  verifiedByName: string;
  verifiedAt: string | null;
  lastReconciledDate: string | null;
  lastReconciledBalancePaise: number | null;
  balancePaise: number | null;
  status: 'ACTIVE' | 'CLOSED';
  version: number;
}

export interface BankOption {
  id: number;
  label: string;
  isCollection: boolean;
}

export interface BankAccountInput {
  displayName: string;
  bankName: string;
  branchName?: string;
  ifsc: string;
  accountKind: BankKind;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  openingBalancePaise?: number;
  openingBalanceDate?: string;
  isCollectionAccount?: boolean;
}

export interface BankAccountPatch {
  displayName?: string;
  branchName?: string | null;
  accountHolderName?: string;
  ifsc?: string;
  accountNumber?: string;
  confirmAccountNumber?: string;
  version: number;
}
