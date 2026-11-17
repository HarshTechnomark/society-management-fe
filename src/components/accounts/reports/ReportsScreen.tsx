'use client';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Gate } from '@/components/setup/Gate';
import { PlanLocked } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { HEADINGS } from '@/services/accountsReportsMappers';
import { accountsPeriodsService } from '@/services/accountsPeriods.service';
import { accountsReportsService } from '@/services/accountsReports.service';
import type { ReportKey, ReportQuery } from '@/types/accountsReports';
import { financialYearOf, fyStart, isPlanError, periodsError, todayIso } from '../periods/format';
import { ExportPanel } from './ExportPanel';
import { ReportTable } from './ReportTable';

const A = PERMISSIONS.finance.accounts;
const KEYS = Object.keys(HEADINGS) as ReportKey[];
const AS_OF: ReportKey[] = ['trial-balance', 'balance-sheet'];
const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** Reports (spec 8.19, 11.7): pick a report, set the period or year, read it, drill down, export. */
export function ReportsScreen() {
  return (
    <Gate view={A.view} feature="accounting.financial_reports" title="Reports">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const sp = useSearchParams();
  const canExport = usePermission(A.export);
  const gstOn = useFeature('accounting.gst_summary');
  const tdsOn = useFeature('accounting.tds');
  const today = todayIso();
  const thisFy = financialYearOf(today);
  const first = sp?.get('report') as ReportKey | null;
  const [report, setReport] = useState<ReportKey>(first && KEYS.includes(first) ? first : 'trial-balance');
  const [mode, setMode] = useState<'range' | 'year'>('range');
  const [asOf, setAsOf] = useState(today);
  const [from, setFrom] = useState(fyStart(thisFy));
  const [to, setTo] = useState(today);
  const [fy, setFy] = useState(thisFy);
  const [accountId, setAccountId] = useState(Number(sp?.get('ledgerAccountId')) || 0);
  const [includeZero, setIncludeZero] = useState(false);

  const years = useLoad(() => accountsPeriodsService.get().catch(() => null), 'years');
  const fyOptions = useMemo(() => {
    const list = (years.data?.years ?? []).map(y => y.financialYear);
    if (!list.includes(thisFy)) list.push(thisFy);
    return list
      .sort()
      .reverse()
      .map(v => ({ value: v, label: `Financial year ${v}` }));
  }, [years.data, thisFy]);
  const accounts = useLoad(() => accountsReportsService.ledgerAccounts().catch(() => []), 'accounts');

  const asOfType = AS_OF.includes(report);
  const isGl = report === 'general-ledger';
  const locked = (report === 'gst-summary' && !gstOn) || (report === 'tds-register' && !tdsOn);

  const { params, problem } = useMemo(() => {
    const p: ReportQuery = {};
    let bad: string | null = null;
    if (mode === 'year') p.financialYear = fy;
    else if (asOfType) {
      if (!asOf) bad = 'Choose a date.';
      p.asOf = asOf;
    } else {
      p.from = from;
      p.to = to;
      if (!from || !to) bad = 'Choose both dates.';
      else if (to < from) bad = 'The end date is before the start date.';
      else if (days(from, to) > 366) bad = 'Choose a period of at most one year, or pick a financial year.';
    }
    if (isGl) {
      if (accountId) p.ledgerAccountId = accountId;
      else bad = bad ?? 'Choose an account to see its ledger.';
    }
    if (report === 'trial-balance' && includeZero) p.includeZero = true;
    return { params: p, problem: bad };
  }, [mode, fy, asOfType, asOf, from, to, isGl, accountId, report, includeZero]);

  const load = useLoad(
    () => (problem || locked ? Promise.resolve(null) : accountsReportsService.get(report, params)),
    `${report}|${JSON.stringify(params)}|${problem}|${locked}`,
  );
  const view = load.data;
  const openLedger = (id: number) => {
    setReport('general-ledger');
    setAccountId(id);
  };

  return (
    <Page>
      <PageHead
        title="Reports"
        sub="Read the books of the society for any period, or export them for your auditor."
      />
      <div role="tablist" aria-label="Reports" className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {KEYS.map(k => {
          const lock = (k === 'gst-summary' && !gstOn) || (k === 'tds-register' && !tdsOn);
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={report === k}
              onClick={() => setReport(k)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${
                report === k ? 'bg-[#143041] text-white' : 'bg-[rgba(20,35,44,0.08)]'
              }`}
            >
              {HEADINGS[k]}
              {lock && <span className="ml-1.5 text-[11px]">(Premium)</span>}
            </button>
          );
        })}
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select
            label="Period"
            value={mode}
            onChange={e => setMode(e.target.value as 'range' | 'year')}
            options={[
              { value: 'range', label: asOfType ? 'On a date' : 'Between dates' },
              { value: 'year', label: 'A financial year' },
            ]}
          />
          {mode === 'year' ? (
            <Select
              label="Financial year"
              value={fy}
              onChange={e => setFy(e.target.value)}
              options={fyOptions}
            />
          ) : asOfType ? (
            <Input label="As of" type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
          ) : (
            <>
              <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
              <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </>
          )}
          {isGl && (
            <Select
              label="Account"
              value={String(accountId || '')}
              onChange={e => setAccountId(Number(e.target.value) || 0)}
              options={[
                { value: '', label: 'Choose an account' },
                ...(accounts.data ?? []).map(a => ({ value: String(a.id), label: `${a.code} ${a.name}` })),
              ]}
            />
          )}
          {report === 'trial-balance' && (
            <Checkbox
              className="!mb-2"
              label="Show accounts with no balance"
              checked={includeZero}
              onChange={e => setIncludeZero(e.target.checked)}
            />
          )}
        </div>
        {locked ? (
          <PlanLocked title={HEADINGS[report]} />
        ) : problem ? (
          <EmptyState title={isGl && !accountId ? 'Choose an account' : 'Check the period'} text={problem} />
        ) : load.loading ? (
          <div aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton mb-2 h-10 w-full" data-testid="skeleton-row" />
            ))}
          </div>
        ) : load.error != null ? (
          isPlanError(load.error) ? (
            <PlanLocked title={HEADINGS[report]} />
          ) : (
            <ErrorState
              error={new Error(periodsError(load.error))}
              action={
                <Button size="sm" onClick={load.reload}>
                  Try again
                </Button>
              }
            />
          )
        ) : view ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[17px] font-bold">{view.heading}</h2>
                {view.periodText && <span className="text-[13.5px] text-muted">{view.periodText}</span>}
                {view.balanced !== null && (
                  <Chip tone={view.balanced ? 'ok' : 'bad'}>
                    {view.balanced ? 'Balanced' : 'Out of balance'}
                  </Chip>
                )}
              </div>
              {canExport && <ExportPanel report={report} params={params} />}
            </div>
            {view.empty ? (
              <EmptyState title="Nothing to show" text="No posted entries match this period." />
            ) : (
              <ReportTable view={view} onLedger={openLedger} />
            )}
          </>
        ) : null}
      </Card>
    </Page>
  );
}
