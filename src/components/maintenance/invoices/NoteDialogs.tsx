'use client';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { billingInvoicesService } from '@/services/billingInvoices.service';
import type {
  CreditReason,
  DebitReason,
  InvoiceDetail,
  InvoiceLine,
  NoteSummary,
} from '@/types/billingInvoices';
import { LinesEditor, newLine, parseLines, type LineDraft } from './LinesEditor';
import {
  AUTO_APPROVE_LIMIT_PAISE,
  CREDIT_REASONS,
  DEBIT_REASONS,
  billingInvoiceError,
  creditLimits,
  estimateCreditTax,
  rupeesToPaise,
} from './format';

const CREDITABLE = new Set(['CHARGE', 'INTEREST', 'LATE_FEE']);

interface Creditable {
  line: InvoiceLine;
  source: string;
  max: number;
}
/**
 * Lines that can still be credited: charge, interest and late fee lines of the bill and of its issued debit notes
 * (BR-11-41). The detail lists notes without lines, so the debit notes come from `GET /billing/notes/:id`; their lines
 * carry no credited amount, so the server's `CREDIT_EXCEEDS_LINE` answer gives the real maximum.
 */
export function creditableLines(d: InvoiceDetail, debitNotes: NoteSummary[] = []): Creditable[] {
  const own = d.lines.map(line => ({ line, source: d.invoiceNo }));
  const debit = debitNotes
    .filter(n => n.noteType === 'DEBIT' && n.status === 'ISSUED')
    .flatMap(n => n.lines.map(line => ({ line, source: n.noteNo ?? 'Debit note' })));
  return [...own, ...debit]
    .filter(x => CREDITABLE.has(x.line.lineKind))
    .map(x => ({ ...x, max: x.line.amountPaise - x.line.creditedPaise }))
    .filter(x => x.max > 0);
}

/** Credit note form (spec 8.15, 11.4): reason, remarks, creditable lines with their maximum, tax estimate and total. */
export function CreditNoteDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: InvoiceDetail;
  onClose: () => void;
  onDone: (note: NoteSummary) => void;
}) {
  const hasDebit = invoice.notes.some(n => n.noteType === 'DEBIT' && n.status === 'ISSUED');
  const debitNotes = useLoad(() => billingInvoicesService.debitNotesWithLines(invoice), invoice.id);
  const lines = useMemo(() => creditableLines(invoice, debitNotes.data ?? []), [invoice, debitNotes.data]);
  const [reason, setReason] = useState<CreditReason>('BILLING_ERROR');
  const [remarks, setRemarks] = useState('');
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [limits, setLimits] = useState<Record<number, number>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entered = lines
    .map(l => ({ l, paise: rupeesToPaise(amounts[l.line.id] ?? '') }))
    .filter(x => x.paise !== null && x.paise > 0) as { l: Creditable; paise: number }[];
  const subtotal = entered.reduce((a, x) => a + x.paise, 0);
  const taxable = entered.filter(x => x.l.line.isTaxable).reduce((a, x) => a + x.paise, 0);
  const tax = estimateCreditTax(invoice, taxable);
  const total = subtotal + tax;

  const submit = async () => {
    const text = remarks.trim();
    const over = entered.find(x => x.paise > (limits[x.l.line.id] ?? x.l.max));
    const bad = lines.find(l => {
      const t = (amounts[l.line.id] ?? '').trim();
      return t !== '' && rupeesToPaise(t) === null;
    });
    const fail =
      entered.length === 0
        ? 'Enter an amount for at least one line.'
        : bad
          ? 'Amounts are rupees with at most two decimals.'
          : over
            ? `The amount for "${over.l.line.description}" is above its maximum of ${inr(over.l.max)}.`
            : text.length < 5 || text.length > 500
              ? 'Write the remarks in 5 to 500 characters.'
              : null;
    if (fail) return setProblem(fail);
    setBusy(true);
    setProblem(null);
    const sent = entered.map(x => ({ invoiceLineId: x.l.line.id, amountPaise: x.paise }));
    try {
      onDone(
        await billingInvoicesService.creditNote(invoice.id, {
          reasonCode: reason,
          remarks: text,
          lines: sent,
        }),
      );
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CREDIT_EXCEEDS_LINE')
        setLimits(l => ({
          ...l,
          ...creditLimits(
            e,
            sent.map(x => x.invoiceLineId),
          ),
        }));
      setProblem(billingInvoiceError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={busy ? () => {} : onClose}
      title={`Credit note for ${invoice.invoiceNo}`}
      description="Reduces the amount due on this bill."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Create credit note
          </Button>
        </>
      }
    >
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem}
        </Alert>
      )}
      <Select
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value as CreditReason)}
        options={CREDIT_REASONS}
      />
      <Textarea
        label="Remarks"
        hint="Printed on the note."
        value={remarks}
        onChange={e => setRemarks(e.target.value)}
        required
      />
      {debitNotes.error != null && (
        <Alert tone="warn" className="mb-3">
          The lines of the debit notes could not be loaded, so only the lines of the bill are shown.{' '}
          {billingInvoiceError(debitNotes.error)}
        </Alert>
      )}
      {hasDebit && debitNotes.loading ? (
        <div className="skeleton mb-3 h-24 w-full" aria-busy="true" aria-label="Loading lines" />
      ) : lines.length === 0 ? (
        <Alert tone="info">Every line of this bill is already credited.</Alert>
      ) : (
        <ul aria-label="Lines to credit" className="mb-3 flex flex-col gap-2">
          {lines.map(({ line, source, max }) => {
            const shown = limits[line.id] ?? max;
            return (
              <li
                key={line.id}
                className="rounded-2xl border border-[var(--line)] p-3"
                data-testid="credit-line"
              >
                <div className="text-[14px] font-semibold">{line.description}</div>
                <div className="mb-1 text-[12.5px] text-muted">
                  {source} · Max {inr(shown)}
                </div>
                <Input
                  label={`Credit for ${line.description} in rupees`}
                  inputMode="decimal"
                  value={amounts[line.id] ?? ''}
                  onChange={e => setAmounts(a => ({ ...a, [line.id]: e.target.value }))}
                />
              </li>
            );
          })}
        </ul>
      )}
      <dl className="mb-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[14px]">
        <dt>Credit</dt>
        <dd className="text-right tabular-nums">{inr(subtotal)}</dd>
        {invoice.gstApplied && (
          <>
            <dt>GST (estimate)</dt>
            <dd className="text-right tabular-nums">{inr(tax)}</dd>
          </>
        )}
        <dt className="font-bold">Total credit</dt>
        <dd className="text-right font-bold tabular-nums">{inr(total)}</dd>
      </dl>
      <p className="text-[13px] text-muted">
        {total > AUTO_APPROVE_LIMIT_PAISE
          ? 'This note needs approval from another committee member before it takes effect.'
          : `Needs approval above ${inr(AUTO_APPROVE_LIMIT_PAISE)}. Smaller notes are approved at once by the default rule.`}{' '}
        The final GST is worked out when the note is created.
      </p>
    </Modal>
  );
}

