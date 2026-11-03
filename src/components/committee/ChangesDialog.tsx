'use client';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/apiClient';
import { shortDate } from '@/lib/money';
import { committeeService } from '@/services/committee.service';
import type { Designation, Plan, Term, VacateReason } from '@/types/committee';
import {
  MAX_CHANGES,
  leavesNoChairman,
  newAdd,
  newRedesignate,
  newVacate,
  toChanges,
  validateChanges,
  type AddJoin,
  type ChangeRow,
} from './changesForm';
import { FlatSelect, HolderPicker } from './SeatFields';
import {
  DESIGNATION_LABEL,
  EXIT_LABEL,
  JOIN_LABEL,
  committeeError,
  designationLabel,
  opts,
  roleLabel,
  today,
} from './format';
import { PlanView } from './PlanView';
import { needsReplaceChoice } from './termForm';

const DESIGNATION_OPTS = opts<Designation>(DESIGNATION_LABEL);
const ADD_JOIN_OPTS = (['CO_OPTED', 'NOMINATED', 'APPOINTED'] as AddJoin[]).map(value => ({
  value,
  label: JOIN_LABEL[value],
}));
const VACATE_OPTS = (['RESIGNED', 'REMOVED', 'DECEASED', 'DISQUALIFIED'] as VacateReason[]).map(value => ({
  value,
  label: EXIT_LABEL[value],
}));

type Step = 'edit' | 'preview' | 'done';

/**
 * Make changes dialog (spec 11.5) for an active or caretaker committee: vacate, change designation or add
 * (co-opt, nominate, appoint) with an effective date; then **Preview** (same layout as the activation plan)
 * and **Apply** with a reason. The API asks for a fresh sign in on apply; the API client opens it.
 */
