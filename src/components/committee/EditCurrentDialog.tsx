'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { committeeService } from '@/services/committee.service';
import type { Term, TermPatch } from '@/types/committee';
import { committeeError } from './format';

const iso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * "Edit term" of the current committee (spec 11.2): name, notes, end date, strength. Changing the end date
 * (also an extension after the term lapsed) or the strength needs a reason; the API asks for a fresh sign in.
 */
export function EditCurrentDialog({
  term,
  seated,
  onClose,
  onSaved,
}: {
  term: Term;
  seated: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(term.name);
  const [notes, setNotes] = useState(term.notes ?? '');
  const [endDate, setEndDate] = useState(term.endDate);
  const [strength, setStrength] = useState(term.strength);
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsReason = endDate !== term.endDate || strength !== term.strength;
  const extending = endDate > term.endDate;

  const save = async () => {
    setProblem(null);
    const e: Record<string, string> = {};
    if (name.trim().length < 3 || name.trim().length > 120) e.name = 'Enter a name of 3 to 120 characters.';
    if (!iso(endDate)) e.endDate = 'Choose the end date.';
    else if (endDate <= term.startDate) e.endDate = 'The end date must be after the start date.';
    if (!Number.isInteger(strength) || strength < 3 || strength > 25) e.strength = 'Choose 3 to 25 seats.';
    else if (strength < seated) e.strength = `${seated} seats are filled. The strength cannot be lower.`;
    if (notes.length > 1000) e.notes = 'Notes can have at most 1000 characters.';
    const why = reason.trim();
    if (needsReason && (why.length < 5 || why.length > 500))
      e.reason = 'Enter a reason of 5 to 500 characters.';
    setErrs(e);
    if (Object.keys(e).length) return;
    const body: TermPatch = { version: term.version };
    if (name.trim() !== term.name) body.name = name.trim();
    if (notes.trim() !== (term.notes ?? '')) body.notes = notes.trim() ? notes.trim() : null;
    if (endDate !== term.endDate) body.endDate = endDate;
    if (strength !== term.strength) body.strength = strength;
    if (needsReason) body.reason = why;
    if (Object.keys(body).length === 1) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await committeeService.updateTerm(term.id, body);
      toast.show(extending ? 'The end date is extended.' : 'The committee is updated.');
      onSaved();
    } catch (err) {
      setProblem(committeeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit term"
      description="Change the name, notes, end date or strength. The seats change through Make changes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      {problem && <Alert tone="bad">{problem}</Alert>}
      <Input label="Name" value={name} error={errs.name} onChange={e => setName(e.target.value)} />
      <Input
        label="End date"
        type="date"
        value={endDate}
        error={errs.endDate}
        hint={
          term.status === 'EXPIRED'
            ? 'Set a date from today on to bring the committee back from caretaker.'
            : 'Up to 5 years from the start.'
        }
        onChange={e => setEndDate(e.target.value)}
      />
      <Input
        label="Strength (number of seats)"
        type="number"
        min={3}
        max={25}
        value={String(strength)}
        error={errs.strength}
        onChange={e => setStrength(Number(e.target.value))}
      />
      <Textarea label="Notes" value={notes} error={errs.notes} onChange={e => setNotes(e.target.value)} />
      {needsReason && (
        <Input
          label="Reason"
          value={reason}
          error={errs.reason}
          hint="Needed to change the end date or strength. You will be asked to confirm it is you."
          onChange={e => setReason(e.target.value)}
          required
        />
      )}
    </Modal>
  );
}
