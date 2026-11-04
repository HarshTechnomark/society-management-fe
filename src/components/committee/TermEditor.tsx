'use client';
import { useState } from 'react';
import { Card } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { committeeService } from '@/services/committee.service';
import type { Term, TermKind } from '@/types/committee';
import { Loading } from '@/components/residents/common';
import { SeatFields } from './SeatFields';
import { KIND_LABEL, committeeError, existingDraftId, opts, today } from './format';
import {
  emptyForm,
  formErrorsFromApi,
  formFromTerm,
  hasErrors,
  newSeatRow,
  toCreate,
  toPatch,
  validateForm,
  type EditorMode,
  type FormErrors,
  type TermForm,
} from './termForm';

interface Props {
  mode: EditorMode;
  termId?: number;
  onClose: () => void;
  onSaved: () => void;
  /** A draft already exists: open it instead. */
  onOpenDraft: (id: number) => void;
}

/** Create or edit a draft term, or record a past committee (spec 11.3). Full page; the page scrolls on a phone. */
export function TermEditor(props: Props) {
  const draft = useLoad(
    () => (props.termId ? committeeService.term(props.termId) : Promise.resolve(null)),
    props.termId,
  );
  if (props.mode === 'edit')
    return <Loading load={draft}>{t => (t ? <EditorForm {...props} term={t} /> : null)}</Loading>;
  return <EditorForm {...props} term={null} />;
}

function EditorForm({ mode, term, onClose, onSaved, onOpenDraft }: Props & { term: Term | null }) {
  const toast = useToast();
  const [form, setForm] = useState<TermForm>(() => (term ? formFromTerm(term) : emptyForm()));
  const [errs, setErrs] = useState<FormErrors>({ form: {}, seats: {} });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [clash, setClash] = useState<number | null>(null);
  const past = mode === 'past';
  const election = term?.source === 'ELECTION';
  const title = mode === 'edit' ? 'Edit draft committee' : past ? 'Record a past committee' : 'Add committee';
  const set = (patch: Partial<TermForm>) => setForm(f => ({ ...f, ...patch }));
  const setSeat = (key: string, patch: Partial<TermForm['seats'][number]>) =>
    setForm(f => ({ ...f, seats: f.seats.map(s => (s.key === key ? { ...s, ...patch } : s)) }));
  const atStrength = form.seats.length >= form.strength;

  const failFromApi = (e: unknown) => {
    setProblem(committeeError(e));
    setClash(existingDraftId(e));
    if (!(e instanceof ApiError)) return;
    setErrs(formErrorsFromApi(e, form.seats, term?.seats.map(x => x.seatId) ?? [], committeeError(e)));
  };

  const save = async () => {
    setProblem(null);
    setClash(null);
    const found = validateForm(form, mode, today());
    setErrs(found);
    if (hasErrors(found)) {
      setProblem('Check the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'edit' && term) await committeeService.updateTerm(term.id, toPatch(form, term.version));
      else await committeeService.createTerm(toCreate(form, mode));
      toast.show(
        mode === 'edit' ? 'Draft saved.' : past ? 'Past committee saved.' : 'Draft committee saved.',
      );
      onSaved();
    } catch (e) {
      failFromApi(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        void save();
      }}
      noValidate
      aria-label={title}
    >
      <h2 className="mb-1 text-[20px] font-bold">{title}</h2>
      <p className="mb-4 max-w-2xl text-[14px] text-muted">
        {past
          ? 'Keep the history of the society. Past committees have no roles and no flats.'
          : election
            ? 'Elected members come from the election result. Set their designations and portfolios.'
            : 'Saved as a draft. Roles change only when you activate the committee.'}
      </p>
      {problem && (
        <Alert tone="bad">
          <span>
            {problem}
            {clash !== null && (
              <>
                {' '}
                <button type="button" className="font-bold underline" onClick={() => onOpenDraft(clash)}>
                  Open the existing draft
                </button>
              </>
            )}
          </span>
        </Alert>
      )}
      <Card title="Term" className="mb-4">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input
            label="Name"
            value={form.name}
            error={errs.form.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="Managing Committee 2024-2029"
            required
          />
          <Select
            label="Kind"
            value={form.kind}
            onChange={e => set({ kind: e.target.value as TermKind })}
            options={opts(KIND_LABEL)}
          />
          <Input
            label="Start date"
            type="date"
            value={form.startDate}
            error={errs.form.startDate}
            onChange={e => set({ startDate: e.target.value })}
            required
          />
          <Input
            label="End date"
            type="date"
            value={form.endDate}
            error={errs.form.endDate}
            hint="Up to 5 years"
            onChange={e => set({ endDate: e.target.value })}
            required
          />
          <div>
            <Input
              label="Strength (number of seats)"
              type="number"
              inputMode="numeric"
              min={3}
              max={25}
              value={String(form.strength)}
              error={errs.form.strength}
              hint="3 to 25"
              onChange={e => set({ strength: Number(e.target.value) })}
            />
          </div>
          {past || mode === 'new' ? (
            <Input
              label={past ? 'Resolution reference' : 'Resolution reference (optional now)'}
              value={form.resolutionRef}
              error={errs.form.resolutionRef}
              hint={
                past
                  ? 'The general body resolution that records this committee.'
                  : 'Needed when you activate.'
              }
              onChange={e => set({ resolutionRef: e.target.value })}
              required={past}
            />
          ) : null}
        </div>
        <Textarea
          label="Notes"
          value={form.notes}
          error={errs.form.notes}
          onChange={e => set({ notes: e.target.value })}
        />
      </Card>

      <h3 className="mb-2 text-[16px] font-bold">
        Seats ({form.seats.length} of {form.strength})
      </h3>
      {errs.form.seats && (
        <p role="alert" className="mb-2 text-[13px] font-medium text-bad">
          {errs.form.seats}
        </p>
      )}
      {form.seats.map((s, i) => (
        <SeatFields
          key={s.key}
          index={i}
          row={s}
          past={past}
          lockHolder={!!election}
          errors={errs.seats[s.key] ?? {}}
          canRemove={!election && form.seats.length > 1}
          onChange={p => setSeat(s.key, p)}
          onRemove={() => set({ seats: form.seats.filter(x => x.key !== s.key) })}
        />
      ))}
      {!election && (
        <Button
          variant="glass"
          size="sm"
          disabled={atStrength || form.seats.length >= 25}
          title={atStrength ? 'All seats of the strength are used. Raise the strength first.' : undefined}
          onClick={() => set({ seats: [...form.seats, newSeatRow()] })}
        >
          Add seat
        </Button>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--line)] pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {mode === 'edit' ? 'Save draft' : past ? 'Save past committee' : 'Save draft committee'}
        </Button>
      </div>
    </form>
  );
}
