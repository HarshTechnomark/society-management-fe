'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { societySetupService } from '@/services/society-setup.service';
import type { Building, Unit, UnitInput, UnitType } from '@/types/societySetup';
import { ConfirmDialog } from './ConfirmDialog';
import {
  BHK_OPTIONS,
  STATUS_TONE,
  UNIT_TYPES,
  bhkLabel,
  fieldErrors,
  setupError,
  statusLabel,
} from './format';

const U = PERMISSIONS.residents.units;
const AREA = /^\d{1,6}(\.\d{1,3})?$/;
const recent = (iso: string) => Date.now() - Date.parse(iso) < 24 * 3600 * 1000;

interface Values {
  buildingId: string;
  unitNumber: string;
  floor: string;
  positionOnFloor: string;
  unitType: UnitType;
  bhk: string;
  carpet: string;
  builtUp: string;
  superArea: string;
  share: string;
  isBillable: boolean;
  possessionDate: string;
  notes: string;
}

const toValues = (u: Unit | null, buildingId?: number): Values => ({
  buildingId: String(u?.buildingId ?? buildingId ?? ''),
  unitNumber: u?.unitNumber ?? '',
  floor: u ? String(u.floor) : '1',
  positionOnFloor: u?.positionOnFloor ? String(u.positionOnFloor) : '',
  unitType: u?.unitType ?? 'FLAT',
  bhk: u?.bhk ?? '',
  carpet: u?.carpetAreaSqft ?? '',
  builtUp: u?.builtUpAreaSqft ?? '',
  superArea: u?.superBuiltUpAreaSqft ?? '',
  share: u?.undividedSharePct ?? '',
  isBillable: u?.isBillable ?? true,
  possessionDate: u?.possessionDate ?? '',
  notes: u?.notes ?? '',
});

