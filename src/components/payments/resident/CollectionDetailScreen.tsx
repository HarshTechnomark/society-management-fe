'use client';
import { plural } from '@/lib/plural';
import Link from 'next/link';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button, buttonClasses } from '@/components/ui/Button';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import { Progress } from './CollectionsScreen';
import { PayTabs } from './PayTabs';
import { payLink, plainPayError } from './format';

/** One collection: progress, my request, the who-paid list as far as the society's privacy level allows, spending. */
export function CollectionDetailScreen({ id }: { id: number }) {
  return (
    <Gate view={PERMISSIONS.resident.payments.view} title="collections">
      <Inner id={id} />
    </Gate>
  );
}

function Inner({ id }: { id: number }) {
  const canPay = usePermission(PERMISSIONS.resident.payments.create);
  const d = useLoad(() => svc.collection(id), `collection-${id}`);
  const c = d.data;
  return (
    <Page>
      <PayTabs />
      {d.error != null ? (
        <Card>
          <ErrorState
            error={plainPayError(d.error)}
            notFoundAction={
              <Link href="/resident/pay/collections" className={buttonClasses('glass')}>
                All collections
              </Link>
            }
            action={
              <Button size="sm" onClick={d.reload}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : d.loading || !c ? (
        <div aria-busy="true" aria-label="Loading collection">
          <div className="skeleton h-40 w-full" data-testid="skeleton-row" />
        </div>
      ) : (
        <>
          <PageHead title={c.title} sub={c.purpose || undefined} />
          <Card className="mb-4">
            {c.dueDate && <p className="text-[13.5px] text-muted">By {shortDate(c.dueDate)}</p>}
            <Progress c={c} />
            {c.contributorCount !== null && (
              <p className="mt-1 text-[13.5px]">
                {c.contributorCount} of {c.requestCount === null ? '-' : plural(c.requestCount, 'flat')}{' '}
                {c.requestCount === 1 ? 'has' : 'have'} paid.
              </p>
            )}
            {c.myRequests.map(r => (
              <div
                key={r.id}
                className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[14.5px]"
              >
                <span>
                  Your share for {r.unitLabel}:{' '}
                  <strong>{r.amountPaise > 0 ? inr(r.amountPaise) : 'Any amount'}</strong> (paid{' '}
                  {inr(r.paidPaise)})
                </span>
                {canPay && c.status !== 'CLOSED' && (r.amountPaise === 0 || r.paidPaise < r.amountPaise) && (
                  <Link
                    href={payLink(r.unitId, null, r.id)}
                    aria-label={`Pay for ${r.unitLabel}`}
                    className={buttonClasses('primary', 'sm')}
                  >
                    Pay
                  </Link>
                )}
              </div>
            ))}
          </Card>
          {c.whoPaid && (
            <Card title="Who has paid" className="mb-4">
              {c.whoPaid.length === 0 ? (
                <p className="text-[14px] text-muted">No one yet.</p>
              ) : (
                <ul
                  aria-label="Who has paid"
                  className="grid grid-cols-2 gap-x-4 gap-y-1 text-[14px] sm:grid-cols-3"
                >
                  {c.whoPaid.map((w, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{w.unitLabel}</span>
                      {w.paidPaise !== null && <span className="tabular-nums">{inr(w.paidPaise)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {c.spentPaise !== null && (
            <Card title="How the money was used" sub={`Spent so far: ${inr(c.spentPaise)}`}>
              {c.expenses.length === 0 ? (
                <p className="text-[14px] text-muted">No spending recorded yet.</p>
              ) : (
                <ul aria-label="Spending" className="divide-y divide-[var(--line)] text-[14px]">
                  {c.expenses.map((e, i) => (
                    <li key={i} className="flex justify-between gap-3 py-1.5">
                      <span>
                        {e.title}
                        <span className="block text-[12.5px] text-muted">
                          {e.category} · {shortDate(e.date)}
                        </span>
                      </span>
                      <span className="tabular-nums">{inr(e.amountPaise)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
