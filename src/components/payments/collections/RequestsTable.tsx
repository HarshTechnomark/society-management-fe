'use client';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import { Input } from '@/components/ui/Input';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { collectionsService } from '@/services/collections.service';
import type { CollectionRequest } from '@/types/collections';
import { REQUEST_LABEL, REQUEST_TONE, plainError } from './format';

const CHIPS = [
  { key: '', label: 'All' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PART_PAID', label: 'Part paid' },
  { key: 'OPEN', label: 'Due' },
  { key: 'WAIVED', label: 'Waived' },
];
const PAGE = 25;

/** Per flat table (spec 11.1): search by flat, status chips, and a row action for each flat the state allows. */
export function RequestsTable({
  id,
  mandatory,
  reloadKey,
  rowAction,
}: {
  id: number;
  mandatory: boolean;
  reloadKey: number;
  rowAction?: (r: CollectionRequest) => React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [text]);
  const list = useLoad(
    () =>
      collectionsService.requests(id, { q: q || undefined, status: status || undefined, page, limit: PAGE }),
    `${q}|${status}|${page}|${reloadKey}`,
  );
  const items = list.data?.items ?? [];
  const pages = list.data?.pagination.totalPages ?? 1;
  return (
    <section aria-label="Per flat">
      <h2 className="mb-2 text-[16px] font-bold">Per flat</h2>
      <Input
        label="Search flats"
        type="search"
        placeholder="Flat number"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div role="group" aria-label="Filter flats" className="mb-3 flex flex-wrap gap-2">
        {CHIPS.map(c => (
          <button
            key={c.key}
            type="button"
            aria-pressed={status === c.key}
            onClick={() => {
              setStatus(c.key);
              setPage(1);
            }}
            className={cx(
              'h-8 rounded-full px-3 text-[13px] font-semibold',
              status === c.key ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/80',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {list.error != null ? (
        <ErrorState
          error={plainError(list.error)}
          action={
            <Button size="sm" onClick={list.reload}>
              Try again
            </Button>
          }
        />
      ) : list.loading ? (
        <div aria-busy="true" aria-label="Loading flats">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-2 h-10 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No flats here"
          text={q || status ? 'Change the search or the filter.' : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="text-[12.5px] text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">Flat</th>
                <th className="py-2 pr-3 text-right font-semibold">Asked</th>
                <th className="py-2 pr-3 text-right font-semibold">Paid</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">Last paid</th>
                <th className="py-2 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {items.map(r => (
                <tr key={r.id} data-testid="request-row">
                  <td className="py-2 pr-3 font-semibold">
                    {r.unitLabel}
                    {r.billToName && (
                      <span className="block text-[12.5px] font-normal text-muted">{r.billToName}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.amountPaise ? inr(r.amountPaise) : '-'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{inr(r.paidPaise)}</td>
                  <td className="py-2 pr-3">
                    <Chip tone={REQUEST_TONE[r.status]}>{REQUEST_LABEL(r.status, mandatory)}</Chip>
                  </td>
                  <td className="py-2 pr-3 text-muted">{shortDate(r.lastPaidAt)}</td>
                  <td className="py-2 text-right">{rowAction?.(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages of flats" className="mt-3 flex items-center justify-between text-[13.5px]">
          <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="glass" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </nav>
      )}
    </section>
  );
}
