'use client';
import { useEffect, useState } from 'react';
import { Pager, useServerList } from '@/components/billing/useServerList';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { Gate } from '@/components/setup/Gate';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { ApiError } from '@/lib/apiClient';
import { residentsService } from '@/services/residents.service';
import type { DirectoryEntry } from '@/types/residents';
import { Empty } from '../common';
import { residentsError } from '../format';

const REL: Record<DirectoryEntry['relation'], string> = {
  OWNER: 'Owner',
  TENANT: 'Tenant',
  FAMILY: 'Family',
};

/** Directory (spec 11.2): search and neighbour cards with the contacts they allow. */
export function DirectoryScreen() {
  return (
    <Gate view={PERMISSIONS.resident.community.view} feature="residents.resident_directory" title="Directory">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().length >= 2 ? search.trim() : ''), 300);
    return () => clearTimeout(t);
  }, [search]);
  const list = useServerList<DirectoryEntry>(
    page => residentsService.directory({ q: q || undefined, page, limit: 20 }),
    q,
    20,
  );
  const disabled = list.error instanceof ApiError && list.error.code === 'DIRECTORY_DISABLED';
  return (
    <Page>
      <PageHead title="Directory" sub="Neighbours who chose to be listed." />
      <label htmlFor="dir-q" className="mb-1.5 block text-[13px] font-semibold">
        Search name or flat
      </label>
      <input
        id="dir-q"
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 h-12 w-full rounded-[16px] border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[15px]"
      />
      {disabled ? (
        <Card>
          <p className="font-semibold">{residentsError(list.error)}</p>
        </Card>
      ) : list.error ? (
        <ErrorState error={list.error} />
      ) : list.loading ? (
        <div aria-busy="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-3 h-16 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : list.rows.length === 0 ? (
        <Card>
          <Empty
            title="No neighbours found"
            text={q ? 'Try another name or flat.' : 'Nobody is listed yet.'}
          />
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.rows.map((d, i) => (
              <li key={`${d.unitLabel}-${d.name}-${i}`}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[16px] font-bold">{d.name}</p>
                      <p className="text-[13.5px] text-muted">Flat {d.unitLabel}</p>
                    </div>
                    <Chip>{REL[d.relation]}</Chip>
                  </div>
                  {d.mobile && (
                    <p className="mt-1 text-[14px]">
                      Mobile{' '}
                      <a className="underline" href={`tel:${d.mobile}`}>
                        {d.mobile}
                      </a>
                    </p>
                  )}
                  {d.email && <p className="text-[14px]">Email {d.email}</p>}
                </Card>
              </li>
            ))}
          </ul>
          <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
        </>
      )}
    </Page>
  );
}
