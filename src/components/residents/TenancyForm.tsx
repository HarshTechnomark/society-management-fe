'use client';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { isValidEmail, isValidMobile, normaliseMobile } from '@/lib/validation';
import { residentsService } from '@/services/residents.service';
import type { FileRef, TenancyInput } from '@/types/residents';
import { FileField, FlatPicker, FormDialog, fieldErrors, isoDate, rupeesToPaise } from './common';
import { today } from './format';

/**
 * Add a tenant (spec 8.13): the admin form (`POST /tenancies`, picks the flat) and the owner form
 * (`POST /me/tenancies`, the flat is the owner's). The tenancy starts as a draft; submitting is a separate step.
 */
export function TenancyForm({
  as,
  unitId,
  unitLabel,
  onClose,
  onDone,
}: {
  as: 'admin' | 'owner';
  unitId?: number;
  unitLabel?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [unit, setUnit] = useState<number | null>(unitId ?? null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState('');
  const [type, setType] = useState('LEAVE_AND_LICENCE');
  const [regNo, setRegNo] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [payer, setPayer] = useState('OWNER');
  const [occupants, setOccupants] = useState('');
  const [invite, setInvite] = useState(true);
  const [agreement, setAgreement] = useState<number | null>(null);
  const [police, setPolice] = useState<number | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!unit) e.unitId = 'Choose the flat.';
    if (name.trim().length < 2) e.name = 'Enter the full name of the tenant.';
    if (!isValidMobile(mobile)) e.mobile = 'Enter a 10 digit Indian mobile number.';
    if (email && !isValidEmail(email)) e.email = 'Enter a valid email address.';
    if (!isoDate(start)) e.agreementStart = 'Choose the agreement start date.';
    if (!isoDate(end)) e.agreementEnd = 'Choose the agreement end date.';
    else if (isoDate(start) && end <= start) e.agreementEnd = 'The end date must be after the start date.';
    setErrs(e);
    if (Object.keys(e).length) return { error: 'Check the highlighted fields.' };
    const fileIds: FileRef[] = [];
    if (agreement) fileIds.push({ fileId: agreement, docType: 'RENT_AGREEMENT' });
    if (police) fileIds.push({ fileId: police, docType: 'POLICE_VERIFICATION' });
    const body: TenancyInput = {
      unitId: unit!,
      tenant: {
        name: name.trim(),
        mobile: normaliseMobile(mobile),
        ...(email ? { email: email.trim() } : {}),
        ...(dob ? { dateOfBirth: dob } : {}),
      },
      agreementType: type as TenancyInput['agreementType'],
      agreementStart: start,
      agreementEnd: end,
      ...(regNo ? { agreementRegistrationNo: regNo.trim() } : {}),
      ...(rent ? { monthlyRentPaise: rupeesToPaise(rent) } : {}),
      ...(deposit ? { securityDepositPaise: rupeesToPaise(deposit) } : {}),
      maintenancePayer: payer as 'OWNER' | 'TENANT',
      ...(occupants ? { occupantCount: Number(occupants) } : {}),
      inviteTenant: invite,
      ...(fileIds.length ? { fileIds } : {}),
    };
    try {
      await (as === 'admin' ? residentsService.createTenancy(body) : residentsService.addTenancy(body));
    } catch (err) {
      setErrs(fieldErrors(err));
      throw err;
    }
    return { message: 'Tenant added. Submit the tenancy when it is ready.' };
  };

  return (
    <FormDialog
      wide
      title="Add tenant"
      description="They get an invite to the resident app once the tenancy is approved."
      submitLabel="Save tenancy"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      {as === 'admin' ? (
        <FlatPicker value={unit} onChange={id => setUnit(id)} error={errs.unitId} fixed={unitLabel} />
      ) : (
        <Input label="Flat" value={unitLabel ?? ''} readOnly />
      )}
      <Input
        label="Tenant name"
        value={name}
        onChange={ev => setName(ev.target.value)}
        error={errs.name}
        required
      />
      <Input
        label="Tenant mobile"
        inputMode="numeric"
        value={mobile}
        onChange={ev => setMobile(ev.target.value)}
        error={errs['tenant.mobile'] ?? errs.mobile}
        required
      />
      <Input
        label="Email (optional)"
        type="email"
        value={email}
        onChange={ev => setEmail(ev.target.value)}
        error={errs.email}
      />
      <Input
        label="Date of birth (optional)"
        type="date"
        value={dob}
        onChange={ev => setDob(ev.target.value)}
      />
      <Select
        label="Agreement type"
        value={type}
        onChange={ev => setType(ev.target.value)}
        options={[
          { value: 'LEAVE_AND_LICENCE', label: 'Leave and licence' },
          { value: 'LEASE', label: 'Lease' },
          { value: 'OTHER', label: 'Other' },
        ]}
      />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Input
          label="Agreement start"
          type="date"
          value={start}
          onChange={ev => setStart(ev.target.value)}
          error={errs.agreementStart}
          required
        />
        <Input
          label="Agreement end"
          type="date"
          value={end}
          onChange={ev => setEnd(ev.target.value)}
          error={errs.agreementEnd}
          required
        />
        <Input
          label="Monthly rent (₹)"
          inputMode="decimal"
          value={rent}
          onChange={ev => setRent(ev.target.value)}
        />
        <Input
          label="Security deposit (₹)"
          inputMode="decimal"
          value={deposit}
          onChange={ev => setDeposit(ev.target.value)}
        />
        <Input
          label="Registration number (optional)"
          value={regNo}
          onChange={ev => setRegNo(ev.target.value)}
          error={errs.agreementRegistrationNo}
        />
        <Input
          label="People living in the flat"
          inputMode="numeric"
          value={occupants}
          onChange={ev => setOccupants(ev.target.value)}
        />
      </div>
      <Select
        label="Who pays maintenance"
        value={payer}
        onChange={ev => setPayer(ev.target.value)}
        options={[
          { value: 'OWNER', label: 'Owner' },
          { value: 'TENANT', label: 'Tenant' },
        ]}
      />
      <FileField label="Rent agreement (PDF or photo)" purpose="RESIDENT_RECORD" onChange={setAgreement} />
      <FileField label="Police verification (optional)" purpose="RESIDENT_RECORD" onChange={setPolice} />
      <Checkbox
        label="Send the tenant an invite"
        checked={invite}
        onChange={ev => setInvite(ev.target.checked)}
      />
    </FormDialog>
  );
}
