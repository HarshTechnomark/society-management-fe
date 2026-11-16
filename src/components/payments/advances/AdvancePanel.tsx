'use client';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import { ADVANCE_ENTRY_LABEL, plainError } from '../ops/format';

const SHOWN = 5;

/** A flat's advance balance and its history, newest first (spec 8.7 `GET /units/:unitId/advances`). */
export function AdvancePanel({ unitId }: { unitId: number }) {
  const load = useLoad(() => paymentsOpsService.advances(unitId, { limit: 50 }), unitId);
  const [all, setAll] = useState(false);
  if (load.error != null)
    return (
      <ErrorState
        error={plainError(load.error)}
        action={
          <Button size="sm" onClick={load.reload}>
            Try again
          </Button>
        }
      />
    );
  if (!load.data) return <div aria-busy="true" aria-label="Loading" className="skeleton h-16 w-full" />;
  const { balancePaise, entries } = load.data;
  const shown = all ? entries : entries.slice(0, SHOWN);
  return (
    <div>
      <p className="text-[14px]">
        Advance balance <strong className="text-[18px] tabular-nums">{inr(balancePaise)}</strong>
      </p>
      {entries.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted">No advance payments yet.</p>
      ) : (
        <ul aria-label="Advance history" className="mt-2 divide-y divide-[var(--line)] text-[14px]">
          {shown.map(e => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                {ADVANCE_ENTRY_LABEL[e.entryType] ?? e.entryType}
                <span className="block text-[12.5px] text-muted">
                  {e.narration ? `${e.narration}. ` : ''}
                  {shortDate(e.createdAt)}
                </span>
              </span>
              <span className="text-right tabular-nums">
                <span className={e.amountPaise < 0 ? 'text-[#8a1d17]' : 'text-[#14583a]'}>
                  {e.amountPaise > 0 ? '+' : ''}
                  {inr(e.amountPaise)}
                </span>
                <span className="block text-[12.5px] text-muted">Balance {inr(e.balanceAfterPaise)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {entries.length > SHOWN && !all && (
        <Button size="xs" variant="glass" className="mt-2" onClick={() => setAll(true)}>
          Show all {entries.length}
        </Button>
      )}
    </div>
  );
}
