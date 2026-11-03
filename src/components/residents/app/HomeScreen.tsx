'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { ConfirmDialog } from '@/components/setup/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { isValidMobile, normaliseMobile } from '@/lib/validation';
import { residentsService } from '@/services/residents.service';
import type { FamilyRelation, HouseholdPerson, HouseholdUnit } from '@/types/residents';
import { FormDialog, Loading, StatusChip, fieldErrors, useRun } from '../common';
import {
  FAMILY_LABEL,
  OCCUPANCY_LABEL,
  OCCUPANCY_TONE,
  POLICE_LABEL,
  POLICE_TONE,
  RELATION_LABEL,
  opts,
} from '../format';

const H = PERMISSIONS.resident.household;

/** My home (spec 11.2): my flats, the household, add and invite members, the household permissions link. */
export function HomeScreen() {
  return (
    <Gate view={H.view} feature="residents.person_registry" title="My home">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canAdd = usePermission(H.create);
  const portfolioOn = useFeature('residents.owner_portfolio_view');
  const [adding, setAdding] = useState(false);
  const load = useLoad(() => residentsService.household(), 'h');
  const owned = (load.data?.units ?? []).filter(u => u.myRelation === 'OWNER' || u.myRelation === 'CO_OWNER');
  return (
    <Page>
      <PageHead
        title="My home"
        sub="Your flats and the people who live in them."
        actions={canAdd && <Button onClick={() => setAdding(true)}>Add member</Button>}
      />
      <Loading load={load} rows={3}>
        {h =>
          h.units.length === 0 ? (
            <Card>
              <p className="font-semibold">No flat is linked to you yet.</p>
              <p className="text-[14px] text-muted">
                Ask to join your society from{' '}
                <Link className="underline" href="/resident/join">
                  Join a society
                </Link>
                .
              </p>
            </Card>
          ) : (
            <>
              {portfolioOn && owned.length > 1 && <Portfolio />}
              {h.units.map(u => (
                <UnitCard key={u.unitId} unit={u} onChanged={load.reload} />
              ))}
              {adding && (
                <AddMemberDialog
                  units={h.units.filter(u => u.canManage)}
                  onClose={() => setAdding(false)}
                  onDone={() => {
                    setAdding(false);
                    load.reload();
                  }}
                />
              )}
            </>
          )
        }
      </Loading>
    </Page>
  );
}

function Portfolio() {
  const load = useLoad(() => residentsService.portfolio(), 'p');
  return (
    <Card title="My flats" sub="Every flat you own" className="mb-4">
      <Loading load={load} rows={2}>
        {list => (
          <ul className="grid gap-2 sm:grid-cols-2">
            {list.map(p => (
              <li key={p.unitId} className="rounded-[14px] bg-white/60 p-3 text-[14px]">
                <div className="flex items-center justify-between gap-2">
                  <strong>{p.unitLabel}</strong>
                  <Chip tone={OCCUPANCY_TONE[p.occupancy]}>{OCCUPANCY_LABEL[p.occupancy]}</Chip>
                </div>
                <p className="mt-1">{p.duesPaise > 0 ? `Dues ${inr(p.duesPaise)}` : 'Paid up'}</p>
                {p.tenancy && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Chip>Agreement ends {p.tenancy.agreementEnd}</Chip>
                    <StatusChip
                      status={p.tenancy.policeVerificationStatus}
                      labels={POLICE_LABEL}
                      tones={POLICE_TONE}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Loading>
    </Card>
  );
}

function UnitCard({ unit: u, onChanged }: { unit: HouseholdUnit; onChanged: () => void }) {
  const canAdd = usePermission(H.create);
  const canDelete = usePermission(H.delete);
  const canEdit = usePermission(H.edit);
  const run = useRun();
  const [remove, setRemove] = useState<HouseholdPerson | null>(null);
  return (
    <Card className="mb-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[19px] font-bold">{u.unitLabel}</h2>
          <p className="text-[13.5px] text-muted">You are the {RELATION_LABEL[u.myRelation].toLowerCase()}</p>
        </div>
        <Chip tone={OCCUPANCY_TONE[u.occupancy]}>{OCCUPANCY_LABEL[u.occupancy]}</Chip>
      </div>
      <ul>
        {u.people.map(p => (
          <li
            key={p.linkId}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2.5 text-[14px] last:border-0"
          >
            <span className="min-w-0">
              <strong>{p.name}</strong>
              <span className="block text-[12.5px] text-muted">
                {p.relation === 'FAMILY' && p.familyRelation
                  ? FAMILY_LABEL[p.familyRelation]
                  : RELATION_LABEL[p.relation]}
                {p.mobile ? ` · ${p.mobile}` : ''}
                {p.isMinor ? ' · minor' : ''}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {p.isPrimary && <Chip tone="gold">Primary</Chip>}
              <Chip tone={p.hasLogin ? 'info' : 'neutral'}>
                {p.hasLogin ? 'Has the app' : 'No app login'}
              </Chip>
              {u.canManage &&
                canAdd &&
                !p.hasLogin &&
                p.mobile &&
                (p.relation === 'FAMILY' || p.relation === 'CARETAKER') && (
                  <Button
                    size="xs"
                    variant="glass"
                    onClick={() =>
                      void run(
                        () => residentsService.inviteMember(p.linkId),
                        `Invite sent to ${p.name}`,
                      ).then(ok => ok && onChanged())
                    }
                  >
                    Invite
                  </Button>
                )}
              {u.canManage && canEdit && p.memberId && (
                <Link
                  className="rounded-full bg-white/60 px-3 py-1 text-[12.5px] font-semibold"
                  href={`/resident/household/${p.memberId}/permissions`}
                >
                  Permissions
                </Link>
              )}
              {u.canManage && canDelete && (p.relation === 'FAMILY' || p.relation === 'CARETAKER') && (
                <Button size="xs" variant="danger-soft" onClick={() => setRemove(p)}>
                  Remove
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {u.tenancy && (
        <p className="mt-2 text-[13.5px] text-muted">
          Tenant: {u.tenancy.tenant.name}, agreement ends {u.tenancy.agreementEnd}. See My tenant for details.
        </p>
      )}
      <ConfirmDialog
        open={!!remove}
        title={`Remove ${remove?.name ?? ''}?`}
        description="They will no longer be linked to this flat."
        confirmLabel="Remove"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (
            remove &&
            (await run(() => residentsService.removeMember(remove.linkId), `${remove.name} removed`))
          ) {
            setRemove(null);
            onChanged();
          }
        }}
      />
    </Card>
  );
}

function AddMemberDialog({
  units,
  onClose,
  onDone,
}: {
  units: HouseholdUnit[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [unit, setUnit] = useState(units[0] ? String(units[0].unitId) : '');
  const [relation, setRelation] = useState<'FAMILY' | 'CARETAKER'>('FAMILY');
  const [family, setFamily] = useState<FamilyRelation>('SPOUSE');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [invite, setInvite] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!unit) e.unitId = 'Choose the flat.';
    if (name.trim().length < 2) e.name = 'Enter the full name.';
    if (mobile ? !isValidMobile(mobile) : invite) e.mobile = 'Enter a 10 digit Indian mobile number.';
    setErrs(e);
    if (Object.keys(e).length) return { error: 'Check the highlighted fields.' };
    try {
      await residentsService.addMember({
        unitId: Number(unit),
        name: name.trim(),
        relation,
        ...(relation === 'FAMILY' ? { familyRelation: family } : {}),
        ...(mobile ? { mobile: normaliseMobile(mobile) } : {}),
        ...(dob ? { dateOfBirth: dob } : {}),
        invite,
      });
    } catch (err) {
      setErrs(fieldErrors(err));
      throw err;
    }
    return { message: `${name.trim()} added` };
  };
  return (
    <FormDialog
      title="Add a household member"
      description="Family members and caretakers of your flat."
      submitLabel="Add member"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      {units.length === 0 ? (
        <p className="mb-4 text-[14px]">Only the owner of a flat, or its tenant, can add members.</p>
      ) : (
        <Select
          label="Flat"
          value={unit}
          error={errs.unitId}
          onChange={e => setUnit(e.target.value)}
          options={units.map(u => ({ value: String(u.unitId), label: u.unitLabel }))}
        />
      )}
      <Select
        label="Who"
        value={relation}
        onChange={e => setRelation(e.target.value as 'FAMILY')}
        options={[
          { value: 'FAMILY', label: 'Family member' },
          { value: 'CARETAKER', label: 'Caretaker' },
        ]}
      />
      {relation === 'FAMILY' && (
        <Select
          label="Relation"
          value={family}
          onChange={e => setFamily(e.target.value as FamilyRelation)}
          options={opts(FAMILY_LABEL)}
        />
      )}
      <Input label="Name" value={name} onChange={e => setName(e.target.value)} error={errs.name} required />
      <Input
        label="Mobile (optional)"
        inputMode="numeric"
        value={mobile}
        onChange={e => setMobile(e.target.value)}
        error={errs.mobile}
      />
      <Input
        label="Date of birth (optional)"
        type="date"
        value={dob}
        onChange={e => setDob(e.target.value)}
      />
      <Checkbox label="Invite them to the app" checked={invite} onChange={e => setInvite(e.target.checked)} />
    </FormDialog>
  );
}
