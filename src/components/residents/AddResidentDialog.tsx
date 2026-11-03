'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { isValidEmail, isValidMobile, normaliseMobile } from '@/lib/validation';
import { residentsService } from '@/services/residents.service';
import type { FamilyRelation, LinkInput, Relation, ResidentInput } from '@/types/residents';
import { FlatPicker, FormDialog, fieldErrors, isoDate, useRun } from './common';
import { FAMILY_LABEL, RELATION_LABEL, existingResidentId, opts, today } from './format';
import { TenancyForm } from './TenancyForm';

/** "Add resident" (spec 11.1): every flat, four relations, Tenant opens the tenancy form. */
export function AddResidentDialog({
  unitId,
  unitLabel,
  onClose,
  onDone,
}: {
  unitId?: number;
  unitLabel?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const run = useRun();
  const [unit, setUnit] = useState<number | null>(unitId ?? null);
  const [relation, setRelation] = useState<Relation>('OWNER');
  const [family, setFamily] = useState<FamilyRelation>('SPOUSE');
  const [householdOf, setHouseholdOf] = useState<'OWNER' | 'TENANT'>('OWNER');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [share, setShare] = useState('');
  const [from, setFrom] = useState(today());
  const [invite, setInvite] = useState(true);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [clash, setClash] = useState<{ id: number; name: string } | null>(null);

  if (relation === 'TENANT')
    return (
      <TenancyForm
        as="admin"
        unitId={unit ?? undefined}
        unitLabel={unitLabel}
        onClose={onClose}
        onDone={onDone}
      />
    );

  const link = (): LinkInput => ({
    unitId: unit!,
    relation,
    ...(relation === 'FAMILY' ? { familyRelation: family } : {}),
    ...(relation === 'FAMILY' || relation === 'CARETAKER' ? { householdOf } : {}),
    ...(share && (relation === 'OWNER' || relation === 'CO_OWNER') ? { sharePercent: share } : {}),
    fromDate: from,
  });

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!unit) e.unitId = 'Choose the flat.';
    if (name.trim().length < 2) e.name = 'Enter the full name.';
    if (mobile ? !isValidMobile(mobile) : invite) e.mobile = 'Enter a 10 digit Indian mobile number.';
    if (email && !isValidEmail(email)) e.email = 'Enter a valid email address.';
    if (!isoDate(from)) e.fromDate = 'Choose the start date.';
    setErrs(e);
    if (Object.keys(e).length) return { error: 'Check the highlighted fields.' };
    const body: ResidentInput = {
      name: name.trim(),
      ...(mobile ? { mobile: normaliseMobile(mobile) } : {}),
      ...(email ? { email: email.trim() } : {}),
      ...(dob ? { dateOfBirth: dob } : {}),
      link: link(),
      invite,
    };
    try {
      const r = await residentsService.createResident(body);
      return {
        message: r.warnings?.length
          ? 'Resident added. A person with the same name and birth date already exists, please check.'
          : invite
            ? 'Resident added and invited'
            : 'Resident added',
      };
    } catch (err) {
      setErrs(fieldErrors(err));
      const id = existingResidentId(err);
      if (id) {
        const found = await residentsService.resident(id).catch(() => null);
        setClash({ id, name: found?.name ?? 'another resident' });
        return { error: '' };
      }
      throw err;
    }
  };

  const linkExisting = async () => {
    if (!clash || !unit) return;
    if (await run(() => residentsService.addLink(clash.id, link()), `${clash.name} is linked to the flat`))
      onDone();
  };

  return (
    <FormDialog
      wide
      title="Add resident"
      description="They get an invite to the resident app."
      submitLabel="Add and invite"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
      extra={
        clash && (
          <Alert tone="warn">
            <span>
              This number belongs to {clash.name}. Link them instead?{' '}
              <Button size="xs" variant="glass" onClick={() => void linkExisting()}>
                Link existing person
              </Button>
            </span>
          </Alert>
        )
      }
    >
      <FlatPicker
        value={unit}
        onChange={id => setUnit(id)}
        error={errs.unitId}
        fixed={unitId ? unitLabel : undefined}
      />
      <Select
        label="Living as"
        value={relation}
        onChange={e => setRelation(e.target.value as Relation)}
        options={opts(RELATION_LABEL)}
      />
      {relation === 'FAMILY' && (
        <Select
          label="Relation to the household head"
          value={family}
          onChange={e => setFamily(e.target.value as FamilyRelation)}
          options={opts(FAMILY_LABEL)}
        />
      )}
      {(relation === 'FAMILY' || relation === 'CARETAKER') && (
        <Select
          label="Household of"
          value={householdOf}
          onChange={e => setHouseholdOf(e.target.value as 'OWNER' | 'TENANT')}
          options={[
            { value: 'OWNER', label: 'Owner' },
            { value: 'TENANT', label: 'Tenant' },
          ]}
        />
      )}
      <Input label="Name" value={name} onChange={e => setName(e.target.value)} error={errs.name} required />
      <Input
        label="Mobile"
        inputMode="numeric"
        value={mobile}
        onChange={e => setMobile(e.target.value)}
        error={errs.mobile}
      />
      <Input
        label="Email (optional)"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        error={errs.email}
      />
      <div className="grid gap-x-3 sm:grid-cols-3">
        <Input
          label="Date of birth"
          type="date"
          value={dob}
          onChange={e => setDob(e.target.value)}
          error={errs.dateOfBirth}
        />
        {(relation === 'OWNER' || relation === 'CO_OWNER') && (
          <Input
            label="Share %"
            inputMode="decimal"
            value={share}
            onChange={e => setShare(e.target.value)}
            error={errs['link.sharePercent'] ?? errs.sharePercent}
          />
        )}
        <Input
          label="From date"
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          error={errs.fromDate}
        />
      </div>
      <Checkbox label="Send invite" checked={invite} onChange={e => setInvite(e.target.checked)} />
    </FormDialog>
  );
}
