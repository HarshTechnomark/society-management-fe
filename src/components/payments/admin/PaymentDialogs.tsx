'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { paymentsService } from '@/services/payments.service';
import type { PaymentDetail, ReallocationTarget, ReceiptChannel, ReverseReasonCode } from '@/types/payments';
import { isoDay, paiseText, paymentError, rupeesToPaise, today } from './format';

/** A modal that runs one call; a failure stays in the dialog, success closes it through `onDone`. */
function ActionModal({
  title,
  description,
  submitLabel,
  variant = 'primary',
  onClose,
  run,
  onDone,
  children,
  disabled,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  variant?: 'primary' | 'danger';
  onClose: () => void;
  /** Returns a text to show instead of calling, or runs the call. */
  run: () => Promise<string | void>;
  onDone: (message: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await run();
      if (typeof r === 'string' && r.startsWith('!')) {
        setError(r.slice(1));
        return;
      }
      onDone(typeof r === 'string' ? r : 'Done');
    } catch (e) {
      setError(paymentError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} loading={busy} disabled={disabled} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {children}
    </Modal>
  );
}

interface DialogProps {
  payment: PaymentDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

const minTrim = (v: string, n: number) => v.trim().length >= n;

export function ClearDialog({ payment, onClose, onDone }: DialogProps) {
  const [on, setOn] = useState(today());
  return (
    <ActionModal
      title="Mark cheque cleared"
      description={`Cheque ${payment.cheque?.chequeNo ?? ''} of ${payment.unitLabel}. The money counts in the bank balance from the clearing date.`}
      submitLabel="Mark cleared"
      onClose={onClose}
      onDone={onDone}
      run={async () => {
        if (!isoDay(on)) return '!Enter the clearing date.';
        await paymentsService.clearCheque(payment.id, { clearedOn: on, version: payment.version });
        return 'Cheque marked as cleared';
      }}
    >
      <Input
        label="Cleared on"
        type="date"
        value={on}
        min={payment.cheque?.depositedOn ?? undefined}
        max={today()}
        onChange={e => setOn(e.target.value)}
      />
    </ActionModal>
  );
}

export function BounceDialog({ payment, onClose, onDone }: DialogProps) {
  const [on, setOn] = useState(today());
  const [reason, setReason] = useState('');
  const [apply, setApply] = useState(true);
  const [charge, setCharge] = useState('500');
  return (
    <ActionModal
      title="Cheque bounced"
      description="The receipt is cancelled and the dues come back. A bounce charge can be added to the flat's next bill."
      submitLabel="Mark bounced"
      variant="danger"
      onClose={onClose}
      onDone={onDone}
      run={async () => {
        if (!isoDay(on)) return '!Enter the bounce date.';
        if (!minTrim(reason, 5)) return '!Enter the bank reason (at least 5 characters).';
        const paise = apply ? rupeesToPaise(charge) : 0;
        if (paise === null || paise > 500000) return '!Enter a bounce charge between 0 and 5,000 rupees.';
        await paymentsService.bounceCheque(payment.id, {
          bouncedOn: on,
          reason: reason.trim(),
          applyBounceCharge: apply,
          bounceChargePaise: paise,
          version: payment.version,
        });
        return 'Cheque marked as bounced';
      }}
    >
      <Input
        label="Bounce date"
        type="date"
        value={on}
        min={payment.cheque?.depositedOn ?? undefined}
        max={today()}
        onChange={e => setOn(e.target.value)}
      />
      <Input
        label="Bank reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        hint="For example: Funds insufficient"
        maxLength={200}
      />
      <Checkbox
        label="Charge a bounce fee to the flat"
        checked={apply}
        onChange={e => setApply(e.target.checked)}
      />
      {apply && (
        <Input
          label="Bounce charge (₹)"
          inputMode="decimal"
          value={charge}
          onChange={e => setCharge(e.target.value)}
        />
      )}
    </ActionModal>
  );
}

export function ReturnDialog({ payment, onClose, onDone }: DialogProps) {
  const [reason, setReason] = useState('');
  return (
    <ActionModal
      title="Return to payer"
      description="Give the cheque back before it is deposited. The receipt is cancelled and no charge is added."
      submitLabel="Return to payer"
      onClose={onClose}
      onDone={onDone}
      run={async () => {
        if (!minTrim(reason, 5)) return '!Enter a reason (at least 5 characters).';
        await paymentsService.returnCheque(payment.id, { reason: reason.trim(), version: payment.version });
        return 'Cheque returned to the payer';
      }}
    >
      <Textarea label="Reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={300} />
    </ActionModal>
  );
}

const REVERSE_CODES: { value: ReverseReasonCode; label: string }[] = [
  { value: 'WRONG_ENTRY', label: 'Wrong entry' },
  { value: 'DUPLICATE_ENTRY', label: 'Duplicate entry' },
  { value: 'CHARGEBACK_LOST', label: 'Chargeback lost' },
  { value: 'OTHER', label: 'Other' },
];

/** Reverse needs a step-up: the API client opens the "Confirm it is you" dialog when the API asks and retries. */
export function ReverseDialog({ payment, onClose, onDone }: DialogProps) {
  const [code, setCode] = useState<ReverseReasonCode>(
    payment.source === 'ONLINE' ? 'CHARGEBACK_LOST' : 'WRONG_ENTRY',
  );
  const [reason, setReason] = useState('');
  const online = payment.source === 'ONLINE' || payment.source === 'AUTOPAY';
  return (
    <ActionModal
      title={`Reverse ${payment.receiptNo ?? 'payment'}`}
      description="The receipt is cancelled and the amount goes back to the dues. You will be asked to confirm it is you."
      submitLabel="Reverse payment"
      variant="danger"
      onClose={onClose}
      onDone={onDone}
      run={async () => {
        if (!minTrim(reason, 10)) return '!Enter a reason of at least 10 characters.';
        await paymentsService.reverse(payment.id, {
          reasonCode: code,
          reason: reason.trim(),
          version: payment.version,
        });
        return 'Payment reversed';
      }}
    >
      <Select
        label="Why"
        value={code}
        onChange={e => setCode(e.target.value as ReverseReasonCode)}
        options={REVERSE_CODES}
        hint={online ? 'An online payment can only be reversed after a lost chargeback.' : undefined}
      />
      <Textarea label="Reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} />
    </ActionModal>
  );
}

const CHANNELS: { value: ReceiptChannel; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'SMS', label: 'SMS' },
  { value: 'PUSH', label: 'App notification' },
];

export function ResendDialog({ payment, onClose, onDone }: DialogProps) {
  const [picked, setPicked] = useState<ReceiptChannel[]>(['EMAIL']);
  const toggle = (c: ReceiptChannel) => setPicked(p => (p.includes(c) ? p.filter(x => x !== c) : [...p, c]));
  return (
    <ActionModal
      title="Resend receipt"
      description={`Send ${payment.receiptNo ?? 'the receipt'} to ${payment.payerName} again. Up to 3 times a day.`}
      submitLabel="Send receipt"
      onClose={onClose}
      onDone={onDone}
      run={async () => {
        if (picked.length === 0) return '!Choose at least one channel.';
        await paymentsService.resendReceipt(payment.id, picked);
        return 'Receipt sent again';
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Send by</legend>
        {CHANNELS.map(c => (
          <Checkbox
            key={c.value}
            label={c.label}
            checked={picked.includes(c.value)}
            onChange={() => toggle(c.value)}
          />
        ))}
      </fieldset>
    </ActionModal>
  );
}

export function ReviewDialog({ payment, onClose, onDone }: DialogProps) {
  const [note, setNote] = useState('');
  return (
    <ActionModal
      title="Mark as reviewed"
      description={payment.reviewReason ?? 'This payment was flagged for a look. Say what you checked.'}
      submitLabel="Mark reviewed"
      onClose={onClose}
      onDone={onDone}
      run={async () => {
        if (!minTrim(note, 5)) return '!Enter a note (at least 5 characters).';
        await paymentsService.reviewDone(payment.id, { note: note.trim(), version: payment.version });
        return 'Review flag cleared';
      }}
    >
      <Textarea label="Note" value={note} onChange={e => setNote(e.target.value)} maxLength={300} />
    </ActionModal>
  );
}

interface Row {
  key: string;
  type: ReallocationTarget['type'];
  id?: number;
  label: string;
  amount: string;
}

/** What the payment holds now, per invoice or collection request (reversals are netted off). */
export function currentRows(p: PaymentDetail): Row[] {
  const by = new Map<string, Row & { paise: number }>();
  for (const a of p.allocations) {
    const isInvoice = a.invoiceId !== null;
    const id = isInvoice ? a.invoiceId : a.collectionRequestId;
    if (id === null) continue;
    const key = `${isInvoice ? 'I' : 'C'}${id}`;
    const row = by.get(key) ?? {
      key,
      type: isInvoice ? ('INVOICE' as const) : ('COLLECTION_REQUEST' as const),
      id,
      label: isInvoice ? `Invoice ${a.invoiceNo ?? id}` : `Collection ${a.collectionTitle ?? id}`,
      amount: '',
      paise: 0,
    };
    row.paise += a.amountPaise;
    by.set(key, row);
  }
  const rows: Row[] = [...by.values()]
    .filter(r => r.paise > 0)
    .map(r => ({ ...r, amount: paiseText(r.paise) }));
  if (p.toAdvancePaise > 0)
    rows.push({ key: 'ADV', type: 'ADVANCE', label: 'Advance', amount: paiseText(p.toAdvancePaise) });
  return rows;
}

export function ReallocateDialog({ payment, onClose, onDone }: DialogProps) {
  const [rows, setRows] = useState<Row[]>(() => currentRows(payment));
  const [reason, setReason] = useState('');
  const invoices = useLoad(() => paymentsService.openInvoices(payment.unitId), payment.unitId);
  const total = payment.toInvoicesPaise + payment.toCollectionsPaise + payment.toAdvancePaise;
  const sum = useMemo(() => rows.reduce((s, r) => s + (rupeesToPaise(r.amount) ?? 0), 0), [rows]);
  const addable = (invoices.data ?? []).filter(i => !rows.some(r => r.key === `I${i.id}`));
  return (
    <ActionModal
      title="Reallocate payment"
      description="Move this payment between the open items of the same flat. The total stays the same."
      submitLabel="Reallocate"
      onClose={onClose}
      onDone={onDone}
      run={async () => {
        const targets: ReallocationTarget[] = [];
        for (const r of rows) {
          const paise = rupeesToPaise(r.amount);
          if (paise === null || paise < 100) return `!Enter an amount of at least ₹1 for ${r.label}.`;
          targets.push({ type: r.type, ...(r.id !== undefined ? { id: r.id } : {}), amountPaise: paise });
        }
        if (targets.length === 0) return '!Add at least one target.';
        if (sum !== total) return `!The amounts add up to ${inr(sum)}; they must add up to ${inr(total)}.`;
        if (!minTrim(reason, 10)) return '!Enter a reason of at least 10 characters.';
        await paymentsService.reallocate(payment.id, {
          targets,
          reason: reason.trim(),
          version: payment.version,
        });
        return 'Payment reallocated';
      }}
    >
      <ul className="mb-3 grid gap-2">
        {rows.map(r => (
          <li key={r.key} className="flex items-end gap-2" data-testid="realloc-row">
            <div className="min-w-0 flex-1">
              <Input
                label={r.label}
                inputMode="decimal"
                value={r.amount}
                onChange={e =>
                  setRows(list => list.map(x => (x.key === r.key ? { ...x, amount: e.target.value } : x)))
                }
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              aria-label={`Remove ${r.label}`}
              onClick={() => setRows(list => list.filter(x => x.key !== r.key))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="mb-3 flex flex-wrap gap-2">
        {!rows.some(r => r.type === 'ADVANCE') && (
          <Button
            size="sm"
            variant="glass"
            onClick={() =>
              setRows(l => [...l, { key: 'ADV', type: 'ADVANCE', label: 'Advance', amount: '' }])
            }
          >
            Add advance
          </Button>
        )}
        {addable.length > 0 && (
          <select
            aria-label="Add an open invoice"
            className="h-9 rounded-full border border-[rgba(20,35,44,0.16)] bg-white/80 px-3 text-[13.5px]"
            value=""
            onChange={e => {
              const inv = addable.find(i => i.id === Number(e.target.value));
              if (inv)
                setRows(l => [
                  ...l,
                  {
                    key: `I${inv.id}`,
                    type: 'INVOICE',
                    id: inv.id,
                    label: `Invoice ${inv.invoiceNo}`,
                    amount: paiseText(inv.outstandingPaise),
                  },
                ]);
            }}
          >
            <option value="">Add an open invoice</option>
            {addable.map(i => (
              <option key={i.id} value={i.id}>
                {i.invoiceNo} ({inr(i.outstandingPaise)} open)
              </option>
            ))}
          </select>
        )}
      </div>
      <p
        className={`mb-3 text-[13.5px] ${sum === total ? 'text-muted' : 'font-semibold text-bad'}`}
        aria-live="polite"
      >
        Total {inr(sum)} of {inr(total)}
      </p>
      <Textarea label="Reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} />
    </ActionModal>
  );
}
