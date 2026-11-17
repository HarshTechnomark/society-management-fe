'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { Gate } from '@/components/setup/Gate';
import { PlanLocked } from '@/components/subscription/FeatureGate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { accountsStatementsService } from '@/services/accountsStatements.service';
import { isPlan402, plainError } from '../statements/format';
import { BRS_KIND_LABEL, brsToCsv } from './brsCsv';
import { todayIST } from '@/lib/indiaDate';

const todayIso = () => todayIST();

/** Bank reconciliation statement of one bank account (spec 8.14 route 38, Premium). */
export function BrsScreen({ bankAccountId }: { bankAccountId: number }) {
  return (
    <Gate
      view={PERMISSIONS.finance.bank.view}
      feature="accounting.bank_reconciliation"
      title="Bank reconciliation statement"
    >
      <Inner id={bankAccountId} />
    </Gate>
  );
}

function Inner({ id }: { id: number }) {
  const [asOf, setAsOf] = useState(todayIso());
  const load = useLoad(() => accountsStatementsService.brs(id, asOf), `${id}|${asOf}`);
  const b = load.data;

  const exportCsv = () => {
    if (!b) return;
    const url = URL.createObjectURL(new Blob([brsToCsv(b)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-reconciliation-${asOf}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (load.error != null && isPlan402(load.error))
    return (
      <Page>
        <PlanLocked title="Bank reconciliation statement" />
      </Page>
    );

  return (
    <Page>
      <PageHead
        title="Bank reconciliation statement"
        sub="Why the books and the bank statement show different balances."
        actions={
          <>
            <Link href="/admin/accounts/bank/statements" className="text-[14px] font-semibold underline">
              Bank statements
            </Link>
            <Button variant="glass" disabled={!b} onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />
      <Card>
        <div className="mb-4 max-w-xs">
          <Input
            label="As of"
            type="date"
            max={todayIso()}
            value={asOf}
            onChange={e => e.target.value && setAsOf(e.target.value)}
          />
        </div>
        {load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : load.loading || !b ? (
          <div aria-busy="true" className="skeleton h-40 w-full" data-testid="skeleton-row" />
        ) : (
          <>
            <dl className="grid gap-1 text-[14.5px]" aria-label="Summary">
              <Row label="Balance as per the books" v={b.bookBalancePaise} strong />
              <Row
                label="Less: money in, in the books but not yet on the statement"
                v={-b.unclearedDebitsPaise}
              />
              <Row
                label="Add: money out, in the books but not yet on the statement"
                v={b.unclearedCreditsPaise}
              />
              <Row
                label="Add: money in on the statement, not in the books"
                v={b.unmatchedStatementCreditsPaise}
              />
              <Row
                label="Less: money out on the statement, not in the books"
                v={-b.unmatchedStatementDebitsPaise}
              />
              <Row label="Balance as computed" v={b.computedBankBalancePaise} strong />
              {b.statementBalancePaise !== null && b.differencePaise !== null && (
                <>
                  <Row label="Balance as per the bank statement" v={b.statementBalancePaise} strong />
                  <Row label="Difference" v={b.differencePaise} strong />
                </>
              )}
            </dl>
            <div className="mt-3">
              {b.differencePaise === null ? (
                <Alert tone="info">
                  No bank statement has been imported up to this date, so there is nothing to compare with.
                </Alert>
              ) : b.differencePaise === 0 ? (
                <Alert tone="ok">The books and the bank statement agree.</Alert>
              ) : (
                <Alert tone="warn">
                  There is a difference of {inr(Math.abs(b.differencePaise))}. Match or create the missing
                  entries.
                </Alert>
              )}
            </div>
            <h2 className="mb-2 mt-5 text-[16px] font-bold">Items still open</h2>
            {b.items.length === 0 ? (
              <p className="text-[14px] text-muted">Nothing is open.</p>
            ) : (
              <ul aria-label="Open items" className="divide-y divide-[var(--line)]">
                {b.items.map((i, n) => (
                  <li
                    key={n}
                    data-testid="brs-item"
                    className="flex items-start justify-between gap-3 py-2.5 text-[13.5px]"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{i.description || '-'}</span>
                      <span className="text-muted">
                        {shortDate(i.date)}
                        {i.reference ? ` . ${i.reference}` : ''} . {BRS_KIND_LABEL[i.kind] ?? i.kind}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{inr(i.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </Page>
  );
}

const Row = ({ label, v, strong }: { label: string; v: number; strong?: boolean }) => (
  <div
    className={`flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-1.5 ${strong ? 'font-bold' : ''}`}
  >
    <dt>{label}</dt>
    <dd className="tabular-nums">{inr(v)}</dd>
  </div>
);
