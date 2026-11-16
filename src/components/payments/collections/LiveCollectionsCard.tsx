'use client';
import Link from 'next/link';
import { Card } from '@/components/common/PageHead';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { collectionsService } from '@/services/collections.service';
import { Meter } from './CollectionBits';

const FEATURE_NOTE = 'No live collections. Create a festival or event collection and residents pay by UPI.';

/** Admin home "Collections" card (spec 11.2): live collections with meters. Hidden without `finance.collections.view`. */
export function LiveCollectionsCard() {
  const can = usePermission(PERMISSIONS.finance.collections.view);
  if (!can) return null;
  return <Inner />;
}

function Inner() {
  const list = useLoad(() =>
    collectionsService.list({ status: 'PUBLISHED', limit: 5, sortBy: 'dueDate', sortOrder: 'asc' }),
  );
  const items = list.data?.items ?? [];
  return (
    <Card title="Collections" className="mb-4">
      {list.loading ? (
        <div aria-busy="true" aria-label="Loading collections">
          <div className="skeleton h-12 w-full" data-testid="skeleton-row" />
        </div>
      ) : list.error != null ? (
        <p role="alert" className="text-[14px] text-muted">
          Collections could not be loaded.{' '}
          <button type="button" className="font-semibold underline" onClick={list.reload}>
            Try again
          </button>
        </p>
      ) : items.length === 0 ? (
        <p className="text-[14px] text-muted">{FEATURE_NOTE}</p>
      ) : (
        <ul aria-label="Live collections" className="flex flex-col gap-3">
          {items.map(c => (
            <li key={c.id} data-testid="live-collection">
              <Link href={`/admin/collections/${c.id}`} className="block">
                <span className="flex justify-between gap-2 text-[14.5px] font-bold">
                  <span>{c.title}</span>
                  <span className="text-[12.5px] font-normal text-muted">Due {shortDate(c.dueDate)}</span>
                </span>
                <Meter percent={c.percent} label={`${c.title} progress`} />
                <span className="text-[13px] text-muted">
                  {inr(c.collectedPaise)} of {inr(c.targetPaise)} · {c.percent}%
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13.5px]">
        <Link href="/admin/collections" className="font-semibold underline">
          All collections
        </Link>
      </p>
    </Card>
  );
}
