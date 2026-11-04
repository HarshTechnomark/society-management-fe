'use client';
import { ErrorState } from '@/components/common/ErrorState';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { useLoad } from '@/hooks/useLoad';
import { shortDate } from '@/lib/money';
import { approvalsPageHref } from '@/services/residents.service';
import { billingSetupService } from '@/services/billingSetup.service';
import type { BillingRule } from '@/types/billingSetup';
import { VERSION_LABEL, VERSION_TONE, describeRate, plainError, type DescribeCtx } from './format';

/** All versions of one rule, newest first. Versions never change once created (BR-11-20). */
export function RuleHistory({
  rule,
  ctx,
  onClose,
}: {
  rule: BillingRule;
  ctx: DescribeCtx;
  onClose: () => void;
}) {
  const { data, loading, error, reload } = useLoad(() => billingSetupService.rule(rule.id));
  const versions = [...(data?.versions ?? [])].sort((a, b) => b.versionNo - a.versionNo);
  return (
    <Drawer open onClose={onClose} title={`History: ${rule.name}`}>
      {error ? (
        <ErrorState
          error={plainError(error)}
          action={
            <button className="underline" onClick={reload}>
              Try again
            </button>
          }
        />
      ) : loading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      ) : versions.length === 0 ? (
        <p className="text-[14px] text-muted">No versions yet.</p>
      ) : (
        <ol className="space-y-3">
          {versions.map(v => (
            <li key={v.id} className="rounded-[14px] bg-white/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">Version {v.versionNo}</span>
                <Chip tone={VERSION_TONE[v.status]}>{VERSION_LABEL[v.status]}</Chip>
              </div>
              <p className="mt-1 text-[14px] font-semibold">{describeRate(v, ctx)}</p>
              <p className="text-[13px] text-muted">
                From {shortDate(v.effectiveFrom)}
                {v.effectiveTo ? ` to ${shortDate(v.effectiveTo)}` : ''}
              </p>
              <p className="mt-1 text-[13px]">{v.reason}</p>
              {v.resolutionRef && <p className="text-[13px] text-muted">Resolution: {v.resolutionRef}</p>}
              {v.status === 'REJECTED' && v.rejectedReason && (
                <p className="text-[13px] text-bad">Rejected: {v.rejectedReason}</p>
              )}
              {v.status === 'PENDING_APPROVAL' && (
                <a className="text-[13px] font-semibold underline" href={approvalsPageHref()}>
                  Open in approvals
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
