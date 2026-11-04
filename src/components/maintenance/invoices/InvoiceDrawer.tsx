'use client';
import { useState, type ReactNode } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { StatementDrawer } from '@/components/maintenance/ledger/StatementDrawer';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { billingInvoicesService } from '@/services/billingInvoices.service';
import { approvalsPageHref } from '@/services/residents.service';
import type { InvoiceDetail, InvoiceLine, NoteSummary } from '@/types/billingInvoices';
import { CancelInvoiceDialog, WriteOffDialog } from './ActionDialogs';
import { InvoiceStatusChip, NoteStatusChip, OverdueChip } from './InvoiceBits';
import { CreditNoteDialog, DebitNoteDialog } from './NoteDialogs';
import {
  REASON_LABEL,
  RELATION_LABEL,
  TYPE_LABEL,
  billingInvoiceError,
  canAddNote,
  canCancel,
  canRemind,
  canWriteOff,
  plainError,
} from './format';

const B = PERMISSIONS.finance.billing;
const CHARGE_KINDS = new Set(['CHARGE', 'INTEREST', 'LATE_FEE']);
type Dialog = 'credit' | 'debit' | 'cancel' | 'writeoff' | null;

function Row({
  label,
  value,
  strong,
  minus,
}: {
  label: string;
  value: string;
  strong?: boolean;
  minus?: boolean;
}) {
  return (
    <>
      <dt className={strong ? 'font-bold' : undefined}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? 'font-bold' : ''}`}>
        {minus ? '- ' : ''}
        {value}
      </dd>
    </>
  );
}

/** The invoice drawer (spec 8.12, 11.3): header, lines with GST, notes, payments, balance and the actions the status allows. */
export function InvoiceDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const load = useLoad(() => billingInvoicesService.get(id), id);
  const toast = useToast();
  const canCreate = usePermission(B.create);
  const canEdit = usePermission(B.edit);
  const creditsOn = useFeature('billing.credit_notes');
  const debitsOn = useFeature('billing.debit_notes');
  const pdfOn = useFeature('billing.invoice_pdf_with_upi_qr');
  const statementOn = useFeature('billing.statement_of_account');
  const explainOn = useFeature('billing.explain_my_bill');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [statement, setStatement] = useState(false);
  const [cancelAsked, setCancelAsked] = useState(false);
  const [explained, setExplained] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inv = load.data;

  const changed = (message: string) => {
    setDialog(null);
    toast.show(message);
    load.reload();
    onChanged();
  };
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.show(billingInvoiceError(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const download = (key: string, get: () => Promise<{ url: string }>) =>
    run(key, async () => {
      const { url } = await get();
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
    });

  if (statement && inv)
    return (
      <StatementDrawer unitId={inv.unitId} unitLabel={inv.unitLabel} onClose={() => setStatement(false)} />
    );

  const sub = inv
    ? [
        inv.unitLabel,
        `${inv.billToName}${inv.billToRelation ? ` (${RELATION_LABEL[inv.billToRelation] ?? inv.billToRelation})` : ''}`,
        inv.periodLabel,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  const actions = inv && (
    <div className="flex flex-wrap gap-2">
      {pdfOn && (
        <Button
          size="sm"
          variant="glass"
          loading={busy === 'pdf'}
          disabled={inv.pdfStatus !== 'READY'}
          onClick={() => void download('pdf', () => billingInvoicesService.pdfUrl(inv.id))}
        >
          Download PDF
        </Button>
      )}
      {statementOn && (
        <Button size="sm" variant="glass" onClick={() => setStatement(true)}>
          Statement
        </Button>
      )}
      {canEdit && canRemind(inv) && (
        <Button
          size="sm"
          variant="glass"
          loading={busy === 'remind'}
          onClick={() =>
            void run('remind', async () => {
              await billingInvoicesService.remind(inv.id);
              toast.show('Reminder sent');
            })
          }
        >
          Send reminder
        </Button>
      )}
      {canCreate && creditsOn && canAddNote(inv) && (
        <Button size="sm" variant="glass" onClick={() => setDialog('credit')}>
          Credit note
        </Button>
      )}
      {canCreate && debitsOn && canAddNote(inv) && (
        <Button size="sm" variant="glass" onClick={() => setDialog('debit')}>
          Debit note
        </Button>
      )}
      {canEdit && creditsOn && canWriteOff(inv) && (
        <Button size="sm" variant="danger-soft" onClick={() => setDialog('writeoff')}>
          Write off
        </Button>
      )}
      {canEdit && creditsOn && canCancel(inv) && (
        <Button size="sm" variant="danger-soft" disabled={cancelAsked} onClick={() => setDialog('cancel')}>
          Cancel invoice
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={inv ? inv.invoiceNo : 'Invoice'}
        description={sub}
        size={640}
        footer={actions}
      >
        {load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : !inv ? (
          <div aria-busy="true" aria-label="Loading">
            <div className="skeleton mb-2 h-8 w-1/2" />
            <div className="skeleton mb-2 h-32 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        ) : (
          <Body
            inv={inv}
            explainOn={explainOn}
            explained={explained}
            onExplain={l => setExplained(explained === l ? null : l)}
            cancelAsked={cancelAsked}
            busy={busy}
            onNotePdf={n => void download(`note${n.id}`, () => billingInvoicesService.notePdfUrl(n.id))}
            pdfOn={pdfOn}
          />
        )}
      </Drawer>
      {inv && dialog === 'credit' && (
        <CreditNoteDialog
          invoice={inv}
          onClose={() => setDialog(null)}
          onDone={n =>
            changed(
              n.status === 'PENDING_APPROVAL'
                ? 'Credit note sent for approval'
                : `Credit note ${n.noteNo ?? ''} issued`.replace('  ', ' '),
            )
          }
        />
      )}
      {inv && dialog === 'debit' && (
        <DebitNoteDialog
          invoice={inv}
          onClose={() => setDialog(null)}
          onDone={n => changed(`Debit note ${n.noteNo ?? ''} issued`.replace('  ', ' '))}
        />
      )}
      {inv && dialog === 'writeoff' && (
        <WriteOffDialog
          invoice={inv}
          onClose={() => setDialog(null)}
          onDone={() => changed('Write-off sent for approval')}
        />
      )}
      {inv && dialog === 'cancel' && (
        <CancelInvoiceDialog
          invoice={inv}
          onClose={() => setDialog(null)}
          onDone={r => {
            if (r.outcome === 'PENDING') setCancelAsked(true);
            changed(r.outcome === 'PENDING' ? 'Cancellation sent for approval' : 'Invoice cancelled');
          }}
        />
      )}
    </>
  );
}

function Body({
  inv,
  explainOn,
  explained,
  onExplain,
  cancelAsked,
  busy,
  onNotePdf,
  pdfOn,
}: {
  inv: InvoiceDetail;
  explainOn: boolean;
  explained: number | null;
  onExplain: (lineId: number) => void;
  cancelAsked: boolean;
  busy: string | null;
  onNotePdf: (n: NoteSummary) => void;
  pdfOn: boolean;
}) {
  const charges = inv.lines.filter(l => CHARGE_KINDS.has(l.lineKind));
  const pending = inv.notes.filter(n => n.status === 'PENDING_APPROVAL');
  const waiting = cancelAsked || pending.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InvoiceStatusChip status={inv.status} />
        {inv.isOverdue && inv.status !== 'CANCELLED' && <OverdueChip />}
        {inv.isDisputed && <span className="text-[13px] font-semibold">Disputed</span>}
        <span className="text-[13.5px] text-muted">
          Due {shortDate(inv.dueDate)} · Billed {shortDate(inv.invoiceDate)} ·{' '}
          {TYPE_LABEL[inv.invoiceType] ?? inv.invoiceType}
        </span>
      </div>
      {waiting && (
        <Alert tone="warn">
          Waiting for approval.{' '}
          <a className="font-semibold underline" href={approvalsPageHref()}>
            Open the approvals page
          </a>
        </Alert>
      )}
      {inv.description && <p className="text-[14px]">{inv.description}</p>}

      <section aria-label="Lines">
        <h3 className="mb-1 text-[14px] font-bold">Charges</h3>
        <ul className="divide-y divide-[var(--line)]">
          {charges.map(l => (
            <LineRow
              key={l.id}
              line={l}
              explain={explainOn && !!l.explanation}
              open={explained === l.id}
              onToggle={() => onExplain(l.id)}
            />
          ))}
        </ul>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-[var(--line)] pt-2 text-[14px]">
          <Row label="Subtotal" value={inr(inv.subtotalPaise)} />
          {inv.gstApplied && (
            <>
              <Row label="CGST" value={inr(inv.cgstPaise)} />
              <Row label="SGST" value={inr(inv.sgstPaise)} />
            </>
          )}
          {inv.roundOffPaise !== 0 && <Row label="Round off" value={inr(inv.roundOffPaise)} />}
          <Row label="Total" value={inr(inv.totalPaise)} strong />
          {inv.debitedPaise > 0 && <Row label="Debit notes" value={inr(inv.debitedPaise)} />}
          {inv.creditedPaise > 0 && <Row label="Credit notes" value={inr(inv.creditedPaise)} minus />}
          {inv.writtenOffPaise > 0 && <Row label="Of which written off" value={inr(inv.writtenOffPaise)} />}
          <Row label="Paid" value={inr(inv.paidPaise)} minus />
          <Row label="Balance due" value={inr(inv.outstandingPaise)} strong />
        </dl>
        {inv.gstApplied && inv.societyGstin && (
          <p className="mt-1 text-[12.5px] text-muted">
            GSTIN {inv.societyGstin} · taxable value {inr(inv.taxableValuePaise)}
          </p>
        )}
        {inv.previousDuesPaise > 0 && (
          <p className="mt-1 text-[12.5px] text-muted">
            Earlier dues of {inr(inv.previousDuesPaise)} are shown on the printed bill.
          </p>
        )}
      </section>

      <section aria-label="Payments">
        <h3 className="mb-1 text-[14px] font-bold">Payments</h3>
        {inv.payments.length === 0 ? (
          <p className="text-[13.5px] text-muted">No payment has been recorded against this bill.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {inv.payments.map(p => (
              <li key={p.key} className="flex justify-between gap-3 py-2 text-[14px]">
                <span>
                  {p.label}
                  <span className="block text-[12.5px] text-muted">
                    {shortDate(p.date)}
                    {p.mode && ` · ${p.mode}`}
                  </span>
                </span>
                <span className="tabular-nums">{inr(p.amountPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Notes">
        <h3 className="mb-1 text-[14px] font-bold">Credit and debit notes</h3>
        {inv.notes.length === 0 ? (
          <p className="text-[13.5px] text-muted">No notes on this bill.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {inv.notes.map(n => (
              <li
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-[14px]"
                data-testid="note-row"
              >
                <span>
                  <span className="font-semibold">
                    {n.noteNo ?? (n.noteType === 'CREDIT' ? 'Credit note' : 'Debit note')}
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {n.noteType === 'CREDIT' ? 'Credit' : 'Debit'} ·{' '}
                    {REASON_LABEL[n.reasonCode] ?? n.reasonCode}
                    {n.noteDate && ` · ${shortDate(n.noteDate)}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <NoteStatusChip status={n.status} />
                  <span className="tabular-nums">{inr(n.totalPaise)}</span>
                  {pdfOn && n.status === 'ISSUED' && n.pdfStatus === 'READY' && (
                    <Button
                      size="xs"
                      variant="ghost"
                      loading={busy === `note${n.id}`}
                      aria-label={`Download PDF of ${n.noteNo}`}
                      onClick={() => onNotePdf(n)}
                    >
                      PDF
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Bill to">
        <h3 className="mb-1 text-[14px] font-bold">Bill to</h3>
        <p className="text-[14px]">
          {inv.billToName}
          {inv.billToRelation && ` (${RELATION_LABEL[inv.billToRelation] ?? inv.billToRelation})`} ·{' '}
          {inv.unitLabel}
        </p>
        {inv.pdfStatus !== 'READY' && (
          <p className="text-[12.5px] text-muted">
            The PDF of this bill is {inv.pdfStatus === 'FAILED' ? 'delayed' : 'being prepared'}.
          </p>
        )}
      </section>
    </div>
  );
}

function LineRow({
  line,
  explain,
  open,
  onToggle,
}: {
  line: InvoiceLine;
  explain: boolean;
  open: boolean;
  onToggle: () => void;
}): ReactNode {
  const inner = (
    <>
      <span>{line.description}</span>
      <span className="tabular-nums">{inr(line.amountPaise)}</span>
    </>
  );
  return (
    <li className="py-2 text-[14px]" data-testid="invoice-line">
      {explain ? (
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full justify-between gap-3 text-left"
          onClick={onToggle}
        >
          {inner}
        </button>
      ) : (
        <div className="flex justify-between gap-3">{inner}</div>
      )}
      {explain && open && <p className="mt-1 text-[12.5px] text-muted">{line.explanation}</p>}
    </li>
  );
}
