import Link from 'next/link';
import { inr, shortDate } from '@/lib/money';
import type { Collection } from '@/types/collections';
import { CollectionStatusChip, Meter, TypeChip } from './CollectionBits';
import { clip } from './format';

/** One collection of the Collections tab (spec 11.1): chips, title, purpose, meter and the three facts. */
export function CollectionCard({ c }: { c: Collection }) {
  const progress = `${inr(c.collectedPaise)} of ${inr(c.targetPaise)} · ${c.percent}%`;
  return (
    <li data-testid="collection-card">
      <Link
        href={`/admin/collections/${c.id}`}
        className="glass flex h-full flex-col gap-2 p-4 transition-colors hover:bg-white/80"
      >
        <span className="flex flex-wrap gap-1.5">
          <TypeChip mandatory={c.isMandatory} />
          <CollectionStatusChip status={c.status} />
        </span>
        <span className="text-[16px] font-bold">{c.title}</span>
        <span className="text-[13.5px] text-muted">{clip(c.purpose)}</span>
        <Meter percent={c.percent} label={`${c.title} progress`} />
        <span className="text-[13.5px] font-semibold tabular-nums">{progress}</span>
        <span className="flex justify-between text-[13px] text-muted">
          <span>
            {c.paidCount} of {c.requestCount} flats
          </span>
          <span>Due {shortDate(c.dueDate)}</span>
        </span>
      </Link>
    </li>
  );
}