export function ChangesDialog({
  term,
  fill,
  onClose,
  onDone,
}: {
  term: Term;
  /** Opened from "Fill" on a vacancy card: starts with an add row for this designation. */
  fill?: Designation | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const seated = useMemo(() => term.seats.filter(s => s.status === 'SEATED'), [term.seats]);
  const [rows, setRows] = useState<ChangeRow[]>(() => (fill ? [newAdd(fill)] : []));
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [step, setStep] = useState<Step>('edit');
  const [errs, setErrs] = useState<ReturnType<typeof validateChanges>>({ form: {}, rows: {} });
  const [problem, setProblem] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const noChairman = leavesNoChairman(rows, term.seats);
  const patch = (k: string, p: Partial<ChangeRow>) =>
    setRows(rs => rs.map(r => (r.key === k ? ({ ...r, ...p } as ChangeRow) : r)));
  const remove = (k: string) => setRows(rs => rs.filter(r => r.key !== k));
  const add = (r: ChangeRow) => {
    if (rows.length < MAX_CHANGES) setRows(rs => [...rs, r]);
  };
  const body = () => ({
    version: term.version,
    effectiveDate,
    changes: toChanges(rows),
  });

  const runPreview = async () => {
    setPlan(await committeeService.changesPreview(term.id, body()));
  };

  const preview = async () => {
    setProblem(null);
    const v = validateChanges(rows, term.seats, effectiveDate, today(), term.tookChargeOn);
    setErrs(v);
    if (Object.keys(v.form).length || Object.keys(v.rows).length) return;
    if (noChairman) {
      setProblem(committeeError(new ApiError(422, 'COMMITTEE_CHAIRMAN_REQUIRED', '')));
      return;
    }
    setBusy(true);
    try {
      await runPreview();
      setStale(false);
      setStep('preview');
    } catch (e) {
      setProblem(committeeError(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan) return;
    const why = reason.trim();
    if (why.length < 5 || why.length > 500) {
      setReasonError('Enter a reason of 5 to 500 characters.');
      return;
    }
    setReasonError(null);
    setProblem(null);
    setBusy(true);
    try {
      await committeeService.applyChanges(term.id, { ...body(), previewHash: plan.previewHash, reason: why });
      toast.show('The committee is updated.');
      setStep('done');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'COMMITTEE_PREVIEW_STALE') {
        setStale(true);
        try {
          await runPreview();
        } catch (e2) {
          setProblem(committeeError(e2));
        }
      } else if (e instanceof ApiError && e.code === 'COMMITTEE_CHAIRMAN_REQUIRED') {
        setStep('edit');
        setProblem(committeeError(e));
      } else {
        setProblem(committeeError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const finish = () => (step === 'done' ? onDone() : onClose());
  const seatLabel = (id: string) => {
    const s = term.seats.find(x => x.seatId === id);
    return s ? `${s.name} (${designationLabel(s.designation)})` : id;
  };
  const seatOptions = [
    { value: '', label: 'Choose a seat' },
    ...seated.map(s => ({ value: s.seatId, label: `${s.name} (${designationLabel(s.designation)})` })),
  ];

  const footer =
    step === 'edit' ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={() => void preview()}>
          Preview
        </Button>
      </>
    ) : step === 'preview' ? (
      <>
        <Button variant="ghost" disabled={busy} onClick={() => setStep('edit')}>
          Back
        </Button>
        <Button loading={busy} disabled={!plan || plan.blockers.length > 0} onClick={() => void apply()}>
          Apply changes
        </Button>
      </>
    ) : (
      <Button onClick={finish}>Done</Button>
    );

  return (
    <Modal
      open
      wide
      sticky={busy}
      onClose={finish}
      title={step === 'edit' ? 'Make changes' : step === 'preview' ? 'Check the changes' : 'Done'}
      description={
        step === 'edit'
          ? `${term.name}. Vacate a seat, change a designation or add a member. Preview comes before anything changes.`
          : undefined
      }
      footer={footer}
    >
      {problem && <Alert tone="bad">{problem}</Alert>}
      {step === 'edit' && (
        <>
          <Input
            label="Effective date"
            type="date"
            value={effectiveDate}
            max={today()}
            min={term.tookChargeOn ?? undefined}
            error={errs.form.effectiveDate}
            onChange={e => setEffectiveDate(e.target.value)}
          />
          {errs.form.changes && <Alert tone="bad">{errs.form.changes}</Alert>}
          {rows.length === 0 && !errs.form.changes && (
            <p className="mb-3 text-[14px] text-muted">No changes yet. Choose what to do below.</p>
          )}
          {rows.map((r, i) => {
            const e = errs.rows[r.key] ?? {};
            return (
              <fieldset key={r.key} className="glass mb-3 p-4" data-testid="change-row">
                <legend className="px-1 text-[14px] font-bold">
                  {i + 1}.{' '}
                  {r.op === 'VACATE'
                    ? 'Vacate a seat'
                    : r.op === 'REDESIGNATE'
                      ? 'Change designation'
                      : 'Add a member'}
                </legend>
                {r.op === 'VACATE' && (
                  <>
                    <Select
                      label="Seat"
                      value={r.seatId}
                      error={e.seat}
                      options={seatOptions}
                      onChange={ev => patch(r.key, { seatId: ev.target.value })}
                    />
                    <Select
                      label="Reason for leaving"
                      value={r.exitReason}
                      options={VACATE_OPTS}
                      onChange={ev => patch(r.key, { exitReason: ev.target.value as VacateReason })}
                    />
                    <Input
                      label="Note"
                      value={r.note}
                      error={e.note}
                      hint="Optional."
                      onChange={ev => patch(r.key, { note: ev.target.value })}
                    />
                  </>
                )}
                {r.op === 'REDESIGNATE' && (
                  <>
                    <Select
                      label="Seat"
                      value={r.seatId}
                      error={e.seat}
                      options={seatOptions}
                      onChange={ev => patch(r.key, { seatId: ev.target.value })}
                    />
                    <Select
                      label="New designation"
                      value={r.designation}
                      error={e.designation}
                      options={DESIGNATION_OPTS}
                      onChange={ev => patch(r.key, { designation: ev.target.value as Designation })}
                    />
                  </>
                )}
                {r.op === 'ADD' && (
                  <>
                    <HolderPicker
                      row={r.seat}
                      error={e.holder}
                      onPick={c =>
                        patch(r.key, {
                          seat: {
                            ...r.seat,
                            userId: c.userId,
                            name: c.name,
                            roleKey: c.roleKey,
                            roleName: c.roleName,
                            replace: false,
                            unitId: null,
                            unitLabel: '',
                          },
                        })
                      }
                    />
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      <Select
                        label="Designation"
                        value={r.seat.designation}
                        options={DESIGNATION_OPTS}
                        onChange={ev =>
                          patch(r.key, { seat: { ...r.seat, designation: ev.target.value as Designation } })
                        }
                      />
                      <Select
                        label="How they join"
                        value={r.joinMode}
                        options={ADD_JOIN_OPTS}
                        onChange={ev => patch(r.key, { joinMode: ev.target.value as AddJoin })}
                      />
                    </div>
                    {r.seat.userId && (
                      <FlatSelect
                        row={r.seat}
                        error={e.flat}
                        onPick={(unitId, unitLabel) =>
                          patch(r.key, { seat: { ...r.seat, unitId, unitLabel } })
                        }
                      />
                    )}
                    <Input
                      label="Resolution reference"
                      value={r.resolutionRef}
                      error={e.resolutionRef}
                      hint={r.joinMode === 'APPOINTED' ? 'Optional for an appointment.' : 'Required.'}
                      onChange={ev => patch(r.key, { resolutionRef: ev.target.value })}
                    />
                    {needsReplaceChoice(r.seat.roleKey) && (
                      <Checkbox
                        label={
                          <>
                            Replace current role
                            <span className="block text-[12.5px] text-muted">
                              Their {r.seat.roleName ?? roleLabel(r.seat.roleKey ?? '')} access ends while
                              they are on the committee.
                            </span>
                          </>
                        }
                        checked={r.seat.replace}
                        onChange={ev => patch(r.key, { seat: { ...r.seat, replace: ev.target.checked } })}
                      />
                    )}
                  </>
                )}
                <Button
                  variant="danger-soft"
                  size="xs"
                  className="mt-2"
                  aria-label={`Remove change ${i + 1}`}
                  onClick={() => remove(r.key)}
                >
                  Remove change
                </Button>
              </fieldset>
            );
          })}
          {noChairman && (
            <Alert tone="warn">
              <span>
                <strong>Chairman needed: </strong>
                the Chairman steps down. Choose the new chairman.{' '}
                <button type="button" className="font-bold underline" onClick={() => add(newAdd('CHAIRMAN'))}>
                  Add a new chairman
                </button>
                {' or '}
                <button
                  type="button"
                  className="font-bold underline"
                  onClick={() => add(newRedesignate('', 'CHAIRMAN'))}
                >
                  make a current member the chairman
                </button>
                .
              </span>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="glass"
              size="sm"
              disabled={rows.length >= MAX_CHANGES}
              onClick={() => add(newVacate())}
            >
              Vacate a seat
            </Button>
            <Button
              variant="glass"
              size="sm"
              disabled={rows.length >= MAX_CHANGES}
              onClick={() => add(newRedesignate())}
            >
              Change designation
            </Button>
            <Button
              variant="glass"
              size="sm"
              disabled={rows.length >= MAX_CHANGES}
              onClick={() => add(newAdd())}
            >
              Add a member
            </Button>
          </div>
        </>
      )}
      {step === 'preview' && (
        <>
          {stale && (
            <Alert tone="warn">{committeeError(new ApiError(409, 'COMMITTEE_PREVIEW_STALE', ''))}</Alert>
          )}
          {plan && (
            <>
              <section aria-label="Your changes" className="mb-4">
                <h3 className="mb-1.5 text-[14px] font-bold">
                  Your changes, effective {shortDate(effectiveDate)}
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-[14px]" data-testid="change-summary">
                  {rows.map(r => (
                    <li key={r.key}>
                      {r.op === 'VACATE'
                        ? `${seatLabel(r.seatId)} leaves the committee (${EXIT_LABEL[r.exitReason]}).`
                        : r.op === 'REDESIGNATE'
                          ? `${seatLabel(r.seatId)} becomes ${designationLabel(r.designation)}.`
                          : `${r.seat.name} joins as ${designationLabel(r.seat.designation)} (${JOIN_LABEL[r.joinMode]}).`}
                    </li>
                  ))}
                </ul>
              </section>
              <PlanView plan={plan} verb="apply" />
              <Textarea
                label="Reason"
                value={reason}
                error={reasonError ?? undefined}
                hint="Kept in the audit trail. You will be asked to confirm it is you."
                onChange={ev => setReason(ev.target.value)}
                required
              />
            </>
          )}
        </>
      )}
      {step === 'done' && (
        <div role="status" data-testid="changes-result">
          <p className="text-[15px] font-semibold">The committee is updated.</p>
        </div>
      )}
    </Modal>
  );
}
