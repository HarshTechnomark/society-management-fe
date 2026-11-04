'use client';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { societySetupService } from '@/services/society-setup.service';
import type { ScopeType, ScopeValue } from '@/types/billingSetup';
import { SCOPE_LABEL, UNIT_TYPE_VALUES, opts } from './format';

export interface ScopeState {
  type: ScopeType;
  /** Building ids and flat types as text; flat ids as comma separated text in `unitIds`. */
  values: string[];
  unitIds: string;
}
export const allUnits: ScopeState = { type: 'ALL_UNITS', values: [], unitIds: '' };

/** Turns the form state into the API fields, or an error text. */
export function scopeToApi(s: ScopeState): { values?: ScopeValue[]; error?: string } {
  if (s.type === 'ALL_UNITS') return {};
  if (s.type === 'BUILDINGS')
    return s.values.length ? { values: s.values.map(Number) } : { error: 'Pick at least one building.' };
  if (s.type === 'UNIT_TYPES')
    return s.values.length ? { values: s.values } : { error: 'Pick at least one flat type.' };
  const ids = s.unitIds
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (ids.length === 0 || ids.some(n => !Number.isInteger(n) || n < 1))
    return { error: 'Enter flat ids separated by commas, for example 501, 502.' };
  return { values: [...new Set(ids)] };
}

export function scopeFromApi(type: ScopeType, values: ScopeValue[]): ScopeState {
  return type === 'UNITS'
    ? { type, values: [], unitIds: values.join(', ') }
    : { type, values: values.map(String), unitIds: '' };
}

/** Which flats a rule covers: all, buildings, flat types or single flats (spec 8.2). Single flats need the plan feature. */
export function ScopePicker({
  value,
  onChange,
  error,
  disabled,
  label = 'Applies to',
}: {
  value: ScopeState;
  onChange: (s: ScopeState) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
}) {
  const canUnits = useFeature('billing.unit_overrides_and_exemptions');
  const types = (Object.keys(SCOPE_LABEL) as ScopeType[]).filter(
    t => t !== 'UNITS' || canUnits || value.type === 'UNITS',
  );
  const toggle = (v: string, on: boolean) =>
    onChange({ ...value, values: on ? [...value.values, v] : value.values.filter(x => x !== v) });
  return (
    <div>
      <Select
        label={label}
        value={value.type}
        disabled={disabled}
        onChange={e => onChange({ type: e.target.value as ScopeType, values: [], unitIds: '' })}
        options={opts(Object.fromEntries(types.map(t => [t, SCOPE_LABEL[t]])) as Record<ScopeType, string>)}
        hint={
          disabled
            ? 'The scope cannot change after the first approved rate. Add a new rule instead.'
            : undefined
        }
      />
      {value.type === 'BUILDINGS' && (
        <BuildingChecks value={value.values} disabled={disabled} onToggle={toggle} />
      )}
      {value.type === 'UNIT_TYPES' && (
        <fieldset className="mb-4" disabled={disabled}>
          <legend className="mb-1.5 text-[13px] font-semibold">Flat types</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {UNIT_TYPE_VALUES.map(t => (
              <Checkbox
                key={t}
                className="!mb-2"
                label={t}
                checked={value.values.includes(t)}
                onChange={e => toggle(t, e.target.checked)}
              />
            ))}
          </div>
        </fieldset>
      )}
      {value.type === 'UNITS' && (
        <Input
          label="Flat ids"
          value={value.unitIds}
          disabled={disabled}
          onChange={e => onChange({ ...value, unitIds: e.target.value })}
          hint="Ids of the flats, separated by commas. A rate of ₹0 exempts these flats."
        />
      )}
      {error && <p className="-mt-2 mb-3 text-[12.5px] font-medium text-bad">{error}</p>}
    </div>
  );
}

function BuildingChecks({
  value,
  disabled,
  onToggle,
}: {
  value: string[];
  disabled?: boolean;
  onToggle: (v: string, on: boolean) => void;
}) {
  const { data, loading, error } = useLoad(() =>
    societySetupService.buildings({ status: 'ACTIVE', limit: 100 }),
  );
  if (loading) return <div className="skeleton mb-4 h-16 w-full" aria-busy="true" />;
  if (error || !data)
    return (
      <p className="mb-4 text-[13px] text-bad">The buildings could not be loaded. Close and try again.</p>
    );
  return (
    <fieldset className="mb-4" disabled={disabled}>
      <legend className="mb-1.5 text-[13px] font-semibold">Buildings</legend>
      {data.items.map(b => (
        <Checkbox
          key={b.id}
          className="!mb-2"
          label={`${b.name} (${b.code})`}
          checked={value.includes(String(b.id))}
          onChange={e => onToggle(String(b.id), e.target.checked)}
        />
      ))}
    </fieldset>
  );
}
