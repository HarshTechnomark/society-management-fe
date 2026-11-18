'use client';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { helpdeskService } from '@/services/helpdesk.service';
import type { TicketStats } from '@/types/helpdesk';
import { minutesText } from './format';

/** Stats are an optional extra (plan feature `helpdesk_analytics`): once the API says 402 or 404 we stop asking. */
let unavailable = false;
export const resetStatsMemory = () => {
  unavailable = false;
};

const pct = (v: number | null) => (v == null ? '-' : `${v}%`);

export function StatsTiles({ version }: { version: number }) {
  const load = useLoad<TicketStats | null>(async () => {
    if (unavailable) return null;
    try {
      return await helpdeskService.stats();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 402)) unavailable = true;
      return null;
    }
  }, version);
  const s = load.data;
  if (!s) return null;
  const tiles: { label: string; value: string; sub?: string; bad?: boolean }[] = [
    { label: 'Open', value: String(s.open), sub: `${s.urgent} urgent` },
    { label: 'Unassigned', value: String(s.unassigned) },
    { label: 'SLA breached', value: String(s.breachedOpen), bad: s.breachedOpen > 0 },
    { label: 'Resolved (30 days)', value: String(s.resolved), sub: `${s.created} raised` },
    { label: 'Fixed on time', value: pct(s.resolutionMetPct), sub: `reply on time ${pct(s.responseMetPct)}` },
    { label: 'Median fix time', value: minutesText(s.medianResolutionMinutes) },
    { label: 'Rating', value: s.csatAvg == null ? '-' : `${s.csatAvg} / 5`, sub: `${s.csatCount} ratings` },
  ];
  return (
    <ul aria-label="Helpdesk figures" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map(t => (
        <li key={t.label} className="glass p-3">
          <p className="text-[12px] font-semibold text-muted">{t.label}</p>
          <p className={`text-[20px] font-bold ${t.bad ? 'text-bad' : ''}`}>{t.value}</p>
          {t.sub && <p className="text-[12px] text-muted">{t.sub}</p>}
        </li>
      ))}
    </ul>
  );
}
