'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/common/ErrorState';
import { ApiError } from '@/lib/apiClient';
import { useLoad } from '@/hooks/useLoad';
import { societySetupService } from '@/services/society-setup.service';
import type { Onboarding, OnboardingStep, SettingItem, SocietyProfile, StepKey } from '@/types/societySetup';
import { GeneratorDialog } from './GeneratorDialog';
import { ImportDialog } from './ImportDialog';
import { ProfileForm } from './ProfileForm';
import { STEP_LABEL, fieldErrors, setupError, sqft, bhkLabel } from './format';
import { defaultPattern } from './generator';

/** What every step form gets from the wizard. */
export interface StepProps {
  ob: Onboarding;
  step: OnboardingStep;
  society: SocietyProfile;
  canEdit: boolean;
  /** Completes the step when it is still pending, then moves to the next one. */
  finish: () => Promise<void>;
  back: (() => void) | null;
  /** Skip with a reason (steps 4, 6 and 7). */
  skip: (() => void) | null;
  reload: () => void;
  onSociety: (s: SocietyProfile) => void;
}

/** The message of a failed step: the server text plus the check summary it puts in `errors[0]`. */
export function stepError(e: unknown): string {
  const base = setupError(e);
  if (e instanceof ApiError && e.code === 'ONBOARDING_STEP_INCOMPLETE' && e.errors?.[0]?.message)
    return `${base} ${e.errors[0].message}`;
  return base;
}

export function StepFooter({
  back,
  skip,
  primary,
  busy,
  disabled,
  onPrimary,
  note,
}: {
  back: (() => void) | null;
  skip: (() => void) | null;
  primary: string;
  busy?: boolean;
  disabled?: boolean;
  onPrimary: () => void;
  note?: ReactNode;
}) {
  return (
    <div className="mt-5">
      {note}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back ? (
          <Button variant="glass" onClick={back}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <span className="flex flex-wrap gap-2">
          {skip && (
            <Button variant="ghost" onClick={skip}>
              Skip for now
            </Button>
          )}
          <Button loading={busy} disabled={disabled} onClick={onPrimary}>
            {primary}
          </Button>
        </span>
      </div>
    </div>
  );
}

function useFinish(finish: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await finish();
    } catch (e) {
      setError(stepError(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, go, setError };
}

const Heading = ({ title, text }: { title: string; text: string }) => (
  <>
    <h2 className="text-[19px] font-bold">{title}</h2>
    <p className="mb-4 mt-1 text-[14px] text-muted">{text}</p>
  </>
);

/** Step 1: society profile. */
export function ProfileStep({ society, canEdit, finish, back, onSociety }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Heading title="Society profile" text="Shown on invoices and receipts." />
      {error && <Alert tone="bad">{error}</Alert>}
      <ProfileForm
        wizard
        society={society}
        canEdit={canEdit}
        submitLabel="Save and continue"
        extraActions={null}
        onSaved={async s => {
          onSociety(s);
          try {
            await finish();
          } catch (e) {
            setError(stepError(e));
          }
        }}
      />
      {back && (
        <div className="mt-2">
          <Button variant="glass" onClick={back}>
            Back
          </Button>
        </div>
      )}
    </>
  );
}

const LETTERS = 'ABCDEF';
const n = (v: string) => Number(v);

/** Step 2: towers, floors and flats per floor, with a live preview line; Advanced opens the full generator. */
export function StructureStep({ step, finish, back, canEdit, reload }: StepProps) {
  const [towers, setTowers] = useState('2');
  const [floors, setFloors] = useState('6');
  const [per, setPer] = useState('4');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(false);
  const f = useFinish(finish);
  const exists = step.checkState === 'PASS' || step.status === 'DONE';

  const t = n(towers);
  const fl = n(floors);
  const p = n(per);
  const valid =
    t >= 1 && t <= 6 && fl >= 1 && fl <= 30 && p >= 1 && p <= 10 && [t, fl, p].every(Number.isInteger);
  const preview = valid
    ? `${t * fl * p} flats: towers ${LETTERS.slice(0, t).split('').join(', ')} · ${fl} floors · ${p} per floor. Example: A-101 … ${LETTERS[t - 1]}-${fl}0${p}.`
    : 'Enter 1 to 6 towers, 1 to 30 floors and 1 to 10 flats per floor.';

  const submit = async () => {
    if (exists) return f.go();
    const e: Record<string, string> = {};
    if (!(t >= 1 && t <= 6)) e.towers = '1 to 6 towers.';
    if (!(fl >= 1 && fl <= 30)) e.floors = '1 to 30 floors.';
    if (!(p >= 1 && p <= 10)) e.per = '1 to 10 flats per floor.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const input = {
      buildings: LETTERS.slice(0, t)
        .split('')
        .map(code => ({ newBuilding: { code, name: `Tower ${code}`, kind: 'TOWER' as const } })),
      floorFrom: 1,
      floorTo: fl,
      positions: Array.from({ length: p }, (_, i) => ({ position: i + 1, unitType: 'FLAT' as const })),
      pattern: defaultPattern(p),
    };
    f.setError(null);
    try {
      const pv = await societySetupService.previewGenerator(input);
      await societySetupService.commitGenerator({ ...input, previewHash: pv.previewHash });
      await finish();
    } catch (err) {
      f.setError(stepError(err));
    }
  };

  return (
    <>
      <Heading
        title="Towers and flats"
        text="Generate every flat with a numbering pattern. You can edit single flats later."
      />
      {f.error && <Alert tone="bad">{f.error}</Alert>}
      {exists ? (
        <Alert tone="ok">{step.summary || 'Your buildings and flats are already set up.'}</Alert>
      ) : (
        <>
          <div className="grid gap-x-3 sm:grid-cols-3">
            <Input
              label="Number of towers"
              type="number"
              min={1}
              max={6}
              value={towers}
              onChange={e => setTowers(e.target.value)}
              error={errors.towers}
              disabled={!canEdit}
            />
            <Input
              label="Floors per tower"
              type="number"
              min={1}
              max={30}
              value={floors}
              onChange={e => setFloors(e.target.value)}
              error={errors.floors}
              disabled={!canEdit}
            />
            <Input
              label="Flats per floor"
              type="number"
              min={1}
              max={10}
              value={per}
              onChange={e => setPer(e.target.value)}
              error={errors.per}
              disabled={!canEdit}
            />
          </div>
          <Alert tone="info">{preview}</Alert>
        </>
      )}
      <div className="mt-1">
        {canEdit && (
          <Button size="sm" variant="glass" onClick={() => setAdvanced(true)}>
            Advanced
          </Button>
        )}
      </div>
      <GeneratorDialog open={advanced} onClose={() => setAdvanced(false)} onDone={reload} />
      <StepFooter
        back={back}
        skip={null}
        primary={exists ? 'Continue' : 'Save and continue'}
        busy={f.busy}
        disabled={!canEdit && !exists}
        onPrimary={submit}
      />
    </>
  );
}

