'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { billingSetupService } from '@/services/billingSetup.service';
import { approvalsPageHref } from '@/services/residents.service';
import { LateFeeDrawer } from './LateFeeDrawer';
import { POLICY_STATUS_LABEL, POLICY_STATUS_TONE, plainError, today } from './format';
import { describePolicy, policyInForce } from './lateFee';

/** Settings > Billing > Late fee: current policy, pending change, history and "Change policy". */
export function LateFeeTab() {
  const canEdit = usePermission(PERMISSIONS.settings.billingRules.edit);
  const { data, loading, error, reload } = useLoad(() => billingSetupService.lateFeePolicies());
  const [open, setOpen] = useState(false);

  if (error)
    return (
      <ErrorState
        error={plainError(error)}
        action={
          <button className="underline" onClick={reload}>
            Try again
          </button>
        }
      />
    );
  if (loading || !data)
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="skeleton h-24 w-full" />
      </div>
    );

  const now = today();
  const current = policyInForce(data, now);
  const upcoming = data.filter(p => p.status === 'ACTIVE' && p.effectiveFrom > now);
  const pending = data.find(p => p.status === 'PENDING_APPROVAL');
  const history = [...data].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-muted">
          Interest and late fees are charged by a monthly job. Simple interest is capped at 21 percent a year.
        </p>
        {canEdit && <Button onClick={() => setOpen(true)}>Change policy</Button>}
      </div>
      {data.length === 0 ? (
        <EmptyState
          title="No late fee policy yet"
          text="Without a policy no interest or late fee is charged."
          action={canEdit ? <Button onClick={() => setOpen(true)}>Set a policy</Button> : undefined}
        />
      ) : (
        <>
          <section className="mb-4 rounded-[18px] bg-white/60 p-4" aria-label="Current policy">
            <h3 className="text-[12px] font-semibold uppercase text-muted">Current policy</h3>
            <p className="text-[15px] font-bold">
              {current ? describePolicy(current) : 'Nothing in force yet'}
            </p>
            {current && <p className="text-[13px] text-muted">since {shortDate(current.effectiveFrom)}</p>}
            {upcoming.map(p => (
              <p key={p.id} className="mt-2 text-[13.5px]">
                <b>Next:</b> {describePolicy(p)} from {shortDate(p.effectiveFrom)}
              </p>
            ))}
            {pending && (
              <p className="mt-2 text-[13.5px]">
                <Chip tone="warn">Waiting for approval</Chip> {describePolicy(pending)} from{' '}
                {shortDate(pending.effectiveFrom)}{' '}
                <a className="font-semibold underline" href={approvalsPageHref()}>
                  Open in approvals
                </a>
              </p>
            )}
          </section>
          <h3 className="mb-2 text-[14px] font-bold">History</h3>
          <ol className="space-y-2">
            {history.map(p => (
              <li key={p.id} className="rounded-[14px] bg-white/60 p-3 text-[13.5px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">From {shortDate(p.effectiveFrom)}</span>
                  <Chip tone={POLICY_STATUS_TONE[p.status]}>{POLICY_STATUS_LABEL[p.status]}</Chip>
                </div>
                <p>{describePolicy(p)}</p>
                <p className="text-muted">{p.reason}</p>
                {p.status === 'REJECTED' && p.rejectedReason && (
                  <p className="text-bad">Rejected: {p.rejectedReason}</p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {open && (
        <LateFeeDrawer
          current={current}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
