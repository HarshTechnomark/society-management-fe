'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { noticesService } from '@/services/notices.service';
import type { NoticeListQuery } from '@/types/notices';
import { NoticeCard } from './NoticeCard';
import { NoticeComposer } from './NoticeComposer';
import { NoticeDrawer } from './NoticeDrawer';
import { CATEGORY_LABEL, SEGMENTS, plainError, type SegmentKey } from './format';

const CATEGORIES = [
  { value: '', label: 'Any category' },
  ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
];

/**
 * Admin notices list (spec 11.1). `banner` and `emergencyAction` are slots for the emergency broadcast banner
 * and button, which the emergency screens fill in.
 */
export function NoticesScreen({
  banner,
  emergencyAction,
}: {
  banner?: ReactNode;
  emergencyAction?: ReactNode;
}) {
  const canCreate = usePermission(PERMISSIONS.communication.notices.create);
  const [segment, setSegment] = useState<SegmentKey>('ALL');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const deep = Number(useSearchParams()?.get('open'));
  const [openId, setOpenId] = useState<number | null>(Number.isInteger(deep) && deep > 0 ? deep : null); // `?open=<id>` from a notification
  useEffect(() => {
    if (Number.isInteger(deep) && deep > 0) setOpenId(deep); // the bell can change the query on this same page
  }, [deep]);
  const [composing, setComposing] = useState<{ id?: number } | null>(null);
  const [tick, setTick] = useState(0);

  const status = SEGMENTS.find(s => s.key === segment)?.status;
  const query: NoticeListQuery = {
    status,
    category: category || undefined,
    q: q.trim() || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page,
    limit: 20,
  };
  const load = useLoad(() => noticesService.list(query), JSON.stringify(query) + tick);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const refresh = () => setTick(t => t + 1);
  const items = load.data?.items ?? [];

  return (
    <Page>
      <PageHead
        title="Notices"
        sub="Reach every resident with buttons they can act on."
        actions={
          <>
            {emergencyAction}
            {canCreate && <Button onClick={() => setComposing({})}>New notice</Button>}
          </>
        }
      />
      {banner}
      <div className="glass p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Search"
            type="search"
            placeholder="Search notices"
            value={q}
            onChange={e => reset(() => setQ(e.target.value))}
            autoComplete="off"
          />
          <Select
            label="Category"
            value={category}
            onChange={e => reset(() => setCategory(e.target.value))}
            options={CATEGORIES}
          />
        </div>
        <Segments
          label="Notice views"
          options={SEGMENTS.map(s => ({ key: s.key, label: s.label }))}
          value={segment}
          onChange={k => reset(() => setSegment(k))}
        />
        {load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : load.loading ? (
          <div aria-busy="true" aria-label="Loading" className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton h-32 w-full" data-testid="skeleton-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={q.trim() || category || segment !== 'ALL' ? 'No notices match your search' : 'No notices'}
            text={
              q.trim() || category || segment !== 'ALL'
                ? 'Try other words or clear the filters.'
                : 'Write one and reach everyone in minutes.'
            }
            action={
              q.trim() || category || segment !== 'ALL' ? undefined : canCreate ? (
                <Button onClick={() => setComposing({})}>New notice</Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Notices">
            {items.map(n => (
              <NoticeCard key={n.id} item={n} onOpen={() => setOpenId(n.id)} />
            ))}
          </ul>
        )}
        {(load.data?.totalPages ?? 1) > 1 && (
          <nav aria-label="Pages of notices" className="mt-3 flex items-center justify-between gap-2">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-[13px] text-muted">
              Page {page} of {load.data?.totalPages}
            </span>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= (load.data?.totalPages ?? 1)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </div>
      {openId != null && (
        <NoticeDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
          onEdit={id => {
            setOpenId(null);
            setComposing({ id });
          }}
        />
      )}
      {composing && (
        <NoticeComposer
          noticeId={composing.id}
          onClose={() => setComposing(null)}
          onSaved={() => {
            setComposing(null);
            refresh();
          }}
        />
      )}
    </Page>
  );
}