/** The unit drawer (spec 11.6, fields of 8.11). `unitId` null creates a flat. */
export function UnitDrawer({
  open,
  unitId,
  buildings,
  defaultBuildingId,
  onClose,
  onChanged,
}: {
  open: boolean;
  unitId: number | null;
  buildings: Building[];
  defaultBuildingId?: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const load = useLoad(() => (unitId ? societySetupService.unit(unitId) : Promise.resolve(null)), unitId);
  return (
    <Drawer open={open} onClose={onClose} title={unitId ? (load.data?.label ?? 'Flat') : 'Add flat'}>
      {unitId && load.error ? (
        <ErrorState error={load.error} />
      ) : unitId && !load.data ? (
        <div className="skeleton h-40 w-full" aria-busy="true" />
      ) : (
        <UnitForm
          key={load.data?.version ?? 'new'}
          unit={load.data}
          buildings={buildings}
          defaultBuildingId={defaultBuildingId}
          onClose={onClose}
          onChanged={onChanged}
        />
      )}
    </Drawer>
  );
}

function UnitForm({
  unit,
  buildings,
  defaultBuildingId,
  onClose,
  onChanged,
}: {
  unit: Unit | null;
  buildings: Building[];
  defaultBuildingId?: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canCreate = usePermission(U.create);
  const canEdit = usePermission(U.edit);
  const canDelete = usePermission(U.delete);
  const [v, setV] = useState<Values>(() => toValues(unit, defaultBuildingId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'archive' | 'restore' | 'delete' | null>(null);
  const live = useLoad(() => (unit ? societySetupService.society() : Promise.resolve(null)), unit?.id ?? 0);
  const archived = unit?.status === 'ARCHIVED';
  const mayWrite = unit ? canEdit : canCreate;
  const ro = !mayWrite || archived;
  const set = (k: keyof Values) => (e: { target: { value: string } }) =>
    setV(x => ({ ...x, [k]: e.target.value }));
  const withinDay = unit ? recent(unit.createdAt) : false;
  const mayDelete = !!unit && canDelete && (withinDay || (live.data !== null && !live.data.isLive));

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setFormError(null);
    try {
      await fn();
      toast.show(done);
      setDialog(null);
      onChanged();
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      setFormError(setupError(e));
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!v.buildingId) e.buildingId = 'Choose a building.';
    if (!/^[A-Za-z0-9][A-Za-z0-9/-]{0,19}$/.test(v.unitNumber.trim()))
      e.unitNumber = 'Use 1 to 20 letters, digits, / or -.';
    const floor = Number(v.floor);
    if (v.floor === '' || !Number.isInteger(floor))
      e.floor = 'Enter the floor number (0 is the ground floor).';
    if (v.positionOnFloor && !(Number(v.positionOnFloor) >= 1 && Number(v.positionOnFloor) <= 50))
      e.positionOnFloor = 'Position: 1 to 50.';
    for (const [k, val] of [
      ['carpet', v.carpet],
      ['builtUp', v.builtUp],
      ['superArea', v.superArea],
    ] as const)
      if (val && !AREA.test(val)) e[k] = 'A number with up to 3 decimals.';
    if (v.share && !/^\d{1,3}(\.\d{1,4})?$/.test(v.share)) e.share = 'A number with up to 4 decimals.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const body: UnitInput = {
      buildingId: Number(v.buildingId),
      unitNumber: v.unitNumber.trim().toUpperCase(),
      floor,
      positionOnFloor: v.positionOnFloor ? Number(v.positionOnFloor) : null,
      unitType: v.unitType,
      bhk: v.unitType === 'FLAT' && v.bhk ? v.bhk : null,
      carpetAreaSqft: v.carpet || null,
      builtUpAreaSqft: v.builtUp || null,
      superBuiltUpAreaSqft: v.superArea || null,
      undividedSharePct: v.share || null,
      isBillable: v.isBillable,
      possessionDate: v.possessionDate || null,
      notes: v.notes.trim() || null,
    };
    await run(
      () =>
        unit
          ? societySetupService.updateUnit(unit.id, { ...body, version: unit.version })
          : societySetupService.createUnit(body),
      unit ? 'Flat saved.' : 'Flat added.',
    );
  };

  const missingArea = !!unit && unit.areaSqft === null;

  return (
    <>
      {unit && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Chip tone={STATUS_TONE[unit.status]}>{statusLabel(unit.status)}</Chip>
          <Chip>
            Billing area:{' '}
            {unit.areaSqft ? `${Number(unit.areaSqft).toLocaleString('en-IN')} sq ft` : 'Area missing'}
          </Chip>
          {unit.archivedReason && <Chip tone="warn">Archived: {unit.archivedReason}</Chip>}
        </div>
      )}
      {formError && <Alert tone="bad">{formError}</Alert>}
      {archived && <Alert tone="info">This flat is archived. Restore it to edit.</Alert>}
      {missingArea && !archived && (
        <Alert tone="warn">Area is missing, so this flat cannot be billed per sq ft yet.</Alert>
      )}
      <form onSubmit={submit} noValidate aria-label="Flat">
        <Select
          label="Building"
          value={v.buildingId}
          onChange={set('buildingId')}
          error={errors.buildingId}
          disabled={ro}
          options={[
            { value: '', label: 'Choose' },
            ...buildings
              .filter(b => b.status === 'ACTIVE' && b.wings.length === 0)
              .map(b => ({ value: String(b.id), label: `${b.name} (${b.code})` })),
          ]}
        />
        <div className="grid grid-cols-3 gap-x-3">
          <Input
            label="Flat number"
            value={v.unitNumber}
            onChange={set('unitNumber')}
            error={errors.unitNumber}
            disabled={ro}
            required
          />
          <Input
            label="Floor"
            type="number"
            value={v.floor}
            onChange={set('floor')}
            error={errors.floor}
            disabled={ro}
          />
          <Input
            label="Position on floor"
            type="number"
            value={v.positionOnFloor}
            onChange={set('positionOnFloor')}
            error={errors.positionOnFloor}
            disabled={ro}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Select
            label="Type"
            value={v.unitType}
            onChange={set('unitType')}
            options={UNIT_TYPES}
            disabled={ro}
          />
          <Select
            label="BHK"
            value={v.bhk}
            onChange={set('bhk')}
            error={errors.bhk}
            disabled={ro || v.unitType !== 'FLAT'}
            options={[{ value: '', label: '-' }, ...BHK_OPTIONS.map(b => ({ value: b, label: bhkLabel(b) }))]}
          />
        </div>
        <div className="grid grid-cols-3 gap-x-3">
          <Input
            label="Carpet area (sq ft)"
            inputMode="decimal"
            value={v.carpet}
            onChange={set('carpet')}
            error={errors.carpet}
            disabled={ro}
          />
          <Input
            label="Built-up area (sq ft)"
            inputMode="decimal"
            value={v.builtUp}
            onChange={set('builtUp')}
            error={errors.builtUp}
            disabled={ro}
          />
          <Input
            label="Super built-up area (sq ft)"
            inputMode="decimal"
            value={v.superArea}
            onChange={set('superArea')}
            error={errors.superArea}
            disabled={ro}
          />
        </div>
        {errors.areaSqft && <p className="mb-2 text-[12.5px] font-medium text-bad">{errors.areaSqft}</p>}
        <div className="grid grid-cols-2 gap-x-3">
          <Input
            label="Undivided share (%)"
            inputMode="decimal"
            value={v.share}
            onChange={set('share')}
            error={errors.share}
            disabled={ro}
          />
          <Input
            label="Possession date"
            type="date"
            value={v.possessionDate}
            onChange={set('possessionDate')}
            error={errors.possessionDate}
            disabled={ro}
          />
        </div>
        <Checkbox
          label="Billable"
          checked={v.isBillable}
          onChange={e => setV(x => ({ ...x, isBillable: e.target.checked }))}
          disabled={ro}
        />
        <Textarea
          label="Notes"
          value={v.notes}
          onChange={set('notes')}
          error={errors.notes}
          disabled={ro}
          maxLength={500}
        />
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <span className="flex flex-wrap gap-2">
            {unit && canEdit && unit.status === 'ACTIVE' && (
              <Button variant="danger-soft" onClick={() => setDialog('archive')}>
                Archive
              </Button>
            )}
            {unit && canEdit && archived && (
              <Button variant="glass" onClick={() => setDialog('restore')}>
                Restore
              </Button>
            )}
            {mayDelete && (
              <Button variant="ghost" onClick={() => setDialog('delete')}>
                Delete
              </Button>
            )}
          </span>
          {!ro && (
            <Button type="submit" loading={busy && dialog === null}>
              {unit ? 'Save changes' : 'Add flat'}
            </Button>
          )}
        </div>
      </form>
      {unit && (
        <>
          <ConfirmReason
            open={dialog === 'archive'}
            title="Archive this flat?"
            description="Flats with active residents, an unsettled balance or a parking slot cannot be archived."
            confirmLabel="Archive"
            minLength={5}
            onCancel={() => setDialog(null)}
            onConfirm={reason =>
              run(() => societySetupService.archiveUnit(unit.id, reason, unit.version), 'Flat archived.')
            }
          />
          <ConfirmDialog
            open={dialog === 'restore'}
            title="Restore this flat?"
            confirmLabel="Restore"
            variant="primary"
            onCancel={() => setDialog(null)}
            onConfirm={() =>
              run(() => societySetupService.restoreUnit(unit.id, unit.version), 'Flat restored.')
            }
          />
          <ConfirmDialog
            open={dialog === 'delete'}
            title="Delete this flat?"
            description="Only for setup mistakes, before go-live or within 24 hours. This cannot be undone. You may be asked for a fresh code."
            confirmLabel="Delete"
            onCancel={() => setDialog(null)}
            onConfirm={() => run(() => societySetupService.deleteUnit(unit.id), 'Flat deleted.')}
          />
        </>
      )}
    </>
  );
}
