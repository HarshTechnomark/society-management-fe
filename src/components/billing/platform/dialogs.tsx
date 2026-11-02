'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { inr } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { InvoiceDetail, InvoiceListItem, PaymentItem } from '@/types/platformBilling';
import { FileAttach } from '../FileAttach';
import { FormModal } from '../FormModal';
import { TdsClaimFields, validateTdsClaim, type TdsDraft, emptyTds } from '../TdsClaim';
import { billingError, daysAgo, paiseText, rupeesToPaise, today } from '../format';

interface Done {
  onClose: () => void;
  onDone: () => void;
}

type Method = 'NEFT' | 'RTGS' | 'IMPS' | 'CHEQUE' | 'UPI' | 'DD';
const METHOD_OPTIONS = [
  { value: 'NEFT', label: 'NEFT' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'IMPS', label: 'IMPS' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'UPI', label: 'UPI' },
  { value: 'DD', label: 'Demand draft' },
];

const idOf = (text: string) => (/^[1-9]\d*$/.test(text.trim()) ? Number(text.trim()) : null);

/** Spec 11.1 Record payment (prototype "Mark invoice as paid"): no cash, a second person approves. */
export function RecordPaymentModal({
  invoice,
  societyId,
  onClose,
  onDone,
}: Done & {
  invoice?: Pick<InvoiceListItem, 'id' | 'societyId' | 'amountDuePaise' | 'invoiceNo'>;
  societyId?: number;
}) {
  const [soc, setSoc] = useState(String(invoice?.societyId ?? societyId ?? ''));
  const [method, setMethod] = useState<Method>('NEFT');
  const [amount, setAmount] = useState(invoice ? paiseText(invoice.amountDuePaise) : '');
  const [receivedOn, setReceivedOn] = useState(today());
  const [ref, setRef] = useState('');
  const [bank, setBank] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);

  const paise = rupeesToPaise(amount);
  const errors: Record<string, string | null> = {
    soc: idOf(soc) ? null : 'Enter the society number.',
    amount: paise !== null && paise >= 100 ? null : 'Enter an amount of ₹1 or more.',
    receivedOn:
      receivedOn && receivedOn <= today() && receivedOn >= daysAgo(180)
        ? null
        : 'Pick a date in the last 180 days.',
    ref: !/^[A-Za-z0-9/-]{4,40}$/.test(ref.trim())
      ? 'Use 4 to 40 letters, digits, / or -.'
      : (method === 'CHEQUE' || method === 'DD') && !/^\d{6}$/.test(ref.trim())
        ? 'A cheque or draft number has 6 digits.'
        : null,
  };
  const bad = Object.values(errors).some(Boolean);
  return (
    <FormModal
      title="Record payment"
      description="A second person has to approve this before the invoice changes. Cash is not accepted."
      submitLabel="Send for approval"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (bad) return { error: 'Fix the highlighted fields.' };
        await svc.recordPayment({
          societyId: idOf(soc)!,
          invoiceId: invoice?.id,
          method,
          amountPaise: paise!,
          receivedOn,
          bankReference: ref.trim(),
          payerBankName: bank.trim() || undefined,
          attachmentFileId: file ?? undefined,
          notes: notes.trim() || undefined,
        });
        return { message: 'Sent for approval.' };
      }}
    >
      {!invoice && (
        <Input
          label="Society number"
          inputMode="numeric"
          value={soc}
          onChange={e => setSoc(e.target.value)}
          error={touched ? errors.soc : null}
          required
        />
      )}
      {invoice && (
        <p className="mb-4 text-[14px] text-muted">
          For invoice <b>{invoice.invoiceNo}</b>, due {inr(invoice.amountDuePaise)}.
        </p>
      )}
      <Select
        label="Payment method"
        value={method}
        onChange={e => setMethod(e.target.value as Method)}
        options={METHOD_OPTIONS}
      />
      <Input
        label="Amount (₹)"
        inputMode="decimal"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        error={touched ? errors.amount : null}
        required
      />
      <Input
        label="Received on"
        type="date"
        value={receivedOn}
        max={today()}
        onChange={e => setReceivedOn(e.target.value)}
        error={touched ? errors.receivedOn : null}
        required
      />
      <Input
        label="Reference number"
        hint="UTR or cheque number"
        value={ref}
        onChange={e => setRef(e.target.value)}
        error={touched ? errors.ref : null}
        required
      />
      <Input label="Bank" value={bank} onChange={e => setBank(e.target.value)} />
      <FileAttach label="Attachment" purpose="PLATFORM_ATTACHMENT" onChange={setFile} />
      <Textarea label="Notes" value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} />
    </FormModal>
  );
}

