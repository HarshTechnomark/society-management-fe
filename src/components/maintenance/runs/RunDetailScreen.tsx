'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { approvalsPageHref } from '@/services/residents.service';
import { billingRunsService } from '@/services/billingRuns.service';
import type { Run } from '@/types/billingRuns';
import { billingRunError, computeErrorText, periodLabel, plainError, rangeText } from './format';
import { PublishForm, PublishResult } from './PublishForm';
import { ReasonDialog } from './ReasonDialog';
import { ProgressBar, RunStatusChip, RunSummary, RunTimeline } from './RunBits';
import { RunItems } from './RunItems';
import { useRunData } from './useRunData';

const B = PERMISSIONS.finance.billing;
const FEATURE = 'billing.billing_run_pipeline';

/** Billing run detail (spec 11.2): status timeline, totals, items, and the actions the status and the person allow. */
export function RunDetailScreen({ id }: { id: number }) {
  return (
    <Gate view={B.view} feature={FEATURE} title="Billing runs">
      <Inner id={id} />
    </Gate>
  );
}

function Inner({ id }: { id: number }) {
  const toast = useToast();
  const canCreate = usePermission(B.create);
  const canEdit = usePermission(B.edit);
  const { run, error, loading, reload, refresh, setRun } = useRunData(id);
  const [dialog, setDialog] = useState<'publish' | 'cancel' | null>(null);
  const [published, setPublished] = useState<Run | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'recompute' | 'resume' | null>(null);

  if (error != null)
    return (
      <Page>
        <ErrorState
          error={plainError(error)}
          action={
            <>
              <Button size="sm" onClick={() => void reload()}>
                Try again
              </Button>{' '}
              <Link className="text-[14px] underline" href="/admin/billing/runs">
                All billing runs
              </Link>
            </>
          }
        />
      </Page>
    );
  if (loading && !run)
    return (
      <Page>
        <div aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-3 h-20 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      </Page>
    );
  if (!run) return null;

  const act = async (kind: 'recompute' | 'resume') => {
    setBusy(kind);
    setProblem(null);
    try {
      const r =
        kind === 'recompute'
          ? await billingRunsService.recompute(run.id, run.version)
          : await billingRunsService.resumeIssue(run.id, run.version);
      setRun(billingRunsService.mergeShort(run, r));
      toast.show(kind === 'recompute' ? 'Computing the run again.' : 'Issuing resumed.');
    } catch (e) {
      setProblem(billingRunError(e));
      void refresh();
    } finally {
      setBusy(null);
    }
  };

  const s = run.status;
  const canWork = s === 'PREVIEW' || s === 'FAILED';
  const issuedPct =
    run.counts.ready + run.counts.issued > 0
      ? (run.counts.issued / (run.counts.ready + run.counts.issued)) * 100
      : 0;
  const actions = (
    <>
      {canCreate && canWork && (
        <Button variant="glass" loading={busy === 'recompute'} onClick={() => void act('recompute')}>
          Recompute
        </Button>
      )}
      {canCreate && s === 'PREVIEW' && (
        <Button onClick={() => setDialog('publish')}>Submit for approval</Button>
      )}
      {canCreate && s === 'ISSUING' && run.lastError && (
        <Button loading={busy === 'resume'} onClick={() => void act('resume')}>
          Resume issuing
        </Button>
      )}
      {canEdit && (s === 'DRAFT' || s === 'PREVIEW' || s === 'FAILED') && (
        <Button variant="danger-soft" onClick={() => setDialog('cancel')}>
          Cancel run
        </Button>
      )}
    </>
  );

  return (
    <Page>
      <p className="mb-2 text-[13px]">
        <Link className="underline" href="/admin/billing/runs">
          All billing runs
        </Link>
      </p>
      <PageHead
        title={run.runLabel}
        sub={`${run.runType === 'SUPPLEMENTARY' ? 'Extra run' : 'Regular run'} for ${periodLabel(run.periodStart, run.cycle)} (${rangeText(run.periodStart, run.periodEnd)}). Bill date ${shortDate(run.billDate)}.`}
        actions={
          <>
            <RunStatusChip status={s} />
            {actions}
          </>
        }
      />
      <Card className="mb-4">
        <RunTimeline run={run} />
      </Card>
      {problem && <Alert tone="bad">{problem}</Alert>}
      {(s === 'DRAFT' || s === 'COMPUTING') && (
        <Card title="Computing" className="mb-4">
          <ProgressBar
            label="Computing the run"
            value={null}
            text={
              run.counts.items > 0
                ? `Computing the bills. ${run.counts.items} bills done so far. You can leave this page.`
                : 'Computing the bills. This can take a minute. You can leave this page.'
            }
          />
        </Card>
      )}
      {s === 'FAILED' && (
        <Alert tone="bad">
          The run could not be computed.{' '}
          {run.computeError ? computeErrorText(run.computeError) : 'Try again with Recompute.'}
        </Alert>
      )}
      {s === 'PREVIEW' && run.isStale && (
        <Alert tone="warn">
          Rates, settings or resident details changed after this run was computed. Recompute it before you
          submit it.
        </Alert>
      )}
      {s === 'PENDING_APPROVAL' && (
        <Alert tone="info">
          Waiting for approval by a different committee member.{' '}
          <Link className="font-bold underline" href={approvalsPageHref()}>
            Open in approvals
          </Link>
        </Alert>
      )}
      {s === 'APPROVED' && (
        <Alert tone="ok">Approved. Bills will be issued on {shortDate(run.billDate)}.</Alert>
      )}
      {s === 'ISSUING' && (
        <Card title="Issuing bills" className="mb-4">
          <ProgressBar
            label="Issuing bills"
            value={issuedPct}
            text={`${run.counts.issued} of ${run.counts.ready + run.counts.issued} bills issued.`}
          />
          {run.lastError && (
            <Alert tone="bad" className="mt-3">
              Issuing stopped with an error: {run.lastError}.{' '}
              {canCreate ? 'Use Resume issuing to continue.' : 'Ask someone with billing access to resume.'}
            </Alert>
          )}
        </Card>
      )}
      {s === 'ISSUED' && (
        <Alert tone="ok">
          Issued{run.issuedAt ? ` on ${shortDate(run.issuedAt)}` : ''}: {run.counts.issued} bills,{' '}
          {inr(run.totalPaise)} in total.
        </Alert>
      )}
      {s === 'CANCELLED' && (
        <Alert tone="info">This run was cancelled{run.cancelReason ? `: ${run.cancelReason}` : '.'}</Alert>
      )}
      {s !== 'DRAFT' && s !== 'COMPUTING' && (
        <>
          <Card title="Totals" className="mb-4">
            <RunSummary run={run} />
          </Card>
          {!(s === 'FAILED') && (
            <Card title="Flats">
              <RunItems run={run} canEdit={canCreate} onChanged={() => void refresh()} />
            </Card>
          )}
        </>
      )}
      {dialog === 'publish' && (
        <Modal open onClose={() => setDialog(null)} title="Submit for approval" description={run.runLabel}>
          {published ? (
            <>
              <PublishResult run={published} />
              <div className="mt-4 text-right">
                <Button onClick={() => setDialog(null)}>Close</Button>
              </div>
            </>
          ) : (
            <PublishForm
              run={run}
              onChanged={() => void refresh()}
              onRecompute={async () => {
                setDialog(null);
                await act('recompute');
              }}
              onPublished={r => {
                setPublished(r);
                setRun(r);
              }}
              footerLeft={
                <Button variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
              }
            />
          )}
        </Modal>
      )}
      {dialog === 'cancel' && (
        <ReasonDialog
          title={`Cancel ${run.runLabel}?`}
          description="No bills are issued and the period can be billed with a new run."
          confirmLabel="Cancel run"
          variant="danger"
          max={500}
          onCancel={() => setDialog(null)}
          onSubmit={async reason => {
            const short = await billingRunsService.cancel(run.id, { reason, version: run.version });
            // the short answer has no cancelReason: show the reason that was sent
            setRun({ ...billingRunsService.mergeShort(run, short), cancelReason: reason });
            setDialog(null);
            toast.show(`${run.runLabel} was cancelled.`);
          }}
        />
      )}
    </Page>
  );
}
