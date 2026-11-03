'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { isValidMobile, normaliseMobile } from '@/lib/validation';
import { residentsService } from '@/services/residents.service';
import type { EmergencyContact, EmergencyProfile } from '@/types/residents';
import { Loading, fieldErrors } from '../common';
import { residentsError } from '../format';

const BLOOD = [
  ['', 'Not sure'],
  ['A_POS', 'A+'],
  ['A_NEG', 'A-'],
  ['B_POS', 'B+'],
  ['B_NEG', 'B-'],
  ['AB_POS', 'AB+'],
  ['AB_NEG', 'AB-'],
  ['O_POS', 'O+'],
  ['O_NEG', 'O-'],
] as const;

/** Emergency profile (spec 11.2): consent, blood group, notes, care flags (Premium) and up to 3 contacts. */
export function EmergencyScreen() {
  return (
    <Gate
      view={PERMISSIONS.resident.home.view}
      feature="residents.emergency_profile"
      title="Emergency profile"
    >
      <Inner />
    </Gate>
  );
}

function Inner() {
  const load = useLoad(() => residentsService.emergency(), 'e');
  return (
    <Page>
      <PageHead
        title="Emergency profile"
        sub="Shown to the guard and committee only while an SOS is active for your flat."
      />
      <Loading load={load} rows={4}>
        {p => <Form key={p.version ?? 0} initial={p} onSaved={load.reload} />}
      </Loading>
    </Page>
  );
}

function Form({ initial, onSaved }: { initial: EmergencyProfile; onSaved: () => void }) {
  const toast = useToast();
  const careOn = useFeature('residents.care_flags');
  const [blood, setBlood] = useState(initial.bloodGroup ?? '');
  const [notes, setNotes] = useState(initial.medicalNotes ?? '');
  const [senior, setSenior] = useState(!!initial.isSeniorCitizen);
  const [disabled, setDisabled] = useState(!!initial.isDifferentlyAbled);
  const [mobility, setMobility] = useState(initial.mobilityNote ?? '');
  const [hospital, setHospital] = useState(initial.preferredHospital ?? '');
  const [contacts, setContacts] = useState<EmergencyContact[]>(initial.contacts ?? []);
  const [consent, setConsent] = useState(!!initial.consent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const healthGiven = !!(blood || notes.trim() || senior || disabled || mobility.trim());
  const setContact = (i: number, patch: Partial<EmergencyContact>) =>
    setContacts(c => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async (extra: Record<string, unknown> = {}, message = 'Emergency profile saved') => {
    setError(null);
    setBusy(true);
    try {
      await residentsService.saveEmergency({
        ...extra,
        ...(initial.version ? { version: initial.version } : {}),
      });
      toast.show(message);
      onSaved();
    } catch (e) {
      setErrs(fieldErrors(e));
      setError(residentsError(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const e: Record<string, string> = {};
    if (healthGiven && !consent) e.consent = 'Tick the consent to save health details.';
    contacts.forEach((c, i) => {
      if (c.name.trim().length < 2) e[`name${i}`] = 'Enter the name.';
      if (c.relation.trim().length < 2) e[`relation${i}`] = 'Enter the relation.';
      if (!isValidMobile(c.mobile)) e[`mobile${i}`] = 'Enter a 10 digit Indian mobile number.';
    });
    setErrs(e);
    if (Object.keys(e).length) return setError('Check the highlighted fields.');
    void save({
      bloodGroup: blood || null,
      medicalNotes: notes.trim() || null,
      ...(careOn
        ? { isSeniorCitizen: senior, isDifferentlyAbled: disabled, mobilityNote: mobility.trim() || null }
        : {}),
      preferredHospital: hospital.trim() || null,
      contacts: contacts.map(c => ({
        name: c.name.trim(),
        relation: c.relation.trim(),
        mobile: normaliseMobile(c.mobile),
      })),
      ...(healthGiven ? { consent: true } : {}),
    });
  };
  return (
    <Card>
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="mb-4 rounded-[14px] bg-white/60 p-3 text-[13.5px]">
        Your health details are encrypted. They are shown only to the guard and committee while an SOS is
        active for your flat, and every view is recorded.
      </div>
      <Select
        label="Blood group"
        value={blood}
        onChange={e => setBlood(e.target.value)}
        options={BLOOD.map(([value, label]) => ({ value, label }))}
      />
      <Textarea
        label="Medical notes"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        hint="For example allergies or medicines. Up to 1000 characters."
        maxLength={1000}
      />
      {careOn && (
        <>
          <Checkbox label="Senior citizen" checked={senior} onChange={e => setSenior(e.target.checked)} />
          <Checkbox
            label="Differently abled"
            checked={disabled}
            onChange={e => setDisabled(e.target.checked)}
          />
          <Input
            label="Mobility note"
            value={mobility}
            onChange={e => setMobility(e.target.value)}
            maxLength={200}
          />
        </>
      )}
      <Input label="Preferred hospital" value={hospital} onChange={e => setHospital(e.target.value)} />
      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[13px] font-semibold">Emergency contacts (up to 3)</legend>
        {contacts.map((c, i) => (
          <div key={i} className="mb-2 grid gap-x-3 rounded-[14px] bg-white/50 p-3 sm:grid-cols-3">
            <Input
              label={`Contact ${i + 1} name`}
              value={c.name}
              error={errs[`name${i}`]}
              onChange={e => setContact(i, { name: e.target.value })}
            />
            <Input
              label="Relation"
              value={c.relation}
              error={errs[`relation${i}`]}
              onChange={e => setContact(i, { relation: e.target.value })}
            />
            <Input
              label="Mobile"
              inputMode="numeric"
              value={c.mobile}
              error={errs[`mobile${i}`]}
              onChange={e => setContact(i, { mobile: e.target.value })}
            />
            <Button size="xs" variant="ghost" onClick={() => setContacts(x => x.filter((_, j) => j !== i))}>
              Remove contact {i + 1}
            </Button>
          </div>
        ))}
        {contacts.length < 3 && (
          <Button
            size="sm"
            variant="glass"
            onClick={() => setContacts(x => [...x, { name: '', relation: '', mobile: '' }])}
          >
            Add contact
          </Button>
        )}
      </fieldset>
      <Checkbox
        label="I agree that my health details are shown to the guard and committee while an SOS is active for my flat."
        checked={consent}
        error={errs.consent}
        onChange={e => setConsent(e.target.checked)}
      />
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={submit}>
          Save profile
        </Button>
        {initial.consent && (
          <Button
            variant="danger-soft"
            disabled={busy}
            onClick={() =>
              void save(
                { withdrawConsent: true, keepContacts: true },
                'Consent withdrawn. Health details are removed.',
              )
            }
          >
            Withdraw consent
          </Button>
        )}
      </div>
    </Card>
  );
}