interface LineDraft {
  description: string;
  quantity: string;
  price: string;
}
const emptyLine = (): LineDraft => ({ description: '', quantity: '1', price: '' });

/** Manual invoice draft (8.12). It becomes an invoice when another person approves it. */
export function ManualInvoiceModal({ onClose, onDone, societyId }: Done & { societyId?: number }) {
  const [soc, setSoc] = useState(societyId ? String(societyId) : '');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const set = (i: number, patch: Partial<LineDraft>) =>
    setLines(l => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const lineError = (l: LineDraft) =>
    l.description.trim().length < 3
      ? 'Describe the line (3 characters or more).'
      : !/^\d{1,8}(\.\d{1,4})?$/.test(l.quantity) || Number(l.quantity) <= 0
        ? 'Quantity must be a number above zero.'
        : (rupeesToPaise(l.price) ?? 0) < 1
          ? 'Enter a price.'
          : null;
  return (
    <FormModal
      title="New manual invoice"
      description="Saved as a draft. Another person approves it before it is numbered and sent."
      submitLabel="Save draft"
      wide
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (!idOf(soc) || lines.some(lineError)) return { error: 'Fix the highlighted fields.' };
        await svc.createInvoice({
          societyId: idOf(soc)!,
          lines: lines.map(l => ({
            description: l.description.trim(),
            quantity: l.quantity,
            unitPricePaise: rupeesToPaise(l.price)!,
          })),
          notes: notes.trim() || undefined,
        });
        return { message: 'Draft saved. It waits for another approver.' };
      }}
    >
      {!societyId && (
        <Input
          label="Society number"
          inputMode="numeric"
          value={soc}
          onChange={e => setSoc(e.target.value)}
          error={touched && !idOf(soc) ? 'Enter the society number.' : null}
          required
        />
      )}
      {lines.map((l, i) => (
        <fieldset key={i} className="mb-4 rounded-[16px] border border-[var(--line)] p-3">
          <legend className="px-1 text-[13px] font-semibold">Line {i + 1}</legend>
          <Input
            label="Description"
            value={l.description}
            onChange={e => set(i, { description: e.target.value })}
            error={touched ? lineError(l) : null}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              inputMode="decimal"
              value={l.quantity}
              onChange={e => set(i, { quantity: e.target.value })}
            />
            <Input
              label="Unit price (₹)"
              inputMode="decimal"
              value={l.price}
              onChange={e => set(i, { price: e.target.value })}
            />
          </div>
          {lines.length > 1 && (
            <Button size="xs" variant="ghost" onClick={() => setLines(x => x.filter((_, j) => j !== i))}>
              Remove line {i + 1}
            </Button>
          )}
        </fieldset>
      ))}
      {lines.length < 20 && (
        <Button size="sm" variant="glass" onClick={() => setLines(l => [...l, emptyLine()])}>
          Add line
        </Button>
      )}
      <div className="mt-4">
        <Textarea label="Notes" value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} />
      </div>
    </FormModal>
  );
}

const CN_REASONS = [
  { value: 'PRICE_CORRECTION', label: 'Price correction' },
  { value: 'SERVICE_CREDIT', label: 'Service credit' },
  { value: 'DUPLICATE_INVOICE', label: 'Duplicate invoice' },
  { value: 'CANCELLATION', label: 'Cancellation' },
  { value: 'GOODWILL', label: 'Goodwill' },
  { value: 'OTHER', label: 'Other' },
];

