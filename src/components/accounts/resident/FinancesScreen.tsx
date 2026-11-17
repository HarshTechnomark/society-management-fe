'use client';
import Link from 'next/link';
import { useEffect } from 'react';
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
import type { CategoryAmount } from '@/types/accountsBalance';
import { plainBalanceError, timeOf } from '../balance/format';

export const HIDDEN_TEXT = 'Your society has not made its finances visible to residents.';

/** Bars for amounts by category: label, value and a proportional bar. */
export function CategoryBars({
  title,
  rows,
}: {
  title: string;
  rows: { category: string; amountPaise: number }[];
}) {
  const max = Math.max(1, ...rows.map(r => r.amountPaise));
  return (
    <section aria-label={title} className="mt-4">
      <h3 className="text-[14.5px] font-bold">{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map(r => (
          <li key={r.category} data-testid="category-row">
            <span className="flex justify-between gap-2 text-[13.5px]">
              <span>{r.category}</span>
              <strong>{inr(r.amountPaise)}</strong>
            </span>
            <span
              className="mt-1 block h-2 overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-[#c9a961]"
                style={{ width: `${(r.amountPaise / max) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const sumByCategory = (rows: CategoryAmount[]) =>
  rows.map(r => ({ category: r.category, amountPaise: r.amountPaise }));

/** Resident "Society finances" (spec 11.8): balance, funds, and at FULL level income and spending. */
export function FinancesScreen({ pollMs = 30_000 }: { pollMs?: number }) {
  return (
    <Gate view={PERMISSIONS.resident.finances.view} title="society finances">
      <Inner pollMs={pollMs} />
    </Gate>
  );
}

function Inner({ pollMs }: { pollMs: number }) {
  const q = useLoad(() => svc.residentFinances());
  const { reload } = q;
  useEffect(() => {
    const t = window.setInterval(reload, pollMs);
    return () => window.clearInterval(t);
  }, [pollMs, reload]);
  const d = q.data;
  const hidden = d === null && q.error instanceof ApiError && q.error.status === 404;
  return (
    <Page>
      <PageHead title="Society finances" sub="How much money the society has and where it is kept." />
      {d === null && q.loading ? (
        <div className="skeleton h-40 w-full" aria-label="Loading finances" />
      ) : hidden ? (
        <Card>
          <EmptyState title="Finances are not shown" text={HIDDEN_TEXT} />
        </Card>
      ) : d === null ? (
        <Card>
          <ErrorState
            error={plainBalanceError(q.error)}
            action={
              <Button size="sm" onClick={reload}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card title="Society balance">
            <p className="text-[30px] font-bold tracking-tight" data-testid="resident-total">
              {inr(d.totalPaise)}
            </p>
            <p className="text-[12.5px] text-muted">Updated {timeOf(d.changedAt)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[13.5px]">
              {[
                ['In bank', d.inBankPaise],
                ['Reaching bank', d.clearingPaise],
                ['Cash in hand', d.cashPaise],
                ['Cheques in clearing', d.chequesPaise],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-[rgba(20,35,44,0.05)] px-3 py-2">
                  <p className="text-[12.5px] font-semibold text-muted">{l}</p>
                  <p className="text-[16px] font-bold">{inr(v as number)}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Funds" className="mt-4">
            {d.funds.length === 0 ? (
              <p className="text-[14px] text-muted">No funds are shown.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {d.funds.map(f => (
                  <li key={f.id}>
                    <Link
                      href={`/resident/finances/funds/${f.id}`}
                      className="flex justify-between gap-2 rounded-xl bg-[rgba(20,35,44,0.05)] px-3 py-2.5"
                      data-testid="fund-row"
                    >
                      <span className="font-semibold">{f.name}</span>
                      <strong>{inr(f.balancePaise)}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {d.level === 'FULL' && (d.incomeByCategory || d.spendByCategory) && (
            <Card title="Where the money went this year" className="mt-4">
              {d.incomeByCategory && (
                <CategoryBars title="Money in" rows={sumByCategory(d.incomeByCategory)} />
              )}
              {d.spendByCategory &&
                (d.spendByCategory.length === 0 ? (
                  <p className="mt-3 text-[14px] text-muted">No spending recorded yet.</p>
                ) : (
                  <CategoryBars title="Money spent" rows={sumByCategory(d.spendByCategory)} />
                ))}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
