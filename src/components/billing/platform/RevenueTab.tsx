'use client';
import type { ReactNode } from 'react';
import { Card } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="glass p-4">
      <div className="text-[12.5px] font-semibold text-muted">{label}</div>
      <div className="mt-1 text-[24px] font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[12.5px] text-muted">{sub}</div>}
    </div>
  );
}

/** A labelled horizontal bar; the figure is always written next to it, so colour is not the only signal. */
function Bar({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <li className="grid grid-cols-[110px_1fr_auto] items-center gap-3 py-1 text-[13.5px]">
      <span className="truncate">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]" aria-hidden="true">
        <span className="block h-full rounded-full bg-navy" style={{ width: `${value > 0 ? pct : 0}%` }} />
      </span>
      <span className="text-right font-semibold tabular-nums">{text}</span>
    </li>
  );
}

/** Spec 11.1 Revenue tab: MRR, ARR, collections, churn, ageing, top societies. */
export function RevenueTab() {
  const load = useLoad(() => svc.revenue({ months: 12 }));
  if (load.error)
    return (
      <Card>
        <ErrorState
          error={load.error}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  const r = load.data;
  if (!r) return <div className="skeleton h-64" data-testid="revenue-loading" />;
  const last = r.series[r.series.length - 1];
  const pctOfBilled =
    r.billedThisMonthPaise > 0
      ? Math.round((r.collectedThisMonthPaise / r.billedThisMonthPaise) * 100)
      : null;
  const ageing = [
    ['Not due', r.ageing.notDuePaise],
    ['1 to 15 days', r.ageing.d1to15Paise],
    ['16 to 30 days', r.ageing.d16to30Paise],
    ['31 to 60 days', r.ageing.d31to60Paise],
    ['Over 60 days', r.ageing.over60Paise],
  ] as const;
  const maxAge = Math.max(...ageing.map(a => a[1]));
  const maxPlan = Math.max(0, ...r.mrrByPlan.map(p => p.mrrPaise));
  const maxMrr = Math.max(0, ...r.series.map(s => s.endMrrPaise));
  const maxTop = Math.max(0, ...r.topSocieties.map(s => s.mrrPaise));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="MRR" value={inr(r.mrrPaise)} sub={`${r.payingSocieties} paying societies`} />
        <Kpi label="ARR (run rate)" value={inr(r.arrPaise)} />
        <Kpi
          label="Collected this month"
          value={inr(r.collectedThisMonthPaise)}
          sub={pctOfBilled === null ? undefined : `${pctOfBilled}% of billed`}
        />
        <Kpi label="Outstanding" value={inr(r.outstandingPaise)} sub={`${inr(r.overduePaise)} overdue`} />
        <Kpi label="GST collected" value={inr(r.gstThisMonthPaise)} sub="this month" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="MRR by plan">
          <ul>
            {r.mrrByPlan.map(p => (
              <Bar
                key={p.planKey}
                label={p.planKey}
                value={p.mrrPaise}
                max={maxPlan}
                text={inr(p.mrrPaise)}
              />
            ))}
          </ul>
        </Card>
        <Card title="Churn" sub={last ? `Last month, ${last.month}` : undefined}>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Logo churn" value={last ? `${last.logoChurnPct}%` : '-'} />
            <Kpi label="Revenue churn" value={last ? `${last.revenueChurnPct}%` : '-'} />
          </div>
        </Card>
        <Card title="Ageing of unpaid invoices">
          <ul>
            {ageing.map(([label, v]) => (
              <Bar key={label} label={label} value={v} max={maxAge} text={inr(v)} />
            ))}
          </ul>
        </Card>
        <Card title="Top societies by MRR">
          <ol>
            {r.topSocieties.map(s => (
              <Bar key={s.societyId} label={s.name} value={s.mrrPaise} max={maxTop} text={inr(s.mrrPaise)} />
            ))}
          </ol>
        </Card>
      </div>
      <Card title="MRR movement" sub="Last 12 months">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <caption className="sr-only">MRR movement by month</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-[12px] uppercase text-muted">
                <th className="px-2 py-2">Month</th>
                <th className="px-2 py-2 text-right">Start</th>
                <th className="px-2 py-2 text-right">New</th>
                <th className="px-2 py-2 text-right">Expansion</th>
                <th className="px-2 py-2 text-right">Contraction</th>
                <th className="px-2 py-2 text-right">Churned</th>
                <th className="px-2 py-2 text-right">End</th>
              </tr>
            </thead>
            <tbody>
              {r.series.map(s => (
                <tr key={s.month} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-2 py-2 font-semibold">{s.month}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(s.startMrrPaise)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(s.newPaise)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(s.expansionPaise)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(s.contractionPaise)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(s.churnedPaise)}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">{inr(s.endMrrPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3" aria-label="End of month MRR">
          {r.series.map(s => (
            <Bar key={s.month} label={s.month} value={s.endMrrPaise} max={maxMrr} text={inr(s.endMrrPaise)} />
          ))}
        </ul>
      </Card>
    </div>
  );
}