/** Credit note draft against an invoice (8.13). */
export function CreditNoteModal({ invoice, onClose, onDone }: Done & { invoice: InvoiceDetail }) {
  const [reason, setReason] = useState('PRICE_CORRECTION');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const paise = rupeesToPaise(amount);
  const aErr =
    paise === null || paise < 1
      ? 'Enter the amount before tax.'
      : paise > invoice.subtotalPaise
        ? `At most ${inr(invoice.subtotalPaise)} (the invoice value before tax).`
        : null;
  const nErr =
    notes.trim().length < 10 ? 'Write at least 10 characters. This is printed on the credit note.' : null;
  return (
    <FormModal
      title="Issue credit note"
      description={`Against ${invoice.invoiceNo}. Saved as a draft; another person approves it.`}
      submitLabel="Save draft"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (aErr || nErr) return { error: 'Fix the highlighted fields.' };
        await svc.createCreditNote(invoice.id, {
          reason: reason as never,
          subtotalPaise: paise!,
          notes: notes.trim(),
        });
        return { message: 'Credit note draft saved. It waits for another approver.' };
      }}
    >
      <Select label="Reason" value={reason} onChange={e => setReason(e.target.value)} options={CN_REASONS} />
      <Input
        label="Amount before tax (₹)"
        inputMode="decimal"
        hint="Tax is added at the same rate as the invoice."
        value={amount}
        onChange={e => setAmount(e.target.value)}
        error={touched ? aErr : null}
        required
      />
      <Textarea
        label="Notes"
        value={notes}
        maxLength={500}
        onChange={e => setNotes(e.target.value)}
        error={touched ? nErr : null}
        required
      />
    </FormModal>
  );
}

/** Extend grace (8.16): 3, 7 or 14 days with a reason. */
export function ExtendGraceModal({ invoice, onClose, onDone }: Done & { invoice: InvoiceDetail }) {
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const err = reason.trim().length < 10 ? 'Write at least 10 characters.' : null;
  return (
    <FormModal
      title="Extend grace"
      description={`Moves the suspension date of ${invoice.invoiceNo}${invoice.suspendOn ? ' from ' + invoice.suspendOn : ''}.`}
      submitLabel="Extend"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (err) return { error: 'Fix the highlighted fields.' };
        await svc.extendGrace(invoice.id, {
          days: Number(days),
          reason: reason.trim(),
          version: invoice.version,
        });
        return { message: `Grace extended by ${days} days.` };
      }}
    >
      <Select
        label="Days"
        value={days}
        onChange={e => setDays(e.target.value)}
        options={['3', '7', '14'].map(d => ({ value: d, label: `${d} days` }))}
      />
      <Textarea
        label="Reason"
        value={reason}
        maxLength={500}
        onChange={e => setReason(e.target.value)}
        error={touched ? err : null}
        required
      />
    </FormModal>
  );
}

/** Manual reminder (8.15) with an optional note. */
export function RemindModal({
  invoice,
  onClose,
  onDone,
}: Done & { invoice: Pick<InvoiceListItem, 'id' | 'invoiceNo' | 'societyName'> }) {
  const [note, setNote] = useState('');
  return (
    <FormModal
      title="Send reminder"
      description={`Sends a payment reminder for ${invoice.invoiceNo}${invoice.societyName ? ' to ' + invoice.societyName : ''}. One per 24 hours.`}
      submitLabel="Send reminder"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        await svc.remind(invoice.id, note.trim() || undefined);
        return { message: 'Reminder sent.' };
      }}
    >
      <Textarea
        label="Note (optional)"
        value={note}
        maxLength={300}
        onChange={e => setNote(e.target.value)}
      />
    </FormModal>
  );
}

/** Confirm with a reason of at least 10 characters; the call and its error text live here. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  variant = 'danger',
  run,
  success,
  onClose,
  onDone,
}: Done & {
  title: string;
  description?: string;
  confirmLabel: string;
  variant?: 'danger' | 'primary';
  run: (reason: string) => Promise<unknown>;
  success: string;
}) {
  const toast = useToast();
  return (
    <ConfirmReason
      open
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant={variant}
      minLength={10}
      onCancel={onClose}
      onConfirm={async reason => {
        try {
          await run(reason);
          toast.show(success);
          onDone();
        } catch (e) {
          toast.show(billingError(e), 'error');
        }
      }}
    />
  );
}

/** Approve confirmation: the API asks for step-up and the global dialog handles it. */
export function ApproveDialog({
  title,
  description,
  run,
  success,
  onClose,
  onDone,
}: Done & { title: string; description: string; run: () => Promise<unknown>; success: string }) {
  return (
    <FormModal
      title={title}
      description={description}
      submitLabel="Approve"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        await run();
        return { message: success };
      }}
    >
      <p className="text-[14px] text-muted">You will be asked to confirm it is you.</p>
    </FormModal>
  );
}

