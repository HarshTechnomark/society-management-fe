import { Chip } from '@/components/ui/Chip';
import { useFeature } from '@/hooks/useFeature';
import { inr, shortDate } from '@/lib/money';
import type { ItemStatus, Run, RunStatus } from '@/types/billingRuns';
import {
  ITEM_STATUS_LABEL,
  ITEM_STATUS_MARK,
  ITEM_STATUS_TONE,
  RUN_STATUS_LABEL,
  RUN_STATUS_MARK,
  RUN_STATUS_TONE,
  pctText,
} from './format';

/** The status in words with a mark, so it never relies on colour alone. */
export function RunStatusChip({ status }: { status: RunStatus }) {
  return (
    <Chip tone={RUN_STATUS_TONE[status] ?? 'neutral'}>
      <span aria-hidden="true" className="mr-1">
        {RUN_STATUS_MARK[status]}
      </span>
      {RUN_STATUS_LABEL[status] ?? status}
    </Chip>
  );
}

export function ItemStatusChip({ status }: { status: ItemStatus }) {
  return (
    <Chip tone={ITEM_STATUS_TONE[status] ?? 'neutral'}>
      <span aria-hidden="true" className="mr-1">
        {ITEM_STATUS_MARK[status]}
      </span>
      {ITEM_STATUS_LABEL[status] ?? status}
    </Chip>
  );
}

/** A bar with a text value. `value` null means "working, size not known yet". */
export function ProgressBar({ label, value, text }: { label: string; value: number | null; text: string }) {
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : Math.round(value)}
        aria-valuetext={text}
        className="h-2.5 w-full overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
      >
        <div
          className={`h-full rounded-full bg-navy ${value === null ? 'w-1/3 animate-pulse' : ''}`}
          style={value === null ? undefined : { width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
      <p className="mt-1.5 text-[13px] text-muted">{text}</p>
    </div>
  );
}

const STEPS = ['Compute', 'Review', 'Approval', 'Issue'];
const STEP_OF: Record<RunStatus, number> = {
  DRAFT: 0,
  COMPUTING: 0,
  FAILED: 0,
  PREVIEW: 1,
  PENDING_APPROVAL: 2,
  APPROVED: 3,
  ISSUING: 3,
  ISSUED: 4,
  CANCELLED: -1,
};

/** The status timeline: each step says Done, Now or Next in words. */
export function RunTimeline({ run }: { run: Run }) {
  const at = STEP_OF[run.status] ?? 0;
  return (
    <ol aria-label="Run progress" className="flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
      {STEPS.map((s, i) => {
        const state = run.status === 'CANCELLED' ? 'Stopped' : i < at ? 'Done' : i === at ? 'Now' : 'Next';
        const failed = run.status === 'FAILED' && i === at;
        return (
          <li
            key={s}
            aria-current={state === 'Now' ? 'step' : undefined}
            className={state === 'Now' ? 'font-bold' : state === 'Done' ? '' : 'text-muted'}
          >
            <span aria-hidden="true" className="mr-1">
              {failed ? '!' : state === 'Done' ? '✓' : state === 'Now' ? '●' : '○'}
            </span>
            {s}
            <span className="ml-1 text-[12px] font-normal text-muted">({failed ? 'Failed' : state})</span>
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={strong ? 'text-[22px] font-bold' : 'text-[16px] font-semibold'}>{value}</dd>
    </div>
  );
}

/** Totals per head, the total to be billed, the change against the last run and the counts (spec 11.2). */
export function RunSummary({ run }: { run: Run }) {
  const diffOn = useFeature('billing.bill_change_diff');
  const c = run.counts;
  const prev = run.previousRunTotalPaise;
  return (
    <div data-testid="run-summary">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total to be billed" value={inr(run.totalPaise)} strong />
        <Stat label="Before tax" value={inr(run.subtotalPaise)} />
        <Stat label="Tax" value={inr(run.taxPaise)} />
        <Stat label="Round-off" value={inr(run.roundOffPaise)} />
      </dl>
      {diffOn && (
        <p className="mt-3 text-[14px]" data-testid="run-change">
          {prev === null
            ? 'No earlier issued run to compare with.'
            : `Last run was ${inr(prev)}. This run is ${
                run.changePct === null
                  ? 'not comparable'
                  : run.changePct === 0
                    ? 'the same'
                    : `${pctText(run.changePct)} ${run.changePct > 0 ? 'higher' : 'lower'}`
              } (${inr(run.totalPaise - prev)}).`}
        </p>
      )}
      {run.byHead.length > 0 && (
        <table className="mt-4 w-full text-[14px]">
          <caption className="sr-only">Total per charge head</caption>
          <thead>
            <tr className="text-left text-[12px] font-semibold uppercase tracking-wide text-muted">
              <th scope="col" className="py-1">
                Charge head
              </th>
              <th scope="col" className="py-1 text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {run.byHead.map(h => (
              <tr key={h.headKey} className="border-t border-[var(--line)]">
                <td className="py-1.5">{h.name}</td>
                <td className="py-1.5 text-right tabular-nums">{inr(h.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="mt-4 flex flex-wrap gap-2 text-[13px]" aria-label="Flat counts">
        <li>
          <Chip tone="ok">{c.ready} ready</Chip>
        </li>
        <li>
          <Chip tone={c.exceptions > 0 ? 'bad' : 'neutral'}>
            {c.exceptions} {c.exceptions === 1 ? 'needs attention' : 'need attention'}
          </Chip>
        </li>
        <li>
          <Chip tone={c.warnings > 0 ? 'warn' : 'neutral'}>
            {c.warnings} {c.warnings === 1 ? 'warning' : 'warnings'}
          </Chip>
        </li>
        <li>
          <Chip>{c.excluded} excluded</Chip>
        </li>
        {c.skipped > 0 && (
          <li>
            <Chip>{c.skipped} skipped (no owner)</Chip>
          </li>
        )}
      </ul>
      {run.computedAt && (
        <p className="mt-3 text-[12.5px] text-muted">Computed on {shortDate(run.computedAt)}.</p>
      )}
    </div>
  );
}
