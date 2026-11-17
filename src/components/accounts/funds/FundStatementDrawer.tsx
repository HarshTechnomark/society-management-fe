'use client';
import { useState } from 'react';
import { accountsError, fyStart } from '@/components/accounts/format';
import { todayIso } from '@/components/payments/ops/format';
import { Alert } from '@/components/ui/Alert';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { accountsFundsService } from '@/services/accountsFunds.service';
import type { Fund } from '@/types/accountsFunds';

const KIND_LABEL = {
  CONTRIBUTION: 'Collected',
  EXPENSE: 'Spent',
  TRANSFER_IN: 'Moved in from another fund',
  TRANSFER_OUT: 'Moved to another fund',
} as const;

/** Statement of one fund: opening balance, every movement with its voucher, closing balance. */
export function FundStatementDrawer({ fund, onClose }: { fund: Fund; onClose: () => void }) {
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(todayIso());
  const valid = from <= to && (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 <= 366;
  const st = useLoad(() => accountsFundsService.statement(fund.id, from, to), `${from}|${to}`);
  return (
    <Drawer open onClose={onClose} title={`${fund.name} statement`} size={640}>
      <div className="grid grid-cols-2 gap-x-3">
        <Input label="From" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} max={todayIso()} onChange={e => setTo(e.target.value)} />
      </div>
      {!valid && <Alert tone="warn">Choose a period of at most 366 days, with From before To.</Alert>}
      {valid && st.error != null && <Alert tone="bad">{accountsError(st.error)}</Alert>}
      {valid && st.loading && <div className="skeleton h-32 w-full" aria-busy="true" aria-label="Loading" />}
      {valid && st.data && (
        <>
          <p className="mb-3 text-[14px]">
            Opening <strong className="tabular-nums">{inr(st.data.openingPaise)}</strong>, closing{' '}
            <strong className="tabular-nums">{inr(st.data.closingPaise)}</strong>
          </p>
          {st.data.rows.length === 0 ? (
            <p className="text-[14px] text-muted">No movements in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left text-[13.5px]">
                <caption className="sr-only">Fund statement</caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-[12px] uppercase tracking-wide text-muted">
                    {['Date', 'Type', 'Voucher', 'In', 'Out', 'Balance'].map(h => (
                      <th key={h} scope="col" className="px-2 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {st.data.rows.map((r, i) => (
                    <tr
                      key={`${r.voucherNo}-${i}`}
                      className="border-b border-[var(--line)] last:border-0"
                      data-testid="statement-row"
                    >
                      <td className="px-2 py-2.5">{shortDate(r.date)}</td>
                      <td className="px-2 py-2.5" data-testid="statement-kind">
                        {r.kind ? KIND_LABEL[r.kind] : ''}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="font-semibold">{r.voucherNo}</div>
                        <div className="text-[12.5px] text-muted">{r.narration}</div>
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">{r.inPaise ? inr(r.inPaise) : ''}</td>
                      <td className="px-2 py-2.5 tabular-nums">{r.outPaise ? inr(r.outPaise) : ''}</td>
                      <td className="px-2 py-2.5 font-semibold tabular-nums">{inr(r.runningPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
