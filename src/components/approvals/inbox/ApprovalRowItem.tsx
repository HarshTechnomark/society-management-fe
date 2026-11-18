'use client';
import { Chip } from '@/components/ui/Chip';
import { inr } from '@/lib/money';
import type { ApprovalRow } from '@/types/approvals';
import {
  STATUS_LABEL,
  STATUS_TONE,
  ago,
  dateTime,
  progressChip,
  reasonText,
  summaryLine,
  typeLabel,
} from '../format';

/** One request in the list: type, title, one summary line, amount and the chips that matter. */
export function ApprovalRowItem({
  row,
  selectable,
  selected,
  onSelect,
  onOpen,
}: {
  row: ApprovalRow;
  selectable: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onOpen: () => void;
}) {
  const progress = progressChip(row);
  return (
    <li data-testid="approval-row" className="flex items-start gap-3 py-3">
      {selectable && (
        <input
          type="checkbox"
          className="mt-1.5 h-4 w-4"
          aria-label={`Select ${row.title}`}
          checked={selected}
          onChange={e => onSelect(e.target.checked)}
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${row.title}`}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block text-[15px] font-bold">{row.title}</span>
        <span className="block text-[13.5px] text-muted">
          {typeLabel(row.type, row.typeLabel)}
          {row.requesterName ? ` · ${row.requesterName}` : ''}
          {row.createdAt ? ` · ${ago(row.createdAt)}` : ''}
        </span>
        {summaryLine(row) !== row.title && (
          <span className="block text-[13.5px]">
            {summaryLine({ ...row, title: '' }).replace(/^ · /, '')}
          </span>
        )}
        {row.status !== 'PENDING' && (row.decidedByName || row.decidedAt || row.decisionComment) && (
          <span data-testid="decision-line" className="block text-[13px] text-muted">
            {[
              row.decidedByName ? `By ${row.decidedByName}` : null,
              row.decidedAt ? dateTime(row.decidedAt) : null,
              row.decisionComment ? `"${row.decisionComment}"` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
        <span className="mt-1 flex flex-wrap gap-1.5">
          {row.status !== 'PENDING' && (
            <Chip tone={STATUS_TONE[row.status] ?? 'neutral'}>{STATUS_LABEL[row.status] ?? row.status}</Chip>
          )}
          {progress && <Chip>{progress}</Chip>}
          {row.isOverdue && <Chip tone="warn">Overdue</Chip>}
          {row.onBehalfOfName && <Chip tone="info">On behalf of {row.onBehalfOfName}</Chip>}
          {row.stuck && <Chip tone="bad">Stuck</Chip>}
          {row.status === 'PENDING' && !row.canAct && row.reason && (
            <Chip>{reasonText(row.reason, row.currentStepName)}</Chip>
          )}
        </span>
      </button>
      {row.amountPaise ? (
        <span className="text-[15px] font-semibold tabular-nums">{inr(row.amountPaise)}</span>
      ) : null}
    </li>
  );
}
