'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { inr } from '@/lib/money';
import type { SimilarTicket, Ticket, TicketAction, TransitionInput, WaitingReason } from '@/types/helpdesk';
import { WAITING_REASONS, helpdeskError } from './format';
import { AttachmentPicker, type UploadedFile } from './pickers';

export const toPaise = (v: string): number => Math.round(Number(v.trim()) * 100);
const isRupees = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());

/** Wait on the resident, or resolve (with the after photo and the final charge when the work is chargeable). */
export function TransitionDialog({
  ticket,
  action,
  onCancel,
  onConfirm,
}: {
  ticket: Ticket;
  action: Extract<TicketAction, 'WAIT_ON_RESIDENT' | 'RESOLVE'>;
  onCancel: () => void;
  onConfirm: (input: Omit<TransitionInput, 'version'>) => Promise<void>;
}) {
  const resolve = action === 'RESOLVE';
  const approved = resolve && ticket.charge?.status === 'APPROVED';
  const [reason, setReason] = useState<WaitingReason>('INFORMATION');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [final, setFinal] = useState(ticket.charge ? String(ticket.charge.estimatePaise / 100) : '');
  const [waive, setWaive] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const n = note.trim();
  const errors = {
    note: resolve
      ? n.length < 10 || n.length > 2000
        ? 'Write what was done before resolving.'
        : null
      : n.length < 5 || n.length > 1000
        ? 'Ask the question in 5 to 1000 characters.'
        : null,
    final: approved && !waive && !isRupees(final) ? 'Enter the final charge in rupees.' : null,
    waive:
      approved && waive && (waiveReason.trim().length < 5 || waiveReason.trim().length > 300)
        ? 'Enter 5 to 300 characters.'
        : null,
    photo:
      resolve && ticket.requiresAfterPhoto && files.length === 0
        ? 'This category needs an after photo.'
        : null,
  };
  const submit = async () => {
    setTouched(true);
    setProblem(null);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      await onConfirm({
        action,
        note: n,
        ...(resolve ? {} : { waitingReason: reason }),
        ...(resolve && files.length ? { fileIds: files.map(f => f.fileId) } : {}),
        ...(approved
          ? waive
            ? { waiveReason: waiveReason.trim() }
            : { chargeFinalPaise: toPaise(final) }
          : {}),
      });
    } catch (e) {
      setProblem(helpdeskError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title={resolve ? 'Mark resolved' : 'Waiting on resident'}
      description={
        resolve
          ? 'The resident is told and can confirm the fix.'
          : 'The SLA clock pauses until the resident answers.'
      }
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={resolve ? 'gold' : 'primary'} loading={busy} onClick={() => void submit()}>
            {resolve ? 'Mark resolved' : 'Ask the resident'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {problem && <Alert tone="bad">{problem}</Alert>}
        {!resolve && (
          <Select
            label="Why are you waiting?"
            value={reason}
            onChange={e => setReason(e.target.value as WaitingReason)}
            options={WAITING_REASONS}
          />
        )}
        <Textarea
          label={resolve ? 'What was done?' : 'Your question for the resident'}
          value={note}
          onChange={e => setNote(e.target.value)}
          error={touched ? errors.note : null}
          required
        />
        {resolve && (
          <>
            <AttachmentPicker label="After photos" value={files} onChange={setFiles} disabled={busy} />
            {touched && errors.photo && (
              <p role="alert" className="text-[12.5px] text-bad">
                {errors.photo}
              </p>
            )}
          </>
        )}
        {approved && ticket.charge && (
          <fieldset className="grid gap-2 rounded-xl border border-[var(--line)] p-3">
            <legend className="px-1 text-[13px] font-semibold">
              Charge (estimate {inr(ticket.charge.estimatePaise)} approved)
            </legend>
            {!waive ? (
              <Input
                label="Final charge (₹)"
                inputMode="decimal"
                value={final}
                onChange={e => setFinal(e.target.value)}
                error={touched ? errors.final : null}
              />
            ) : (
              <Input
                label="Why is the charge waived?"
                value={waiveReason}
                onChange={e => setWaiveReason(e.target.value)}
                error={touched ? errors.waive : null}
              />
            )}
            <button
              type="button"
              className="w-fit text-[13px] font-semibold underline"
              onClick={() => setWaive(w => !w)}
            >
              {waive ? 'Enter a final charge instead' : 'Waive the charge'}
            </button>
          </fieldset>
        )}
      </div>
    </Modal>
  );
}

/** Merge a duplicate into an open building issue (spec 8.15): choose from the similar ones or type the number. */
export function MergeDialog({
  similar,
  onCancel,
  onConfirm,
}: {
  similar: SimilarTicket[];
  onCancel: () => void;
  onConfirm: (input: { intoTicketId: number; note?: string }) => Promise<void>;
}) {
  const [target, setTarget] = useState(similar[0] ? String(similar[0].id) : '');
  const [manual, setManual] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const id = Number(target || manual);
  const error = !Number.isInteger(id) || id <= 0 ? 'Choose the issue to merge into.' : null;
  const submit = async () => {
    setTouched(true);
    setProblem(null);
    if (error) return;
    setBusy(true);
    try {
      await onConfirm({ intoTicketId: id, ...(note.trim() ? { note: note.trim() } : {}) });
    } catch (e) {
      setProblem(helpdeskError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title="Merge into another issue"
      description="This ticket closes as a duplicate. Its residents and Me too votes move to the issue you choose."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Merge
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {problem && <Alert tone="bad">{problem}</Alert>}
        {similar.length > 0 ? (
          <Select
            label="Merge into"
            value={target}
            onChange={e => setTarget(e.target.value)}
            error={touched ? error : null}
            options={[
              { value: '', label: 'Choose an open issue' },
              ...similar.map(s => ({ value: String(s.id), label: `${s.ticketNo} ${s.title}` })),
            ]}
          />
        ) : (
          <Input
            label="Issue id to merge into"
            hint="No similar open issue was found. Enter the id of the open building issue."
            inputMode="numeric"
            value={manual}
            onChange={e => setManual(e.target.value.replace(/\D/g, ''))}
            error={touched ? error : null}
          />
        )}
        <Textarea
          label="Note (optional)"
          value={note}
          maxLength={300}
          onChange={e => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Send a cost estimate to the resident (spec 8.16). */
export function EstimateDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (input: { estimatePaise: number; note: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const paise = toPaise(amount);
  const errors = {
    amount: !isRupees(amount) || paise < 100 || paise > 10_000_000 ? 'Enter from ₹1 up to ₹1,00,000.' : null,
    note: note.trim().length < 5 || note.trim().length > 300 ? 'Enter 5 to 300 characters.' : null,
  };
  const submit = async () => {
    setTouched(true);
    setProblem(null);
    if (errors.amount || errors.note) return;
    setBusy(true);
    try {
      await onConfirm({ estimatePaise: paise, note: note.trim() });
    } catch (e) {
      setProblem(helpdeskError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title="Send an estimate"
      description="The flat's owner or tenant approves it before the work is charged."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Send estimate
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {problem && <Alert tone="bad">{problem}</Alert>}
        <Input
          label="Estimate (₹)"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          error={touched ? errors.amount : null}
          required
        />
        <Textarea
          label="What the amount covers"
          value={note}
          maxLength={300}
          onChange={e => setNote(e.target.value)}
          error={touched ? errors.note : null}
          required
        />
      </div>
    </Modal>
  );
}
