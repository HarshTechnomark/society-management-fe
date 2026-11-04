'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { inr, shortDate } from '@/lib/money';
import { ApiError } from '@/lib/apiClient';
import { approvalsPageHref } from '@/services/residents.service';
import { billingRunsService } from '@/services/billingRuns.service';
import type { Run } from '@/types/billingRuns';
import { billingRunError, isCode, periodLabel } from './format';

/** Why a run cannot be submitted yet, in words; null when it can. */
export function publishBlock(run: Run): string | null {
  if (run.status !== 'PREVIEW') return 'Only a run that is ready to review can be submitted.';
  if (run.isStale)
    return 'Rates, settings or resident details changed after this run was computed. Recompute it first.';
  if (run.counts.exceptions > 0)
    return `${run.counts.exceptions} ${run.counts.exceptions === 1 ? 'flat needs' : 'flats need'} attention. Fix the cause and recompute, or exclude them.`;
  if (run.counts.ready === 0) return 'No flat is ready to be billed.';
  return null;
}

/**
 * Step 3 of the wizard and the publish dialog of the run detail (BR-11-35): shows what is submitted, asks for the run
 * label to be typed, then publishes with a new idempotency key. The API client opens the step-up sign in when the
 * server asks for it. The run `version` and the computed time pin what the person reviewed: if anything changed
 * the server answers `RUN_STALE` or `STALE_VERSION` and nothing is sent for approval.
 */
export function PublishForm({
  run,
  onPublished,
  onChanged,
  onRecompute,
  footerLeft,
}: {
  run: Run;
  onPublished: (run: Run) => void;
  /** The run changed on the server: read it again. */
  onChanged: () => void;
  onRecompute?: () => Promise<void>;
  footerLeft?: ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [problem, setProblem] = useState<{ text: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const blocked = publishBlock(run);

  const submit = async () => {
    setProblem(null);
    if (typed.trim() !== run.runLabel) {
      setFieldError(`Type ${run.runLabel} exactly.`);
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    try {
      onPublished(
        await billingRunsService.publish(run.id, { confirmLabel: typed.trim(), version: run.version }),
      );
    } catch (e) {
      if (isCode(e, 'RUN_CONFIRM_MISMATCH')) setFieldError(billingRunError(e));
      else setProblem({ text: billingRunError(e), code: e instanceof ApiError ? e.code : '' });
      if (
        e instanceof ApiError &&
        ['RUN_STALE', 'STALE_VERSION', 'INVALID_STATE', 'RUN_HAS_EXCEPTIONS', 'RUN_EMPTY'].includes(e.code)
      )
        onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Alert tone="info">
        A different committee member must approve this run before bills are issued and residents are notified.
      </Alert>
      <p className="mb-3 text-[14px]">
        {run.runLabel} bills <b>{run.counts.ready}</b> {run.counts.ready === 1 ? 'flat' : 'flats'} for{' '}
        {periodLabel(run.periodStart, run.cycle)}, <b>{inr(run.totalPaise)}</b> in total. Bills are dated{' '}
        {shortDate(run.billDate)} or the day they are issued, whichever is later.
        {run.counts.excluded > 0 && ` ${run.counts.excluded} excluded.`}
      </p>
      {blocked && <Alert tone="warn">{blocked}</Alert>}
      {problem && (
        <Alert tone="bad">
          {problem.text}
          {problem.code === 'RUN_STALE' && onRecompute && (
            <>
              {' '}
              <button type="button" className="font-bold underline" onClick={() => void onRecompute()}>
                Recompute now
              </button>
            </>
          )}
          {problem.code === 'APPROVAL_ALREADY_PENDING' && (
            <>
              {' '}
              <Link className="font-bold underline" href={approvalsPageHref()}>
                Open approvals
              </Link>
            </>
          )}
        </Alert>
      )}
      <Input
        label={`Type ${run.runLabel} to confirm`}
        value={typed}
        error={fieldError}
        autoComplete="off"
        placeholder={run.runLabel}
        disabled={!!blocked}
        onChange={e => setTyped(e.target.value)}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div>{footerLeft}</div>
        <Button loading={busy} disabled={!!blocked} onClick={() => void submit()}>
          Submit for approval
        </Button>
      </div>
    </div>
  );
}

/** What happened after the run was submitted. */
export function PublishResult({ run }: { run: Run }) {
  const text =
    run.status === 'PENDING_APPROVAL'
      ? 'Sent for approval. A different committee member must approve it before bills are issued.'
      : run.status === 'APPROVED'
        ? `Approved. Bills will be issued on ${shortDate(run.billDate)}.`
        : run.status === 'ISSUING'
          ? 'Approved. Bills are being issued now.'
          : `The run is now: ${run.status.toLowerCase().replace('_', ' ')}.`;
  return (
    <div role="status" data-testid="publish-result">
      <p className="mb-2 text-[16px] font-bold">{run.runLabel} was submitted.</p>
      <p className="text-[14px]">{text}</p>
      <p className="mt-3 flex flex-wrap gap-4 text-[14px]">
        {run.status === 'PENDING_APPROVAL' && (
          <Link className="font-semibold underline" href={approvalsPageHref()}>
            Open in approvals
          </Link>
        )}
        <Link className="font-semibold underline" href={`/admin/billing/runs/${run.id}`}>
          Open the run
        </Link>
      </p>
    </div>
  );
}
