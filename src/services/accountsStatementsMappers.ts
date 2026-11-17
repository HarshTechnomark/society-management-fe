/** Normalisers from the statement shapes (spec 7.10, 7.11, 8.14 BRS, 8.16) to `types/accountsStatements.ts`. Never throw. */
import type {
  BankAccountOption,
  BrsItem,
  Brs,
  Candidate,
  LineMatchStatus,
  MatchMethod,
  StatementImport,
  StatementLine,
  StatementStatus,
} from '@/types/accountsStatements';
import { arr, num, numN, obj, str, strN } from './accountsReadHelpers';

export function normaliseImport(raw: unknown): StatementImport {
  const r = obj(raw);
  const acc = obj(r.bankAccount);
  const file = obj(r.file);
  return {
    id: num(r.id),
    bankAccountId: num(r.bankAccountId, num(acc.id)),
    bankAccountLabel: str(r.bankAccountLabel, str(acc.label, str(acc.name, str(acc.bankName)))),
    fileName: strN(r.fileName) ?? strN(file.originalName) ?? strN(file.name),
    fileFormat: str(r.fileFormat, 'CSV'),
    periodFrom: strN(r.periodFrom),
    periodTo: strN(r.periodTo),
    openingBalancePaise: numN(r.openingBalancePaise),
    closingBalancePaise: numN(r.closingBalancePaise),
    lineCount: num(r.lineCount),
    duplicateCount: num(r.duplicateCount),
    creditTotalPaise: num(r.creditTotalPaise),
    debitTotalPaise: num(r.debitTotalPaise),
    matchedCount: num(r.matchedCount),
    status: str(r.status, 'UPLOADED') as StatementStatus,
    errorMessage: strN(r.errorMessage),
    createdAt: str(r.createdAt),
    version: num(r.version, 1),
  };
}

export function normaliseLine(raw: unknown): StatementLine {
  const r = obj(raw);
  return {
    id: num(r.id),
    importId: num(r.importId),
    lineNo: num(r.lineNo),
    txnDate: str(r.txnDate),
    valueDate: strN(r.valueDate),
    description: str(r.description),
    reference: strN(r.reference),
    chequeNumber: strN(r.chequeNumber),
    debitPaise: num(r.debitPaise),
    creditPaise: num(r.creditPaise),
    runningBalancePaise: numN(r.runningBalancePaise),
    matchStatus: str(r.matchStatus, 'UNMATCHED') as LineMatchStatus,
    matchMethod: strN(r.matchMethod) as MatchMethod | null,
    matchConfidence: numN(r.matchConfidence),
    matchedJournalLineId: numN(r.matchedJournalLineId),
    matchedLabel: strN(r.matchedLabel) ?? strN(obj(r.matchedLine).voucherNo),
    ignoredReason: strN(r.ignoredReason),
    version: num(r.version, 1),
  };
}

export function normaliseCandidate(raw: unknown): Candidate {
  const r = obj(raw);
  const entry = obj(r.entry);
  return {
    journalLineId: num(r.journalLineId, num(r.id)),
    entryDate: str(r.entryDate, str(entry.entryDate, str(r.date))),
    voucherNo: strN(r.voucherNo) ?? strN(entry.voucherNo),
    narration: str(r.narration, str(entry.narration, str(r.description))),
    instrumentRef: strN(r.instrumentRef) ?? strN(entry.instrumentRef),
    amountPaise: num(r.amountPaise, num(r.debitPaise) || num(r.creditPaise)),
    score: num(r.score),
  };
}

export function normaliseBrsItem(raw: unknown): BrsItem {
  const r = obj(raw);
  return {
    kind: str(r.kind, str(r.type)),
    date: str(r.date, str(r.entryDate, str(r.txnDate))),
    description: str(r.description, str(r.narration)),
    reference: strN(r.reference) ?? strN(r.instrumentRef),
    amountPaise: num(r.amountPaise),
  };
}

export function normaliseBrs(raw: unknown): Brs {
  const r = obj(raw);
  return {
    asOf: strN(r.asOf),
    bookBalancePaise: num(r.bookBalancePaise),
    unclearedDebitsPaise: num(r.unclearedDebitsPaise),
    unclearedCreditsPaise: num(r.unclearedCreditsPaise),
    unmatchedStatementCreditsPaise: num(r.unmatchedStatementCreditsPaise),
    unmatchedStatementDebitsPaise: num(r.unmatchedStatementDebitsPaise),
    computedBankBalancePaise: num(r.computedBankBalancePaise),
    statementBalancePaise: numN(r.statementBalancePaise),
    differencePaise: numN(r.differencePaise),
    items: arr(r.items).map(normaliseBrsItem),
  };
}

export function normaliseBankOption(raw: unknown): BankAccountOption {
  const r = obj(raw);
  const bank = str(r.bankName, str(r.name));
  const display = str(r.displayName);
  const masked = str(r.accountNumberMasked, str(r.accountNumber));
  return {
    id: num(r.id),
    label: str(r.label) || display || [bank, masked].filter(Boolean).join(' ') || `Account ${num(r.id)}`,
  };
}
