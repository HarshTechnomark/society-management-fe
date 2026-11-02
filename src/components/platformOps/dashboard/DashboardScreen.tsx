'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Segment, StatusChip } from '@/components/societies/bits';
import { HealthMeter } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { inr } from '@/lib/money';
import { societiesService } from '@/services/societies.service';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { ActivityItem, DashboardData, HealthSummary } from '@/types/platformOps';
import { LivePill, opsError, timeAgo } from '../format';
import { usePolling } from '../usePolling';
import { BarChart, Donut, LineChart } from './Charts';

type Period = '7' | '30' | '90';

const ATTENTION: Record<string, string> = {
  PAST_DUE_SOCIETIES: 'Past due societies',
  FAILED_JOBS: 'Failed jobs',
  SLA_BREACHED_TICKETS: 'Tickets past their SLA',
  HIGH_PRIORITY_TICKETS: 'High priority tickets',
  TRIALS_ENDING: 'Trials ending within 5 days',
  PROVIDERS_DEGRADED: 'Providers not operational',
  OPEN_SEV_INCIDENTS: 'Open SEV1 or SEV2 incidents',
};

/** Where an API link such as `/societies?status=PAST_DUE` lives in the console. */
export const consoleLink = (link: string) => (link.startsWith('/platform') ? link : `/platform${link}`);

