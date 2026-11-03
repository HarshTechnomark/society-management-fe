'use client';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { societySetupService } from '@/services/society-setup.service';
import type { GeneratorInput, GeneratorPreview } from '@/types/societySetup';
import {
  PATTERN_TOKENS,
  blankPos,
  blankRow,
  buildGeneratorInput,
  blankForm,
  type GenForm,
} from './generator';
import { BHK_OPTIONS, UNIT_TYPES, bhkLabel, setupError } from './format';

/** Generator dialog (spec 11.6): inputs, Preview (counts, conflicts, limit, first 200 labels), Create units. */
function GeneratorDialogInner({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<GenForm>(blankForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    hash: string;
    data: GeneratorPreview;
    input: GeneratorInput;
  } | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const existing = useLoad(
    () => (open ? societySetupService.buildings({ status: 'ACTIVE', limit: 100 }) : Promise.resolve(null)),
    open,
  );
  const choices = (existing.data?.items ?? []).filter(b => b.wings.length === 0);

  const change = (fn: (x: GenForm) => GenForm) => {
    setF(fn);
    setPreview(null);
  };
  const text =
    (k: 'floorFrom' | 'floorTo' | 'pattern' | 'skipFloors' | 'skipCells') =>
    (e: { target: { value: string } }) =>
      change(x => ({ ...x, [k]: e.target.value }));

  const run = async () => {
    const built = buildGeneratorInput(f);
    setErrors(built.errors ?? {});
    setFormError(null);
    if (!built.input) return;
    setBusy('preview');
    try {
      const data = await societySetupService.previewGenerator(built.input);
      setPreview({ hash: data.previewHash, data, input: built.input });
    } catch (e) {
      setFormError(setupError(e));
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy('commit');
    setFormError(null);
    try {
      const r = await societySetupService.commitGenerator({ ...preview.input, previewHash: preview.hash });
      toast.show(`${r.created} flats created.`);
      onDone();
      onClose();
    } catch (e) {
      setFormError(setupError(e));
    } finally {
      setBusy(null);
    }
  };

  const conflicts = preview?.data.conflicts ?? [];
  const s = preview?.data.summary;
  const over = !!s && s.countableUnits > s.limitRemaining;
  const labels = useMemo(() => preview?.data.sample.map(x => x.label) ?? [], [preview]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Generate flats"
      description="Create every flat of a tower from a numbering pattern. Preview first, nothing is saved until you press Create."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="glass" loading={busy === 'preview'} onClick={run}>
            Preview
          </Button>
          <Button
            loading={busy === 'commit'}
            disabled={!preview || conflicts.length > 0 || over || preview.data.summary.units === 0}
            onClick={commit}
          >
            Create units
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      <fieldset className="mb-3">
        <legend className="mb-2 text-[13px] font-semibold">Buildings</legend>
        {errors.buildings && <p className="mb-2 text-[12.5px] font-medium text-bad">{errors.buildings}</p>}
        {f.rows.map((r, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-start gap-2 rounded-[14px] bg-white/50 p-3">
            <div className="w-[130px]">
              <Select
                label={`Building ${i + 1} source`}
                value={r.mode}
                onChange={e =>
                  change(x => ({
                    ...x,
                    rows: x.rows.map((y, j) =>
                      j === i ? { ...y, mode: e.target.value as 'new' | 'existing' } : y,
                    ),
                  }))
                }
                options={[
                  { value: 'new', label: 'New building' },
                  { value: 'existing', label: 'Existing' },
                ]}
              />
            </div>
            {r.mode === 'existing' ? (
              <div className="min-w-[160px] flex-1">
                <Select
                  label={`Building ${i + 1}`}
                  value={r.buildingId}
                  error={errors[`building${i}`]}
                  onChange={e =>
                    change(x => ({
                      ...x,
                      rows: x.rows.map((y, j) => (j === i ? { ...y, buildingId: e.target.value } : y)),
                    }))
                  }
                  options={[
                    { value: '', label: 'Choose' },
                    ...choices.map(b => ({ value: String(b.id), label: `${b.name} (${b.code})` })),
                  ]}
                />
              </div>
            ) : (
              <>
                <div className="w-[100px]">
                  <Input
                    label={`Code ${i + 1}`}
                    value={r.code}
                    maxLength={6}
                    error={errors[`building${i}`]}
                    onChange={e =>
                      change(x => ({
                        ...x,
                        rows: x.rows.map((y, j) =>
                          j === i ? { ...y, code: e.target.value.toUpperCase() } : y,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="min-w-[140px] flex-1">
                  <Input
                    label={`Name ${i + 1}`}
                    value={r.name}
                    placeholder={r.code ? `Tower ${r.code}` : 'Tower A'}
                    onChange={e =>
                      change(x => ({
                        ...x,
                        rows: x.rows.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)),
                      }))
                    }
                  />
                </div>
              </>
            )}
            {f.rows.length > 1 && (
              <Button
                size="xs"
                variant="ghost"
                className="mt-7"
                onClick={() => change(x => ({ ...x, rows: x.rows.filter((_, j) => j !== i) }))}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {f.rows.length < 10 && (
          <Button
            size="sm"
            variant="glass"
            onClick={() => change(x => ({ ...x, rows: [...x.rows, blankRow()] }))}
          >
            Add building
          </Button>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-x-3">
        <Input
          label="Floors from"
          type="number"
          value={f.floorFrom}
          onChange={text('floorFrom')}
          error={errors.floorFrom}
        />
        <Input
          label="Floors to"
          type="number"
          value={f.floorTo}
          onChange={text('floorTo')}
          error={errors.floorTo}
        />
      </div>

      <fieldset className="mb-3">
        <legend className="mb-2 text-[13px] font-semibold">Flats per floor</legend>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <caption className="sr-only">Flats on each floor</caption>
            <thead className="text-[12px] text-muted">
              <tr>
                <th className="p-1 font-semibold">Position</th>
                <th className="p-1 font-semibold">Type</th>
                <th className="p-1 font-semibold">BHK</th>
                <th className="p-1 font-semibold">Carpet</th>
                <th className="p-1 font-semibold">Built-up</th>
                <th className="p-1 font-semibold">Super</th>
              </tr>
            </thead>
            <tbody>
              {f.positions.map((p, i) => {
                const upd = (patch: Partial<typeof p>) =>
                  change(x => ({
                    ...x,
                    positions: x.positions.map((y, j) => (j === i ? { ...y, ...patch } : y)),
                  }));
                const cell =
                  'h-9 w-full rounded-lg border border-[rgba(20,35,44,0.16)] bg-white/80 px-2 text-[13px]';
                return (
                  <tr key={i}>
                    <td className="p-1 font-semibold">{i + 1}</td>
                    <td className="p-1">
                      <select
                        aria-label={`Type of position ${i + 1}`}
                        className={cell}
                        value={p.unitType}
                        onChange={e => upd({ unitType: e.target.value as typeof p.unitType })}
                      >
                        {UNIT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <select
                        aria-label={`BHK of position ${i + 1}`}
                        className={cell}
                        value={p.bhk}
                        disabled={p.unitType !== 'FLAT'}
                        onChange={e => upd({ bhk: e.target.value })}
                      >
                        <option value="">-</option>
                        {BHK_OPTIONS.map(b => (
                          <option key={b} value={b}>
                            {bhkLabel(b)}
                          </option>
                        ))}
                      </select>
                    </td>
                    {(['carpet', 'builtUp', 'superArea'] as const).map(k => (
                      <td key={k} className="p-1">
                        <input
                          aria-label={`${k === 'carpet' ? 'Carpet' : k === 'builtUp' ? 'Built-up' : 'Super'} area of position ${i + 1}`}
                          aria-invalid={errors[`pos${i}.${k}`] ? true : undefined}
                          inputMode="decimal"
                          className={cell}
                          value={p[k]}
                          onChange={e => upd({ [k]: e.target.value })}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {Object.entries(errors)
          .filter(([k]) => k.startsWith('pos'))
          .map(([k, m]) => (
            <p key={k} className="mt-1 text-[12.5px] font-medium text-bad">
              Position {Number(k.slice(3).split('.')[0]) + 1}: {m}
            </p>
          ))}
        <div className="mt-2 flex gap-2">
          {f.positions.length < 50 && (
            <Button
              size="xs"
              variant="glass"
              onClick={() => change(x => ({ ...x, positions: [...x.positions, blankPos()] }))}
            >
              Add position
            </Button>
          )}
          {f.positions.length > 1 && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => change(x => ({ ...x, positions: x.positions.slice(0, -1) }))}
            >
              Remove last position
            </Button>
          )}
        </div>
      </fieldset>

      <Input
        label="Numbering pattern"
        value={f.pattern}
        onChange={text('pattern')}
        error={errors.pattern}
        hint="Letters, digits, - and / plus the tokens below."
      />
      <div className="-mt-2 mb-3 flex flex-wrap gap-1.5" aria-label="Pattern tokens">
        {PATTERN_TOKENS.map(t => (
          <button
            key={t}
            type="button"
            className="rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-semibold hover:bg-white"
            onClick={() => change(x => ({ ...x, pattern: (x.pattern + t).slice(0, 40) }))}
          >
            {t}
          </button>
        ))}
      </div>
      <Input
        label="Skip floors"
        value={f.skipFloors}
        onChange={text('skipFloors')}
        error={errors.skipFloors}
        placeholder="13"
        hint="Comma separated floor numbers, for example refuge floors."
      />
      <Input
        label="Skip cells"
        value={f.skipCells}
        onChange={text('skipCells')}
        error={errors.skipCells}
        placeholder="5:2, 7:4"
        hint="Floor:position pairs, comma separated."
      />

      {preview && s && (
        <section aria-label="Preview" className="mt-2 rounded-[16px] bg-white/60 p-3">
          <div className="mb-2 flex flex-wrap gap-2">
            <Chip tone="info">{s.units} flats</Chip>
            <Chip>{s.newBuildings} new buildings</Chip>
            <Chip tone={conflicts.length ? 'bad' : 'ok'}>{conflicts.length} conflicts</Chip>
            <Chip tone={over ? 'bad' : 'neutral'}>Limit remaining: {s.limitRemaining}</Chip>
          </div>
          {over && (
            <Alert tone="bad">
              This run adds {s.countableUnits} flats but your plan has room for {s.limitRemaining}.
            </Alert>
          )}
          {conflicts.length > 0 && (
            <Alert tone="bad">
              These numbers already exist:{' '}
              {conflicts
                .map(c => (typeof c === 'string' ? c : c.label))
                .slice(0, 20)
                .join(', ')}
              {conflicts.length > 20 ? ' and more' : ''}.
            </Alert>
          )}
          <p className="text-[13px] font-semibold">
            First {labels.length} of {preview.data.sampleCount} labels
          </p>
          <p className="max-h-32 overflow-y-auto text-[12.5px] text-muted">{labels.join(', ')}</p>
        </section>
      )}
    </Modal>
  );
}

/** The dialog mounts only while open, so every opening starts with a clean form. */
export function GeneratorDialog(props: { open: boolean; onClose: () => void; onDone: () => void }) {
  return props.open ? <GeneratorDialogInner {...props} /> : null;
}
