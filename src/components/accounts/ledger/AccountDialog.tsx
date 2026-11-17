'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { accountsJournalService } from '@/services/accountsJournal.service';
import type { LedgerAccount } from '@/types/accountsJournal';
import { accountsError } from '../journals/format';

const SUBTYPES = [
  { value: 'OTHER', label: 'Other' },
  { value: 'RECEIVABLE', label: 'Receivable' },
  { value: 'PAYABLE', label: 'Payable' },
  { value: 'TAX', label: 'Tax' },
];

/** Add a custom account under a group (spec 8.10 POST). */
export function AddAccountDialog({
  groups,
  initialParentId,
  onClose,
  onDone,
}: {
  groups: LedgerAccount[];
  initialParentId?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [parentId, setParentId] = useState(String(initialParentId ?? groups[0]?.id ?? ''));
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [subtype, setSubtype] = useState('OTHER');
  const [cashBook, setCashBook] = useState(false);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parent = groups.find(g => String(g.id) === parentId);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!parent) e.parent = 'Pick the group to add this account under.';
    if (!/^\d{4}$/.test(code.trim())) e.code = 'Enter a 4 digit code.';
    else if (parent && code.trim()[0] !== parent.code[0])
      e.code = `The code must start with ${parent.code[0]}, like its group.`;
    const n = name.trim();
    if (n.length < 2 || n.length > 120) e.name = 'Enter a name of 2 to 120 characters.';
    if (note.length > 300) e.note = 'Keep the note within 300 characters.';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await accountsJournalService.createAccount({
        parentId: Number(parentId),
        code: code.trim(),
        name: n,
        ...(isGroup ? { isGroup: true } : {}),
        ...(subtype !== 'OTHER' ? { subtype } : {}),
        ...(cashBook && parent?.accountType === 'EXPENSE' && !isGroup ? { isCashBookCategory: true } : {}),
        ...(note.trim() ? { description: note.trim() } : {}),
      });
      toast.show('Account added.');
      onDone();
      onClose();
    } catch (err) {
      setFailed(accountsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add an account"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Add account
          </Button>
        </>
      }
    >
      {failed && (
        <p role="alert" className="mb-3 text-[14px] text-bad">
          {failed}
        </p>
      )}
      <Select
        label="Under"
        value={parentId}
        error={errors.parent}
        onChange={e => setParentId(e.target.value)}
        options={groups.map(g => ({ value: String(g.id), label: `${g.code} ${g.name}` }))}
      />
      <Input
        label="Code"
        inputMode="numeric"
        maxLength={4}
        value={code}
        error={errors.code}
        hint="Four digits, starting like the group."
        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
      />
      <Input label="Name" value={name} error={errors.name} onChange={e => setName(e.target.value)} />
      <Select label="Kind" value={subtype} onChange={e => setSubtype(e.target.value)} options={SUBTYPES} />
      <Checkbox
        label="This is a group that holds other accounts"
        checked={isGroup}
        onChange={e => setIsGroup(e.target.checked)}
      />
      {parent?.accountType === 'EXPENSE' && !isGroup && (
        <Checkbox
          label="Show as a category in the cash book"
          checked={cashBook}
          onChange={e => setCashBook(e.target.checked)}
        />
      )}
      <Textarea
        label="Note (optional)"
        value={note}
        error={errors.note}
        onChange={e => setNote(e.target.value)}
      />
    </Modal>
  );
}

/** Rename, switch on or off and set the flags (spec 8.10 PATCH). System accounts only take the flag, label and note. */
export function EditAccountDialog({
  account,
  onClose,
  onDone,
}: {
  account: LedgerAccount;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const locked = account.isSystem;
  const [name, setName] = useState(account.name);
  const [active, setActive] = useState(account.isActive);
  const [cashBook, setCashBook] = useState(account.isCashBookCategory);
  const [label, setLabel] = useState(account.transparencyCategory ?? '');
  const [note, setNote] = useState(account.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (!locked && (n.length < 2 || n.length > 120)) e.name = 'Enter a name of 2 to 120 characters.';
    if (label.trim() && (label.trim().length < 2 || label.trim().length > 40))
      e.label = 'Use 2 to 40 characters.';
    if (note.length > 300) e.note = 'Keep the note within 300 characters.';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await accountsJournalService.updateAccount(account.id, {
        version: account.version,
        ...(locked ? {} : { name: n, isActive: active }),
        ...(account.accountType === 'EXPENSE' && !account.isGroup ? { isCashBookCategory: cashBook } : {}),
        transparencyCategory: label.trim() || null,
        description: note.trim() || null,
      });
      toast.show('Account saved.');
      onDone();
      onClose();
    } catch (err) {
      setFailed(accountsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${account.code} ${account.name}`}
      description={locked ? 'A system account. Its name, code and place cannot change.' : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      {failed && (
        <p role="alert" className="mb-3 text-[14px] text-bad">
          {failed}
        </p>
      )}
      <Input
        label="Name"
        value={name}
        disabled={locked}
        error={errors.name}
        onChange={e => setName(e.target.value)}
      />
      {!locked && (
        <Checkbox
          label="In use (switch off to stop new entries)"
          checked={active}
          onChange={e => setActive(e.target.checked)}
        />
      )}
      {account.accountType === 'EXPENSE' && !account.isGroup && (
        <Checkbox
          label="Show as a category in the cash book"
          checked={cashBook}
          onChange={e => setCashBook(e.target.checked)}
        />
      )}
      <Input
        label="Label residents see (optional)"
        value={label}
        error={errors.label}
        onChange={e => setLabel(e.target.value)}
      />
      <Textarea
        label="Note (optional)"
        value={note}
        error={errors.note}
        onChange={e => setNote(e.target.value)}
      />
    </Modal>
  );
}
