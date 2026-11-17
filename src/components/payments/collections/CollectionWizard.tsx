'use client';
import { plural } from '@/lib/plural';
import { useRef, useState } from 'react';
import { FundPicker } from '@/components/accounts/pickers/FundPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { cx } from '@/components/ui/cx';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { collectionsService } from '@/services/collections.service';
import type { AmountMode, CollectionDetail, CollectionKind, PayListVisibility } from '@/types/collections';
import { ChosenFlats } from './ChosenFlats';
import { KIND_LABEL, MODE_LABEL, VISIBILITY_LABEL, collectionError, todayIso } from './format';
import {
  STEP_NAMES,
  draftKey,
  draftOf,
  emptyDraft,
  flatCount,
  stepOfField,
  targetHint,
  toInput,
  validateStep,
  type Draft,
  type Errors,
} from './wizardModel';

const FIELD_CODES: Record<string, keyof Draft> = {
  COLLECTION_TITLE_EXISTS: 'title',
  MANDATORY_MUST_BE_FIXED: 'isMandatory',
  COLLECTION_DUE_DATE_PAST: 'dueDate',
  COLLECTION_NO_AUDIENCE: 'audienceType',
  FUND_NOT_FOUND: 'fundId',
};

const optionList = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map(value => ({ value, label: labels[value] }));

/**
 * New collection wizard (spec 11.1): What, Amount, Who pays, Fund. With `editing` it changes a draft, a rejected
 * collection or one with changes requested. "Submit for approval" saves, then submits.
 */
