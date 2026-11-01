'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/apiClient';
import { societiesService } from '@/services/societies.service';
import type { SocietyDetail, SocietyPatch } from '@/types/societies';
import { INDIAN_STATES, isValidPincode, societyErrorText } from '../format';

type Form = {
  name: string;
  legalName: string;
  registrationNo: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  approxFlats: string;
};

const fromDetail = (s: SocietyDetail): Form => ({
  name: s.name,
  legalName: s.legalName ?? '',
  registrationNo: s.registrationNo ?? '',
  gstin: s.gstin ?? '',
  addressLine1: s.addressLine1,
  addressLine2: s.addressLine2 ?? '',
  city: s.city,
  state: s.state,
  pincode: s.pincode,
  approxFlats: String(s.approxFlats),
});

/** F06 edit details (8.6): sends only the changed fields with `version`. */
export function EditSocietyDrawer({
  society,
  open,
  onClose,
  onSaved,
}: {
  society: SocietyDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Form>(() => fromDetail(society));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (f.name.trim().length < 3) e.name = 'Enter the society name.';
    if (f.addressLine1.trim().length < 5) e.addressLine1 = 'Enter the address (at least 5 characters).';
    if (f.city.trim().length < 2) e.city = 'Enter the city.';
    if (!isValidPincode(f.pincode)) e.pincode = 'Enter a 6 digit pincode.';
    const flats = Number(f.approxFlats);
    if (!Number.isInteger(flats) || flats < 10 || flats > 20000) e.approxFlats = 'Enter 10 to 20,000 flats.';
    setErrors(e);
    if (Object.keys(e).length) return;

    const before = fromDetail(society);
    const patch: SocietyPatch = { version: society.version };
    const nullable = new Set<keyof Form>(['legalName', 'registrationNo', 'gstin', 'addressLine2']);
    for (const k of Object.keys(f) as (keyof Form)[]) {
      if (f[k].trim() === before[k].trim()) continue;
      const v = f[k].trim();
      if (k === 'approxFlats') patch.approxFlats = Number(v);
      else (patch as Record<string, unknown>)[k] = nullable.has(k) && !v ? null : v;
    }
    if (Object.keys(patch).length === 1) return onClose();
    setBusy(true);
    setAlert(null);
    try {
      await societiesService.update(society.id, patch);
      toast.show('Society details saved');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.errors?.length)
        setErrors(Object.fromEntries(err.errors.map(x => [x.field, x.message])));
      setAlert(societyErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit society details"
      description="The web address and status cannot be changed here."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
      <Input label="Society name" value={f.name} onChange={set('name')} error={errors.name} required />
      <Input label="Legal name" value={f.legalName} onChange={set('legalName')} />
      <Input
        label="Registration no."
        value={f.registrationNo}
        onChange={set('registrationNo')}
        error={errors.registrationNo}
      />
      <Input label="GSTIN" value={f.gstin} onChange={set('gstin')} error={errors.gstin} />
      <Input
        label="Address line 1"
        value={f.addressLine1}
        onChange={set('addressLine1')}
        error={errors.addressLine1}
        required
      />
      <Input label="Address line 2" value={f.addressLine2} onChange={set('addressLine2')} />
      <Input label="City" value={f.city} onChange={set('city')} error={errors.city} required />
      <Select
        label="State"
        value={f.state}
        onChange={set('state')}
        options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
      />
      <Input
        label="Pincode"
        inputMode="numeric"
        maxLength={6}
        value={f.pincode}
        onChange={set('pincode')}
        error={errors.pincode}
        required
      />
      <Input
        label="Approximate number of flats"
        type="number"
        inputMode="numeric"
        value={f.approxFlats}
        onChange={set('approxFlats')}
        error={errors.approxFlats}
        required
      />
    </Drawer>
  );
}
