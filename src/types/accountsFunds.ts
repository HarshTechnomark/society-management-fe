/** Module 13 funds (spec 8.13). Money is integer paise. */
export type FundType = 'SINKING' | 'REPAIR' | 'CORPUS' | 'COLLECTION' | 'CUSTOM';
export type FundStatus = 'ACTIVE' | 'CLOSED';

export interface Fund {
  id: number;
  name: string;
  fundType: FundType;
  ledgerCode: string;
  balancePaise: number;
  inflowFyPaise: number;
  outflowFyPaise: number;
  /** Money moved out to other funds this year, when the API sends it separately from spending. */
  movedOutFyPaise: number;
  showToResidents: boolean;
  status: FundStatus;
  version: number;
  purpose: string;
  usageRequiresResolution: boolean;
}

export interface FundOption {
  id: number;
  label: string;
  fundType: FundType;
  balancePaise?: number;
}

export interface FundInput {
  fundType: 'COLLECTION' | 'CUSTOM';
  name: string;
  purpose?: string;
  usageRequiresResolution: boolean;
  showToResidents: boolean;
}

export interface FundPatch {
  name?: string;
  purpose?: string | null;
  usageRequiresResolution?: boolean;
  showToResidents?: boolean;
  status?: 'CLOSED';
  version: number;
}

export interface FundStatementRow {
  date: string;
  voucherNo: string;
  narration: string;
  inPaise: number;
  outPaise: number;
  runningPaise: number;
  kind?: 'CONTRIBUTION' | 'EXPENSE' | 'TRANSFER_IN' | 'TRANSFER_OUT';
}

export interface FundStatement {
  openingPaise: number;
  closingPaise: number;
  rows: FundStatementRow[];
}

/** `null` is General (the unearmarked surplus). */
export interface FundTransferInput {
  fromFundId: number | null;
  toFundId: number | null;
  amountPaise: number;
  date: string;
  reason: string;
}

export interface FundTransferResult {
  /** True when the approval rule let it through and the voucher is posted. */
  done: boolean;
  approvalRequestId: number | null;
  status: string;
}
