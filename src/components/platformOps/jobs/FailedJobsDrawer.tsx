'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pager } from '@/components/billing/useServerList';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { FailedJob } from '@/types/platformOps';
import { opsError, timeAgo } from '../format';

/** Spec 11.6 failed jobs drawer: one card per job, filters by job name and society. */
export function FailedJobsDrawer({
  queue,
  onClose,
  onChanged,
}: {
  queue: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.platform.jobs.edit);
  const [jobName, setJobName] = useState('');
  const [society, setSociety] = useState('');
  const [page, setPage] = useState(1);
  const [discard, setDiscard] = useState<FailedJob | null>(null);
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const name = jobName.trim();
  const soc = /^[1-9]\d*$/.test(society.trim()) ? Number(society.trim()) : undefined;
  const key = `${queue}|${name}|${soc}|${page}`;
  const load = useLoad(
    () =>
      svc.failedJobs({
        queue: queue ?? undefined,
        jobName: /^[a-z-]+:[a-z0-9-]+$/.test(name) ? name : undefined,
        societyId: soc,
        page,
        limit: 20,
      }),
    key,
  );
  const id = (j: FailedJob) => `${j.queue}:${j.jobId}`;

  const retry = async (j: FailedJob) => {
    setBusy(id(j));
    try {
      const r = await svc.retryJob(j.queue, j.jobId);
      toast.show(
        r.warning ? 'Retried, but this kind of error will likely fail again.' : 'Job queued again.',
        r.warning ? 'warning' : 'success',
      );
      load.reload();
      onChanged();
    } catch (e) {
      toast.show(opsError(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const showPayload = async (j: FailedJob) => {
    try {
      const d = await svc.job(j.queue, j.jobId);
      setPayloads(p => ({ ...p, [id(j)]: JSON.stringify(d.data, null, 2) }));
    } catch (e) {
      toast.show(opsError(e), 'error');
    }
  };

  return (
    <Drawer open onClose={onClose} size={640} title={queue ? `Failed jobs in ${queue}` : 'Failed jobs'}>
      <div className="grid gap-3 min-[600px]:grid-cols-2">
        <Input
          label="Job name"
          hint="For example payments:process-webhook"
          value={jobName}
          onChange={e => {
            setJobName(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label="Society number"
          inputMode="numeric"
          value={society}
          onChange={e => {
            setSociety(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {load.error ? (
        <ErrorState error={load.error} />
      ) : load.loading ? (
        <div className="skeleton h-32 w-full" />
      ) : (load.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No failed jobs" text="Everything in this queue is running." />
      ) : (
        <ul className="space-y-3">
          {load.data!.items.map(j => (
            <li key={id(j)} className="rounded-[16px] bg-white/60 p-3">
              <p className="flex flex-wrap items-center gap-2 text-[13px]">
                <code className="font-semibold">{j.name}</code>
                {j.errorName && <Chip tone="bad">{j.errorName}</Chip>}
                {j.isPermanent && <Chip tone="warn">Permanent error</Chip>}
              </p>
              <p className="mt-1 text-[14px]">{j.failedReason ?? 'No reason recorded'}</p>
              <p className="mt-1 text-[12.5px] text-muted">
                {j.jobId} · {j.queue} · attempt {j.attemptsMade} of {j.maxAttempts} · {timeAgo(j.failedAt)}
                {j.societyId && (
                  <>
                    {' · '}
                    <Link href={`/platform/societies/${j.societyId}`} className="underline">
                      Society {j.societyId}
                    </Link>
                  </>
                )}
              </p>
              {payloads[id(j)] !== undefined && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-[10px] bg-white/80 p-2 text-[12px]">
                  {payloads[id(j)]}
                </pre>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {payloads[id(j)] === undefined && (
                  <Button size="xs" variant="ghost" onClick={() => showPayload(j)}>
                    Show payload
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button size="xs" variant="danger-soft" onClick={() => setDiscard(j)}>
                      Discard
                    </Button>
                    <Button size="xs" loading={busy === id(j)} onClick={() => retry(j)}>
                      Retry
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager pagination={load.data?.pagination ?? null} page={page} onPage={setPage} />
      <ConfirmReason
        open={discard !== null}
        title="Discard this job?"
        description="The job is removed and will not run again."
        confirmLabel="Discard"
        onCancel={() => setDiscard(null)}
        onConfirm={async reason => {
          if (!discard) return;
          try {
            await svc.discardJob(discard.queue, discard.jobId, reason);
            toast.show('Job discarded.');
            setDiscard(null);
            load.reload();
            onChanged();
          } catch (e) {
            setDiscard(null);
            toast.show(opsError(e), 'error');
          }
        }}
      />
    </Drawer>
  );
}
