import type { Brs } from '@/types/accountsStatements';

const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const rupees = (p: number) => (p / 100).toFixed(2);
export const BRS_KIND_LABEL: Record<string, string> = {
  UNCLEARED_DEBIT: 'In the books, not yet on the statement (money in)',
  UNCLEARED_CREDIT: 'In the books, not yet on the statement (money out)',
  UNMATCHED_STATEMENT_CREDIT: 'On the statement, not in the books (money in)',
  UNMATCHED_STATEMENT_DEBIT: 'On the statement, not in the books (money out)',
};

/** The BRS as CSV text (rupees with two decimals), summary first, then the open items. */
export function brsToCsv(b: Brs): string {
  const out: string[] = [
    'Bank reconciliation statement',
    `${q('As of')},${q(b.asOf ?? '')}`,
    `${q('Balance as per books')},${rupees(b.bookBalancePaise)}`,
    `${q('Add: money in, in the books but not on the statement')},${rupees(b.unclearedDebitsPaise)}`,
    `${q('Less: money out, in the books but not on the statement')},${rupees(b.unclearedCreditsPaise)}`,
    `${q('Add: money in on the statement, not in the books')},${rupees(b.unmatchedStatementCreditsPaise)}`,
    `${q('Less: money out on the statement, not in the books')},${rupees(b.unmatchedStatementDebitsPaise)}`,
    `${q('Balance as computed')},${rupees(b.computedBankBalancePaise)}`,
    `${q('Balance as per the bank statement')},${rupees(b.statementBalancePaise)}`,
    `${q('Difference')},${rupees(b.differencePaise)}`,
    '',
    ['Kind', 'Date', 'Description', 'Reference', 'Amount'].map(q).join(','),
    ...b.items.map(i =>
      [BRS_KIND_LABEL[i.kind] ?? i.kind, i.date, i.description, i.reference ?? '', rupees(i.amountPaise)]
        .map(q)
        .join(','),
    ),
  ];
  return out.join('\n');
}
