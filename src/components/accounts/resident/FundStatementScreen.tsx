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
            <dt className="text-muted">Spent</dt>
            <dd className="text-right font-bold" data-testid="fund-spent">
              {inr(d.spentPaise)}
            </dd>
            <dt className="text-muted">Balance</dt>
            <dd className="text-right font-bold" data-testid="fund-balance">
              {inr(d.balancePaise)}
            </dd>
            <dt className="text-muted">Contributors</dt>
            <dd className="text-right font-bold">
              {d.contributors === 1 ? '1 household' : `${d.contributors} households`}
            </dd>
          </dl>
          {d.spend.length === 0 ? (
            <p className="mt-4 text-[14px] text-muted">Nothing has been spent from this fund yet.</p>
          ) : (
            <CategoryBars title="Spent by category" rows={d.spend} />
          )}
          <p className="mt-4 text-[13.5px]">{back}</p>
        </Card>
      )}
    </Page>
  );
}
