'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { billingResidentService } from '@/services/billingResident.service';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import { PayTabs } from './PayTabs';
import { plainPayError } from './format';

const ENTRY_LABEL: Record<string, string> = {
  CREDIT: 'Money added',
  DEBIT: 'Used for a bill',
  ADJUST_IN: 'Added by the society',
  ADJUST_OUT: 'Taken by the society',
  REFUND: 'Refunded to you',
};

/** Advance: the balance of a flat and its history, newest first (spec 8.7). */
export function AdvanceScreen() {
  return (
    <Gate view={PERMISSIONS.resident.payments.view} title="your advance balance">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const dues = useLoad(() => billingResidentService.dues(), 'dues');
  const [picked, setPicked] = useState<number | null>(null);
  const units = dues.data ?? [];
  const unitId = picked ?? units[0]?.unitId ?? 0;
  const adv = useLoad(() => (unitId ? svc.advances(unitId) : Promise.resolve(null)), `advance-${unitId}`);
  return (
    <Page>
      <PageHead title="Advance" sub="Money you paid ahead. It is used for your next bills." />
      <PayTabs />
      <Card>
        {units.length > 1 && (
          <div className="mb-3 max-w-xs">
            <Select
              label="Flat"
              value={String(unitId)}
              onChange={e => setPicked(Number(e.target.value))}
              options={units.map(u => ({ value: String(u.unitId), label: u.unitLabel }))}
            />
          </div>
        )}
        {dues.error != null || adv.error != null ? (
          <ErrorState
            error={plainPayError(dues.error ?? adv.error)}
            action={
              <Button size="sm" onClick={() => (dues.error != null ? dues.reload() : adv.reload())}>
                Try again
              </Button>
            }
          />
        ) : dues.loading || adv.loading ? (
          <div aria-busy="true" aria-label="Loading advance">
            <div className="skeleton h-20 w-full" data-testid="skeleton-row" />
          </div>
        ) : !adv.data ? (
          <EmptyState title="No flat yet" />
        ) : (
          <>
            <p className="text-[14px] text-muted">Balance</p>
            <p className="text-[28px] font-bold tabular-nums" data-testid="advance-balance">
              {inr(adv.data.balancePaise)}
            </p>
            {adv.data.entries.length === 0 ? (
              <EmptyState title="No history yet" text="Money paid ahead shows up here." />
            ) : (
              <ul aria-label="Advance history" className="mt-2 divide-y divide-[var(--line)]">
                {adv.data.entries.map(e => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-[14.5px]">
                    <span>
                      <span className="block font-semibold">{ENTRY_LABEL[e.entryType] ?? e.entryType}</span>
                      <span className="block text-[13px] text-muted">
                        {shortDate(e.createdAt)}
                        {e.narration ? ` · ${e.narration}` : ''}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="block font-semibold">{inr(e.amountPaise)}</span>
                      <span className="block text-[12.5px] text-muted">
                        Balance {inr(e.balanceAfterPaise)}
                      </span>
                    </span>
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
