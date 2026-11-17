'use client';
import { useState, type ReactNode } from 'react';
import { UnitPicker } from '@/components/maintenance/invoices/InvoiceBits';
import type { UnitOption } from '@/types/billingInvoices';
import { opsErrorBox } from './ErrorBox';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { accountsDepositsService as svc } from '@/services/accountsDeposits.service';
import type { Deposit, DepositKind, DepositRefundMode } from '@/types/accountsDeposits';
import { rupeesToPaise, todayIso } from '@/components/payments/ops/format';
import { KIND_LABEL, MODE_LABEL, depositError, needsReference } from './format';

type Errors = Record<string, string>;

function Shell({
  title,
  description,
  action,
  busy,
  failed,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description?: string;
  action: string;
  busy: boolean;
  failed: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Close
          </Button>
          <Button loading={busy} onClick={onSubmit}>
            {action}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {opsErrorBox(failed)}
        {children}
      </div>
    </Modal>
  );
}

/** Runs one deposit call: busy flag, API error text, toast and refresh on success. */
function useAct(done: string, onDone: () => void, onClose: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const run = async (call: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await call();
      toast.show(done);
      onDone();
      onClose();
    } catch (e) {
      setFailed(depositError(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, failed, run };
}

const inDays = (n: number) => {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dateError = (d: string) =>
  !/^\d{4}-\d{2}-\d{2}$/.test(d)
    ? 'Choose a date.'
    : d > todayIso()
      ? 'The date cannot be in the future.'
      : undefined;
const reasonError = (r: string) =>
  r.trim().length < 5 || r.trim().length > 500 ? 'Enter a reason of 5 to 500 characters.' : undefined;

export function NewDepositDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [unit, setUnit] = useState<UnitOption | null>(null);
  const [kind, setKind] = useState<DepositKind>('RENOVATION');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [opening, setOpening] = useState(false);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const { busy, failed, run } = useAct('Deposit added.', onDone, onClose);

  const submit = () => {
    const e: Errors = {};
    if (!unit) e.unit = 'Choose the flat.';
    if (title.trim().length < 3 || title.trim().length > 120)
      e.title = 'Enter a title of 3 to 120 characters.';
    const paise = rupeesToPaise(amount);
    if (paise === null || paise < 100 || paise > 100_000_000)
      e.amount = 'Enter an amount from ₹1 to ₹10,00,000.';
    if (!date) e.date = opening ? 'Choose the date it was received.' : 'Choose the due date.';
    else if (opening && date > todayIso()) e.date = 'The date cannot be in the future.';
    else if (!opening && date < todayIso()) e.date = 'The due date cannot be in the past.';
    else if (!opening && date > inDays(90)) e.date = 'The due date can be at most 90 days from today.';
    setErrors(e);
    if (Object.keys(e).length) return;
    void run(() =>
      svc.create({
        unitId: unit!.id,
        kind,
        title: title.trim(),
        amountPaise: paise!,
        ...(opening ? { isOpening: true, openingDate: date } : { dueDate: date }),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    );
  };
  return (
    <Shell
      title="New deposit"
      description={
        opening
          ? 'A deposit the society already holds. It is recorded as held straight away.'
          : 'The flat gets a bill for this deposit. It is held once the bill is paid.'
      }
      action="Add deposit"
      busy={busy}
      failed={failed}
      onClose={onClose}
      onSubmit={submit}
    >
      <UnitPicker label="Flat" value={unit} onChange={setUnit} required error={errors.unit} />
      <Select
        label="Type"
        value={kind}
        onChange={e => setKind(e.target.value as DepositKind)}
        options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
      />
      <Input
        label="Title"
        value={title}
        error={errors.title}
        onChange={e => setTitle(e.target.value)}
        required
      />
      <Input
        label="Amount (₹)"
        inputMode="decimal"
        value={amount}
        error={errors.amount}
        onChange={e => setAmount(e.target.value)}
        required
      />
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={opening} onChange={e => setOpening(e.target.checked)} />
        Already held (opening deposit)
      </label>
      <Input
        label={opening ? 'Received on' : 'Due date'}
        type="date"
        value={date}
        error={errors.date}
        onChange={e => setDate(e.target.value)}
        required
      />
      <Textarea
        label="Notes (optional)"
        value={notes}
        maxLength={500}
        onChange={e => setNotes(e.target.value)}
      />
    </Shell>
  );
}

/** Deduct part of the held amount (`mode: 'deduct'`) or keep all of it (`'forfeit'`). */
export function DeductDialog({
  deposit: d,
  mode,
  onClose,
  onDone,
}: {
  deposit: Deposit;
  mode: 'deduct' | 'forfeit';
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayIso());
  const [errors, setErrors] = useState<Errors>({});
  const forfeit = mode === 'forfeit';
  const { busy, failed, run } = useAct(forfeit ? 'Deposit forfeited.' : 'Amount deducted.', onDone, onClose);
  const submit = () => {
    const e: Errors = {};
    const paise = rupeesToPaise(amount);
    if (!forfeit) {
      if (paise === null || paise < 100) e.amount = 'Enter an amount of at least ₹1.';
      else if (paise > d.heldPaise) e.amount = `At most ${inr(d.heldPaise)} is held.`;
    }
    const re = reasonError(reason);
    if (re) e.reason = re;
    const de = dateError(date);
    if (de) e.date = de;
    setErrors(e);
    if (Object.keys(e).length) return;
    const base = { reason: reason.trim(), date, version: d.version };
    void run(() => (forfeit ? svc.forfeit(d.id, base) : svc.deduct(d.id, { ...base, amountPaise: paise! })));
  };
  return (
    <Shell
      title={forfeit ? 'Forfeit the deposit' : 'Deduct from the deposit'}
      description={
        forfeit
          ? `The whole held amount of ${inr(d.heldPaise)} is kept by the society as income.`
          : `${inr(d.heldPaise)} is held. The amount deducted is kept by the society as income.`
      }
      action={forfeit ? 'Forfeit' : 'Deduct'}
      busy={busy}
      failed={failed}
      onClose={onClose}
      onSubmit={submit}
    >
      {!forfeit && (
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={amount}
          error={errors.amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
      )}
      <Textarea
        label="Reason"
        value={reason}
        error={errors.reason}
        onChange={e => setReason(e.target.value)}
        required
      />
      <Input
        label="Date"
        type="date"
        max={todayIso()}
        value={date}
        error={errors.date}
        onChange={e => setDate(e.target.value)}
        required
      />
    </Shell>
  );
}

export function RefundRequestDialog({
  deposit: d,
  onClose,
  onDone,
}: {
  deposit: Deposit;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const { busy, failed, run } = useAct('Refund sent for approval.', onDone, onClose);
  return (
    <Shell
      title="Request a refund"
      description={`The full held amount of ${inr(d.heldPaise)} is refunded. Deduct first if the society keeps part of it. A different committee member approves it.`}
      action="Request refund"
      busy={busy}
      failed={failed}
      onClose={onClose}
      onSubmit={() =>
        void run(() =>
          svc.requestRefund(d.id, {
            ...(reason.trim() ? { reason: reason.trim() } : {}),
            version: d.version,
          }),
        )
      }
    >
      <Textarea
        label="Note (optional)"
        value={reason}
        maxLength={500}
        onChange={e => setReason(e.target.value)}
      />
    </Shell>
  );
}

export function CancelDepositDialog({
  deposit: d,
  onClose,
  onDone,
}: {
  deposit: Deposit;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const { busy, failed, run } = useAct('Deposit cancelled.', onDone, onClose);
  return (
    <Shell
      title="Cancel this deposit"
      description="The unpaid bill for this deposit is also cancelled."
      action="Cancel deposit"
      busy={busy}
      failed={failed}
      onClose={onClose}
      onSubmit={() => {
        const re = reasonError(reason);
        setError(re);
        if (!re) void run(() => svc.cancel(d.id, { reason: reason.trim(), version: d.version }));
      }}
    >
      <Textarea
        label="Reason"
        value={reason}
        error={error}
        onChange={e => setReason(e.target.value)}
        required
      />
    </Shell>
  );
}

/** Record the refund payout: paid-from account, mode, reference, date (step-up is handled by the API client). */
export function RefundPaidDialog({
  deposit: d,
  onClose,
  onDone,
}: {
  deposit: Deposit;
  onClose: () => void;
  onDone: () => void;
}) {
  const accounts = useLoad(() => svc.paidFromAccounts(), 'paid-from');
  const list = accounts.data ?? [];
  const [account, setAccount] = useState('');
  const [mode, setMode] = useState<DepositRefundMode>('NEFT');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayIso());
  const [errors, setErrors] = useState<Errors>({});
  const { busy, failed, run } = useAct('Refund recorded as paid.', onDone, onClose);
  const typed = !accounts.loading && list.length === 0;
  const submit = () => {
    const e: Errors = {};
    const id = Number(account || (list.length === 1 ? list[0].id : 0));
    if (!Number.isInteger(id) || id < 1)
      e.account = typed ? 'Enter the ledger account number.' : 'Choose the account.';
    const ref = reference.trim();
    if (needsReference(mode) && (ref.length < 6 || ref.length > 30))
      e.reference = 'Enter the reference (6 to 30 characters).';
    const de = dateError(date);
    if (de) e.date = de;
    setErrors(e);
    if (Object.keys(e).length) return;
    void run(() =>
      svc.refundPaid(d.id, {
        paidFromLedgerAccountId: id,
        refundMode: mode,
        ...(ref ? { refundReference: ref } : {}),
        date,
        version: d.version,
      }),
    );
  };
  return (
    <Shell
      title="Mark refund paid"
      description={`${inr(d.refundRequestedPaise || d.heldPaise)} refunded for ${d.unitLabel}. You may be asked to confirm it is you.`}
      action="Mark paid"
      busy={busy}
      failed={failed}
      onClose={onClose}
      onSubmit={submit}
    >
      {typed ? (
        <Input
          label="Paid from (ledger account number)"
          inputMode="numeric"
          value={account}
          error={errors.account}
          onChange={e => setAccount(e.target.value)}
          required
        />
      ) : (
        <Select
          label="Paid from"
          value={account || (list.length === 1 ? String(list[0].id) : '')}
          error={errors.account}
          onChange={e => setAccount(e.target.value)}
          options={[
            { value: '', label: accounts.loading ? 'Loading...' : 'Choose an account' },
            ...list.map(a => ({ value: String(a.id), label: `${a.code} ${a.name}` })),
          ]}
          required
        />
      )}
      <Select
        label="Mode"
        value={mode}
        onChange={e => setMode(e.target.value as DepositRefundMode)}
        options={Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label }))}
      />
      <Input
        label="Reference (UTR or cheque number)"
        value={reference}
        error={errors.reference}
        onChange={e => setReference(e.target.value)}
        required={needsReference(mode)}
      />
      <Input
        label="Paid on"
        type="date"
        max={todayIso()}
        value={date}
        error={errors.date}
        onChange={e => setDate(e.target.value)}
        required
      />
    </Shell>
  );
}
