/** Module 13 society balance and resident finances shapes (spec 8.1 to 8.3). Money is integer paise. */
export interface BalanceBankAccount {
  id: number;
  displayName: string;
  bankName: string;
  maskedNumber: string;
  balancePaise: number;
  isCollectionAccount: boolean;
  verificationStatus: string;
  lastReconciledDate: string | null;
  lastReconciledBalancePaise: number | null;
}
export interface BalanceFund {
  id: number;
  name: string;
  fundType: string;
  balancePaise: number;
}
export interface BalanceMovement {
  journalEntryId: number;
  changedAt: string;
  direction: 'UP' | 'DOWN' | 'MOVE';
  deltaTotalPaise: number;
  label: string;
  totalPaise: number;
}
export interface SocietyBalance {
  totalPaise: number;
  inBankPaise: number;
  clearingPaise: number;
  cashPaise: number;
  chequesPaise: number;
  investmentsPaise: number;
  earmarkedFundsPaise: number;
  generalPaise: number;
  lastChangedAt: string | null;
  bankAccounts: BalanceBankAccount[];
  funds: BalanceFund[];
  movements: BalanceMovement[];
}
export interface BalancePoint {
  date: string;
  totalPaise: number;
  inBankPaise: number;
  clearingPaise: number;
  cashPaise: number;
  chequesPaise: number;
}
export interface CategoryAmount {
  category: string;
  financialYear: string | null;
  amountPaise: number;
}
export interface ResidentFinances {
  level: 'BALANCE' | 'FULL';
  totalPaise: number;
  inBankPaise: number;
  clearingPaise: number;
  cashPaise: number;
  chequesPaise: number;
  changedAt: string | null;
  funds: { id: number; name: string; balancePaise: number }[];
  spendByCategory: CategoryAmount[] | null;
  incomeByCategory: CategoryAmount[] | null;
}
export type FundLineKind = 'EXPENSE' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'CONTRIBUTION';
export interface FundStatementLine {
  kind: FundLineKind;
  date: string;
  label: string;
  amountPaise: number;
}
export interface FundStatement {
  fund: { id: number; name: string };
  collectedPaise: number;
  spentPaise: number;
  movedInPaise: number;
  movedOutPaise: number;
  balancePaise: number;
  contributors: number;
  spend: { category: string; amountPaise: number }[];
  /** Typed statement lines, when the API sends them. */
  lines: FundStatementLine[];
}
