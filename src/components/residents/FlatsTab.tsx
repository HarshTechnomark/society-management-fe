'use client';
import { useEffect, useMemo, useState } from 'react';
import { Pager, useServerList } from '@/components/billing/useServerList';
import { Card } from '@/components/common/PageHead';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { residentsService } from '@/services/residents.service';
import { societySetupService } from '@/services/society-setup.service';
import type { FlatRow, Occupancy, Stats } from '@/types/residents';
import { Segments } from './common';
import { OCCUPANCY_LABEL, OCCUPANCY_TONE } from './format';

type Seg = 'ALL' | 'OWNER' | 'TENANT' | 'VACANT' | 'OVERDUE';
const OCC: Record<string, Occupancy> = { OWNER: 'OWNER_OCCUPIED', TENANT: 'RENTED', VACANT: 'VACANT' };

/** The Flats tab (spec 11.1): search, tower, segments, 12 per page. */
export function FlatsTab({
  stats,
  refreshKey,
  onOpen,
}: {
  stats: Stats | null;
  refreshKey: number;
  onOpen: (unitId: number) => void;
}) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [building, setBuilding] = useState('');
  const [seg, setSeg] = useState<Seg>('ALL');
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().length >= 2 ? search.trim() : ''), 300);
    return () => clearTimeout(t);
  }, [search]);
  const buildings = useLoad(
    () => societySetupService.buildings({ status: 'ACTIVE', limit: 100 }).catch(() => null),
    'b',
  );
  const list = useServerList<FlatRow>(
    page =>
      residentsService.flats({
        q: q || undefined,
        buildingId: building ? Number(building) : undefined,
        occupancy: OCC[seg],
        hasDues: seg === 'OVERDUE' ? true : undefined,
        page,
        limit: 12,
      }),
    [q, building, seg, refreshKey].join('|'),
    12,
  );
  const columns: Column<FlatRow>[] = useMemo(
    () => [
      {
        key: 'flat',
        label: 'Flat',
        render: f => (
          <>
            <strong>{f.unitLabel}</strong>
            <div className="text-[12.5px] text-muted">
              {[f.bhk ? `${f.bhk} BHK` : null, f.areaSqft ? `${f.areaSqft} sq ft` : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </>
        ),
      },
      {
        key: 'resident',
        label: 'Resident',
        render: f =>
          f.tenant ? (
            <>
              {f.tenant.name}
              <div className="text-[12.5px] text-muted">
                Tenant · owner {f.primaryOwner?.name ?? 'unknown'}
              </div>
            </>
          ) : f.primaryOwner ? (
            <>
              {f.primaryOwner.name}
              <div className="text-[12.5px] text-muted">Owner</div>
            </>
          ) : (
            <span className="text-muted">Vacant</span>
          ),
      },
      {
        key: 'status',
        label: 'Status',
        render: f => <Chip tone={OCCUPANCY_TONE[f.occupancy]}>{OCCUPANCY_LABEL[f.occupancy]}</Chip>,
      },
      {
        key: 'dues',
        label: 'Dues',
        className: 'text-right',
        render: f =>
          f.duesPaise > 0 ? (
            <strong className="text-[#6f4200]">{inr(f.duesPaise)}</strong>
          ) : (
            <span className="text-muted">Paid up</span>
          ),
      },
    ],
    [],
  );
  const filtered = !!(q || building || seg !== 'ALL');
  return (
    <Card>
      <div className="mb-2 grid gap-x-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="flat-search" className="mb-1.5 block text-[13px] font-semibold">
            Search flat, name or tower
          </label>
          <input
            id="flat-search"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search flat, name or tower"
            className="mb-4 h-12 w-full rounded-[16px] border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[15px]"
          />
        </div>
        <Select
          label="Tower"
          value={building}
          onChange={e => setBuilding(e.target.value)}
          options={[
            { value: '', label: 'All towers' },
            ...(buildings.data?.items ?? []).map(b => ({ value: String(b.id), label: b.name })),
          ]}
        />
      </div>
      <Segments
        label="Show"
        value={seg}
        onChange={setSeg}
        options={[
          { key: 'ALL', label: 'All', count: stats?.units },
          { key: 'OWNER', label: 'Owner', count: stats?.ownerOccupied },
          { key: 'TENANT', label: 'Tenant', count: stats?.rented },
          { key: 'VACANT', label: 'Vacant', count: stats?.vacant },
          { key: 'OVERDUE', label: 'Overdue' },
        ]}
      />
      <DataTable
        caption="Flats"
        columns={columns}
        rows={list.rows}
        rowKey={f => f.unitId}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={f => onOpen(f.unitId)}
        rowLabel={f => f.unitLabel}
        pageSize={100}
        empty={{
          title: filtered ? 'No flats match' : 'No flats yet',
          text: filtered ? 'Change the filters to see more.' : 'Add flats in the society setup first.',
        }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
    </Card>
  );
}
