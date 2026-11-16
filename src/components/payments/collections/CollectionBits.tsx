import { Chip } from '@/components/ui/Chip';
import type { Collection } from '@/types/collections';
import { STATUS_LABEL, STATUS_TONE } from './format';

export function CollectionStatusChip({ status }: { status: Collection['status'] }) {
  return <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;
}

export function TypeChip({ mandatory }: { mandatory: boolean }) {
  return mandatory ? <Chip tone="bad">Mandatory</Chip> : <Chip tone="gold">Optional</Chip>;
}

/** The progress meter with its words: "₹1,200 of ₹5,000 · 24%". */
export function Meter({ percent, label }: { percent: number; label: string }) {
  const v = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className="h-2.5 w-full overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
    >
      <div className="h-full rounded-full bg-navy" style={{ width: `${v === 0 ? 0 : Math.max(2, v)}%` }} />
    </div>
  );
}
