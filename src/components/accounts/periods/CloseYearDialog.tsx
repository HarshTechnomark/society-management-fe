'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { inr } from '@/lib/money';
import { accountsPeriodsService } from '@/services/accountsPeriods.service';
import { accountsReportsService } from '@/services/accountsReports.service';
import type { YearRow } from '@/types/accountsPeriods';
import type { ReportView } from '@/types/accountsReports';
import { periodsError } from './format';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
type Phase = 'confirm' | 'running' | 'done' | 'slow';

/** "Close financial year" (spec 8.18, BR-13-50): checklist, typed confirmation, progress while the job runs, result. */
export function CloseYearDialog({
  year,
  version,
  onClose,
  onDone,
  pollMs = 2000,
  maxPolls = 60,
}: {
  year: YearRow;
  version: number;
  onClose: () => void;
  onDone: () => void;
  pollMs?: number;
  maxPolls?: number;
}) {
  const phrase = `CLOSE ${year.financialYear}`;
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ surplus: ReportView | null; sheet: ReportView | null }>({
    surplus: null,
    sheet: null,
  });

  const checklist = [
    { ok: true, text: `The year ended on ${year.end}.` },
    ...(year.blockers.length
      ? year.blockers.map(b => ({ ok: false, text: b }))
      : [{ ok: true, text: 'Books are locked through the end of the year and nothing is pending.' }]),
  ];
  const ready = year.canClose && year.blockers.length === 0;

  useEffect(() => {
    if (phase !== 'running') return;
    let live = true;
    (async () => {
      for (let i = 0; i < maxPolls && live; i++) {
        await sleep(pollMs);
        if (!live) return;
        try {
          const p = await accountsPeriodsService.get();
          if (p.lastClosedFinancialYear && p.lastClosedFinancialYear >= year.financialYear) {
            const [surplus, sheet] = await Promise.all([
              accountsReportsService
                .get('income-expenditure', { financialYear: year.financialYear })
                .catch(() => null),
              accountsReportsService.get('balance-sheet', { asOf: year.end }).catch(() => null),
            ]);
            if (!live) return;
            setSummary({ surplus, sheet });
            return setPhase('done');
          }
        } catch {
          /* checked again on the next round */
        }
      }
      if (live) setPhase('slow');
    })();
    return () => {
      live = false;
    };
  }, [phase, pollMs, maxPolls, year.financialYear, year.end]);

  const start = async () => {
    setError([]);
    setPhase('running');
    try {
      await accountsPeriodsService.closeYear(year.financialYear, version);
    } catch (e) {
      setPhase('confirm');
      const detail = (e as { errors?: { message?: string }[] }).errors
        ?.map(x => x.message ?? '')
        .filter(Boolean);
      setError(detail?.length ? detail : [periodsError(e)]);
    }
  };

  const finish = () => {
    onDone();
    onClose();
  };
  const surplusLine = summary.surplus?.summary[0];
  const carry = summary.sheet?.summary.filter(
    s => s.label.startsWith('Total assets') || s.label.startsWith('Liabilities'),
  );

  return (
    <Modal
      open
      sticky={phase === 'running'}
      onClose={phase === 'running' ? () => {} : phase === 'confirm' ? onClose : finish}
      title={`Close financial year ${year.financialYear}`}
      description={phase === 'confirm' ? 'Closing is permanent. It cannot be reopened.' : undefined}
      footer={
        phase === 'confirm' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!ready || typed.trim() !== phrase} onClick={() => void start()}>
              Close year
            </Button>
          </>
        ) : phase === 'running' ? null : (
          <Button onClick={finish}>Done</Button>
        )
      }
    >
      {phase === 'confirm' && (
        <div className="grid gap-3">
          {error.length > 0 && (
            <ul
              role="alert"
              className="list-disc rounded-xl bg-[#f6dcda] px-6 py-2 text-[13.5px] text-[#8a1d17]"
            >
              {error.map(m => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <ul aria-label="Checklist" className="grid gap-1.5 text-[14px]">
            {checklist.map(c => (
              <li key={c.text} className="flex gap-2">
                <span aria-hidden="true">{c.ok ? '✓' : '✗'}</span>
                <span className={c.ok ? '' : 'font-semibold text-[#8a1d17]'}>
                  <span className="sr-only">{c.ok ? 'Done: ' : 'To fix: '}</span>
                  {c.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[13.5px] text-muted">
            Income and expense balances are moved into the surplus account. Assets, liabilities and funds
            carry forward.
          </p>
          <Input
            label={`Type ${phrase} to confirm`}
            value={typed}
            onChange={e => setTyped(e.target.value)}
            disabled={!ready}
            autoComplete="off"
          />
        </div>
      )}
      {phase === 'running' && (
        <p role="status" className="flex items-center gap-2 text-[14px]">
          <Spinner /> Closing the year. Please keep this window open.
        </p>
      )}
      {phase === 'slow' && (
        <p role="status" className="text-[14px]">
          The closing is taking longer than usual. It continues in the background; reload this page in a few
          minutes.
        </p>
      )}
      {phase === 'done' && (
        <div className="grid gap-2" data-testid="close-result">
          <p role="status" className="text-[14.5px] font-bold">
            Financial year {year.financialYear} is closed.
          </p>
          {surplusLine && (
            <p className="text-[14px]">
              {surplusLine.label}: <b>{surplusLine.value}</b>, moved to the surplus account.
            </p>
          )}
          {carry && carry.length > 0 && (
            <dl className="grid gap-1 text-[14px]">
              {carry.map(s => (
                <div key={s.label} className="flex justify-between gap-3">
                  <dt className="text-muted">Carried forward: {s.label.toLowerCase()}</dt>
                  <dd className="font-bold tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {!surplusLine && !carry?.length && (
            <p className="text-[14px] text-muted">
              Balances of assets, liabilities and funds carry forward ({inr(0)} income and expense remain).
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
