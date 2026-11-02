import type { ReactNode } from 'react';
import { inr, shortDate } from '@/lib/money';
import type { InvoiceDetail } from '@/types/platformBilling';
import { InvoiceStatusChip, PaymentStatusChip, methodText, periodText } from './format';

function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 text-[14px] ${strong ? 'font-bold' : ''}`}>
      <dt className={strong ? '' : 'text-muted'}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

/** Invoice or credit note content shared by the platform drawer and the society sheet (spec 11.1 and 11.3). */
export function InvoiceBody({ inv, platform = false }: { inv: InvoiceDetail; platform?: boolean }) {
  const note = inv.documentType === 'CREDIT_NOTE';
  const intra = inv.taxType === 'INTRA_STATE';
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <InvoiceStatusChip status={inv.status} />
        <span className="text-[13px] text-muted">
          {note ? 'Credit note' : 'Invoice'} {inv.invoiceNo ?? '(draft, no number yet)'}
        </span>
      </div>
      <dl>
        <Row label="Issued" value={shortDate(inv.issueDate)} />
        {!note && <Row label="Due" value={shortDate(inv.dueDate)} />}
        {platform && inv.suspendOn && <Row label="Suspends on" value={shortDate(inv.suspendOn)} />}
        <Row label="Period" value={periodText(inv.periodStart, inv.periodEnd)} />
      </dl>

      <section aria-label="Lines">
        <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Lines</h3>
        <ul className="divide-y divide-[var(--line)]">
          {inv.lines.map(l => (
            <li key={l.lineNo} className="flex justify-between gap-4 py-2 text-[14px]">
              <span className="min-w-0">{l.description}</span>
              <span className="shrink-0 font-semibold tabular-nums">{inr(l.amountPaise)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 border-t border-[var(--line)] pt-2">
          <Row label="Taxable value" value={inr(inv.subtotalPaise)} />
          {intra ? (
            <>
              <Row label={`CGST ${half(inv.gstRatePct)}%`} value={inr(inv.cgstPaise)} />
              <Row label={`SGST ${half(inv.gstRatePct)}%`} value={inr(inv.sgstPaise)} />
            </>
          ) : (
            <Row label={`IGST ${Number(inv.gstRatePct)}%`} value={inr(inv.igstPaise)} />
          )}
          <Row label="Total" value={inr(inv.totalPaise)} strong />
        </dl>
      </section>

      {!note && (
        <section aria-label="Settlement">
          <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Settlement</h3>
          <dl>
            {inv.creditAppliedPaise > 0 && (
              <Row label="Credit applied" value={`-${inr(inv.creditAppliedPaise)}`} />
            )}
            {inv.paidPaise > 0 && <Row label="Paid" value={`-${inr(inv.paidPaise)}`} />}
            {inv.tdsPaise > 0 && <Row label="TDS" value={`-${inr(inv.tdsPaise)}`} />}
            {inv.creditNotedPaise > 0 && <Row label="Credit notes" value={`-${inr(inv.creditNotedPaise)}`} />}
            {inv.writtenOffPaise > 0 && <Row label="Written off" value={`-${inr(inv.writtenOffPaise)}`} />}
            {inv.excessToCreditPaise > 0 && (
              <Row label="Excess moved to credit" value={inr(inv.excessToCreditPaise)} />
            )}
            <Row label="Amount due" value={inr(inv.amountDuePaise)} strong />
          </dl>
        </section>
      )}

      <section aria-label="Tax details">
        <dl>
          <Row label="SAC" value={inv.sacCode} />
          <Row
            label="Tax type"
            value={intra ? 'CGST and SGST (same state as supplier)' : 'IGST (inter-state supply)'}
          />
          <Row label="Supplier GSTIN" value={inv.supplier.gstin ?? '-'} />
          <Row
            label="Billed to"
            value={
              <>
                {inv.buyer.name}
                {inv.buyer.gstin ? `, GSTIN ${inv.buyer.gstin}` : ''}
              </>
            }
          />
        </dl>
      </section>

      {inv.payments.length > 0 && (
        <section aria-label="Payments">
          <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Payments</h3>
          <ul className="divide-y divide-[var(--line)]">
            {inv.payments.map(p => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[14px]">
                <span>
                  {methodText(p.method)} {p.bankReference ? `· ${p.bankReference}` : ''}
                  <span className="ml-2 text-muted">{shortDate(p.receivedOn ?? p.capturedAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <PaymentStatusChip status={p.status} />
                  <b className="tabular-nums">{inr(p.amountPaise)}</b>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inv.creditNotes.length > 0 && (
        <section aria-label="Credit notes">
          <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Credit notes</h3>
          <ul className="divide-y divide-[var(--line)]">
            {inv.creditNotes.map(c => (
              <li key={c.id} className="flex justify-between gap-2 py-2 text-[14px]">
                <span>
                  {c.invoiceNo ?? 'Draft'} <InvoiceStatusChip status={c.status} />
                </span>
                <b className="tabular-nums">{inr(c.totalPaise)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {platform && inv.writeOff?.reason && (
        <p className="rounded-[14px] bg-[#f6e6c9] px-3.5 py-2.5 text-[13.5px] text-[#6f4200]">
          Write-off requested{inv.writeOff.requestedBy ? ` by ${inv.writeOff.requestedBy}` : ''}:{' '}
          {inv.writeOff.reason}. Waiting for another approver.
        </p>
      )}

      {platform && inv.dunningEvents && inv.dunningEvents.length > 0 && (
        <section aria-label="Dunning timeline">
          <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
            Dunning timeline
          </h3>
          <ol className="flex flex-col gap-1.5 border-l-2 border-[var(--line)] pl-3">
            {inv.dunningEvents.map((d, i) => (
              <li key={d.id ?? i} className="text-[13.5px]">
                <b>{d.eventType.replace(/_/g, ' ').toLowerCase()}</b>
                <span className="ml-2 text-muted">{shortDate(d.createdAt)}</span>
                {(d.note || d.detail) && <div className="text-muted">{d.note ?? d.detail}</div>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function half(rate: string) {
  const n = Number(rate) / 2;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