/** Step 3: flats and their areas; import a sheet in UPSERT mode. */
export function UnitsStep({ step, finish, back, canEdit }: StepProps) {
  const [importing, setImporting] = useState(false);
  const f = useFinish(finish);
  const all = useLoad(() => societySetupService.units({ limit: 6 }), 'first');
  const missing = useLoad(() => societySetupService.units({ missingArea: true, limit: 1 }), 'missing');
  const total = all.data?.pagination?.total ?? all.data?.items.length ?? 0;
  const missingN = missing.data?.pagination?.total ?? missing.data?.items.length ?? 0;
  const reloadAll = () => {
    all.reload();
    missing.reload();
  };
  return (
    <>
      <Heading
        title="Flat details"
        text="Area in sq ft drives maintenance. Upload your sheet to fill areas and types in one go."
      />
      {f.error && <Alert tone="bad">{f.error}</Alert>}
      {all.error ? (
        <ErrorState error={all.error} />
      ) : (
        <div className="glass-soft rounded-[16px] bg-white/55 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">{all.loading ? 'Counting flats...' : `${total} flats generated`}</p>
              <p className="text-[13px] text-muted">
                {all.loading || missing.loading ? '' : `${total - missingN} have an area`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className={buttonClasses('glass', 'sm')} href="/templates/units-template.csv" download>
                Download template
              </a>
              {canEdit && (
                <Button size="sm" onClick={() => setImporting(true)}>
                  Upload sheet
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {(all.data?.items.length ?? 0) > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[13.5px]">
            <caption className="sr-only">First flats</caption>
            <thead className="text-[12px] uppercase text-muted">
              <tr>
                <th className="p-2">Flat</th>
                <th className="p-2">Area</th>
                <th className="p-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {all.data!.items.slice(0, 6).map(u => (
                <tr key={u.id} className="border-t border-[var(--line)]">
                  <td className="p-2 font-semibold">{u.label}</td>
                  <td className="p-2">{u.areaSqft ? `${sqft(u.areaSqft)} sq ft` : 'Area missing'}</td>
                  <td className="p-2">{bhkLabel(u.bhk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[12.5px] text-muted">Showing the first 6 rows.</p>
        </div>
      )}
      {step.checkState === 'FAIL' && step.summary && (
        <Alert tone="warn" className="mt-3">
          {step.summary}
        </Alert>
      )}
      <ImportDialog
        open={importing}
        defaultMode="UPSERT"
        onClose={() => setImporting(false)}
        onDone={reloadAll}
      />
      <StepFooter
        back={back}
        skip={null}
        primary={step.status === 'DONE' ? 'Continue' : 'Save and continue'}
        busy={f.busy}
        onPrimary={f.go}
      />
    </>
  );
}

/** Steps 4, 6 and 7: other modules own the forms; this shows the check and offers Done or Skip. */
export function ExternalStep({
  props,
  title,
  text,
  link,
}: {
  props: StepProps;
  title: string;
  text: string;
  link?: { href: string; label: string };
}) {
  const { step, finish, back, skip } = props;
  const f = useFinish(finish);
  return (
    <>
      <Heading title={title} text={text} />
      {f.error && <Alert tone="bad">{f.error}</Alert>}
      <div className="rounded-[16px] bg-white/55 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">{step.summary || 'Not started'}</p>
            <p className="text-[13px] text-muted">
              {step.checkState === 'NOT_AVAILABLE'
                ? 'This part is not available yet. You can mark it done yourself.'
                : 'Checked automatically.'}
            </p>
          </div>
          <span className="flex items-center gap-2">
            <Chip tone={step.checkState === 'PASS' ? 'ok' : step.checkState === 'FAIL' ? 'warn' : 'neutral'}>
              {step.checkState === 'PASS' ? 'Ready' : step.checkState === 'FAIL' ? 'Needed' : 'Not checked'}
            </Chip>
            {link && (
              <Link href={link.href} className={buttonClasses('glass', 'sm')}>
                {link.label}
              </Link>
            )}
          </span>
        </div>
      </div>
      <StepFooter
        back={back}
        skip={step.status === 'PENDING' ? skip : null}
        primary={step.status === 'DONE' ? 'Continue' : 'Mark as done'}
        busy={f.busy}
        onPrimary={f.go}
      />
    </>
  );
}

const BILLING_KEYS = [
  'billing.billingDay',
  'billing.dueDays',
  'billing.lateFeeDefaultMode',
  'billing.lateFeeDefaultRatePct',
  'billing.lateFeeGraceDays',
];
const LABEL: Record<string, string> = {
  'billing.billingDay': 'Bill date (day of month, 1 to 28)',
  'billing.dueDays': 'Days to pay',
  'billing.lateFeeDefaultMode': 'Late fee',
  'billing.lateFeeDefaultRatePct': 'Late interest (% per year)',
  'billing.lateFeeGraceDays': 'Grace days',
};

/** Step 5: the billing settings other modules read. */
export function BillingStep(props: StepProps) {
  const load = useLoad(() => societySetupService.settings('billing'));
  if (load.error) return <ErrorState error={load.error} />;
  if (load.loading || !load.data) return <div className="skeleton h-40 w-full" aria-busy="true" />;
  return <BillingForm {...props} items={load.data.filter(i => BILLING_KEYS.includes(i.key))} />;
}

function BillingForm({ finish, back, items }: StepProps & { items: SettingItem[] }) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map(i => [i.key, String(i.value ?? '')])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) =>
    setVals(v => ({ ...v, [k]: e.target.value }));
  const mode = vals['billing.lateFeeDefaultMode'];

  const submit = async () => {
    setErrors({});
    setFormError(null);
    const e: Record<string, string> = {};
    const num = (k: string, min: number, max: number) => {
      const x = Number(vals[k]);
      if (vals[k] === '' || !Number.isFinite(x) || x < min || x > max)
        e[k] = `Enter a number from ${min} to ${max}.`;
    };
    num('billing.billingDay', 1, 28);
    num('billing.dueDays', 0, 60);
    num('billing.lateFeeGraceDays', 0, 30);
    if (mode === 'SIMPLE_INTEREST') num('billing.lateFeeDefaultRatePct', 0.0001, 21);
    if (Object.keys(e).length) return setErrors(e);
    const changes = items
      .map(i => {
        const raw = vals[i.key];
        const value = i.type === 'INT' ? Number(raw) : i.type === 'DEC' ? Number(raw).toFixed(4) : raw;
        return { i, value };
      })
      .filter(({ i, value }) => String(value) !== String(i.value ?? ''))
      .map(({ i, value }) => ({ key: i.key, value, version: i.version }));
    setBusy(true);
    try {
      if (changes.length) await societySetupService.saveSettings(changes);
      await finish();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(stepError(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (key: string) => {
    const item = items.find(i => i.key === key);
    if (!item) return null;
    if (key === 'billing.lateFeeDefaultMode')
      return (
        <Select
          key={key}
          label={LABEL[key]}
          value={vals[key]}
          onChange={set(key)}
          disabled={!item.canEdit}
          options={[
            { value: 'NONE', label: 'None' },
            { value: 'SIMPLE_INTEREST', label: 'Interest % per year' },
            { value: 'FLAT', label: 'Flat amount' },
          ]}
        />
      );
    if (key === 'billing.lateFeeDefaultRatePct' && mode !== 'SIMPLE_INTEREST') return null;
    return (
      <Input
        key={key}
        label={LABEL[key]}
        type="number"
        value={vals[key]}
        onChange={set(key)}
        error={errors[key]}
        disabled={!item.canEdit}
        step={key.endsWith('Pct') ? '0.01' : undefined}
      />
    );
  };

  return (
    <>
      <Heading
        title="Billing setup"
        text="These rules create your first invoices. Charge amounts such as the rate per sq ft are set up with the billing module."
      />
      {formError && <Alert tone="bad">{formError}</Alert>}
      <div className="grid gap-x-4 sm:grid-cols-2">{BILLING_KEYS.map(field)}</div>
      {mode === 'FLAT' && <Alert tone="info">Set the flat late fee amount in Settings, Billing.</Alert>}
      <StepFooter back={back} skip={null} primary="Save and continue" busy={busy} onPrimary={submit} />
    </>
  );
}

/** Step 8: the go-live checklist. */
export function GoLiveStep({
  ob,
  canEdit,
  back,
  onGoLive,
  failing,
  busy,
  error,
}: {
  ob: Onboarding;
  canEdit: boolean;
  back: (() => void) | null;
  onGoLive: () => void;
  failing: { stepKey: string; message: string }[];
  busy: boolean;
  error: string | null;
}) {
  const steps = ob.steps.filter(s => s.stepKey !== 'GO_LIVE');
  const ready = steps.every(s => (s.isRequired ? s.status === 'DONE' : s.status !== 'PENDING'));
  const done = steps.filter(s => s.status !== 'PENDING').length;
  return (
    <>
      <Heading
        title="Go-live checklist"
        text={`${done} of ${steps.length} steps are finished. Required steps must be done; the others can be skipped with a reason.`}
      />
      {error && <Alert tone="bad">{error}</Alert>}
      {failing.length > 0 && (
        <Alert tone="bad">
          <span>
            Not ready yet:
            <ul className="mt-1 list-disc pl-5">
              {failing.map(x => (
                <li key={x.stepKey}>
                  {STEP_LABEL[x.stepKey as StepKey] ?? x.stepKey}: {x.message}
                </li>
              ))}
            </ul>
          </span>
        </Alert>
      )}
      <ul>
        {steps.map(s => (
          <li
            key={s.stepKey}
            className="flex items-center gap-3 border-b border-[var(--line)] py-2.5 last:border-0"
          >
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{STEP_LABEL[s.stepKey]}</span>
              <span className="block text-[13px] text-muted">{s.summary}</span>
            </span>
            <Chip tone={s.status === 'DONE' ? 'ok' : s.status === 'SKIPPED' ? 'neutral' : 'warn'}>
              {s.status === 'DONE' ? 'Done' : s.status === 'SKIPPED' ? 'Skipped' : 'Needed'}
            </Chip>
          </li>
        ))}
      </ul>
      <Alert tone="info" className="mt-4">
        Going live sends a welcome invite to every resident with a mobile number.
      </Alert>
      <StepFooter
        back={back}
        skip={null}
        primary={ready ? 'Go live' : 'Complete required steps'}
        busy={busy}
        disabled={!ready || !canEdit}
        onPrimary={onGoLive}
      />
    </>
  );
}
