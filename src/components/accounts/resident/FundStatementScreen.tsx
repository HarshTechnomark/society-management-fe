'use client';
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { accountsBalanceService as svc } from '@/services/accountsBalance.service';
import { plainBalanceError } from '../balance/format';
import { CategoryBars } from './FinancesScreen';

const LINE_LABEL = {
  EXPENSE: 'Spent',
  TRANSFER_OUT: 'Moved to another fund',
  TRANSFER_IN: 'Moved in from another fund',
  CONTRIBUTION: 'Collected',
} as const;

/** Resident fund statement (spec 8.3): collected, spent by category, balance, and how many people contributed. */
export function FundStatementScreen({ id }: { id: number }) {
  return (
    <Gate view={PERMISSIONS.resident.finances.view} title="society finances">
      <Inner id={id} />
    </Gate>
  );
}

function Inner({ id }: { id: number }) {
  const q = useLoad(() => svc.fundStatement(id), id);
  const d = q.data;
  const gone = q.error instanceof ApiError && q.error.status === 404;
  const back = (
    <Link href="/resident/finances" className="font-semibold underline">
      Back to society finances
    </Link>
  );
  return (
    <Page>
      <PageHead title={d?.fund.name ?? 'Fund statement'} sub="Money collected and spent for this fund." />
      {d === null && q.loading ? (
        <div className="skeleton h-40 w-full" aria-label="Loading statement" />
      ) : gone ? (
        <Card>
          <EmptyState
            title="This fund is not available"
            text="It was not found, or it is not shown to residents."
            action={back}
          />
        </Card>
      ) : d === null ? (
        <Card>
          <ErrorState
            error={plainBalanceError(q.error)}
            action={
              <Button size="sm" onClick={q.reload}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <dl className="grid grid-cols-2 gap-2 text-[14px]">
            <dt className="text-muted">Collected</dt>
            <dd className="text-right font-bold" data-testid="fund-collected">
              {inr(d.collectedPaise)}
            </dd>
            {d.movedInPaise > 0 && (
              <>
                <dt className="text-muted">Moved in from another fund</dt>
                <dd className="text-right font-bold" data-testid="fund-moved-in">
                  {inr(d.movedInPaise)}
                </dd>
              </>
            )}
            <dt className="text-muted">Spent</dt>
            <dd className="text-right font-bold" data-testid="fund-spent">
              {inr(d.spentPaise)}
            </dd>
            {d.movedOutPaise > 0 && (
              <>
                <dt className="text-muted">Moved to another fund</dt>
                <dd className="text-right font-bold" data-testid="fund-moved-out">
                  {inr(d.movedOutPaise)}
                </dd>
              </>
            )}
            <dt className="text-muted">Balance</dt>
            <dd className="text-right font-bold" data-testid="fund-balance">
              {inr(d.balancePaise)}
            </dd>
            {d.contributors > 0 && (
              <>
                <dt className="text-muted">Contributors</dt>
                <dd className="text-right font-bold" data-testid="fund-contributors">
                  {d.contributors === 1 ? '1 household' : `${d.contributors} households`}
                </dd>
              </>
            )}
          </dl>
          <p className="mt-3 text-[13px] text-muted" data-testid="fund-equation">
            Collected {inr(d.collectedPaise)} + Moved in {inr(d.movedInPaise)} − Spent {inr(d.spentPaise)} −
            Moved out {inr(d.movedOutPaise)} = Balance {inr(d.balancePaise)}
          </p>
          {d.spend.length > 0 && <CategoryBars title="Spent by category" rows={d.spend} />}
          {d.lines.length > 0 && (
            <ul className="mt-4 divide-y divide-[var(--line)] text-[14px]" data-testid="fund-lines">
              {d.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{LINE_LABEL[l.kind]}</span>
                    {l.label ? <span className="text-muted"> · {l.label}</span> : null}
                  </span>
                  <span className="tabular-nums">{inr(l.amountPaise)}</span>
                </li>
              ))}
            </ul>
          )}
          {d.spentPaise === 0 && d.movedOutPaise === 0 && (
            <p className="mt-4 text-[14px] text-muted">Nothing has been spent from this fund yet.</p>
          )}
          <p className="mt-4 text-[13.5px]">{back}</p>
        </Card>
      )}
    </Page>
  );
}
