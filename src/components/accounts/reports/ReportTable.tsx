'use client';
import Link from 'next/link';
import type { ReportCell, ReportView } from '@/types/accountsReports';

function Cell({ c, onLedger }: { c: ReportCell; onLedger: (id: number, code: string) => void }) {
  if (c.journalId)
    return (
      <Link
        className="font-semibold underline underline-offset-2"
        href={`/admin/accounts/journals?open=${c.journalId}`}
      >
        {c.text}
      </Link>
    );
  if (c.ledgerAccountId)
    return (
      <button
        type="button"
        className="text-left underline-offset-2 hover:underline"
        onClick={() => onLedger(c.ledgerAccountId!, c.ledgerCode ?? '')}
        aria-label={`Open the ledger of ${c.text}`}
      >
        {c.text}
      </button>
    );
  return <>{c.text}</>;
}

/** The tables of one report with totals; account names and voucher numbers are drill-down links. */
export function ReportTable({
  view,
  onLedger,
}: {
  view: ReportView;
  onLedger: (id: number, code: string) => void;
}) {
  return (
    <div className="grid gap-5" data-testid="report-view">
      {view.blocks.map((b, i) => (
        <div key={i} className="overflow-x-auto">
          {b.title && <h3 className="mb-1 text-[15px] font-bold">{b.title}</h3>}
          <table className="w-full min-w-[420px] border-collapse text-[14px]">
            <caption className="sr-only">{b.title ?? view.heading}</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[12.5px] text-muted">
                {b.columns.map(c => (
                  <th
                    key={c.label}
                    scope="col"
                    className={`py-2 pr-3 font-semibold ${c.right ? 'text-right' : ''}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri} className="border-b border-[var(--line)]">
                  {r.map((c, ci) => (
                    <td key={ci} className={`py-2 pr-3 ${c.right ? 'text-right tabular-nums' : ''}`}>
                      <Cell c={c} onLedger={onLedger} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {b.total && (
              <tfoot>
                <tr className="font-bold">
                  {b.total.map((c, ci) => (
                    <td key={ci} className={`py-2 pr-3 ${c.right ? 'text-right tabular-nums' : ''}`}>
                      {c.text}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ))}
      {view.summary.length > 0 && (
        <dl className="grid gap-1 text-[14px]">
          {view.summary.map(s => (
            <div key={s.label} className="flex justify-between gap-3">
              <dt className="text-muted">{s.label}</dt>
              <dd className="font-bold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
