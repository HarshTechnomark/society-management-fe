'use client';
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import type { Collection } from '@/types/paymentsResident';
import { PayTabs } from './PayTabs';
import { payLink, plainPayError } from './format';

export function Progress({
  c,
}: {
  c: Pick<Collection, 'percent' | 'collectedPaise' | 'targetPaise' | 'title'>;
}) {
  return (
    <div className="mt-2">
      <div
        role="progressbar"
        aria-label={`Collected for ${c.title}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={c.percent}
        className="h-2.5 overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
      >
        <div className="h-full rounded-full bg-[#c9a961]" style={{ width: `${c.percent}%` }} />
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {inr(c.collectedPaise)} of {inr(c.targetPaise)} · {c.percent}%
      </p>
    </div>
  );
}

/** Collections (spec 11.3): a card for each collection with progress, my request and a Pay button. */
export function CollectionsScreen() {
  return (
    <Gate view={PERMISSIONS.resident.payments.view} title="collections">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canPay = usePermission(PERMISSIONS.resident.payments.create);
  const list = useLoad(() => svc.collections(), 'collections');
  const items = list.data ?? [];
  return (
    <Page>
      <PageHead title="Collections" sub="Funds your society is raising, and how much is collected." />
      <PayTabs />
      {list.error != null ? (
        <Card>
          <ErrorState
            error={plainPayError(list.error)}
            action={
              <Button size="sm" onClick={list.reload}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : list.loading ? (
        <div aria-busy="true" aria-label="Loading collections">
          <div className="skeleton h-28 w-full" data-testid="skeleton-row" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No collections" text="When your society raises a fund, it appears here." />
        </Card>
      ) : (
        <ul aria-label="Collections" className="grid gap-3 min-[700px]:grid-cols-2">
          {items.map(c => (
            <li key={c.id} className="glass p-4" data-testid="collection-card">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[17px] font-bold">
                  <Link href={`/resident/pay/collections/${c.id}`} className="hover:underline">
                    {c.title}
                  </Link>
                </h2>
                {c.status === 'CLOSED' ? (
                  <Chip>Closed</Chip>
                ) : c.isMandatory ? (
                  <Chip tone="warn">Compulsory</Chip>
                ) : (
                  <Chip tone="gold">Optional</Chip>
                )}
              </div>
              {c.purpose && <p className="mt-1 text-[13.5px] text-muted">{c.purpose}</p>}
              {c.dueDate && <p className="text-[13px] text-muted">By {shortDate(c.dueDate)}</p>}
              <Progress c={c} />
              {c.myRequests.map(r => (
                <div
                  key={r.id}
                  className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[14px]"
                >
                  <span>
                    {r.unitLabel}:{' '}
                    {r.paidPaise >= r.amountPaise && r.amountPaise > 0
                      ? 'Paid'
                      : r.amountPaise > 0
                        ? `${inr(r.paidPaise)} of ${inr(r.amountPaise)}`
                        : `${inr(r.paidPaise)} paid · any amount`}
                  </span>
                  {canPay &&
                    c.status !== 'CLOSED' &&
                    (r.amountPaise === 0 || r.paidPaise < r.amountPaise) && (
                      <Link
                        href={payLink(r.unitId, null, r.id)}
                        aria-label={`Pay ${c.title} for ${r.unitLabel}`}
                        className={buttonClasses('primary', 'sm')}
                      >
                        Pay
                      </Link>
                    )}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
