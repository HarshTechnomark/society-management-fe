'use client';
import { useEffect, useMemo, useState } from 'react';
import { Pager, useServerList } from '@/components/billing/useServerList';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Card } from '@/components/common/PageHead';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { residentsService } from '@/services/residents.service';
import type { KycStatus, Relation, Resident } from '@/types/residents';
import { StatusChip } from './common';
import { KYC_LABEL, KYC_TONE, RELATION_LABEL, opts } from './format';

/** The People tab (spec 11.1): residents with relation, status, login and KYC filters. */
export function PeopleTab({ refreshKey, onOpen }: { refreshKey: number; onOpen: (id: number) => void }) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [relation, setRelation] = useState('');
  const [status, setStatus] = useState('');
  const [login, setLogin] = useState('');
  const [kyc, setKyc] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().length >= 2 ? search.trim() : ''), 300);
    return () => clearTimeout(t);
  }, [search]);
  const list = useServerList<Resident>(
    page =>
      residentsService.residents({
        q: q || undefined,
        relation: (relation || undefined) as Relation | undefined,
        status: (status || undefined) as 'ACTIVE' | undefined,
        hasLogin: login ? login === 'yes' : undefined,
        kycStatus: (kyc || undefined) as KycStatus | undefined,
        page,
        limit: 20,
      }),
    [q, relation, status, login, kyc, refreshKey].join('|'),
    20,
  );
  const columns: Column<Resident>[] = useMemo(
    () => [
      { key: 'name', label: 'Name', render: r => <strong>{r.name}</strong> },
      { key: 'mobile', label: 'Mobile', render: r => r.mobile ?? '-' },
      {
        key: 'flats',
        label: 'Flats',
        render: r =>
          r.links.filter(l => !l.toDate).length === 0
            ? '-'
            : r.links
                .filter(l => !l.toDate)
                .map(l => `${l.unitLabel} (${RELATION_LABEL[l.relation]})`)
                .join(', '),
      },
      {
        key: 'login',
        label: 'App login',
        render: r => <Chip tone={r.hasLogin ? 'info' : 'neutral'}>{r.hasLogin ? 'Yes' : 'No'}</Chip>,
      },
      {
        key: 'kyc',
        label: 'ID check',
        render: r => <StatusChip status={r.kycStatus} labels={KYC_LABEL} tones={KYC_TONE} />,
      },
      { key: 'status', label: 'Status', render: r => (r.status === 'ACTIVE' ? 'Active' : 'Inactive') },
    ],
    [],
  );
  const filtered = !!(q || relation || status || login || kyc);
  return (
    <Card>
      <div className="mb-2 grid gap-x-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="people-search" className="mb-1.5 block text-[13px] font-semibold">
            Search name, flat or mobile
          </label>
          <input
            id="people-search"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-4 h-12 w-full rounded-[16px] border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[15px]"
          />
        </div>
        <Select
          label="Relation"
          value={relation}
          onChange={e => setRelation(e.target.value)}
          options={[{ value: '', label: 'Any relation' }, ...opts(RELATION_LABEL)]}
        />
        <Select
          label="Status"
          value={status}
          onChange={e => setStatus(e.target.value)}
          options={[
            { value: '', label: 'Active and inactive' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />
        <Select
          label="App login"
          value={login}
          onChange={e => setLogin(e.target.value)}
          options={[
            { value: '', label: 'With or without' },
            { value: 'yes', label: 'Has login' },
            { value: 'no', label: 'No login' },
          ]}
        />
        <Select
          label="ID check"
          value={kyc}
          onChange={e => setKyc(e.target.value)}
          options={[{ value: '', label: 'Any' }, ...opts(KYC_LABEL)]}
        />
      </div>
      <DataTable
        caption="People"
        columns={columns}
        rows={list.rows}
        rowKey={r => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={r => onOpen(r.id)}
        rowLabel={r => r.name}
        pageSize={100}
        empty={{
          title: filtered ? 'No people match' : 'No residents yet',
          text: filtered
            ? 'Change the filters to see more.'
            : 'Add the first resident with the Add resident button.',
        }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
    </Card>
  );
}