/** Verify or reject a TDS claim (8.20). */
export function TdsDecisionModal({ payment, onClose, onDone }: Done & { payment: PaymentItem }) {
  const [decision, setDecision] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const err = decision === 'REJECTED' && reason.trim().length < 10 ? 'Write at least 10 characters.' : null;
  return (
    <FormModal
      title="TDS claim"
      description={`${payment.societyName ?? 'Society'}, ${payment.invoiceNo ?? ''}: ${inr(payment.amountPaise)} under ${payment.tdsSection ?? 'TDS'}${payment.hasCertificate ? ', certificate attached' : ', no certificate yet'}.`}
      submitLabel={decision === 'VERIFIED' ? 'Verify claim' : 'Reject claim'}
      variant={decision === 'VERIFIED' ? 'primary' : 'danger'}
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (err) return { error: 'Fix the highlighted fields.' };
        await svc.tdsDecision(payment.id, {
          decision,
          reason: decision === 'REJECTED' ? reason.trim() : undefined,
          version: payment.version,
        });
        return { message: decision === 'VERIFIED' ? 'TDS claim verified.' : 'TDS claim rejected.' };
      }}
    >
      <Select
        label="Decision"
        value={decision}
        onChange={e => setDecision(e.target.value as 'VERIFIED' | 'REJECTED')}
        options={[
          { value: 'VERIFIED', label: 'Verify' },
          { value: 'REJECTED', label: 'Reject' },
        ]}
      />
      {decision === 'REJECTED' && (
        <Textarea
          label="Reason"
          value={reason}
          maxLength={500}
          onChange={e => setReason(e.target.value)}
          error={touched ? err : null}
          required
        />
      )}
    </FormModal>
  );
}

/** Record the TDS a society deducted (8.9, platform side). */
export function RecordTdsModal({ invoice, onClose, onDone }: Done & { invoice: InvoiceDetail }) {
  const [draft, setDraft] = useState<TdsDraft>(emptyTds());
  const [touched, setTouched] = useState(false);
  const v = validateTdsClaim(draft, invoice);
  return (
    <FormModal
      title="Record TDS"
      description={`TDS deducted by the society on ${invoice.invoiceNo}.`}
      submitLabel="Record TDS"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (!v.input) return { error: 'Fix the highlighted fields.' };
        await svc.recordTds(invoice.id, v.input);
        return { message: 'TDS recorded.' };
      }}
    >
      <TdsClaimFields draft={draft} onChange={setDraft} invoice={invoice} errors={touched ? v.errors : {}} />
    </FormModal>
  );
}

