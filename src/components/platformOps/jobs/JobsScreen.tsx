'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { QueueRow } from '@/types/platformOps';
import { LivePill, opsError } from '../format';
import { usePolling } from '../usePolling';
import { FailedJobsDrawer } from './FailedJobsDrawer';

/** Spec 11.6 Jobs and queues (prototype `Pages.queues`). Polls every 5 s, paused while a dialog or drawer is open. */
export function JobsScreen() {
  const { ready } = useMe();
  const toast = useToast();
  const canView = usePermission(PERMISSIONS.platform.jobs.view);
  const canEdit = usePermission(PERMISSIONS.platform.jobs.edit);
  const [failedQueue, setFailedQueue] = useState<{ queue: string | null } | null>(null);
  const [toggle, setToggle] = useState<QueueRow | null>(null);
  const [bulk, setBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const idle = !failedQueue && !toggle && !bulk;
  const q = usePolling(() => svc.queues(false), 5000, canView && idle);

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Jobs and queues" />
        <EmptyState title="You do not have access to jobs and queues" />
      </Page>
    );

  const t = q.data?.totals;
  const retryAll = async () => {
    setBulkBusy(true);
    try {
      const r = await svc.retryFailed({});
      toast.show(`${r.retried} retried, ${r.skippedPermanent} skipped (permanent errors).`);
      setBulk(false);
      void q.reload();
    } catch (e) {
      toast.show(opsError(e), 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <Page>
      <PageHead
        title="Jobs and queues"
        sub="Background work by module. Updates every 5 seconds."
        actions={
          <>
            <LivePill />
            {canEdit && (
              <Button variant="glass" size="sm" onClick={() => setBulk(true)} disabled={!t || t.failed === 0}>
                Retry all failed
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 min-[900px]:grid-cols-5">
        {[
          ['Waiting', t?.waiting],
          ['Active', t?.active],
          ['Delayed', t?.delayed],
          ['Failed', t?.failed],
          ['Throughput / min', t?.throughputPerMin],
        ].map(([label, v]) => (
          <div key={label as string} className="glass p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label as string}</p>
            <p
              className={`mt-1 text-[24px] font-bold tabular-nums ${label === 'Failed' && (v as number) > 0 ? 'text-bad' : ''}`}
            >
              {v === undefined ? '-' : (v as number).toLocaleString('en-IN')}
            </p>
          </div>
        ))}
      </div>
      <Card>
        {q.error && !q.data ? (
          <ErrorState
            error={q.error}
            action={
              <button className="underline" onClick={() => void q.reload()}>
                Try again
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[760px] border-collapse text-left text-[14px]"
              aria-busy={q.loading || undefined}
            >
              <caption className="sr-only">Queues</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {['Queue', 'State', 'Waiting', 'Active', 'Delayed', 'Failed', 'Per min', ''].map((h, i) => (
                    <th key={i} scope="col" className="px-3 py-2.5">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!q.data
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr key={i} data-testid="skeleton-row">
                        <td colSpan={8} className="px-3 py-3.5">
                          <div className="skeleton h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  : q.data.items.map(r => (
                      <tr key={r.name} className="border-b border-[var(--line)] last:border-0">
                        <td className="px-3 py-3">
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-[12.5px] text-muted">
                            {r.description} · concurrency {r.concurrency}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Chip tone={r.isPaused ? 'warn' : 'ok'}>{r.isPaused ? 'Paused' : 'Running'}</Chip>
                        </td>
                        <td className="px-3 py-3 tabular-nums">{r.counts.waiting}</td>
                        <td className="px-3 py-3 tabular-nums">{r.counts.active}</td>
                        <td className="px-3 py-3 tabular-nums">{r.counts.delayed}</td>
                        <td className="px-3 py-3">
                          {r.counts.failed > 0 ? (
                            <button
                              type="button"
                              aria-label={`${r.counts.failed} failed jobs in ${r.name}`}
                              onClick={() => setFailedQueue({ queue: r.name })}
                            >
                              <Chip tone="bad">{r.counts.failed}</Chip>
                            </button>
                          ) : (
                            <span className="tabular-nums">0</span>
                          )}
                        </td>
                        <td className="px-3 py-3 tabular-nums">{r.throughputPerMin}</td>
                        <td className="px-3 py-3 text-right">
                          {canEdit && (
                            <Button size="xs" variant="glass" onClick={() => setToggle(r)}>
                              {r.isPaused ? 'Resume' : 'Pause'}
                              <span className="sr-only"> {r.name}</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {failedQueue && (
        <FailedJobsDrawer
          queue={failedQueue.queue}
          onClose={() => setFailedQueue(null)}
          onChanged={() => void q.reload()}
        />
      )}
      <ConfirmReason
        open={toggle !== null}
        title={toggle?.isPaused ? `Resume ${toggle.name}?` : `Pause ${toggle?.name}?`}
        description={
          toggle?.isPaused
            ? 'Waiting jobs start running again.'
            : 'No new jobs start until you resume the queue.'
        }
        confirmLabel={toggle?.isPaused ? 'Resume' : 'Pause'}
        variant={toggle?.isPaused ? 'primary' : 'danger'}
        onCancel={() => setToggle(null)}
        onConfirm={async reason => {
          if (!toggle) return;
          try {
            if (toggle.isPaused) await svc.resumeQueue(toggle.name, reason);
            else await svc.pauseQueue(toggle.name, reason);
            toast.show(toggle.isPaused ? 'Queue resumed.' : 'Queue paused.');
            setToggle(null);
            void q.reload();
          } catch (e) {
            setToggle(null);
            toast.show(opsError(e), 'error');
          }
        }}
      />
      <Modal
        open={bulk}
        onClose={() => setBulk(false)}
        title="Retry all failed jobs?"
        description="Jobs that failed with a permanent error are skipped."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulk(false)}>
              Cancel
            </Button>
            <Button loading={bulkBusy} onClick={retryAll}>
              Retry all failed
            </Button>
          </>
        }
      >
        <p className="text-[14px]">{t?.failed ?? 0} jobs are in the failed list.</p>
      </Modal>
    </Page>
  );
}
