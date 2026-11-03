'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useFeature } from '@/hooks/useFeature';
import { isValidMobile, normaliseMobile } from '@/lib/validation';
import { residentsService } from '@/services/residents.service';
import type {
  DocType,
  FileRef,
  MoveInput,
  PermitInput,
  TransferInput,
  TransferType,
  WorkCategory,
} from '@/types/residents';
import { FileField, FlatPicker, FormDialog, fieldErrors, isoDate, rupeesToPaise } from './common';
import { TRANSFER_TYPE_LABEL, WORK_LABEL, docLabel, opts, today } from './format';

export interface UnitChoice {
  unitId: number;
  unitLabel: string;
}
type As = 'admin' | 'owner';

/** The flat field: the admin searches every flat; a resident picks from their own flats. */
function UnitField({
  as,
  units,
  value,
  onChange,
  error,
}: {
  as: As;
  units?: UnitChoice[];
  value: number | null;
  onChange: (id: number | null) => void;
  error?: string;
}) {
  if (as === 'admin' || !units)
    return <FlatPicker value={value} onChange={id => onChange(id)} error={error} />;
  if (units.length === 1) return <Input label="Flat" value={units[0].unitLabel} readOnly />;
  return (
    <Select
      label="Flat"
      value={value ? String(value) : ''}
      error={error}
      onChange={e => onChange(Number(e.target.value) || null)}
      options={[
        { value: '', label: 'Choose a flat' },
        ...units.map(u => ({ value: String(u.unitId), label: u.unitLabel })),
      ]}
    />
  );
}

const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  return `${h}:${i % 2 ? '30' : '00'}`;
});
const PRESETS = [
  ['Morning', '09:00', '12:00'],
  ['Afternoon', '12:00', '15:00'],
  ['Evening', '15:00', '18:00'],
];