/** Debit note form (spec 8.16): reason, remarks and 1 to 20 charges. It is issued at once, without approval. */
export function DebitNoteDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: InvoiceDetail;
  onClose: () => void;
  onDone: (note: NoteSummary) => void;
}) {
  const [reason, setReason] = useState<DebitReason>('ADDITIONAL_CHARGE');
  const [remarks, setRemarks] = useState('');
  const [drafts, setDrafts] = useState<LineDraft[]>(() => [newLine()]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heads = useLoad(() => billingInvoicesService.heads());

  const submit = async () => {
    const parsed = parseLines(drafts, 20);
    const text = remarks.trim();
    const fail =
      parsed.problem ??
      (text.length < 5 || text.length > 500 ? 'Write the remarks in 5 to 500 characters.' : null);
    if (fail) return setProblem(fail);
    setBusy(true);
    setProblem(null);
    try {
      onDone(
        await billingInvoicesService.debitNote(invoice.id, {
          reasonCode: reason,
          remarks: text,
          lines: parsed.lines,
        }),
      );
    } catch (e) {
      setProblem(billingInvoiceError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={busy ? () => {} : onClose}
      title={`Debit note for ${invoice.invoiceNo}`}
      description="Adds a charge to this bill. It takes effect at once and the resident is notified."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Create debit note
          </Button>
        </>
      }
    >
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem}
        </Alert>
      )}
      <Select
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value as DebitReason)}
        options={DEBIT_REASONS}
      />
      <Textarea
        label="Remarks"
        hint="Printed on the note."
        value={remarks}
        onChange={e => setRemarks(e.target.value)}
        required
      />
      {heads.error != null ? (
        <Alert tone="bad">{billingInvoiceError(heads.error)}</Alert>
      ) : heads.loading ? (
        <div className="skeleton h-24 w-full" />
      ) : (
        <LinesEditor drafts={drafts} heads={heads.data ?? []} max={20} onChange={setDrafts} />
      )}
      <p className="text-[13px] text-muted">GST is added by the rules of each charge head.</p>
    </Modal>
  );
}
