'use client';
import { useState } from 'react';
import { useLoad } from '@/hooks/useLoad';
import type { Pagination } from '@/lib/apiClient';
import type { Page } from '@/services/platform-billing.service';

/** A server-paged list: reloads whenever the filters or the page change. */
export function useServerList<T>(fetcher: (page: number) => Promise<Page<T>>, filterKey: string, limit = 20) {
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setPage(1);
  }
  const effective = lastKey !== filterKey ? 1 : page;
  const load = useLoad(() => fetcher(effective), `${filterKey}|${effective}|${limit}`);
  return {
    rows: load.data?.items ?? [],
    pagination: load.data?.pagination ?? null,
    loading: load.loading,
    error: load.error,
    reload: load.reload,
    page: effective,
    setPage,
  };
}

export function Pager({
  pagination,
  page,
  onPage,
}: {
  pagination: Pagination | null;
  page: number;
  onPage: (p: number) => void;
}) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pages"
      className="flex items-center justify-between gap-3 px-1 pt-3 text-[13px] text-muted"
    >
      <span>{pagination.total} in total</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          className="h-9 rounded-full px-4 font-semibold text-navy hover:bg-black/5 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span aria-current="page">
          Page {page} of {pagination.totalPages}
        </span>
        <button
          type="button"
          className="h-9 rounded-full px-4 font-semibold text-navy hover:bg-black/5 disabled:opacity-40"
          disabled={page >= pagination.totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </span>
    </nav>
  );
}