function Tile({
  href,
  label,
  value,
  sub,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
  tone?: 'bad';
}) {
  return (
    <Link href={href} className="glass block p-4 hover:bg-white/70">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-[26px] font-bold tabular-nums ${tone === 'bad' ? 'text-bad' : ''}`}>{value}</p>
      <p className="text-[13px] text-muted">{sub}</p>
    </Link>
  );
}

/** Spec 11.1 Dashboard (prototype `Pages.dashboard`). */
export function DashboardScreen() {
  const { me } = useMe();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('30');
  const canAdd = usePermission(PERMISSIONS.platform.societies.create);
  const dash = useLoad(() => svc.dashboard(period), period);
  const health = usePolling<HealthSummary>(() => svc.healthSummary(), 30_000);
  const feed = usePolling<ActivityItem[]>(() => svc.activity(), 30_000);
  const plans = useLoad(() => svc.plansByCount().catch(() => []), 'plans');
  const [nudging, setNudging] = useState<number | null>(null);
  const first = me?.user.name?.split(' ')[0];

  const refresh = () => {
    dash.reload();
    void health.reload();
    void feed.reload();
  };
  const nudge = async (id: number) => {
    setNudging(id);
    try {
      await societiesService.nudge(id);
      toast.show('Reminder sent.');
    } catch (e) {
      toast.show(opsError(e), 'error');
    } finally {
      setNudging(null);
    }
  };

  const d: DashboardData | null = dash.data;
  return (
    <Page>
      <PageHead
        title="Platform overview"
        sub={first ? `Welcome back, ${first}` : 'Welcome back'}
        actions={
          <>
            <LivePill />
            <Segment<Period>
              label="Period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
              ]}
            />
            <Button variant="glass" size="sm" onClick={refresh}>
              Refresh
            </Button>
            {canAdd && (
              <Link href="/platform/societies?add=1" className={buttonClasses('primary', 'sm')}>
                Add society
              </Link>
            )}
          </>
        }
      />
      {dash.error ? (
        <Card>
          <ErrorState
            error={dash.error}
            action={
              <button className="underline" onClick={dash.reload}>
                Try again
              </button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 min-[900px]:grid-cols-3" aria-busy={!d}>
            {!d ? (
              Array.from({ length: 6 }, (_, i) => (
                <div key={i} data-testid="tile-skeleton" className="skeleton h-28" />
              ))
            ) : (
              <>
                <Tile
                  href="/platform/societies"
                  label="Active societies"
                  value={String(d.societies.byStatus.ACTIVE ?? 0)}
                  sub={`${d.societies.byStatus.PAST_DUE ?? 0} past due · ${d.societies.byStatus.TRIAL ?? 0} on trial`}
                />
                <Tile
                  href="/platform/societies"
                  label="Units under management"
                  value={
                    d.unitsUnderManagement === null
                      ? 'Not available yet'
                      : d.unitsUnderManagement.toLocaleString('en-IN')
                  }
                  sub={
                    d.activeUsers30d === null
                      ? ' '
                      : `${d.activeUsers30d.toLocaleString('en-IN')} active users`
                  }
                />
                <Tile
                  href="/platform/billing"
                  label="MRR"
                  value={inr(d.mrr.mrrPaise)}
                  sub={`${(d.mrr.netChangeBp / 100).toFixed(1)}% net MRR change`}
                />
                <Tile
                  href="/platform/societies?status=TRIAL"
                  label="Trial conversions"
                  value={`${d.trialConversions.converted} of ${d.trialConversions.ended}`}
                  sub={
                    d.trialConversions.ratePct === null
                      ? 'No trials ended'
                      : `${Math.round(d.trialConversions.ratePct)}% convert`
                  }
                />
                <Tile
                  href="/platform/billing"
                  label="Payment success rate"
                  value={
                    d.paymentSuccessRatePct === null ? 'Not available yet' : `${d.paymentSuccessRatePct}%`
                  }
                  sub="Online payments, last 7 days"
                />
                <Tile
                  href="/platform/support"
                  label="Open support tickets"
                  value={String(d.tickets.open)}
                  sub={`${d.tickets.unassigned} unassigned`}
                  tone={d.tickets.slaBreached > 0 ? 'bad' : undefined}
                />
              </>
            )}
          </div>

          <Card title="System health" sub="Refreshed every 30 seconds">
            {health.error && !health.data ? (
              <ErrorState error={health.error} />
            ) : !health.data ? (
              <div className="skeleton h-14 w-full" />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-[14px] min-[700px]:grid-cols-5">
                <Stat label="API p95 latency" value={`${health.data.apiP95Ms} ms`} />
                <Stat label="Error rate" value={`${health.data.errorRatePct}%`} />
                <Stat
                  label="Job failures"
                  value={String(health.data.failedJobs)}
                  bad={health.data.failedJobs > 0}
                />
                <Stat
                  label="Provider outages"
                  value={String(health.data.providerIssues.length)}
                  bad={health.data.providerIssues.length > 0}
                />
                <Stat label="Uptime (30 d)" value={`${health.data.uptime30dPct}%`} />
              </dl>
            )}
          </Card>

          {d && (
            <div className="mt-4 grid gap-4 min-[900px]:grid-cols-2">
              <Card title="Monthly recurring revenue">
                <LineChart
                  labels={d.series.labels}
                  values={d.series.mrrPaise}
                  title={`MRR, ${inr(d.mrr.mrrPaise)} now`}
                />
              </Card>
              <Card title="New societies">
                <BarChart
                  labels={d.series.labels}
                  values={d.series.signups}
                  title={`${d.societies.newInPeriod} new societies`}
                />
              </Card>
              <Card title="Societies by plan">
                {plans.data && plans.data.length > 0 ? (
                  <Donut
                    title="Societies by plan"
                    parts={plans.data.map(p => ({ label: p.name, value: p.activeSubscriptions }))}
                  />
                ) : (
                  <EmptyState title="No plan data" />
                )}
              </Card>
              <Card title="Needs attention">
                {d.needsAttention.length === 0 ? (
                  <EmptyState title="All clear" text="Nothing needs you right now." />
                ) : (
                  <ul className="divide-y divide-[var(--line)]">
                    {d.needsAttention.map(n => (
                      <li key={n.kind}>
                        <Link
                          href={consoleLink(n.link)}
                          className="flex items-center justify-between gap-3 py-2.5 text-[14px] font-semibold hover:underline"
                        >
                          <span>{ATTENTION[n.kind] ?? n.kind}</span>
                          <Chip tone="warn">{n.count}</Chip>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Queue backlog">
                <dl className="grid grid-cols-4 gap-2 text-center text-[13px]">
                  <Stat label="Waiting" value={String(d.jobs.waiting)} />
                  <Stat label="Paused" value={String(d.jobs.pausedQueues)} />
                  <Stat label="Failed" value={String(d.jobs.failed)} bad={d.jobs.failed > 0} />
                  <Stat label="Running" value={String(d.jobs.active)} />
                </dl>
              </Card>
              <Card title="At-risk tenants">
                {d.atRisk.length === 0 ? (
                  <EmptyState title="No societies at risk" />
                ) : (
                  <ul className="divide-y divide-[var(--line)]">
                    {d.atRisk.map(s => (
                      <li
                        key={s.societyId}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/platform/societies/${s.societyId}`}
                            className="font-semibold hover:underline"
                          >
                            {s.name}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-2">
                            <StatusChip status={s.status as never} />
                            <HealthMeter score={s.healthScore} />
                          </div>
                        </div>
                        <Button
                          size="xs"
                          variant="glass"
                          loading={nudging === s.societyId}
                          onClick={() => nudge(s.societyId)}
                        >
                          Nudge
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Live activity">
                {feed.error && !feed.data ? (
                  <ErrorState error={feed.error} />
                ) : !feed.data ? (
                  <div className="skeleton h-24 w-full" />
                ) : feed.data.length === 0 ? (
                  <EmptyState title="No activity yet" />
                ) : (
                  <ul aria-live="polite" className="divide-y divide-[var(--line)]">
                    {feed.data.map(a => (
                      <li key={a.id} className="flex items-start gap-3 py-2.5 text-[14px]">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${{ ok: 'bg-ok', info: 'bg-info', warn: 'bg-warn', bad: 'bg-bad' }[a.tone] ?? 'bg-faint'}`}
                        />
                        <span className="min-w-0 flex-1">
                          {a.link ? (
                            <Link href={consoleLink(a.link)} className="hover:underline">
                              {a.text}
                            </Link>
                          ) : (
                            a.text
                          )}
                        </span>
                        <time dateTime={a.at} className="shrink-0 text-[12px] text-muted">
                          {timeAgo(a.at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`text-[18px] font-bold tabular-nums ${bad ? 'text-bad' : ''}`}>{value}</dd>
    </div>
  );
}
