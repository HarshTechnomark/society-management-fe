'use client';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Page, PageHead, Card } from '@/components/common/PageHead';
import { Pager, useServerList } from '@/components/billing/useServerList';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { societySetupService } from '@/services/society-setup.service';
import type { Unit } from '@/types/societySetup';
import { BulkEditDrawer } from './BulkEditDrawer';
import { Gate } from './Gate';
import { StructureActions } from './StructureActions';
import { UnitDrawer } from './UnitDrawer';
import { STATUS_TONE, UNIT_TYPES, UNIT_TYPE_LABEL, bhkLabel, sqft, statusLabel } from './format';

/** Settings > Structure > Flats (spec 11.6): search, filters, bulk select, drawer. */
export function UnitsScreen() {
  return (
    <Gate view={PERMISSIONS.residents.units.view} feature="property.unit_registry" title="Flats">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(PERMISSIONS.residents.units.create);
  const canEdit = usePermission(PERMISSIONS.residents.units.edit);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [building, setBuilding] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | 'new' | null>(null);
  const [bulk, setBulk] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const buildings = useLoad(() => societySetupService.buildings({ status: 'ALL', limit: 100 }), 'all');
  const filterKey = [q, building, type, status, missing].join('|');
  const list = useServerList<Unit>(
    page =>
      societySetupService.units({
        q: q || undefined,
        buildingId: building ? Number(building) : undefined,
        unitType: type || undefined,
        status,
        missingArea: missing || undefined,
        page,
        limit: 50,
      }),
    filterKey,
    50,
  );

  const toggle = (id: number) =>
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOnPage = list.rows.length > 0 && list.rows.every(r => selected.has(r.id));

  const columns: Column<Unit>[] = useMemo(
    () => [
      ...(canEdit
        ? [
            {
              key: 'sel',
              label: 'Select',
              hideLabel: true,
              className: 'w-10',
              render: (u: Unit) => (
                <span onClick={e => e.stopPropagation()}>
                  <Checkbox
                    label={<span className="sr-only">Select {u.label}</span>}
                    className="mb-0"
                    checked={selected.has(u.id)}
                    disabled={u.status !== 'ACTIVE'}
                    onChange={() => toggle(u.id)}
                  />
                </span>
              ),
            } as Column<Unit>,
          ]
        : []),
      { key: 'label', label: 'Flat', render: u => <strong>{u.label}</strong> },
      { key: 'floor', label: 'Floor', render: u => u.floorLabel },
      { key: 'type', label: 'Type', render: u => UNIT_TYPE_LABEL[u.unitType] ?? u.unitType },
      { key: 'bhk', label: 'BHK', render: u => bhkLabel(u.bhk) },
      {
        key: 'area',
        label: 'Area (sq ft)',
        render: u =>
          u.areaSqft ? (
            sqft(u.areaSqft)
          ) : (
            <Chip tone="warn">
              <span aria-hidden="true">⚠ </span>Area missing
            </Chip>
          ),
      },
      { key: 'billable', label: 'Billable', render: u => (u.isBillable ? 'Yes' : 'No') },
      {
        key: 'status',
        label: 'Status',
        render: u => <Chip tone={STATUS_TONE[u.status]}>{statusLabel(u.status)}</Chip>,
      },
    ],
    [canEdit, selected],
  );

  const changed = () => {
    list.reload();
    buildings.reload();
  };

  return (
    <Page>
      <PageHead
        title="Flats"
        sub="Every flat, shop and office of the society. Area drives maintenance billing."
        actions={
          <>
            {canCreate && <Button onClick={() => setOpen('new')}>Add flat</Button>}
            <StructureActions buildingId={building ? Number(building) : undefined} onChanged={changed} />
          </>
        }
      />
      <Card>
        <div className="mb-3 grid gap-x-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="unit-search" className="mb-1.5 block text-[13px] font-semibold">
              Search flat or tower
            </label>
            <input
              id="unit-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="A-12 or 1203"
              className="mb-4 h-12 w-full rounded-[16px] border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[15px]"
            />
          </div>
          <Select
            label="Building"
            value={building}
            onChange={e => setBuilding(e.target.value)}
            options={[
              { value: '', label: 'All buildings' },
              ...(buildings.data?.items ?? []).map(b => ({
                value: String(b.id),
                label: `${b.name} (${b.code})`,
              })),
            ]}
          />
          <Select
            label="Type"
            value={type}
            onChange={e => setType(e.target.value)}
            options={[{ value: '', label: 'All types' }, ...UNIT_TYPES]}
          />
          <Select
            label="Status"
            value={status}
            onChange={e => setStatus(e.target.value as typeof status)}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'ARCHIVED', label: 'Archived' },
              { value: 'ALL', label: 'All' },
            ]}
          />
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <Checkbox
            label="Missing area only"
            className="mb-0"
            checked={missing}
            onChange={e => setMissing(e.target.checked)}
          />
          {canEdit && list.rows.length > 0 && (
            <Checkbox
              label="Select all on this page"
              className="mb-0"
              checked={allOnPage}
              onChange={e =>
                setSelected(s => {
                  const n = new Set(s);
                  list.rows
                    .filter(r => r.status === 'ACTIVE')
                    .forEach(r => (e.target.checked ? n.add(r.id) : n.delete(r.id)));
                  return n;
                })
              }
            />
          )}
          {selected.size > 0 && (
            <>
              <Button size="sm" onClick={() => setBulk(true)}>
                Edit selected ({selected.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            </>
          )}
        </div>
        <DataTable
          caption="Flats"
          columns={columns}
          rows={list.rows}
          rowKey={u => u.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          onRowClick={u => setOpen(u.id)}
          rowLabel={u => u.label}
          pageSize={100}
          empty={{
            title: q || building || type || missing ? 'No flats match' : 'No flats yet',
            text:
              q || building || type || missing
                ? 'Change the filters to see more.'
                : 'Add a flat, generate towers or import a sheet.',
          }}
        />
        <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      </Card>
      {open !== null && (
        <UnitDrawer
          key={String(open)}
          open
          unitId={open === 'new' ? null : open}
          buildings={buildings.data?.items ?? []}
          defaultBuildingId={building ? Number(building) : undefined}
          onClose={() => setOpen(null)}
          onChanged={changed}
        />
      )}
      {bulk && (
        <BulkEditDrawer
          open
          unitIds={[...selected]}
          onClose={() => setBulk(false)}
          onDone={() => {
            setSelected(new Set());
            changed();
          }}
        />
      )}
    </Page>
  );
}
