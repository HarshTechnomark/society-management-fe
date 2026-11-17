'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { inr } from '@/lib/money';
import { accountsStatementsService } from '@/services/accountsStatements.service';
import type { StatementLine } from '@/types/accountsStatements';
import { QUICK_ACCOUNTS, bankError } from './format';

export const lineAmount = (l: StatementLine) => (l.creditPaise > 0 ? l.creditPaise : l.debitPaise);
export const lineIsCredit = (l: StatementLine) => l.creditPaise > 0;

/** Post a journal from a statement line and match it (spec 8.16 create-entry). */
export function CreateEntryDialog({
  line,
  onClose,
  onDone,
}: {
  line: StatementLine;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [pick, setPick] = useState(QUICK_ACCOUNTS[0].code);
  const [other, setOther] = useState('');
  const [narration, setNarration] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e: Record<string, string> = {};
    const code = pick === 'OTHER' ? other.trim() : pick;
    if (!/^[0-9]{3,6}(-[0-9]{1,4})?$/.test(code)) e.code = 'Enter the account code, for example 5600.';
    const n = narration.trim();
    if (n && (n.length < 3 || n.length > 200)) e.narration = 'Use 3 to 200 characters, or leave it empty.';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await accountsStatementsService.createEntry(line.id, {
        ledgerAccountCode: code,
        ...(n ? { narration: n } : {}),
        version: line.version,
      });
      toast.show('Entry created and matched.');
      onDone();
    } catch (err) {
      setFailed(bankError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Create an entry from this line"
      description={`${inr(lineAmount(line))} ${lineIsCredit(line) ? 'received' : 'paid'}: ${line.description}`}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Create entry
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {failed && <Alert tone="bad">{failed}</Alert>}
        <Select
          label="Account for the other side"
          value={pick}
          error={pick === 'OTHER' ? undefined : errors.code}
          onChange={e => setPick(e.target.value)}
          options={[
            ...QUICK_ACCOUNTS.map(a => ({ value: a.code, label: a.label })),
            { value: 'OTHER', label: 'Other account code' },
          ]}
        />
        {pick === 'OTHER' && (
          <Input
            label="Account code"
            value={other}
            error={errors.code}
            onChange={e => setOther(e.target.value)}
            required
          />
        )}
        <Input
          label="Narration (optional)"
          value={narration}
          error={errors.narration}
          hint="Leave empty to use the bank's description."
          onChange={e => setNarration(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Ignore a line with a reason of 5 to 200 characters. */
export function IgnoreDialog({
  line,
  onClose,
  onDone,
}: {
  line: StatementLine;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = reason.trim();
    if (t.length < 5 || t.length > 200) {
      setError('Enter a reason of 5 to 200 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await accountsStatementsService.ignore(line.id, { reason: t, version: line.version });
      toast.show('Line ignored.');
      onDone();
    } catch (e) {
      setError(bankError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Ignore this line"
      description={line.description}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Ignore line
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        value={reason}
        error={error ?? undefined}
        onChange={e => setReason(e.target.value)}
        required
      />
    </Modal>
  );
}
