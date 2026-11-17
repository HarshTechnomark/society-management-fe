'use client';
import Link from 'next/link';
import { Card } from '@/components/common/PageHead';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { typeLabel } from '../format';
import { approvalHref } from '../links';
import { useApprovalCounts } from '../useApprovalCounts';

/** Admin home "Approvals waiting for you" (spec 11, Today card) from `GET /approvals/counts`. Hidden without the inbox. */
export function ApprovalsWaitingCard() {
  const can = usePermission(PERMISSIONS.approvals.inbox.view);
  const counts = useApprovalCounts(can);
  if (!can || !counts) return null;
  const byType = Object.entries(counts.forMeByType)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return (
    <Card title="Approvals waiting for you" className="mb-4">
      {counts.forMe === 0 ? (
        <p className="text-[14px] text-muted">Nothing waits for you. All caught up.</p>
      ) : (
        <>
          <p className="text-[15px] font-bold" data-testid="approvals-waiting">
            {counts.forMe} {counts.forMe === 1 ? 'approval waits' : 'approvals wait'} for you
            {counts.overdueForMe > 0 && (
              <span className="font-semibold text-bad"> · {counts.overdueForMe} overdue</span>
            )}
          </p>
          {byType.length > 0 && (
            <ul aria-label="Waiting by type" className="mt-2 flex flex-col gap-1 text-[13.5px]">
              {byType.map(([type, n]) => (
                <li key={type}>
                  <Link href={approvalHref(null, type)} className="underline">
                    {typeLabel(type)}: {n}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="mt-3 text-[13.5px]">
        <Link href="/admin/approvals" className="font-semibold underline">
          Open approvals
        </Link>
      </p>
    </Card>
  );
}
