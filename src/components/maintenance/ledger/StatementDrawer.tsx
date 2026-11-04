'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { ledgerService } from '@/services/ledger.service';
import { ApiError } from '@/lib/apiClient';
import {
  ENTRY_LABEL,
  balanceText,
  daysBetween,
  downloadBlob,
  financialYearStart,
  isoDate,
  ledgerError,
} from './format';

const B = PERMISSIONS.finance.billing;
const MAX_DAYS = 1100;

/** Statement of account of one flat (spec 11.7): period, running balance, opening and closing balance, CSV. */
export function StatementDrawer({
  unitId,
  unitLabel,
  onClose,
}: {
  unitId: number;
  unitLabel: string;
  onClose: () => void;
}) {
  const canExport = usePermission(B.export);
  const toast = useToast();
  const [from, setFrom] = useState(financialYearStart());
  const [to, setTo] = useState(isoDate(new Date()));
  const [applied, setApplied] = useState({ from, to });
  const [problem, setProblem] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const load = useLoad(
    () => ledgerService.statement(unitId, applied.from, applied.to),
    `${unitId}|${applied.from}|${applied.to}`,
  );

  const apply = () => {
    if (!from || !to) return setProblem('Choose both dates.');
    if (from > to) return setProblem('The start date must not be after the end date.');
    if (daysBetween(from, to) > MAX_DAYS) return setProblem('The period can be at most 1,100 days.');
    setProblem(null);
    setApplied({ from, to });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(
        await ledgerService.statementCsv(unitId, applied.from, applied.to),
        `statement-${unitLabel}-${applied.from}-${applied.to}.csv`,
      );
      toast.show('Statement exported');
    } catch (e) {
      toast.show(ledgerError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const st = load.data;
  return (
    <Drawer open onClose={onClose} title={`Statement of account, ${unitLabel}`} size={640}>
      <div className="mb-3 grid grid-cols-1 gap-x-3 min-[480px]:grid-cols-2">
        <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem}
        </Alert>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={apply}>
          Show statement
        </Button>
        {canExport && (
          <Button size="sm" variant="glass" loading={exporting} disabled={!st} onClick={exportCsv}>
            Export CSV
          </Button>
        )}
      </div>

      {load.error ? (
        <div role="alert">
          <Alert tone="bad">{ledgerError(load.error)}</Alert>
          {load.error instanceof ApiError && load.error.requestId && (
            <p className="mt-1 text-[12px] text-muted">
              Reference: <code>{load.error.requestId}</code>
            </p>
          )}
          <Button size="sm" className="mt-3" onClick={load.reload}>
            Try again
          </Button>
        </div>
      ) : load.loading || !st ? (
        <div aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-3 h-12 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : (
        <>
          <dl className="mb-3 grid grid-cols-2 gap-3 text-[14px]">
            <div className="rounded-[14px] bg-white/60 p-3">
              <dt className="text-muted">Opening balance</dt>
              <dd className="font-bold">{balanceText(st.openingBalancePaise)}</dd>
            </div>
            <div className="rounded-[14px] bg-white/60 p-3">
              <dt className="text-muted">Closing balance</dt>
              <dd className="font-bold">{balanceText(st.closingBalancePaise)}</dd>
            </div>
          </dl>
          <p className="mb-2 text-[12.5px] text-muted">
            {shortDate(st.from)} to {shortDate(st.to)}
          </p>
          {st.entries.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-muted">No entries in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <caption className="sr-only">Statement of account</caption>
                <thead className="text-[12px] uppercase text-muted">
                  <tr>
                    <th className="p-1.5">Date</th>
                    <th className="p-1.5">Document</th>
                    <th className="p-1.5">Narration</th>
                    <th className="p-1.5 text-right">Debit</th>
                    <th className="p-1.5 text-right">Credit</th>
                    <th className="p-1.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {st.entries.map(e => (
                    <tr key={e.id} className="border-t border-[var(--line)] align-top">
                      <td className="whitespace-nowrap p-1.5">{shortDate(e.entryDate)}</td>
                      <td className="p-1.5">{ENTRY_LABEL[e.entryType] ?? e.entryType}</td>
                      <td className="p-1.5">{e.narration}</td>
                      <td className="p-1.5 text-right">{e.debitPaise ? inr(e.debitPaise) : ''}</td>
                      <td className="p-1.5 text-right">{e.creditPaise ? inr(e.creditPaise) : ''}</td>
                      <td className="whitespace-nowrap p-1.5 text-right font-semibold">
                        {inr(Math.abs(e.balancePaise))}
                        {e.balancePaise > 0 ? ' Dr' : e.balancePaise < 0 ? ' Cr' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[12px] text-muted">
            Dr means the flat owes; Cr means an advance or credit.
          </p>
        </>
      )}
    </Drawer>
  );
}
