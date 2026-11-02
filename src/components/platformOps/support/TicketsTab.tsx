'use client';
import { useEffect, useState } from 'react';
import { Pager } from '@/components/billing/useServerList';
import { Avatar } from '@/components/access/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Segment } from '@/components/societies/bits';
import { useLoad } from '@/hooks/useLoad';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { PlatformTicket } from '@/types/platformOps';
import { PriorityChip, TicketStatusChip, timeAgo } from '../format';
import { TicketDrawer } from './TicketDrawer';

type Filter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED';

/** Spec 11.2 Tickets tab. Search and segments go to the API (`q`, `status`); counts ignore the status filter. */
export function TicketsTab({ initial }: { initial?: { priority?: string; slaBreached?: boolean } }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim().length >= 2 ? text.trim() : '');
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const key = `${q}|${filter}|${page}|${initial?.priority ?? ''}|${initial?.slaBreached ?? ''}`;
  const load = useLoad(
    () =>
      svc.tickets({
        q: q || undefined,
        status: filter === 'ALL' ? undefined : filter,
        priority: initial?.priority,
        slaBreached: initial?.slaBreached,
        page,
        limit: 20,
      }),
    key,
  );
  const counts = load.data?.counts;
  const rows: PlatformTicket[] = load.data?.items ?? [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search tickets or societies"
          placeholder="Search tickets or societies"
          value={text}
          onChange={e => setText(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none sm:max-w-xs"
        />
        <Segment<Filter>
          label="Ticket status"
          value={filter}
          onChange={v => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: 'All', count: counts?.ALL },
            { value: 'OPEN', label: 'Open', count: counts?.OPEN },
            { value: 'IN_PROGRESS', label: 'In progress', count: counts?.IN_PROGRESS },
            { value: 'WAITING', label: 'Waiting', count: counts?.WAITING },
            { value: 'RESOLVED', label: 'Resolved', count: counts?.RESOLVED },
          ]}
        />
      </div>
      {load.error ? (
        <ErrorState
          error={load.error}
          action={
            <button className="underline" onClick={load.reload}>
              Try again
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[720px] border-collapse text-left text-[14px]"
            aria-busy={load.loading || undefined}
          >
            <caption className="sr-only">Support tickets</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                {['Ticket', 'Subject', 'Priority', 'Status', 'Assignee', 'Opened'].map(h => (
                  <th key={h} scope="col" className="px-3 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {load.loading
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} data-testid="skeleton-row">
                      <td colSpan={6} className="px-3 py-3.5">
                        <div className="skeleton h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map(t => (
                    <tr
                      key={t.id}
                      className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-white/50"
                      onClick={() => setOpenId(t.id)}
                    >
                      <td className="px-3 py-3 font-mono text-[13px]">
                        <button
                          type="button"
                          className="underline"
                          aria-label={`Open ${t.ticketNo}`}
                          onClick={e => {
                            e.stopPropagation();
                            setOpenId(t.id);
                          }}
                        >
                          {t.ticketNo}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold">{t.subject}</div>
                        <div className="text-[12.5px] text-muted">{t.society.name}</div>
                      </td>
                      <td className="px-3 py-3">
                        <PriorityChip priority={t.priority} />
                      </td>
                      <td className="px-3 py-3">
                        <TicketStatusChip status={t.status} />
                      </td>
                      <td className="px-3 py-3">
                        {t.assignee ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={t.assignee.name} />
                            {t.assignee.name}
                          </span>
                        ) : (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">{timeAgo(t.createdAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!load.loading && rows.length === 0 && (
            <EmptyState title="No tickets" text="No ticket matches these filters." />
          )}
        </div>
      )}
      <Pager pagination={load.data?.pagination ?? null} page={page} onPage={setPage} />
      {openId !== null && (
        <TicketDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load.reload} />
      )}
    </div>
  );
}
