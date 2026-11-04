'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { billingResidentService } from '@/services/billingResident.service';
import type { InvoiceLine, MyInvoice } from '@/types/billingDues';
import { LINE_KIND_LABEL, billingDuesError, inputLabel, invoiceStatus, payHref, plainError } from './format';

/** One bill (spec 11.10): lines with tap-to-explain, tax, previous dues, PDF and Pay. */
export function ResidentBillDetail({ id }: { id: number }) {
  return (
    <Gate view={PERMISSIONS.resident.dues.view} title="your bills">
      <Inner id={id} />
    </Gate>
  );
}

function Inner({ id }: { id: number }) {
  const load = useLoad(() => billingResidentService.invoice(id), id);
  return (
    <Page>
      <p className="mb-3 text-[14px]">
        <Link href="/resident/bills" className="font-semibold underline">
          All my bills
        </Link>
      </p>
      {load.error != null ? (
        <Card>
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : load.loading || !load.data ? (
        <div aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-3 h-20 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : (
        <Bill inv={load.data} />
      )}
    </Page>
  );
}

function Bill({ inv }: { inv: MyInvoice }) {
  const toast = useToast();
  const explainOn = useFeature('billing.explain_my_bill');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProblem, setPdfProblem] = useState<string | null>(null);
  const st = invoiceStatus(inv);
  const explainable = explainOn && inv.lines.some(l => l.computation);
  const explainable_ids = inv.lines.filter(l => l.computation).map(l => l.id);
  const allOpen = explainable_ids.length > 0 && explainable_ids.every(i => open.has(i));
  const toggle = (lineId: number) =>
    setOpen(s => {
      const n = new Set(s);
      if (n.has(lineId)) n.delete(lineId);
      else n.add(lineId);
      return n;
    });

  const downloadPdf = async () => {
    setPdfBusy(true);
    setPdfProblem(null);
    try {
      const r = await billingResidentService.pdfUrl(inv.id);
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      const m = billingDuesError(e);
      setPdfProblem(m);
      toast.show(m, 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const canPay = inv.outstandingPaise > 0 && inv.status !== 'CANCELLED';
  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-bold">{inv.periodLabel || inv.invoiceNo}</h1>
            <p className="text-[13.5px] text-muted">
              {inv.invoiceNo} · {inv.unitLabel}
            </p>
          </div>
          <Chip tone={st.tone}>{st.label}</Chip>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
          <div>
            <dt className="text-muted">Bill date</dt>
            <dd className="font-semibold">{shortDate(inv.invoiceDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">Due date</dt>
            <dd className="font-semibold">{shortDate(inv.dueDate)}</dd>
          </div>
        </dl>
        {inv.isDisputed && (
          <Alert tone="warn" className="mt-3">
            This bill is under dispute.
          </Alert>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {canPay && (
            <Link href={payHref(inv.unitId, inv.id)} className={buttonClasses('primary', 'md')}>
              Pay {inr(inv.outstandingPaise)}
            </Link>
          )}
          <Button
            variant="glass"
            loading={pdfBusy}
            onClick={downloadPdf}
            disabled={inv.pdfStatus === 'PENDING'}
          >
            Download PDF
          </Button>
          {explainable && (
            <Button
              variant="glass"
              aria-pressed={allOpen}
              onClick={() => setOpen(allOpen ? new Set() : new Set(explainable_ids))}
            >
              {allOpen ? 'Hide explanation' : 'Explain this bill'}
            </Button>
          )}
        </div>
        {inv.pdfStatus === 'PENDING' && (
          <p className="mt-2 text-[13px] text-muted">
            The PDF is being prepared. Check back in a few minutes.
          </p>
        )}
        {inv.pdfStatus === 'FAILED' && (
          <p className="mt-2 text-[13px] text-muted">The PDF could not be made yet. Try again later.</p>
        )}
        {pdfProblem && (
          <Alert tone="bad" className="mt-3">
            {pdfProblem}
          </Alert>
        )}
      </Card>

      <Card title="What you are charged" className="mb-4">
        <ul aria-label="Bill lines" className="divide-y divide-[var(--line)]">
          {inv.lines.map(l => (
            <LineRow
              key={l.id}
              line={l}
              canExplain={explainOn}
              expanded={open.has(l.id)}
              onToggle={() => toggle(l.id)}
            />
          ))}
        </ul>
      </Card>

      <Card title="Summary">
        <dl className="text-[14.5px]">
          <Row label="Subtotal" value={inr(inv.subtotalPaise)} />
          {inv.gstApplied && (
            <>
              <Row label="CGST" value={inr(inv.cgstPaise)} />
              <Row label="SGST" value={inr(inv.sgstPaise)} />
            </>
          )}
          {inv.roundOffPaise !== 0 && <Row label="Round off" value={inr(inv.roundOffPaise)} />}
          {inv.debitedPaise > 0 && <Row label="Debit notes" value={inr(inv.debitedPaise)} />}
          {inv.creditedPaise > 0 && <Row label="Credit notes" value={`-${inr(inv.creditedPaise)}`} />}
          <Row label="Total of this bill" value={inr(inv.totalPaise)} strong />
          <Row label="Paid" value={inr(inv.paidPaise)} />
          <Row label="Still to pay on this bill" value={inr(inv.outstandingPaise)} strong />
          {inv.previousDuesPaise > 0 && (
            <Row label="Earlier dues of this flat (not in this bill)" value={inr(inv.previousDuesPaise)} />
          )}
        </dl>
        {inv.gstApplied && inv.societyGstin && (
          <p className="mt-2 text-[12.5px] text-muted">Society GSTIN {inv.societyGstin}</p>
        )}
      </Card>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--line)] py-2 last:border-0">
      <dt className={strong ? 'font-bold' : 'text-muted'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold' : 'font-semibold'}`}>{value}</dd>
    </div>
  );
}

function LineRow({
  line: l,
  canExplain,
  expanded,
  onToggle,
}: {
  line: InvoiceLine;
  canExplain: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = canExplain ? l.computation : null;
  const panel = `explain-${l.id}`;
  return (
    <li className="py-3" data-testid="bill-line">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px]">{l.description || LINE_KIND_LABEL[l.lineKind] || l.lineKind}</p>
          {c && (
            <button
              type="button"
              className="mt-1 text-[13px] font-semibold underline"
              aria-expanded={expanded}
              aria-controls={panel}
              aria-label={`${expanded ? 'Hide' : 'Show'} how ${l.description} was worked out`}
              onClick={onToggle}
            >
              {expanded ? 'Hide how' : 'How is this worked out?'}
            </button>
          )}
        </div>
        <strong className="shrink-0 tabular-nums">{inr(l.amountPaise)}</strong>
      </div>
      {c && expanded && (
        <div id={panel} className="mt-2 rounded-[14px] bg-white/60 p-3 text-[13.5px]">
          {c.text && <p className="font-semibold">{c.text}</p>}
          {c.formula && (
            <p className="mt-1">
              Formula: <code>{c.formula}</code>
            </p>
          )}
          {c.inputs.length > 0 && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {c.inputs.map(i => (
                <div key={i.key} className="contents">
                  <dt className="text-muted">{inputLabel(i.key)}</dt>
                  <dd>{i.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {c.ruleVersionId !== null && (
            <p className="mt-2 text-[12.5px] text-muted">Rate rule version {c.ruleVersionId}</p>
          )}
        </div>
      )}
    </li>
  );
}