/** Request a move-in or move-out (spec 8.15). */
export function MoveForm({
  as,
  units,
  onClose,
  onDone,
}: {
  as: As;
  units?: UnitChoice[];
  onClose: () => void;
  onDone: () => void;
}) {
  const liftOn = useFeature('residents.moving_slot_and_lift_booking');
  const [unit, setUnit] = useState<number | null>(units?.length === 1 ? units[0].unitId : null);
  const [type, setType] = useState<'MOVE_IN' | 'MOVE_OUT'>('MOVE_IN');
  const [who, setWho] = useState<'OWNER' | 'TENANT'>('OWNER');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('13:00');
  const [lift, setLift] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [company, setCompany] = useState('');
  const [moverMobile, setMoverMobile] = useState('');
  const [helpers, setHelpers] = useState('');
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!unit) e.unitId = 'Choose the flat.';
    if (!isoDate(date) || date < today()) e.moveDate = 'Choose a move date from today on.';
    if (end <= start) e.slotEnd = 'The slot must end after it starts.';
    if (moverMobile && !isValidMobile(moverMobile)) e.moverMobile = 'Enter a 10 digit Indian mobile number.';
    setErrs(e);
    if (Object.keys(e).length) return { error: 'Check the highlighted fields.' };
    const body: MoveInput = {
      unitId: unit!,
      type,
      householdOf: who,
      moveDate: date,
      slotStart: start,
      slotEnd: end,
      ...(liftOn && lift ? { liftLabel: lift.trim() } : {}),
      ...(vehicle ? { vehicleNumber: vehicle.trim() } : {}),
      ...(company ? { moverCompany: company.trim() } : {}),
      ...(moverMobile ? { moverMobile: normaliseMobile(moverMobile) } : {}),
      ...(helpers ? { helperCount: Number(helpers) } : {}),
      ...(note ? { itemsNote: note.trim() } : {}),
    };
    try {
      const r = await (as === 'admin'
        ? residentsService.createMove(body)
        : residentsService.requestMove(body));
      return {
        message:
          r.status === 'BLOCKED_DUES'
            ? 'Request saved, but dues must be paid first.'
            : r.status === 'PENDING_DEPOSIT'
              ? 'Request saved. Pay the deposit to continue.'
              : 'Move requested',
      };
    } catch (err) {
      setErrs(fieldErrors(err));
      throw err;
    }
  };
  return (
    <FormDialog
      wide
      title="Request a move"
      description="Pick the date and a time slot. Moves happen in the society moving hours."
      submitLabel="Request move"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      <UnitField as={as} units={units} value={unit} onChange={setUnit} error={errs.unitId} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Select
          label="Type"
          value={type}
          onChange={e => setType(e.target.value as 'MOVE_IN')}
          options={[
            { value: 'MOVE_IN', label: 'Move in' },
            { value: 'MOVE_OUT', label: 'Move out' },
          ]}
        />
        <Select
          label="Household"
          value={who}
          onChange={e => setWho(e.target.value as 'OWNER')}
          options={[
            { value: 'OWNER', label: 'Owner household' },
            { value: 'TENANT', label: 'Tenant household' },
          ]}
        />
      </div>
      <Input
        label="Move date"
        type="date"
        value={date}
        min={today()}
        onChange={e => setDate(e.target.value)}
        error={errs.moveDate}
        required
      />
      <div role="group" aria-label="Time slot" className="mb-2 flex flex-wrap gap-1.5">
        {PRESETS.map(([label, s, en]) => (
          <button
            key={label}
            type="button"
            aria-pressed={start === s && end === en}
            onClick={() => {
              setStart(s);
              setEnd(en);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${start === s && end === en ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60'}`}
          >
            {label} {s} to {en}
          </button>
        ))}
      </div>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Select
          label="Slot starts"
          value={start}
          onChange={e => setStart(e.target.value)}
          options={TIMES.map(t => ({ value: t, label: t }))}
        />
        <Select
          label="Slot ends"
          value={end}
          onChange={e => setEnd(e.target.value)}
          error={errs.slotEnd}
          options={TIMES.map(t => ({ value: t, label: t }))}
        />
      </div>
      {liftOn && (
        <Input
          label="Lift (optional)"
          value={lift}
          onChange={e => setLift(e.target.value)}
          placeholder="Tower A service lift"
        />
      )}
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Input
          label="Vehicle number (optional)"
          value={vehicle}
          onChange={e => setVehicle(e.target.value)}
          error={errs.vehicleNumber}
        />
        <Input label="Mover company (optional)" value={company} onChange={e => setCompany(e.target.value)} />
        <Input
          label="Mover mobile (optional)"
          inputMode="numeric"
          value={moverMobile}
          onChange={e => setMoverMobile(e.target.value)}
          error={errs.moverMobile}
        />
        <Input
          label="Helpers (optional)"
          inputMode="numeric"
          value={helpers}
          onChange={e => setHelpers(e.target.value)}
        />
      </div>
      <Textarea label="Items note (optional)" value={note} onChange={e => setNote(e.target.value)} />
    </FormDialog>
  );
}

/** Apply for a renovation permit (spec 8.16). */
export function PermitForm({
  as,
  units,
  onClose,
  onDone,
}: {
  as: As;
  units?: UnitChoice[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [unit, setUnit] = useState<number | null>(units?.length === 1 ? units[0].unitId : null);
  const [category, setCategory] = useState<WorkCategory>('KITCHEN');
  const [desc, setDesc] = useState('');
  const [structural, setStructural] = useState(false);
  const [cName, setCName] = useState('');
  const [cCompany, setCCompany] = useState('');
  const [cMobile, setCMobile] = useState('');
  const [workers, setWorkers] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [from, setFrom] = useState('10:00');
  const [to, setTo] = useState('18:00');
  const [idFile, setIdFile] = useState<number | null>(null);
  const [plan, setPlan] = useState<number | null>(null);
  const [cert, setCert] = useState<number | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!unit) e.unitId = 'Choose the flat.';
    if (desc.trim().length < 10) e.workDescription = 'Describe the work in at least 10 characters.';
    if (cName.trim().length < 2) e.contractorName = 'Enter the contractor name.';
    if (!isValidMobile(cMobile)) e.contractorMobile = 'Enter a 10 digit Indian mobile number.';
    const w = Number(workers);
    if (!Number.isInteger(w) || w < 1 || w > 50) e.workerCount = 'Enter between 1 and 50 workers.';
    if (!isoDate(start)) e.startDate = 'Choose the start date.';
    if (!isoDate(end) || end < start) e.endDate = 'The end date cannot be before the start date.';
    if (to <= from) e.dailyEndTime = 'Work hours must end after they start.';
    setErrs(e);
    if (Object.keys(e).length) return { error: 'Check the highlighted fields.' };
    const files: FileRef[] = [];
    if (idFile) files.push({ fileId: idFile, docType: 'CONTRACTOR_ID' });
    if (plan) files.push({ fileId: plan, docType: 'WORK_PLAN' });
    if (cert) files.push({ fileId: cert, docType: 'STRUCTURAL_CERTIFICATE' });
    if (files.length === 0) return { error: 'Attach the contractor ID or the work plan.' };
    const body: PermitInput = {
      unitId: unit!,
      workCategory: category,
      workDescription: desc.trim(),
      involvesStructuralChange: structural,
      contractorName: cName.trim(),
      ...(cCompany ? { contractorCompany: cCompany.trim() } : {}),
      contractorMobile: normaliseMobile(cMobile),
      workerCount: w,
      startDate: start,
      endDate: end,
      dailyStartTime: from,
      dailyEndTime: to,
      fileIds: files,
    };
    try {
      const r = await (as === 'admin'
        ? residentsService.createPermit(body)
        : residentsService.requestPermit(body));
      return {
        message:
          r.status === 'PENDING_DEPOSIT'
            ? 'Permit requested. Pay the deposit to continue.'
            : 'Permit requested',
      };
    } catch (err) {
      setErrs(fieldErrors(err));
      throw err;
    }
  };
  return (
    <FormDialog
      wide
      title="Renovation permit"
      description="Apply before any work starts. The committee approves it."
      submitLabel="Apply for permit"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      <UnitField as={as} units={units} value={unit} onChange={setUnit} error={errs.unitId} />
      <Select
        label="Kind of work"
        value={category}
        onChange={e => setCategory(e.target.value as WorkCategory)}
        options={opts(WORK_LABEL)}
      />
      <Textarea
        label="What will be done"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        error={errs.workDescription}
      />
      <Checkbox
        label="The work changes the structure of the flat"
        checked={structural}
        onChange={e => setStructural(e.target.checked)}
      />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Input
          label="Contractor name"
          value={cName}
          onChange={e => setCName(e.target.value)}
          error={errs.contractorName}
          required
        />
        <Input
          label="Contractor company (optional)"
          value={cCompany}
          onChange={e => setCCompany(e.target.value)}
        />
        <Input
          label="Contractor mobile"
          inputMode="numeric"
          value={cMobile}
          onChange={e => setCMobile(e.target.value)}
          error={errs.contractorMobile}
          required
        />
        <Input
          label="Number of workers"
          inputMode="numeric"
          value={workers}
          onChange={e => setWorkers(e.target.value)}
          error={errs.workerCount}
          required
        />
        <Input
          label="Start date"
          type="date"
          value={start}
          onChange={e => setStart(e.target.value)}
          error={errs.startDate}
          required
        />
        <Input
          label="End date"
          type="date"
          value={end}
          onChange={e => setEnd(e.target.value)}
          error={errs.endDate}
          required
        />
        <Select
          label="Daily start"
          value={from}
          onChange={e => setFrom(e.target.value)}
          options={TIMES.map(t => ({ value: t, label: t }))}
        />
        <Select
          label="Daily end"
          value={to}
          onChange={e => setTo(e.target.value)}
          error={errs.dailyEndTime}
          options={TIMES.map(t => ({ value: t, label: t }))}
        />
      </div>
      <FileField label="Contractor ID" onChange={setIdFile} />
      <FileField label="Work plan" onChange={setPlan} />
      {structural && <FileField label="Structural certificate" onChange={setCert} />}
    </FormDialog>
  );
}

const TRANSFER_DOCS: DocType[] = [
  'SALE_DEED',
  'INDEX_II',
  'STAMP_DUTY_RECEIPT',
  'ORIGINAL_SHARE_CERTIFICATE',
  'MEMBERSHIP_APPLICATION',
  'NOC',
  'DEATH_CERTIFICATE',
  'SUCCESSION_CERTIFICATE',
  'OTHER',
];
interface Buyer {
  name: string;
  mobile: string;
  share: string;
  primary: boolean;
}

/** Start an ownership transfer (spec 8.17); the response carries the fee preview and missing documents. */
export function TransferForm({
  as,
  units,
  onClose,
  onDone,
}: {
  as: As;
  units?: UnitChoice[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [unit, setUnit] = useState<number | null>(units?.length === 1 ? units[0].unitId : null);
  const [type, setType] = useState<TransferType>('SALE');
  const [date, setDate] = useState('');
  const [deedNo, setDeedNo] = useState('');
  const [deedDate, setDeedDate] = useState('');
  const [consideration, setConsideration] = useState('');
  const [buyers, setBuyers] = useState<Buyer[]>([{ name: '', mobile: '', share: '100.00', primary: true }]);
  const [policy, setPolicy] = useState<'MUST_CLEAR' | 'CARRY_WITH_UNIT'>('MUST_CLEAR');
  const [endTenancy, setEndTenancy] = useState(false);
  const [notes, setNotes] = useState('');
  const [docs, setDocs] = useState<{ type: DocType; file: number | null }[]>([
    { type: 'SALE_DEED', file: null },
  ]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (i: number, patch: Partial<Buyer>) =>
    setBuyers(b =>
      b.map((x, j) => (j === i ? { ...x, ...patch } : patch.primary ? { ...x, primary: false } : x)),
    );
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!unit) e.unitId = 'Choose the flat.';
    if (!isoDate(date)) e.effectiveDate = 'Choose the effective date.';
    if (buyers.some(b => b.name.trim().length < 2 || !isValidMobile(b.mobile)))
      e.buyers = 'Each buyer needs a name and a 10 digit mobile number.';
    else if (Math.abs(buyers.reduce((n, b) => n + Number(b.share || 0), 0) - 100) > 0.001)
      e.buyers = 'Buyer shares must add up to 100%.';
    setErrs(e);
    if (Object.keys(e).length) return { error: e.buyers ?? 'Check the highlighted fields.' };
    const body: TransferInput = {
      unitId: unit!,
      transferType: type,
      effectiveDate: date,
      ...(deedNo ? { deedRegistrationNo: deedNo.trim() } : {}),
      ...(isoDate(deedDate) ? { deedDate } : {}),
      ...(consideration ? { considerationPaise: rupeesToPaise(consideration) } : {}),
      buyers: buyers.map(b => ({
        name: b.name.trim(),
        mobile: normaliseMobile(b.mobile),
        sharePercent: Number(b.share).toFixed(2),
        isPrimary: b.primary,
        isResiding: true,
      })),
      duesPolicy: policy,
      endTenancy,
      ...(notes ? { notes: notes.trim() } : {}),
      fileIds: docs.filter(d => d.file).map(d => ({ fileId: d.file!, docType: d.type })),
    };
    try {
      const r = await (as === 'admin'
        ? residentsService.createTransfer(body)
        : residentsService.requestTransfer(body));
      return {
        message: r.missingDocuments?.length
          ? `Transfer drafted. Still needed: ${r.missingDocuments.map(docLabel).join(', ')}.`
          : 'Transfer drafted',
      };
    } catch (err) {
      setErrs(fieldErrors(err));
      throw err;
    }
  };
  return (
    <FormDialog
      wide
      title="Ownership transfer"
      description="Saved as a draft first. Submit it for approval when the papers are ready."
      submitLabel="Save draft"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      <UnitField as={as} units={units} value={unit} onChange={setUnit} error={errs.unitId} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Select
          label="Kind of transfer"
          value={type}
          onChange={e => setType(e.target.value as TransferType)}
          options={opts(TRANSFER_TYPE_LABEL)}
        />
        <Input
          label="Effective date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          error={errs.effectiveDate}
          required
        />
        <Input
          label="Deed registration number"
          value={deedNo}
          onChange={e => setDeedNo(e.target.value)}
          error={errs.deedRegistrationNo}
        />
        <Input label="Deed date" type="date" value={deedDate} onChange={e => setDeedDate(e.target.value)} />
        <Input
          label="Consideration (₹)"
          inputMode="decimal"
          value={consideration}
          onChange={e => setConsideration(e.target.value)}
        />
        <Select
          label="Dues"
          value={policy}
          onChange={e => setPolicy(e.target.value as 'MUST_CLEAR')}
          options={[
            { value: 'MUST_CLEAR', label: 'Seller must clear dues' },
            { value: 'CARRY_WITH_UNIT', label: 'Dues stay with the flat' },
          ]}
        />
      </div>
      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[13px] font-semibold">Buyers</legend>
        {buyers.map((b, i) => (
          <div key={i} className="mb-2 grid gap-x-3 rounded-[14px] bg-white/50 p-3 sm:grid-cols-4">
            <Input
              label={`Buyer ${i + 1} name`}
              value={b.name}
              onChange={e => set(i, { name: e.target.value })}
            />
            <Input
              label={`Buyer ${i + 1} mobile`}
              inputMode="numeric"
              value={b.mobile}
              onChange={e => set(i, { mobile: e.target.value })}
            />
            <Input
              label="Share %"
              inputMode="decimal"
              value={b.share}
              onChange={e => set(i, { share: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                label="Primary"
                className="mb-0"
                checked={b.primary}
                onChange={() => set(i, { primary: true })}
              />
              {buyers.length > 1 && (
                <Button size="xs" variant="ghost" onClick={() => setBuyers(x => x.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
        {errs.buyers && (
          <p role="alert" className="text-[12.5px] font-medium text-bad">
            {errs.buyers}
          </p>
        )}
        {buyers.length < 6 && (
          <Button
            size="xs"
            variant="glass"
            onClick={() => setBuyers(b => [...b, { name: '', mobile: '', share: '', primary: false }])}
          >
            Add buyer
          </Button>
        )}
      </fieldset>
      <Checkbox
        label="End the current tenancy when the transfer completes"
        checked={endTenancy}
        onChange={e => setEndTenancy(e.target.checked)}
      />
      <Textarea label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Document checklist</legend>
        {docs.map((d, i) => (
          <div key={i} className="grid gap-x-3 sm:grid-cols-2">
            <Select
              label={`Document ${i + 1}`}
              value={d.type}
              onChange={e =>
                setDocs(x => x.map((y, j) => (j === i ? { ...y, type: e.target.value as DocType } : y)))
              }
              options={TRANSFER_DOCS.map(t => ({ value: t, label: docLabel(t) }))}
            />
            <FileField
              label="File"
              onChange={f => setDocs(x => x.map((y, j) => (j === i ? { ...y, file: f } : y)))}
            />
          </div>
        ))}
        {docs.length < 10 && (
          <Button
            size="xs"
            variant="glass"
            onClick={() => setDocs(x => [...x, { type: 'INDEX_II', file: null }])}
          >
            Add document
          </Button>
        )}
      </fieldset>
    </FormDialog>
  );
}
