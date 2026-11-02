'use client';
import { Chip } from '@/components/ui/Chip';
import { ErrorState } from '@/components/common/ErrorState';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import { IncidentChip, SEVERITY_TONE, istTime } from '../format';
import { usePolling } from '../usePolling';

const OVERALL: Record<string, { text: string; cls: string }> = {
  OPERATIONAL: { text: 'All systems operational', cls: 'bg-[#dcefe5] text-[#14583a]' },
  DEGRADED_PERFORMANCE: { text: 'Some systems are slower than usual', cls: 'bg-[#f6e6c9] text-[#6f4200]' },
  PARTIAL_OUTAGE: { text: 'Some systems are not working', cls: 'bg-[#fbe0c8] text-[#8a3b00]' },
  MAJOR_OUTAGE: { text: 'Major outage', cls: 'bg-[#f6dcda] text-[#8a1d17]' },
};
const DOT: Record<string, string> = {
  OPERATIONAL: 'bg-ok',
  DEGRADED_PERFORMANCE: 'bg-warn',
  PARTIAL_OUTAGE: 'bg-[#d9660a]',
  MAJOR_OUTAGE: 'bg-bad',
};
const STATE_TEXT: Record<string, string> = {
  OPERATIONAL: 'Operational',
  DEGRADED_PERFORMANCE: 'Degraded performance',
  PARTIAL_OUTAGE: 'Partial outage',
  MAJOR_OUTAGE: 'Major outage',
};

/** Spec 11.4 public status page. No sign-in; refreshes every 60 seconds; reads well at 360 px. */
export function StatusPage() {
  const { data, error } = usePolling(() => svc.publicStatus(), 60_000);
  const overall = data ? (OVERALL[data.overall] ?? OVERALL.PARTIAL_OUTAGE) : null;
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-6 sm:py-10">
      <h1 className="mb-1 text-[26px] font-bold tracking-tight max-[700px]:text-[22px]">SocietyApp status</h1>
      <p className="mb-5 text-[14px] text-muted">
        {data
          ? `Updated ${istTime(data.updatedAt)} IST. This page refreshes every minute.`
          : 'Checking the latest status.'}
      </p>
      {error && !data ? (
        <ErrorState error={error} title="The status could not be loaded" />
      ) : !data || !overall ? (
        <div className="skeleton h-20 w-full" aria-busy="true" />
      ) : (
        <>
          <div role="status" className={`mb-5 rounded-[20px] px-5 py-4 text-[18px] font-bold ${overall.cls}`}>
            {overall.text}
          </div>

          {data.activeIncidents.length > 0 && (
            <section aria-labelledby="active" className="mb-6">
              <h2 id="active" className="mb-2 text-[17px] font-bold">
                Active incidents
              </h2>
              <ul className="space-y-3">
                {data.activeIncidents.map(i => (
                  <li key={i.incidentNo} className="glass p-4">
                    <p className="flex flex-wrap items-center gap-2">
                      <b>{i.title}</b>
                      <Chip tone={SEVERITY_TONE[i.severity]}>{i.severity}</Chip>
                      <IncidentChip status={i.status} />
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {i.incidentNo} · started {istTime(i.startedAt)} IST
                    </p>
                    <ol className="mt-2 space-y-2 border-l-2 border-[var(--line)] pl-3">
                      {i.updates.map((u, n) => (
                        <li key={n} className="text-[14px]">
                          <span className="text-[12.5px] font-semibold">
                            {istTime(u.at)} · {u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                          </span>
                          <p className="whitespace-pre-wrap">{u.message}</p>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="components" className="glass mb-6 p-4">
            <h2 id="components" className="mb-2 text-[17px] font-bold">
              Components
            </h2>
            <ul className="divide-y divide-[var(--line)]">
              {data.components.map(c => (
                <li key={c.key} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span>{c.name}</span>
                  <span className="flex items-center gap-2 text-muted">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 rounded-full ${DOT[c.status] ?? 'bg-faint'}`}
                    />
                    {STATE_TEXT[c.status] ?? c.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="past">
            <h2 id="past" className="mb-2 text-[17px] font-bold">
              Past incidents (14 days)
            </h2>
            {data.recentIncidents.length === 0 ? (
              <p className="text-[14px] text-muted">No incidents in the last 14 days.</p>
            ) : (
              <ul className="space-y-2">
                {data.recentIncidents.map(i => (
                  <li key={i.incidentNo} className="glass p-3 text-[14px]">
                    <b>{i.title}</b>
                    <p className="text-[12.5px] text-muted">
                      {i.incidentNo} · {istTime(i.startedAt)} IST
                      {i.durationMinutes !== null && ` · lasted ${i.durationMinutes} min`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
