'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { approvalsService } from '@/services/approvals.service';
import type { ResidentRequest } from '@/types/approvals';
import {
  STATUS_LABEL,
  STATUS_TONE,
  approvalError,
  dateTime,
  isStale,
  plainError,
  typeLabel,
} from '../format';

/** The resident's own requests and where they stand (spec 11.6): status in words, the reason when turned down, a Withdraw button. */
export function ResidentApprovalsScreen() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const load = useLoad(() => approvalsService.myRequests({ page, limit: 20 }), page);
  const [withdrawing, setWithdrawing] = useState<ResidentRequest | null>(null);

  async function withdraw(r: ResidentRequest, reason: string) {
    try {
      await approvalsService.cancelMine(r.id, { version: r.version, reason });
      toast.show('Request withdrawn.');
      setWithdrawing(null);
      load.reload();
    } catch (e) {
      toast.show(approvalError(e), isStale(e) ? 'warning' : 'error');
      if (isStale(e)) {
        setWithdrawing(null);
        load.reload();
      }
    }
  }

  const rows = load.data?.items ?? [];
  return (
    <Page>
      <PageHead title="My approvals" sub="Requests you made and where each one stands." />
      {load.error != null ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : load.loading ? (
        <div aria-busy="true" aria-label="Loading">
          <div className="skeleton h-24 w-full" data-testid="skeleton-row" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No requests yet" text="Requests you send to the committee appear here." />
      ) : (
        <ul className="grid gap-3" aria-label="My requests">
          {rows.map(r => (
            <li key={r.id} data-testid="request-card">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                      {typeLabel(r.type, r.typeLabel)}
                    </p>
                    <h2 className="text-[16px] font-bold">{r.title}</h2>
                  </div>
                  <Chip tone={STATUS_TONE[r.status] ?? 'neutral'}>
                    {r.statusLabel || STATUS_LABEL[r.status] || r.status}
                  </Chip>
                </div>
                {(r.status === 'REJECTED' || r.status === 'CHANGES_REQUESTED' || r.status === 'CANCELLED') &&
                  r.reason && (
                    <Alert
                      tone={r.status === 'REJECTED' ? 'bad' : r.status === 'CANCELLED' ? 'info' : 'warn'}
                      className="mt-2"
                    >
                      {r.status === 'CANCELLED' ? `Withdrawn: ${r.reason}` : r.reason}
                    </Alert>
                  )}
                <ol className="mt-3 grid gap-1.5">
                  {r.timeline.map((t, i) => (
                    <li key={i} className="border-l-2 border-[var(--line)] pl-3 text-[13.5px]">
                      {t.label}
                      <span className="block text-[12.5px] text-muted">{dateTime(t.at)}</span>
                    </li>
                  ))}
                </ol>
                {r.canCancel && (
                  <div className="mt-3">
                    <Button size="sm" variant="glass" onClick={() => setWithdrawing(r)}>
                      Withdraw
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {(load.data?.totalPages ?? 1) > 1 && (
        <nav aria-label="Pages of requests" className="mt-3 flex items-center justify-between text-[13.5px]">
          <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {load.data?.totalPages}
          </span>
          <Button
            size="sm"
            variant="glass"
            disabled={page >= (load.data?.totalPages ?? 1)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
      <ConfirmReason
        open={withdrawing !== null}
        title="Withdraw this request"
        description="The committee will no longer look at it. A reason is required."
        confirmLabel="Withdraw"
        onCancel={() => setWithdrawing(null)}
        onConfirm={reason => (withdrawing ? withdraw(withdrawing, reason) : undefined)}
      />
    </Page>
  );
}
