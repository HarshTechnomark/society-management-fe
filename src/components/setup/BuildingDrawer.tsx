'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { societySetupService } from '@/services/society-setup.service';
import type { Building } from '@/types/societySetup';
import { ConfirmDialog } from './ConfirmDialog';
import { BUILDING_KINDS, STATUS_TONE, fieldErrors, setupError, statusLabel } from './format';

interface Values {
  code: string;
  name: string;
  kind: string;
  parentBuildingId: string;
  floorsAboveGround: string;
  basements: string;
  liftCount: string;
  sortOrder: string;
}

const toValues = (b: Building | null): Values => ({
  code: b?.code ?? '',
  name: b?.name ?? '',
  kind: b?.kind ?? 'TOWER',
  parentBuildingId: b?.parentBuildingId ? String(b.parentBuildingId) : '',
  floorsAboveGround: String(b?.floorsAboveGround ?? 10),
  basements: String(b?.basements ?? 0),
  liftCount: String(b?.liftCount ?? 0),
  sortOrder: String(b?.sortOrder ?? 0),
});

/** Building drawer (spec 11.6, fields of 8.7) with Archive, Restore and Delete. `building` null means create. */
export function BuildingDrawer({
  open,
  building,
  towers,
  canEdit,
  onClose,
  onChanged,
  onGrid,
}: {
  open: boolean;
  building: Building | null;
  towers: Building[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
  onGrid?: (b: Building) => void;
}) {
  const toast = useToast();
  const [v, setV] = useState<Values>(() => toValues(building));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'archive' | 'restore' | 'delete' | null>(null);
  const set = (k: keyof Values) => (e: { target: { value: string } }) =>
    setV(x => ({ ...x, [k]: e.target.value }));
  const hasUnits = !!building && building.unitCounts.active + building.unitCounts.archived > 0;
  const archived = building?.status === 'ARCHIVED';
  const ro = !canEdit || archived;

  const fail = (e: unknown) => {
    setErrors(fieldErrors(e));
    setFormError(setupError(e));
  };

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
      fail(e);
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!/^[A-Za-z0-9]{1,6}$/.test(v.code.trim())) e.code = 'Use 1 to 6 letters or digits.';
    if (v.name.trim().length < 2) e.name = 'Enter a name (at least 2 characters).';
    const num = (k: keyof Values, min: number, max: number, label: string) => {
      const n = Number(v[k]);
      if (!Number.isInteger(n) || n < min || n > max) e[k] = `${label} must be ${min} to ${max}.`;
    };
    num('floorsAboveGround', 0, 200, 'Floors');
    num('basements', 0, 5, 'Basements');
    num('liftCount', 0, 50, 'Lifts');
    num('sortOrder', 0, 9999, 'Order');
    if (v.kind === 'WING' && !v.parentBuildingId)
      e.parentBuildingId = 'Choose the tower this wing belongs to.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = {
      code: v.code.trim().toUpperCase(),
      name: v.name.trim(),
      kind: v.kind,
      parentBuildingId: v.kind === 'WING' ? Number(v.parentBuildingId) : null,
      floorsAboveGround: Number(v.floorsAboveGround),
      basements: Number(v.basements),
      liftCount: Number(v.liftCount),
      sortOrder: Number(v.sortOrder),
    };
    await run(
      () =>
        building
          ? societySetupService.updateBuilding(building.id, { ...body, version: building.version })
          : societySetupService.createBuilding(body),
      building ? 'Building saved.' : 'Building added.',
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={building ? `${building.name} (${building.code})` : 'Add building'}
      description={building ? `Floors ${building.floorLabels.min} to ${building.floorLabels.max}` : undefined}
    >
      {building && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Chip tone={STATUS_TONE[building.status]}>{statusLabel(building.status)}</Chip>
          <Chip>{building.unitCounts.active} active flats</Chip>
          {onGrid && building.wings.length === 0 && (
            <Button size="xs" variant="glass" onClick={() => onGrid(building)}>
              View flats grid
            </Button>
          )}
        </div>
      )}
      {formError && <Alert tone="bad">{formError}</Alert>}
      {archived && <Alert tone="info">This building is archived. Restore it to edit.</Alert>}
      <form onSubmit={submit} noValidate aria-label="Building">
        <Input
          label="Code"
          value={v.code}
          onChange={set('code')}
          error={errors.code}
          disabled={ro || hasUnits}
          maxLength={6}
          hint={
            hasUnits
              ? 'The code cannot change once the building has flats.'
              : 'Used in flat labels, for example A-101. Never reused.'
          }
          required
        />
        <Input
          label="Name"
          value={v.name}
          onChange={set('name')}
          error={errors.name}
          disabled={ro}
          required
        />
        <Select
          label="Kind"
          value={v.kind}
          onChange={set('kind')}
          options={BUILDING_KINDS}
          disabled={ro || hasUnits}
          error={errors.kind}
        />
        {v.kind === 'WING' && (
          <Select
            label="Parent tower"
            value={v.parentBuildingId}
            onChange={set('parentBuildingId')}
            error={errors.parentBuildingId}
            disabled={ro || hasUnits}
            options={[
              { value: '', label: 'Choose a tower' },
              ...towers
                .filter(t => t.id !== building?.id)
                .map(t => ({ value: String(t.id), label: `${t.name} (${t.code})` })),
            ]}
          />
        )}
        <div className="grid grid-cols-2 gap-x-3">
          <Input
            label="Floors above ground"
            type="number"
            min={0}
            max={200}
            value={v.floorsAboveGround}
            onChange={set('floorsAboveGround')}
            error={errors.floorsAboveGround}
            disabled={ro}
          />
          <Input
            label="Basements"
            type="number"
            min={0}
            max={5}
            value={v.basements}
            onChange={set('basements')}
            error={errors.basements}
            disabled={ro}
          />
          <Input
            label="Lifts"
            type="number"
            min={0}
            max={50}
            value={v.liftCount}
            onChange={set('liftCount')}
            error={errors.liftCount}
            disabled={ro}
          />
          <Input
            label="Order in lists"
            type="number"
            min={0}
            max={9999}
            value={v.sortOrder}
            onChange={set('sortOrder')}
            error={errors.sortOrder}
            disabled={ro}
          />
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <span className="flex flex-wrap gap-2">
            {canEdit && building && building.status === 'ACTIVE' && (
              <Button variant="danger-soft" onClick={() => setDialog('archive')}>
                Archive
              </Button>
            )}
            {canEdit && building && archived && (
              <Button variant="glass" onClick={() => setDialog('restore')}>
                Restore
              </Button>
            )}
            {canEdit && building && !hasUnits && building.wings.length === 0 && (
              <Button variant="ghost" onClick={() => setDialog('delete')}>
                Delete
              </Button>
            )}
          </span>
          {!ro && (
            <Button type="submit" loading={busy && dialog === null}>
              {building ? 'Save changes' : 'Add building'}
            </Button>
          )}
        </div>
      </form>
      {building && (
        <>
          <ConfirmReason
            open={dialog === 'archive'}
            title="Archive this building?"
            description="Its location entries are archived too. Buildings with active flats or wings cannot be archived."
            confirmLabel="Archive"
            minLength={5}
            onCancel={() => setDialog(null)}
            onConfirm={reason =>
              run(
                () => societySetupService.archiveBuilding(building.id, reason, building.version),
                'Building archived.',
              )
            }
          />
          <ConfirmDialog
            open={dialog === 'restore'}
            title="Restore this building?"
            confirmLabel="Restore"
            variant="primary"
            onCancel={() => setDialog(null)}
            onConfirm={() =>
              run(
                () => societySetupService.restoreBuilding(building.id, building.version),
                'Building restored.',
              )
            }
          />
          <ConfirmDialog
            open={dialog === 'delete'}
            title="Delete this building?"
            description="Only buildings that never had flats can be deleted. This cannot be undone. You may be asked for a fresh code."
            confirmLabel="Delete"
            onCancel={() => setDialog(null)}
            onConfirm={() => run(() => societySetupService.deleteBuilding(building.id), 'Building deleted.')}
          />
        </>
      )}
    </Drawer>
  );
}
