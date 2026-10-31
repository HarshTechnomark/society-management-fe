'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { cx } from '@/components/ui/cx';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface Column<T> {
  key: string;
  label: string;
  /** Cell content. */
  render: (row: T) => ReactNode;
  /** Value used to sort; the column is sortable only when this is given. */
  sortValue?: (row: T) => string | number;
  className?: string;
  /** Visually hide the header (action columns). */
  hideLabel?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Accessible name of the table. */
  caption: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Search box over the text this returns; omit to hide the box. */
  searchText?: (row: T) => string;
  searchLabel?: string;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  empty?: { title: string; text?: string; action?: ReactNode };
  toolbar?: ReactNode;
}

/**
 * Client-side table: search, sort, pagination, empty state, loading skeleton and row click. The table scrolls
 * sideways inside its card on phones, so the page itself never scrolls horizontally.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading,
  error,
  onRetry,
  searchText,
  searchLabel = 'Search',
  pageSize = 10,
  initialSort,
  onRowClick,
  rowLabel,
  empty = { title: 'Nothing here yet' },
  toolbar,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);

  const view = useMemo(() => {
    let list = rows;
    const q = query.trim().toLowerCase();
    if (q && searchText) list = list.filter(r => searchText(r).toLowerCase().includes(q));
    const col = sort && columns.find(c => c.key === sort.key);
    if (col?.sortValue && sort) {
      const get = col.sortValue;
      const sign = sort.dir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const x = get(a);
        const y = get(b);
        return (
          (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign
        );
      });
    }
    return list;
  }, [rows, query, sort, columns, searchText]);

  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const current = Math.min(page, pages);
  const slice = view.slice((current - 1) * pageSize, current * pageSize);

  const toggle = (key: string) => {
    setPage(1);
    setSort(s => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  if (error)
    return (
      <ErrorState
        error={error}
        action={
          onRetry && (
            <button className="underline" onClick={onRetry}>
              Try again
            </button>
          )
        }
      />
    );

  return (
    <div>
      {(searchText || toolbar) && (
        <div className="flex flex-wrap items-center gap-3 px-1 pb-3">
          {searchText && (
            <input
              type="search"
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="h-10 min-w-0 flex-1 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none sm:max-w-xs"
            />
          )}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto" data-testid="table-scroll">
        <table
          className="w-full min-w-[640px] border-collapse text-left text-[14px]"
          aria-busy={loading || undefined}
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
              {columns.map(c => {
                const sorted = sort?.key === c.key ? sort.dir : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cx('px-3 py-2.5 font-semibold', c.className)}
                  >
                    {c.hideLabel ? (
                      <span className="sr-only">{c.label}</span>
                    ) : c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className="inline-flex items-center gap-1 uppercase"
                      >
                        {c.label}
                        <span aria-hidden="true">
                          {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                        </span>
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} data-testid="skeleton-row" className="border-b border-[var(--line)]">
                    {columns.map(c => (
                      <td key={c.key} className="px-3 py-3.5">
                        <div className="skeleton h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : slice.map(r => (
                  <tr
                    key={rowKey(r)}
                    className={cx(
                      'border-b border-[var(--line)] last:border-0',
                      onRowClick && 'cursor-pointer hover:bg-white/50',
                    )}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                  >
                    {columns.map((c, i) => (
                      <td key={c.key} className={cx('px-3 py-3 align-middle', c.className)}>
                        {onRowClick && i === 0 ? (
                          <button
                            type="button"
                            className="text-left"
                            aria-label={rowLabel ? `Open ${rowLabel(r)}` : undefined}
                            onClick={e => {
                              e.stopPropagation();
                              onRowClick(r);
                            }}
                          >
                            {c.render(r)}
                          </button>
                        ) : (
                          c.render(r)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && view.length === 0 && (
        <EmptyState
          title={query ? 'No match' : empty.title}
          text={query ? 'Nothing matches that search.' : empty.text}
          action={query ? undefined : empty.action}
        />
      )}
      {!loading && view.length > pageSize && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 px-1 pt-3 text-[13px] text-muted"
        >
          <span>
            {(current - 1) * pageSize + 1} to {Math.min(current * pageSize, view.length)} of {view.length}
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-full px-4 font-semibold text-navy hover:bg-black/5 disabled:opacity-40"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span aria-current="page">
              Page {current} of {pages}
            </span>
            <button
              type="button"
              className="h-9 rounded-full px-4 font-semibold text-navy hover:bg-black/5 disabled:opacity-40"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </span>
        </nav>
      )}
    </div>
  );
}
