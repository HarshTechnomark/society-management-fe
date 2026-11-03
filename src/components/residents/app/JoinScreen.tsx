'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useLoad } from '@/hooks/useLoad';
import { residentsService } from '@/services/residents.service';
import type {
  DocType,
  FamilyRelation,
  FileRef,
  JoinInput,
  JoinRequest,
  JoinSociety,
  Relation,
} from '@/types/residents';
import { ConfirmDialog } from '@/components/setup/ConfirmDialog';
import { FileField, Loading, StatusChip, isoDate, useRun } from '../common';
import {
  FAMILY_LABEL,
  JOIN_LABEL,
  JOIN_TONE,
  RELATION_LABEL,
  docLabel,
  opts,
  residentsError,
} from '../format';
import { isValidEmail } from '@/lib/validation';

const STEPS = ['Society code', 'Flat', 'I am the', 'Details', 'Documents'];
const ID_DOCS: DocType[] = [
  'AADHAAR',
  'PAN',
  'PASSPORT',
  'DRIVING_LICENCE',
  'VOTER_ID',
  'RENT_AGREEMENT',
  'ADDRESS_PROOF',
  'OTHER',
];

/** Join your society (spec 11.2): society code, flat, relation, details, documents, then a status card. */
export function JoinScreen() {
  const mine = useLoad(() => residentsService.myJoinRequests(), 'mine');
  return (
    <Page>
      <PageHead
        title="Join your society"
        sub="Ask to join the society where you live. The owner and the committee approve."
      />
      <Loading load={mine} rows={2}>
        {list => {
          const open =
            list.find(j => j.status === 'PENDING_OWNER' || j.status === 'PENDING_ADMIN') ?? list[0];
          return open &&
            (open.status === 'PENDING_OWNER' ||
              open.status === 'PENDING_ADMIN' ||
              open.status === 'APPROVED') ? (
            <StatusCard req={open} onChanged={mine.reload} />
          ) : (
            <>
              {open && (
                <Card className="mb-4">
                  <StatusCard req={open} onChanged={mine.reload} inline />
                </Card>
              )}
              <Wizard onDone={mine.reload} />
            </>
          );
        }}
      </Loading>
    </Page>
  );
}

function StatusCard({
  req,
  onChanged,
  inline,
}: {
  req: JoinRequest;
  onChanged: () => void;
  inline?: boolean;
}) {
  const run = useRun();
  const [confirm, setConfirm] = useState(false);
  const pending = req.status === 'PENDING_OWNER' || req.status === 'PENDING_ADMIN';
  const body = (
    <>
      <p className="text-[13px] font-semibold uppercase text-muted">Your request</p>
      <p className="mt-1 text-[18px] font-bold">
        {req.societyName ?? 'Society'} · {req.unitLabel} · {RELATION_LABEL[req.relation]}
      </p>
      <div className="mt-2">
        <StatusChip status={req.status} labels={JOIN_LABEL} tones={JOIN_TONE} />
      </div>
      {req.status === 'APPROVED' && (
        <p className="mt-3 text-[14px]">
          Approved:{' '}
          <Link className="font-semibold underline" href="/resident">
            open {req.societyName ?? 'your society'}
          </Link>
        </p>
      )}
      {req.status === 'REJECTED' && req.rejectReason && (
        <p className="mt-3 text-[14px]">Reason: {req.rejectReason}</p>
      )}
      {pending && (
        <Button variant="danger-soft" size="sm" className="mt-3" onClick={() => setConfirm(true)}>
          Withdraw
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        title="Withdraw your request?"
        description="You can send a new request later."
        confirmLabel="Withdraw"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (await run(() => residentsService.withdrawJoin(req.id, req.version ?? 1), 'Request withdrawn')) {
            setConfirm(false);
            onChanged();
          }
        }}
      />
    </>
  );
  return inline ? <div>{body}</div> : <Card>{body}</Card>;
}

function Wizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('code') ?? '').toLowerCase(),
  );
  const [society, setSociety] = useState<JoinSociety | null>(null);
  const [q, setQ] = useState('');
  const [units, setUnits] = useState<{ unitId: number; label: string }[]>([]);
  const [unit, setUnit] = useState<number | null>(null);
  const [relation, setRelation] = useState<Relation>('OWNER');
  const [family, setFamily] = useState<FamilyRelation>('SPOUSE');
  const [householdOf, setHouseholdOf] = useState<'OWNER' | 'TENANT'>('OWNER');
  const [aStart, setAStart] = useState('');
  const [aEnd, setAEnd] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [message, setMessage] = useState('');
  const [docs, setDocs] = useState<{ type: DocType; file: number | null }[]>([
    { type: 'AADHAAR', file: null },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRun();

  const guard = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(residentsError(e));
    } finally {
      setBusy(false);
    }
  };

  const findSociety = () =>
    guard(async () => {
      const c = code.trim().toLowerCase();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c) || c.length < 3)
        throw new Error('Enter the society code, for example sky-heights.');
      setSociety(await residentsService.joinSociety(c));
      setStep(1);
    });
  const search = async (text: string) => {
    setQ(text);
    if (!text.trim()) return setUnits([]);
    try {
      setUnits(await residentsService.joinUnits(code.trim().toLowerCase(), text.trim()));
    } catch {
      setUnits([]);
    }
  };
  const next = () => {
    setError(null);
    if (step === 1 && !unit) return setError('Choose your flat from the list.');
    if (step === 2 && relation === 'TENANT') {
      if (!isoDate(aStart) || !isoDate(aEnd) || aEnd <= aStart)
        return setError('Add the agreement start and an end date after it.');
    }
    if (step === 3 && email && !isValidEmail(email)) return setError('Enter a valid email address.');
    setStep(step + 1);
  };
  const submit = () =>
    guard(async () => {
      const fileIds: FileRef[] = docs.filter(d => d.file).map(d => ({ fileId: d.file!, docType: d.type }));
      if (fileIds.length === 0)
        throw new Error('Attach at least one document: an ID, and the agreement for tenants.');
      const body: JoinInput = {
        societyCode: code.trim().toLowerCase(),
        unitId: unit!,
        relation,
        ...(relation === 'FAMILY' ? { familyRelation: family } : {}),
        ...(relation === 'FAMILY' || relation === 'CARETAKER' ? { householdOf } : {}),
        ...(relation === 'TENANT' ? { agreementStart: aStart, agreementEnd: aEnd } : {}),
        ...(email ? { email: email.trim() } : {}),
        ...(dob ? { dateOfBirth: dob } : {}),
        ...(message ? { message: message.trim() } : {}),
        fileIds,
      };
      if (await run(() => residentsService.submitJoin(body), 'Request sent')) onDone();
    });

  return (
    <Card>
      <ol className="mb-4 flex flex-wrap gap-2 text-[12.5px]" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? 'step' : undefined}
            className={`rounded-full px-3 py-1 font-semibold ${i === step ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 text-muted'}`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {error && <Alert tone="bad">{error}</Alert>}
      {step === 0 && (
        <>
          <Input
            label="Society code"
            value={code}
            onChange={e => setCode(e.target.value)}
            hint="Ask your committee for the code, or scan the society QR."
            placeholder="sky-heights"
          />
          <Button loading={busy} onClick={() => void findSociety()}>
            Find society
          </Button>
        </>
      )}
      {step === 1 && (
        <>
          <p className="mb-3 text-[15px]">
            <strong>{society?.name}</strong>
            {society?.city ? `, ${society.city}` : ''}
          </p>
          <Input
            label="Search your flat"
            type="search"
            value={q}
            onChange={e => void search(e.target.value)}
            placeholder="A-12"
          />
          <Select
            label="Flat"
            value={unit ? String(unit) : ''}
            onChange={e => setUnit(Number(e.target.value) || null)}
            options={[
              { value: '', label: q && units.length === 0 ? 'No flat found' : 'Choose your flat' },
              ...units.map(u => ({ value: String(u.unitId), label: u.label })),
            ]}
          />
        </>
      )}
      {step === 2 && (
        <>
          <Select
            label="I am the"
            value={relation}
            onChange={e => setRelation(e.target.value as Relation)}
            options={opts(RELATION_LABEL)}
          />
          {relation === 'FAMILY' && (
            <Select
              label="Relation"
              value={family}
              onChange={e => setFamily(e.target.value as FamilyRelation)}
              options={opts(FAMILY_LABEL)}
            />
          )}
          {(relation === 'FAMILY' || relation === 'CARETAKER') && (
            <Select
              label="Household of"
              value={householdOf}
              onChange={e => setHouseholdOf(e.target.value as 'OWNER')}
              options={[
                { value: 'OWNER', label: 'The owner' },
                { value: 'TENANT', label: 'The tenant' },
              ]}
            />
          )}
          {relation === 'TENANT' && (
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Input
                label="Agreement start"
                type="date"
                value={aStart}
                onChange={e => setAStart(e.target.value)}
              />
              <Input label="Agreement end" type="date" value={aEnd} onChange={e => setAEnd(e.target.value)} />
            </div>
          )}
        </>
      )}
      {step === 3 && (
        <>
          <Input
            label="Email (optional)"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            label="Date of birth"
            type="date"
            value={dob}
            onChange={e => setDob(e.target.value)}
            hint="Owners and tenants must be 18 or older."
          />
          <Textarea label="Message (optional)" value={message} onChange={e => setMessage(e.target.value)} />
        </>
      )}
      {step === 4 && (
        <>
          {docs.map((d, i) => (
            <div key={i} className="grid gap-x-3 sm:grid-cols-2">
              <Select
                label={`Document ${i + 1}`}
                value={d.type}
                onChange={e =>
                  setDocs(x => x.map((y, j) => (j === i ? { ...y, type: e.target.value as DocType } : y)))
                }
                options={ID_DOCS.map(t => ({ value: t, label: docLabel(t) }))}
              />
              <FileField
                label="Photo or PDF"
                camera
                purpose="KYC_DOCUMENT"
                onChange={f => setDocs(x => x.map((y, j) => (j === i ? { ...y, file: f } : y)))}
              />
            </div>
          ))}
          {docs.length < 5 && (
            <Button
              size="xs"
              variant="glass"
              onClick={() => setDocs(x => [...x, { type: 'RENT_AGREEMENT', file: null }])}
            >
              Add another document
            </Button>
          )}
        </>
      )}
      {step > 0 && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
          >
            Back
          </Button>
          {step < 4 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button loading={busy} onClick={() => void submit()}>
              Send request
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
