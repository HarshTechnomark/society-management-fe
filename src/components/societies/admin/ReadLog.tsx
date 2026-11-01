'use client';
import { ErrorState } from '@/components/common/ErrorState';
import { useLoad } from '@/hooks/useLoad';
import { societiesService } from '@/services/societies.service';
import type { ReadLogEntry } from '@/types/societies';
import { clockTime, dateTime } from '../format';

/** "Billing › Invoices" from `/api/v1/invoices/:id` style route patterns. */
export function routeLabel(route: string): string {
  const parts = route
    .replace(/^\/?api\/v\d+\//, '')
    .split('/')
    .filter(p => p && !p.startsWith(':') && !/^\d+$/.test(p));
  if (parts.length === 0) return route;
  const words = parts.map(p => p.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()));
  return words.join(' › ');
}

function line(e: ReadLogEntry): string {
  const what = routeLabel(e.route);
  return e.method === 'GET'
    ? `Viewed ${what} at ${clockTime(e.at)}`
    : `Changed ${what} at ${clockTime(e.at)}`;
}

/** The read log of one grant (8.23 detail): what support viewed or changed, newest first. */
export function ReadLog({ grantId }: { grantId: number }) {
  const detail = useLoad(() => societiesService.societyGrant(grantId), grantId);
  if (detail.error) return <ErrorState error={detail.error} />;
  if (!detail.data) return <div className="skeleton h-24 w-full" />;
  const log = detail.data.readLog ?? [];
  if (log.length === 0) return <p className="text-[14px] text-muted">Support has not opened anything yet.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {log.map((e, i) => (
        <li key={`${e.at}-${i}`} className="border-b border-[var(--line)] pb-2 text-[14px] last:border-0">
          {line(e)}
          <div className="text-[12px] text-muted">{dateTime(e.at)}</div>
        </li>
      ))}
    </ol>
  );
}
