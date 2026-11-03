'use client';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Page, PageHead, Card } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { societySetupService } from '@/services/society-setup.service';
import type { Building } from '@/types/societySetup';
import { BuildingDrawer } from './BuildingDrawer';
import { BuildingGridDrawer } from './BuildingGridDrawer';
import { Gate } from './Gate';
import { StructureActions } from './StructureActions';
import { UnitDrawer } from './UnitDrawer';
import { STATUS_TONE, kindLabel, statusLabel } from './format';

type Filter = 'ACTIVE' | 'ARCHIVED' | 'ALL';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All' },
];

/** Settings > Structure > Buildings (spec 11.6). */
export function BuildingsScreen() {
  return (
    <Gate view={PERMISSIONS.residents.units.view} feature="property.property_hierarchy" title="Buildings">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canEdit = usePermission(PERMISSIONS.settings.society.edit);
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const { data, error, loading, reload } = useLoad(
    () => societySetupService.buildings({ status: filter, limit: 100 }),
    filter,
  );
  const towers = useLoad(
    () => societySetupService.buildings({ status: 'ACTIVE', kind: 'TOWER', limit: 100 }),
    'towers',
  );
  const [edit, setEdit] = useState<Building | 'new' | null>(null);
  const [grid, setGrid] = useState<Building | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const seen = new Set<number>();
    const out: Building[] = [];
    for (const b of data?.items ?? []) {
      for (const x of [b, ...(b.wings ?? [])])
        if (!seen.has(x.id)) {
          seen.add(x.id);
          out.push(x);
        }
    }
    return out;
  }, [data]);

  const columns: Column<Building>[] = [
    { key: 'code', label: 'Code', render: b => <strong>{b.code}</strong>, sortValue: b => b.code },
    { key: 'name', label: 'Name', render: b => b.name, sortValue: b => b.name },
    { key: 'kind', label: 'Kind', render: b => kindLabel(b.kind) },
    { key: 'floors', label: 'Floors', render: b => `${b.floorLabels.min} … ${b.floorLabels.max}` },
    { key: 'units', label: 'Flats', render: b => b.unitCounts.active, sortValue: b => b.unitCounts.active },
    {
      key: 'status',
      label: 'Status',
      render: b => <Chip tone={STATUS_TONE[b.status]}>{statusLabel(b.status)}</Chip>,
    },
  ];

  return (
    <Page>
      <PageHead
        title="Buildings"
        sub="Towers, wings and blocks. Flat labels start with the building code, for example A-101."
        actions={
          <>
            {canEdit && <Button onClick={() => setEdit('new')}>Add building</Button>}
            <StructureActions onChanged={reload} />
          </>
        }
      />
      <Card>
        <div role="group" aria-label="Show" className="mb-3 flex gap-1.5">
          {FILTERS.map(f => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? 'primary' : 'glass'}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <DataTable
          caption="Buildings"
          columns={columns}
          rows={rows}
          rowKey={b => b.id}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={b => setEdit(b)}
          rowLabel={b => b.name}
          searchText={b => `${b.code} ${b.name}`}
          searchLabel="Search buildings"
          empty={{
            title: 'No buildings yet',
            text: 'Add a building or generate towers.',
            action: canEdit ? <Button onClick={() => setEdit('new')}>Add building</Button> : undefined,
          }}
        />
      </Card>
      {edit && (
        <BuildingDrawer
          key={edit === 'new' ? 'new' : `${edit.id}-${edit.version}`}
          open
          building={edit === 'new' ? null : edit}
          towers={towers.data?.items ?? []}
          canEdit={canEdit}
          onClose={() => setEdit(null)}
          onChanged={() => {
            reload();
            towers.reload();
          }}
          onGrid={b => {
            setEdit(null);
            setGrid(b);
          }}
        />
      )}
      <BuildingGridDrawer building={grid} onClose={() => setGrid(null)} onOpenUnit={setUnitId} />
      {unitId !== null && (
        <UnitDrawer
          open
          unitId={unitId}
          buildings={data?.items ?? []}
          onClose={() => setUnitId(null)}
          onChanged={reload}
        />
      )}
    </Page>
  );
}
