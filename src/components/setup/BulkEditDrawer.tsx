'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { societySetupService } from '@/services/society-setup.service';
import type { BulkUpdateInput } from '@/types/societySetup';
import { BHK_OPTIONS, UNIT_TYPES, bhkLabel, setupError } from './format';

const AREA = /^\d{1,6}(\.\d{1,3})?$/;

/** "Edit selected" drawer (spec 11.6, API 8.13): only the fields you fill in are changed. */
export function BulkEditDrawer({
  open,
  unitIds,
  onClose,
  onDone,
}: {
  open: boolean;
  unitIds: number[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [v, setV] = useState({
    unitType: '',
    bhk: '',
    carpet: '',
    builtUp: '',
    superArea: '',
    share: '',
    billable: '',
    possession: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV(x => ({ ...x, [k]: e.target.value }));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    for (const [k, val] of [
      ['carpet', v.carpet],
      ['builtUp', v.builtUp],
      ['superArea', v.superArea],
    ] as const)
      if (val && !AREA.test(val)) e[k] = 'A number with up to 3 decimals.';
    if (v.share && !/^\d{1,3}(\.\d{1,4})?$/.test(v.share)) e.share = 'A number with up to 4 decimals.';
    const set_: BulkUpdateInput['set'] = {};
    if (v.unitType) set_.unitType = v.unitType as never;
    if (v.bhk) set_.bhk = v.bhk;
    if (v.carpet) set_.carpetAreaSqft = v.carpet;
    if (v.builtUp) set_.builtUpAreaSqft = v.builtUp;
    if (v.superArea) set_.superBuiltUpAreaSqft = v.superArea;
    if (v.share) set_.undividedSharePct = v.share;
    if (v.billable) set_.isBillable = v.billable === 'yes';
    if (v.possession) set_.possessionDate = v.possession;
    if (Object.keys(set_).length === 0) e.form = 'Fill in at least one field to change.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFormError(null);
    try {
      const r = await societySetupService.bulkUpdate({ unitIds, set: set_ });
      toast.show(`${r.updated} flats updated.`);
      onDone();
      onClose();
    } catch (err) {
      setFormError(setupError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit selected flats"
      description={`${unitIds.length} flats selected. Empty fields stay as they are.`}
    >
      {(formError || errors.form) && <Alert tone="bad">{formError ?? errors.form}</Alert>}
      <form onSubmit={submit} noValidate aria-label="Edit selected flats">
        <Select
          label="Type"
          value={v.unitType}
          onChange={set('unitType')}
          options={[{ value: '', label: 'Keep as is' }, ...UNIT_TYPES]}
        />
        <Select
          label="BHK"
          value={v.bhk}
          onChange={set('bhk')}
          options={[
            { value: '', label: 'Keep as is' },
            ...BHK_OPTIONS.map(b => ({ value: b, label: bhkLabel(b) })),
          ]}
        />
        <Input
          label="Carpet area (sq ft)"
          inputMode="decimal"
          value={v.carpet}
          onChange={set('carpet')}
          error={errors.carpet}
        />
        <Input
          label="Built-up area (sq ft)"
          inputMode="decimal"
          value={v.builtUp}
          onChange={set('builtUp')}
          error={errors.builtUp}
        />
        <Input
          label="Super built-up area (sq ft)"
          inputMode="decimal"
          value={v.superArea}
          onChange={set('superArea')}
          error={errors.superArea}
        />
        <Input
          label="Undivided share (%)"
          inputMode="decimal"
          value={v.share}
          onChange={set('share')}
          error={errors.share}
        />
        <Select
          label="Billable"
          value={v.billable}
          onChange={set('billable')}
          options={[
            { value: '', label: 'Keep as is' },
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
        <Input label="Possession date" type="date" value={v.possession} onChange={set('possession')} />
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={busy}>
            Update {unitIds.length} flats
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