/** Refund request (8.22). */
export function RefundModal({
  societyId,
  balancePaise,
  onClose,
  onDone,
}: Done & { societyId: number; balancePaise: number }) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'GATEWAY' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [source, setSource] = useState('');
  const [payee, setPayee] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const paise = rupeesToPaise(amount);
  const e = {
    amount:
      paise === null || paise < 100
        ? 'Enter at least ₹1.'
        : paise > balancePaise
          ? `At most the credit balance, ${inr(balancePaise)}.`
          : null,
    source: mode === 'GATEWAY' && !idOf(source) ? 'Enter the payment number to refund.' : null,
    payee:
      mode === 'BANK_TRANSFER' && (payee.trim().length < 5 || /\d{9,}/.test(payee.replace(/[\s-]/g, '')))
        ? 'Use 5 or more characters and no full account number.'
        : null,
    reason: reason.trim().length < 10 ? 'Write at least 10 characters.' : null,
  };
  return (
    <FormModal
      title="Refund credit"
      description={`Credit balance ${inr(balancePaise)}. Another person approves before money moves.`}
      submitLabel="Request refund"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (Object.values(e).some(Boolean)) return { error: 'Fix the highlighted fields.' };
        await svc.requestRefund(societyId, {
          amountPaise: paise!,
          mode,
          sourcePaymentId: mode === 'GATEWAY' ? idOf(source)! : undefined,
          payeeReference: mode === 'BANK_TRANSFER' ? payee.trim() : undefined,
          reason: reason.trim(),
        });
        return { message: 'Refund sent for approval.' };
      }}
    >
      <Input
        label="Amount (₹)"
        inputMode="decimal"
        value={amount}
        onChange={x => setAmount(x.target.value)}
        error={touched ? e.amount : null}
        required
      />
      <Select
        label="Refund to"
        value={mode}
        onChange={x => setMode(x.target.value as 'GATEWAY' | 'BANK_TRANSFER')}
        options={[
          { value: 'BANK_TRANSFER', label: 'Bank transfer' },
          { value: 'GATEWAY', label: 'Original payment (gateway)' },
        ]}
      />
      {mode === 'GATEWAY' ? (
        <Input
          label="Payment number"
          inputMode="numeric"
          value={source}
          onChange={x => setSource(x.target.value)}
          error={touched ? e.source : null}
          required
        />
      ) : (
        <Input
          label="Payee reference"
          hint="For example the bank name and last 4 digits. Never a full account number."
          value={payee}
          onChange={x => setPayee(x.target.value)}
          error={touched ? e.payee : null}
          required
        />
      )}
      <Textarea
        label="Reason"
        value={reason}
        maxLength={500}
        onChange={x => setReason(x.target.value)}
        error={touched ? e.reason : null}
        required
      />
    </FormModal>
  );
}

/** Goodwill credit request (8.23; prototype "Apply credit"). */
export function GoodwillCreditModal({ societyId, onClose, onDone }: Done & { societyId: number }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const paise = rupeesToPaise(amount);
  const aErr =
    paise === null || paise < 100 || paise > 50_000_000 ? 'Enter an amount between 1 and 5,00,000.' : null;
  const rErr = reason.trim().length < 10 ? 'Write at least 10 characters.' : null;
  return (
    <FormModal
      title="Apply credit"
      description="Credit is applied to the next invoice once another person approves."
      submitLabel="Request credit"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (aErr || rErr) return { error: 'Fix the highlighted fields.' };
        await svc.requestCredit(societyId, { amountPaise: paise!, reason: reason.trim() });
        return { message: 'Credit sent for approval.' };
      }}
    >
      <Input
        label="Credit amount (INR)"
        inputMode="decimal"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        error={touched ? aErr : null}
        required
      />
      <Textarea
        label="Reason"
        value={reason}
        maxLength={500}
        onChange={e => setReason(e.target.value)}
        error={touched ? rErr : null}
        required
      />
    </FormModal>
  );
}

/** Record the bank transfer of an approved refund (8.21). */
export function CompleteRefundModal({ payment, onClose, onDone }: Done & { payment: PaymentItem }) {
  const [ref, setRef] = useState('');
  const [on, setOn] = useState(today());
  const [touched, setTouched] = useState(false);
  const rErr = /^[A-Za-z0-9/-]{4,40}$/.test(ref.trim()) ? null : 'Use 4 to 40 letters, digits, / or -.';
  const dErr = on <= today() && on >= daysAgo(30) ? null : 'Pick a date in the last 30 days.';
  return (
    <FormModal
      title="Complete refund"
      description={`Record the bank transfer of ${inr(payment.amountPaise)}.`}
      submitLabel="Mark refunded"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (rErr || dErr) return { error: 'Fix the highlighted fields.' };
        await svc.completeRefund(payment.id, {
          bankReference: ref.trim(),
          receivedOn: on,
          version: payment.version,
        });
        return { message: 'Refund completed.' };
      }}
    >
      <Input
        label="Bank reference"
        value={ref}
        onChange={e => setRef(e.target.value)}
        error={touched ? rErr : null}
        required
      />
      <Input
        label="Paid out on"
        type="date"
        value={on}
        max={today()}
        onChange={e => setOn(e.target.value)}
        error={touched ? dErr : null}
        required
      />
    </FormModal>
  );
}
