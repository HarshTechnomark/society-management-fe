'use client';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/setup/ConfirmDialog';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { residentsService } from '@/services/residents.service';
import type { Pet } from '@/types/residents';
import { Empty, FormDialog, Loading, fieldErrors, isoDate, useRun } from '../common';
import { daysTo } from '../format';

const SPECIES = [
  ['DOG', 'Dog'],
  ['CAT', 'Cat'],
  ['BIRD', 'Bird'],
  ['RABBIT', 'Rabbit'],
  ['FISH', 'Fish'],
  ['OTHER', 'Other'],
] as const;
const H = PERMISSIONS.resident.household;

/** Vaccination chip: valid, due in N days, expired or not recorded; always words, never colour alone. */
export function vaccination(p: Pet): { text: string; tone: Tone } {
  const d = daysTo(p.vaccinationValidUntil);
  if (d === null) return { text: 'Vaccination not recorded', tone: 'neutral' };
  if (d < 0) return { text: 'Vaccination expired', tone: 'bad' };
  if (d <= 30) return { text: `Vaccination due in ${d} ${d === 1 ? 'day' : 'days'}`, tone: 'warn' };
  return { text: 'Vaccination valid', tone: 'ok' };
}

/** My pets (spec 11.2). */
export function PetsScreen() {
  return (
    <Gate view={PERMISSIONS.resident.home.view} feature="residents.pets_registry" title="My pets">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canAdd = usePermission(H.create);
  const canEdit = usePermission(H.edit);
  const canDelete = usePermission(H.delete);
  const run = useRun();
  const [editing, setEditing] = useState<Pet | 'new' | null>(null);
  const [remove, setRemove] = useState<Pet | null>(null);
  const load = useLoad(() => residentsService.myPets(), 'p');
  const house = useLoad(() => residentsService.household().catch(() => ({ units: [] })), 'h');
  const units = (house.data?.units ?? []).map(u => ({ unitId: u.unitId, unitLabel: u.unitLabel }));
  return (
    <Page>
      <PageHead
        title="My pets"
        sub="Register your pets and keep vaccinations up to date."
        actions={canAdd && <Button onClick={() => setEditing('new')}>Add pet</Button>}
      />
      <Loading load={load} rows={2}>
        {list =>
          list.length === 0 ? (
            <Card>
              <Empty title="No pets registered" text="Add a pet to keep its vaccination dates." />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map(p => {
                const v = vaccination(p);
                return (
                  <li key={p.id}>
                    <Card>
                      <p className="text-[17px] font-bold">{p.name}</p>
                      <p className="text-[13.5px] text-muted">
                        {SPECIES.find(s => s[0] === p.species)?.[1]}
                        {p.breed ? ` · ${p.breed}` : ''}
                        {p.unitLabel ? ` · ${p.unitLabel}` : ''}
                      </p>
                      <div className="mt-2">
                        <Chip tone={v.tone}>{v.text}</Chip>
                      </div>
                      {p.vaccinationValidUntil && (
                        <p className="mt-1 text-[13px] text-muted">
                          Valid until {shortDate(p.vaccinationValidUntil)}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        {canEdit && (
                          <Button size="sm" variant="glass" onClick={() => setEditing(p)}>
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="sm" variant="danger-soft" onClick={() => setRemove(p)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Loading>
      {editing && (
        <PetDialog
          pet={editing === 'new' ? null : editing}
          units={units}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!remove}
        title={`Remove ${remove?.name ?? ''}?`}
        confirmLabel="Remove"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (remove && (await run(() => residentsService.deletePet(remove.id), 'Pet removed'))) {
            setRemove(null);
            load.reload();
          }
        }}
      />
    </Page>
  );
}

function PetDialog({
  pet,
  units,
  onClose,
  onDone,
}: {
  pet: Pet | null;
  units: { unitId: number; unitLabel: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [unit, setUnit] = useState(String(units[0]?.unitId ?? ''));
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Pet['species']>(pet?.species ?? 'DOG');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [vaccine, setVaccine] = useState(pet?.lastVaccineName ?? '');
  const [on, setOn] = useState(pet?.lastVaccinatedOn ?? '');
  const [until, setUntil] = useState(pet?.vaccinationValidUntil ?? '');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 1) e.name = 'Enter the name of the pet.';
    if (!pet && !unit) e.unitId = 'Choose the flat.';
    if (species === 'DOG' && !isoDate(until))
      e.vaccinationValidUntil = 'A dog needs the date its vaccination is valid until.';
    if (isoDate(on) && isoDate(until) && until < on)
      e.vaccinationValidUntil = 'Valid-until cannot be before the vaccination date.';
    setErrs(e);
    if (Object.keys(e).length) return { error: 'Check the highlighted fields.' };
    const body = {
      name: name.trim(),
      species,
      ...(breed ? { breed: breed.trim() } : {}),
      ...(vaccine ? { lastVaccineName: vaccine.trim() } : {}),
      ...(isoDate(on) ? { lastVaccinatedOn: on } : {}),
      ...(isoDate(until) ? { vaccinationValidUntil: until } : {}),
    };
    try {
      if (pet) await residentsService.updatePet(pet.id, { ...body, version: pet.version });
      else await residentsService.addPet({ ...body, unitId: Number(unit) });
    } catch (err) {
      setErrs(fieldErrors(err));
      throw err;
    }
    return { message: pet ? 'Pet saved' : 'Pet added' };
  };
  return (
    <FormDialog
      title={pet ? 'Edit pet' : 'Add a pet'}
      submitLabel="Save"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      {!pet && units.length > 1 && (
        <Select
          label="Flat"
          value={unit}
          error={errs.unitId}
          onChange={e => setUnit(e.target.value)}
          options={units.map(u => ({ value: String(u.unitId), label: u.unitLabel }))}
        />
      )}
      <Input label="Name" value={name} onChange={e => setName(e.target.value)} error={errs.name} required />
      <Select
        label="Kind"
        value={species}
        onChange={e => setSpecies(e.target.value as Pet['species'])}
        options={SPECIES.map(([value, label]) => ({ value, label }))}
      />
      <Input label="Breed (optional)" value={breed} onChange={e => setBreed(e.target.value)} />
      <Input label="Last vaccine (optional)" value={vaccine} onChange={e => setVaccine(e.target.value)} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Input label="Vaccinated on" type="date" value={on} onChange={e => setOn(e.target.value)} />
        <Input
          label="Valid until"
          type="date"
          value={until}
          onChange={e => setUntil(e.target.value)}
          error={errs.vaccinationValidUntil}
        />
      </div>
    </FormDialog>
  );
}
