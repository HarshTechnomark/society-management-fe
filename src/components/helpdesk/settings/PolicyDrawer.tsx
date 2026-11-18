'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useFeatureState } from '@/lib/entitlements';
import { helpdeskSettingsService as svc } from '@/services/helpdeskSettings.service';
import type { Calendar, Priority, SlaPolicy, SlaPolicyInput } from '@/types/helpdesk';
import { helpdeskError } from '../admin/format';
import { PRIORITIES, PRIORITY_NAME, fromMinutes, toMinutes, type TimeUnit } from './settingsFormat';

type Kind = 'Response' | 'Resolution';
type Field = `p${1 | 2 | 3 | 4}${Kind}Minutes`;
const field = (p: Priority, k: Kind): Field => `p${p.slice(1)}${k}Minutes` as Field;
export const policyField = (policy: SlaPolicy, p: Priority, k: Kind): number => policy[field(p, k)];

interface Cell {
  value: string;
  unit: TimeUnit;
}
const DEFAULTS: Record<Priority, [number, number]> = {
  P1: [30, 240],
  P2: [120, 1440],
  P3: [480, 4320],
  P4: [1440, 10080],
};

/** Add or edit an SLA policy: reply and fix targets per priority, calendars of P2 to P4, default flag. */
export function PolicyDrawer({
  policy,
  onClose,
  onSaved,
}: {
  policy?: SlaPolicy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const businessOk = useFeatureState('helpdesk.sla_business_calendar');
  const [name, setName] = useState(policy?.name ?? '');
  const [description, setDescription] = useState(policy?.description ?? '');
  const [isDefault, setIsDefault] = useState(policy?.isDefault ?? false);
  const [cells, setCells] = useState<Record<string, Cell>>(() =>
    Object.fromEntries(
      PRIORITIES.flatMap(p =>
        (['Response', 'Resolution'] as Kind[]).map((k, i) => [
          `${p}${k}`,
          fromMinutes(policy ? policy[field(p, k)] : DEFAULTS[p][i]),
        ]),
      ),
    ),
  );
  const [cal, setCal] = useState<Record<string, Calendar>>({
    P2: policy?.p2Calendar ?? 'TWENTY_FOUR_SEVEN',
    P3: policy?.p3Calendar ?? 'TWENTY_FOUR_SEVEN',
    P4: policy?.p4Calendar ?? 'TWENTY_FOUR_SEVEN',
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const minutes = (p: Priority, k: Kind) => {
    const c = cells[`${p}${k}`];
    return /^\d+$/.test(c.value) ? toMinutes(c.value, c.unit) : NaN;
  };
  const n = name.trim();
  const rowError = (p: Priority): string | null => {
    const r = minutes(p, 'Response');
    const s = minutes(p, 'Resolution');
    if (!Number.isFinite(r) || !Number.isFinite(s) || r <= 0 || s <= 0)
      return 'Enter whole numbers above zero.';
    return r >= s ? 'The reply time must be shorter than the fix time.' : null;
  };
  const nameError = n.length < 2 || n.length > 60 ? 'Enter 2 to 60 characters.' : null;

  const save = async () => {
    setTouched(true);
    setProblem(null);
    if (nameError || PRIORITIES.some(p => rowError(p))) return;
    const body: SlaPolicyInput = {
      name: n,
      description: description.trim() || null,
      isDefault,
      ...Object.fromEntries(
        PRIORITIES.flatMap(p =>
          (['Response', 'Resolution'] as Kind[]).map(k => [field(p, k), minutes(p, k)]),
        ),
      ),
      p2Calendar: cal.P2,
      p3Calendar: cal.P3,
      p4Calendar: cal.P4,
    };
    setBusy(true);
    try {
      if (policy) await svc.updatePolicy(policy.id, { ...body, version: policy.version });
      else await svc.createPolicy({ ...body, name: n });
      toast.show('Policy saved');
      onSaved();
    } catch (e) {
      setProblem(helpdeskError(e));
    } finally {
      setBusy(false);
    }
  };
  const set = (key: string, patch: Partial<Cell>) =>
    setCells(s => ({ ...s, [key]: { ...s[key], ...patch } }));

  return (
    <Drawer
      open
      size={640}
      onClose={busy ? () => {} : onClose}
      title={policy ? `Edit ${policy.name}` : 'New SLA policy'}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {problem && <Alert tone="bad">{problem}</Alert>}
        <Input
          label="Name"
          value={name}
          maxLength={60}
          onChange={e => setName(e.target.value)}
          error={touched ? nameError : null}
          required
        />
        <Input
          label="Description (optional)"
          value={description}
          maxLength={300}
          onChange={e => setDescription(e.target.value)}
        />
        <Checkbox
          className="!mb-0"
          checked={isDefault}
          onChange={e => setIsDefault(e.target.checked)}
          label="Use as the default policy"
        />
        {PRIORITIES.map(p => (
          <fieldset key={p} className="grid gap-2 rounded-xl border border-[var(--line)] p-3">
            <legend className="px-1 text-[13.5px] font-bold">{PRIORITY_NAME[p]}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['Response', 'Resolution'] as Kind[]).map(k => (
                <div key={k} className="flex items-end gap-2">
                  <Input
                    label={k === 'Response' ? 'Reply within' : 'Fix within'}
                    inputMode="numeric"
                    value={cells[`${p}${k}`].value}
                    onChange={e => set(`${p}${k}`, { value: e.target.value })}
                  />
                  <Select
                    label="Unit"
                    value={cells[`${p}${k}`].unit}
                    onChange={e => set(`${p}${k}`, { unit: e.target.value as TimeUnit })}
                    options={[
                      { value: 'min', label: 'minutes' },
                      { value: 'h', label: 'hours' },
                      { value: 'd', label: 'days' },
                    ]}
                  />
                </div>
              ))}
            </div>
            {touched && rowError(p) && (
              <p role="alert" className="text-[12.5px] text-bad">
                {rowError(p)}
              </p>
            )}
            {p !== 'P1' && (
              <Select
                label="Clock"
                value={cal[p]}
                onChange={e => {
                  const v = e.target.value as Calendar;
                  if (v === 'BUSINESS_HOURS' && !businessOk) return;
                  setCal(c => ({ ...c, [p]: v }));
                }}
                hint={businessOk ? undefined : 'Office hours need the Standard plan. Upgrade to switch.'}
                options={[
                  { value: 'TWENTY_FOUR_SEVEN', label: '24 x 7' },
                  {
                    value: 'BUSINESS_HOURS',
                    label: businessOk ? 'Office hours only' : 'Office hours only (locked)',
                  },
                ]}
              />
            )}
          </fieldset>
        ))}
      </div>
    </Drawer>
  );
}
