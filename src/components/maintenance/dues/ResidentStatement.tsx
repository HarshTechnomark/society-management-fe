'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { billingResidentService } from '@/services/billingResident.service';
import { ENTRY_LABEL, balanceText, daysBetween, financialYearStart, isoDate } from '../ledger/format';
import { plainError } from './format';

const MAX_DAYS = 1100;

/** Statement of my flat (spec 11.10, owners only): date range, running balance and sharing. */
export function ResidentStatement({ unitId }: { unitId: number }) {
  return (
    <Gate view={PERMISSIONS.resident.dues.view} feature="billing.statement_of_account" title="the statement">
      <Inner unitId={unitId} />
    </Gate>
  );
}

function Inner({ unitId }: { unitId: number }) {
  const [from, setFrom] = useState(financialYearStart());
  const [to, setTo] = useState(isoDate(new Date()));
  const [applied, setApplied] = useState({ from, to });
  const [problem, setProblem] = useState<string | null>(null);
  const load = useLoad(
    () => billingResidentService.statement(unitId, applied.from, applied.to),
    `${unitId}|${applied.from}|${applied.to}`,
  );
  const st = load.data;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const apply = () => {
    if (!from || !to) return setProblem('Choose both dates.');
    if (from > to) return setProblem('The start date must not be after the end date.');
    if (daysBetween(from, to) > MAX_DAYS) return setProblem('The period can be at most 1,100 days.');
    setProblem(null);
    setApplied({ from, to });
  };
  const share = async () => {
    if (!st) return;
    try {
      await navigator.share({
        title: `Statement of ${st.unit.label}`,
        text: `Statement of ${st.unit.label}, ${shortDate(st.from)} to ${shortDate(st.to)}. Closing balance: ${balanceText(st.closingBalancePaise)}.`,
      });
    } catch {
      /* the person closed the share sheet */
    }
  };

  return (
    <Page>
      <p className="mb-3 text-[14px]">
        <Link href="/resident/bills" className="font-semibold underline">
          All my bills
        </Link>
      </p>
      <PageHead
        title={st ? `Statement of ${st.unit.label}` : 'Statement'}
        sub="Every bill, payment and credit of your flat."
      />
      <Card>
        <div className="mb-3 grid grid-cols-1 gap-x-3 min-[480px]:grid-cols-2">
          <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        {problem && <Alert tone="bad">{problem}</Alert>}
        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={apply}>
            Show statement
          </Button>
          {canShare && (
            <Button size="sm" variant="glass" disabled={!st} onClick={share}>
              Share
            </Button>
          )}
        </div>
        {load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
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
            {st.entries.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-muted">No entries in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <caption className="sr-only">Statement of account</caption>
                  <thead className="text-[12px] uppercase text-muted">
                    <tr>
                      <th className="p-1.5">Date</th>
                      <th className="p-1.5">Details</th>
                      <th className="p-1.5 text-right">Debit</th>
                      <th className="p-1.5 text-right">Credit</th>
                      <th className="p-1.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.entries.map(e => (
                      <tr key={e.id} className="border-t border-[var(--line)] align-top">
                        <td className="whitespace-nowrap p-1.5">{shortDate(e.entryDate)}</td>
                        <td className="p-1.5">
                          <span className="font-semibold">{ENTRY_LABEL[e.entryType] ?? e.entryType}</span>
                          <span className="block text-muted">{e.narration}</span>
                        </td>
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
      </Card>
    </Page>
  );
}