export function CollectionWizard({
  editing,
  onClose,
  onDone,
}: {
  editing?: CollectionDetail;
  onClose: () => void;
  onDone: (c: CollectionDetail, submitted: boolean) => void;
}) {
  const today = todayIso();
  const [d, setD] = useState<Draft>(() => (editing ? draftOf(editing) : emptyDraft(today)));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  // once saved, a retry changes the same collection instead of creating a second one
  const saved = useRef<CollectionDetail | null>(editing ?? null);
  const buildings = useLoad(() => collectionsService.buildings());
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: undefined }));
  };
  const flats = flatCount(d, buildings.data ?? []);

  const next = () => {
    const e = validateStep(step, d, today);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(s => s + 1);
  };

  const save = async (submit: boolean) => {
    for (let s = 0; s < 4; s++) {
      const e = validateStep(s, d, today);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(s);
        return;
      }
    }
    setBusy(submit ? 'submit' : 'draft');
    setProblem(null);
    try {
      const body = toInput(d);
      let c = saved.current
        ? await collectionsService.update(saved.current.id, { ...body, version: saved.current.version })
        : await collectionsService.create(body);
      saved.current = c;
      if (submit) {
        c = await collectionsService.submit(c.id, c.version);
        saved.current = c;
      }
      onDone(c, submit);
    } catch (e) {
      setProblem(collectionError(e));
      if (e instanceof ApiError) {
        const fields: Errors = {};
        for (const f of e.errors ?? []) fields[draftKey(f.field)] = f.message;
        const byCode = FIELD_CODES[e.code];
        if (byCode) fields[byCode] = collectionError(e);
        const keys = Object.keys(fields);
        if (keys.length) {
          setErrors(fields);
          setStep(stepOfField(keys[0]));
          setProblem(null);
        }
      }
    } finally {
      setBusy(null);
    }
  };

  const last = step === 3;
  return (
    <Modal
      open
      wide
      onClose={busy ? () => {} : onClose}
      title={editing ? 'Edit collection' : 'New collection'}
      description={`Step ${step + 1} of 4: ${STEP_NAMES[step]}`}
      footer={
        <>
          <Button variant="ghost" disabled={!!busy} onClick={step === 0 ? onClose : () => setStep(step - 1)}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {last ? (
            <>
              <Button
                variant="glass"
                loading={busy === 'draft'}
                disabled={!!busy}
                onClick={() => void save(false)}
              >
                Save as draft
              </Button>
              <Button loading={busy === 'submit'} disabled={!!busy} onClick={() => void save(true)}>
                Submit for approval
              </Button>
            </>
          ) : (
            <Button onClick={next}>Next</Button>
          )}
        </>
      }
    >
      <ol aria-label="Steps" className="mb-4 flex gap-2 text-[12.5px] font-semibold">
        {STEP_NAMES.map((n, i) => (
          <li
            key={n}
            aria-current={i === step ? 'step' : undefined}
            className={cx(
              'rounded-full px-3 py-1',
              i === step ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 text-muted',
            )}
          >
            {i + 1} {n}
          </li>
        ))}
      </ol>
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem}
        </Alert>
      )}

      {step === 0 && (
        <>
          <Input
            label="Title"
            value={d.title}
            maxLength={80}
            error={errors.title}
            hint="For example Ganesh Utsav 2026"
            onChange={e => set('title', e.target.value)}
            required
          />
          <Select
            label="Kind"
            value={d.kind}
            onChange={e => set('kind', e.target.value as CollectionKind)}
            options={optionList(KIND_LABEL)}
          />
          <Textarea
            label="Purpose"
            value={d.purpose}
            maxLength={1000}
            rows={4}
            error={errors.purpose}
            hint="Residents read this before they pay."
            onChange={e => set('purpose', e.target.value)}
            required
          />
        </>
      )}

      {step === 1 && (
        <>
          <Select
            label="How much does each flat pay"
            value={d.amountMode}
            onChange={e => {
              const mode = e.target.value as AmountMode;
              set('amountMode', mode);
              if (mode !== 'FIXED_PER_UNIT') set('isMandatory', false);
            }}
            options={optionList(MODE_LABEL)}
          />
          <Input
            label={d.amountMode === 'FIXED_PER_UNIT' ? 'Amount per flat (₹)' : 'Suggested amount (₹)'}
            inputMode="decimal"
            value={d.amount}
            error={errors.amount}
            hint={d.amountMode === 'VOLUNTARY' ? 'Optional. Shown as a suggestion.' : undefined}
            onChange={e => set('amount', e.target.value)}
            required={d.amountMode !== 'VOLUNTARY'}
          />
          {d.amountMode === 'MIN_PER_UNIT' && (
            <Input
              label="Minimum (₹)"
              inputMode="decimal"
              value={d.minimum}
              error={errors.minimum}
              hint="Nobody can pay less than this."
              onChange={e => set('minimum', e.target.value)}
              required
            />
          )}
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-[13px] font-semibold">Type</legend>
            <div className="grid gap-2 min-[560px]:grid-cols-2">
              {(
                [
                  [false, 'Optional', 'Nobody becomes a defaulter. No late interest.'],
                  [true, 'Mandatory', "Adds an invoice to every flat's dues."],
                ] as const
              ).map(([value, name, text]) => (
                <label
                  key={name}
                  className={cx(
                    'flex cursor-pointer items-start gap-2.5 rounded-2xl border-[1.5px] p-3',
                    d.isMandatory === value
                      ? 'border-navy bg-white'
                      : 'border-[rgba(20,35,44,0.16)] bg-white/60',
                    value && d.amountMode !== 'FIXED_PER_UNIT' && 'cursor-not-allowed opacity-55',
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    className="mt-1 accent-[#143041]"
                    checked={d.isMandatory === value}
                    disabled={value && d.amountMode !== 'FIXED_PER_UNIT'}
                    onChange={() => set('isMandatory', value)}
                  />
                  <span>
                    <span className="block text-[14.5px] font-bold">{name}</span>
                    <span className="block text-[13px] text-muted">{text}</span>
                  </span>
                </label>
              ))}
            </div>
            {d.amountMode !== 'FIXED_PER_UNIT' && (
              <p className="mt-1.5 text-[12.5px] text-muted">
                A mandatory collection must be a fixed amount per flat.
              </p>
            )}
            {errors.isMandatory && (
              <p className="mt-1.5 text-[12.5px] font-medium text-bad">{errors.isMandatory}</p>
            )}
          </fieldset>
        </>
      )}

      {step === 2 && (
        <>
          <Select
            label="Who pays"
            value={d.audienceType}
            error={errors.audienceType}
            onChange={e => set('audienceType', e.target.value as Draft['audienceType'])}
            options={[
              { value: 'ALL', label: 'All flats' },
              { value: 'BUILDINGS', label: 'A tower' },
              { value: 'UNITS', label: 'Chosen flats' },
            ]}
          />
          {d.audienceType === 'BUILDINGS' && (
            <fieldset className="mb-4">
              <legend className="mb-1.5 text-[13px] font-semibold">Towers</legend>
              {(buildings.data ?? []).map(b => (
                <Checkbox
                  key={b.id}
                  label={b.label}
                  className="!mb-1.5"
                  checked={d.buildingIds.includes(b.id)}
                  onChange={e =>
                    set(
                      'buildingIds',
                      e.target.checked ? [...d.buildingIds, b.id] : d.buildingIds.filter(x => x !== b.id),
                    )
                  }
                />
              ))}
              {errors.buildingIds && (
                <p className="text-[12.5px] font-medium text-bad">{errors.buildingIds}</p>
              )}
            </fieldset>
          )}
          {d.audienceType === 'UNITS' && (
            <ChosenFlats value={d.units} onChange={v => set('units', v)} error={errors.units} />
          )}
          <Checkbox
            label="Also ask flats with no resident"
            checked={d.includeVacant}
            onChange={e => set('includeVacant', e.target.checked)}
          />
          {flats !== null && (
            <p className="mb-4 text-[13.5px] text-muted">
              {d.includeVacant
                ? `${plural(flats, 'flat')} will see this in their Pay list`
                : `Up to ${plural(flats, 'flat')} will see this in their Pay list. Flats with no resident are left out when you publish.`}
            </p>
          )}
          <Input
            label="Due date"
            type="date"
            value={d.dueDate}
            min={today}
            error={errors.dueDate}
            onChange={e => set('dueDate', e.target.value)}
            required
          />
        </>
      )}

      {step === 3 && (
        <>
          <FundPicker value={d.fundId} onChange={v => set('fundId', v)} error={errors.fundId} required />
          <Input
            label="Target (₹)"
            inputMode="decimal"
            value={d.target}
            error={errors.target}
            hint={targetHint(d, flats)}
            onChange={e => set('target', e.target.value)}
            required={d.amountMode === 'VOLUNTARY'}
          />
          <Select
            label="Who paid list"
            value={d.payListVisibility}
            hint="Names, phones and payer identities are never shown to residents."
            onChange={e => set('payListVisibility', e.target.value as PayListVisibility)}
            options={optionList(VISIBILITY_LABEL)}
          />
          <Checkbox
            label="Also send a notice with a Pay button"
            checked={d.sendNotice}
            onChange={e => set('sendNotice', e.target.checked)}
          />
          <p className="text-[13px] text-muted">
            A different committee member must approve before you can publish.
          </p>
        </>
      )}
    </Modal>
  );
}
