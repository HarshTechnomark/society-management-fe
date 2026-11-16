'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { collectionsService } from '@/services/collections.service';
import type { CollectionFilter } from '@/types/collections';
import { CollectionCard } from './CollectionCard';
import { CollectionWizard } from './CollectionWizard';
import { FILTERS, plainError } from './format';
import { useRouter } from 'next/navigation';

const C = PERMISSIONS.finance.collections;
export const COLLECTIONS_FEATURE = 'billing.festival_and_event_collections';
const PAGE = 24;

/** Admin collections list (spec 11.1 "Collections tab"): segmented filter and one card per collection. */
export function CollectionsScreen() {
  return (
    <Gate view={C.view} feature={COLLECTIONS_FEATURE} title="Collections">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const router = useRouter();
  const toast = useToast();
  const canCreate = usePermission(C.create);
  const [filter, setFilter] = useState<CollectionFilter>('ALL');
  const [page, setPage] = useState(1);
  const [wizard, setWizard] = useState(false);
  const status = FILTERS.find(f => f.key === filter)?.status;
  const list = useLoad(() => collectionsService.list({ status, page, limit: PAGE }), `${filter}|${page}`);
  const items = list.data?.items ?? [];
  const pages = list.data?.pagination.totalPages ?? 1;
  const newButton = canCreate && <Button onClick={() => setWizard(true)}>New collection</Button>;

  return (
    <Page>
      <PageHead
        title="Collections"
        sub="Festival, event and other one-time collections. A different committee member approves each one before it goes live."
        actions={newButton}
      />
      <div role="group" aria-label="Filter collections" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={cx(
              'h-9 rounded-full px-4 text-[13.5px] font-semibold',
              filter === f.key ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 text-ink hover:bg-white/80',
            )}
          >
            {f.label}
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
        <div
          aria-busy="true"
          aria-label="Loading"
          className="grid gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-3"
        >
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton h-44 w-full" data-testid="skeleton-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No collections here"
          text="Create a festival or event collection and residents pay by UPI."
          action={newButton || undefined}
        />
      ) : (
        <ul
          aria-label="Collections"
          className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-3"
        >
          {items.map(c => (
            <CollectionCard key={c.id} c={c} />
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav
          aria-label="Pages of collections"
          className="mt-4 flex items-center justify-between text-[13.5px]"
        >
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
      {wizard && (
        <CollectionWizard
          onClose={() => setWizard(false)}
          onDone={(c, submitted) => {
            setWizard(false);
            toast.show(submitted ? 'Sent for approval' : 'Draft saved');
            router.push(`/admin/collections/${c.id}`);
          }}
        />
      )}
    </Page>
  );
}
