'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { billingRunsService } from '@/services/billingRuns.service';
import type { CreateRunInput, Run, RunType, ScopeType, SplitInput } from '@/types/billingRuns';
import {
  CYCLE_LABEL,
  billingRunError,
  computeErrorText,
  nextPeriod,
  periodLabel,
  periodOptions,
  plainError,
  rupeesToPaise,
} from './format';
import { PublishForm, PublishResult, publishBlock } from './PublishForm';
import { ProgressBar, RunSummary } from './RunBits';
import { RunItems } from './RunItems';
import { useRunData } from './useRunData';

const B = PERMISSIONS.finance.billing;
type Step = 1 | 2 | 3;
const STEP_NAMES = ['Heads', 'Preview', 'Confirm'];

/** The 1,000-flat / 200-building limits of spec 8.5 for a supplementary scope typed as ids. */
function parseIds(text: string): number[] | null {
  const parts = text
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.some(p => !/^\d+$/.test(p))) return null;
  return [...new Set(parts.map(Number))];
}

/** New billing run wizard (spec 11.2): 1 Heads, 2 Preview (computes in the background), 3 Confirm and submit. */
export function NewRunWizard() {
  return (
    <Gate view={B.create} feature="billing.billing_run_pipeline" title="Billing runs">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const router = useRouter();
  const supplementaryOn = useFeature('billing.supplementary_and_ad_hoc_invoices');
  const [step, setStep] = useState<Step>(1);
  const [runId, setRunId] = useState<number | null>(null);
  const { run, error: runError, refresh, setRun } = useRunData(runId);

  const cycleLoad = useLoad(() => billingRunsService.cycle().catch(() => 'MONTHLY' as const));
  const rates = useLoad(() => billingRunsService.rates().catch(() => null));
  const cycle = cycleLoad.data ?? 'MONTHLY';

  const [period, setPeriod] = useState<string | null>(null);
  const [runType, setRunType] = useState<RunType>('REGULAR');
  const [scopeType, setScopeType] = useState<ScopeType>('BUILDINGS');
  const [scopeText, setScopeText] = useState('');
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Run | null>(null);

  const options = useMemo(() => periodOptions(cycle), [cycle]);
  const chosen = period ?? nextPeriod(cycle);
  const splits = useLoad(() => billingRunsService.splitRules(chosen).catch(() => null), chosen);
  const splitRules = splits.data ?? [];

  const amountOf = (id: number) => {
    if (amounts[id] !== undefined) return amounts[id];
    const kept = run?.splitInputs.find(x => x.billSplitRuleId === id);
    return kept ? String(kept.amountPaise / 100) : '';
  };

  const submitStep1 = async () => {
    setProblem(null);
    const e: Record<string, string> = {};
    const splitInputs: SplitInput[] = [];
    for (const s of splitRules) {
      const p = rupeesToPaise(amountOf(s.id));
      if (p === null || p < 1 || p > 1_000_000_000)
        e[`split-${s.id}`] =
          'Enter the total amount in rupees (up to ₹1 crore, for example 84321 or 84321.50).';
      else splitInputs.push({ billSplitRuleId: s.id, amountPaise: p });
    }
    let scopeValues: number[] | undefined;
    if (runType === 'SUPPLEMENTARY') {
      const ids = parseIds(scopeText);
      const max = scopeType === 'BUILDINGS' ? 200 : 1000;
      if (!ids || ids.length > max)
        e.scope = `Enter 1 to ${max} ${scopeType === 'BUILDINGS' ? 'building' : 'flat'} numbers, separated by commas.`;
      else scopeValues = ids;
    }
    if (notes.length > 500) e.notes = 'Notes can have at most 500 characters.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (run) {
        const same = JSON.stringify(run.splitInputs) === JSON.stringify(splitInputs);
        if (!same || (run.notes ?? '') !== notes.trim()) {
          await billingRunsService.update(run.id, { version: run.version, splitInputs, notes: notes.trim() });
          await refresh();
        }
      } else {
        const body: CreateRunInput = {
          runType,
          periodStart: chosen,
          ...(runType === 'SUPPLEMENTARY' ? { scopeType, scopeValues } : {}),
          ...(splitInputs.length ? { splitInputs } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
        const created = await billingRunsService.create(body);
        setRunId(created.id);
      }
      setStep(2);
    } catch (err) {
      setProblem(billingRunError(err));
    } finally {
      setBusy(false);
    }
  };

  const recompute = async () => {
    if (!run) return;
    setProblem(null);
    setBusy(true);
    try {
      setRun(billingRunsService.mergeShort(run, await billingRunsService.recompute(run.id, run.version)));
    } catch (err) {
      setProblem(billingRunError(err));
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const computing = !!run && (run.status === 'DRAFT' || run.status === 'COMPUTING');
  const block = run ? publishBlock(run) : 'Wait for the preview.';

  return (
    <Page>
      <PageHead
        title="New billing run"
        sub={`Step ${step} of 3. ${runId ? '' : 'Pick the period and check the rates.'}`}
      />
      <ol aria-label="Steps" className="mb-5 grid grid-cols-3 gap-2">
        {STEP_NAMES.map((n, i) => (
          <li key={n} aria-current={step === i + 1 ? 'step' : undefined} className="text-[13px]">
            <div
              className={`mb-1 h-1.5 rounded-full ${i + 1 <= step ? 'bg-navy' : 'bg-[rgba(20,35,44,0.12)]'}`}
              aria-hidden="true"
            />
            <span className={step === i + 1 ? 'font-bold' : ''}>
              {i + 1}. {n}
              {i + 1 < step && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        ))}
      </ol>
      {problem && <Alert tone="bad">{problem}</Alert>}

      {step === 1 && (
        <Card title="Period and rates">
          {runId && (
            <Alert tone="info">
              {run?.runLabel ?? 'The run'} is already created. You can change the amounts below; to bill
              another period, cancel the run first.
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Billing period"
              value={chosen}
              disabled={!!runId}
              hint={`${CYCLE_LABEL[cycle]} billing. Periods follow your financial year.`}
              onChange={e => setPeriod(e.target.value)}
              options={options.map(o => ({
                value: o.value,
                label: o.isNext ? `${o.label} (next)` : o.label,
              }))}
            />
            {supplementaryOn && (
              <Select
                label="Run type"
                value={runType}
                disabled={!!runId}
                onChange={e => setRunType(e.target.value as RunType)}
                options={[
                  { value: 'REGULAR', label: 'Regular run: all flats' },
                  { value: 'SUPPLEMENTARY', label: 'Extra run: some buildings or flats' },
                ]}
              />
            )}
          </div>
          {runType === 'SUPPLEMENTARY' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Select
                label="Bill"
                value={scopeType}
                disabled={!!runId}
                onChange={e => setScopeType(e.target.value as ScopeType)}
                options={[
                  { value: 'BUILDINGS', label: 'Whole buildings' },
                  { value: 'UNITS', label: 'Chosen flats' },
                ]}
              />
              <Input
                label={scopeType === 'BUILDINGS' ? 'Building numbers' : 'Flat numbers'}
                value={scopeText}
                disabled={!!runId}
                error={errs.scope}
                hint="Ids as shown on the Buildings and Flats pages, separated by commas."
                onChange={e => setScopeText(e.target.value)}
              />
            </div>
          )}

          <h3 className="mb-1 mt-6 text-[15px] font-bold">Approved rates</h3>
          <p className="mb-2 text-[13px] text-muted">
            These come from the approved billing rules.{' '}
            <Link className="underline" href="/admin/settings/billing">
              Change rates in Settings › Billing
            </Link>
            .
          </p>
          {rates.loading ? (
            <div className="skeleton h-24 w-full" data-testid="skeleton-row" />
          ) : rates.data === null ? (
            <Alert tone="warn">
              The rates could not be loaded. You can still continue; the preview uses them.
            </Alert>
          ) : rates.data.length === 0 ? (
            <Alert tone="warn">No billing rule is set up yet. Add rates in Settings › Billing first.</Alert>
          ) : (
            <ul aria-label="Approved rates" className="divide-y divide-[var(--line)] text-[14px]">
              {rates.data.map(r => (
                <li key={r.ruleId} className="flex flex-wrap justify-between gap-x-4 py-2">
                  <span>
                    {r.headName}
                    {r.scopeText && <span className="text-muted"> ({r.scopeText})</span>}
                  </span>
                  <span className="font-semibold">{r.rateText}</span>
                  {r.pendingText && <span className="w-full text-[12.5px] text-muted">{r.pendingText}</span>}
                </li>
              ))}
            </ul>
          )}

          {splitRules.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-1 text-[15px] font-bold">Amounts for this run</h3>
              <p className="mb-3 text-[13px] text-muted">
                These charges share a total bill across flats. Enter the total for this run.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {splitRules.map(s => (
                  <Input
                    key={s.id}
                    label={`${s.name} (total in ₹)`}
                    inputMode="decimal"
                    value={amountOf(s.id)}
                    error={errs[`split-${s.id}`]}
                    hint={s.description || undefined}
                    onChange={e => setAmounts(a => ({ ...a, [s.id]: e.target.value }))}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="mt-5">
            <Textarea
              label="Notes (optional)"
              value={notes}
              error={errs.notes}
              rows={2}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => router.push('/admin/billing/runs')}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={cycleLoad.loading || splits.loading}
              onClick={() => void submitStep1()}
            >
              Next
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <>
          {runError != null && (
            <ErrorState
              error={plainError(runError)}
              action={
                <Button size="sm" onClick={() => void refresh()}>
                  Try again
                </Button>
              }
            />
          )}
          {!run && runError == null && (
            <div aria-busy="true" aria-label="Loading">
              <div className="skeleton h-24 w-full" data-testid="skeleton-row" />
            </div>
          )}
          {run && computing && (
            <Card title={`Computing ${run.runLabel}`}>
              <ProgressBar
                label="Computing the run"
                value={null}
                text={
                  run.counts.items > 0
                    ? `Computing the bills. ${run.counts.items} flats done so far.`
                    : 'Computing the bills. This can take a minute.'
                }
              />
            </Card>
          )}
          {run?.status === 'FAILED' && (
            <Alert tone="bad">
              The run could not be computed.{' '}
              {run.computeError ? computeErrorText(run.computeError) : 'Try again with Recompute.'}
            </Alert>
          )}
          {run && run.status !== 'DRAFT' && run.status !== 'COMPUTING' && run.status !== 'FAILED' && (
            <>
              <Card
                title={`Preview of ${run.runLabel}: ${periodLabel(run.periodStart, run.cycle)}`}
                className="mb-4"
              >
                {run.isStale && (
                  <Alert tone="warn">
                    Rates, settings or resident details changed after this preview. Recompute before you
                    continue.
                  </Alert>
                )}
                <RunSummary run={run} />
              </Card>
              <Card title="Flats">
                <RunItems run={run} canEdit onChanged={() => void refresh()} />
              </Card>
            </>
          )}
          {run && block && !computing && run.status !== 'FAILED' && (
            <Alert tone="warn" className="mt-4">
              {block}
            </Alert>
          )}
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              {run && (run.status === 'PREVIEW' || run.status === 'FAILED') && (
                <Button variant="glass" loading={busy} onClick={() => void recompute()}>
                  Recompute
                </Button>
              )}
              <Button disabled={!run || !!block} onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 3 && run && (
        <Card title="Confirm and submit">
          {published ? (
            <>
              <PublishResult run={published} />
              <p className="mt-3 text-[13px] text-muted">Total {inr(published.totalPaise)}.</p>
            </>
          ) : (
            <PublishForm
              run={run}
              onChanged={() => void refresh()}
              onRecompute={async () => {
                await recompute();
                setStep(2);
              }}
              onPublished={r => {
                setPublished(r);
                setRun(r);
              }}
              footerLeft={
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Back
                </Button>
              }
            />
          )}
        </Card>
      )}
    </Page>
  );
}
