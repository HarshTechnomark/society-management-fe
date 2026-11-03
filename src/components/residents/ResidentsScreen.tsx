'use client';
import { useState } from 'react';
import { Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { residentsService } from '@/services/residents.service';
import { AddResidentDialog } from './AddResidentDialog';
import { Tabs, useRun } from './common';
import { FlatsTab } from './FlatsTab';
import { JoinRequestsTab } from './JoinRequestsTab';
import { PeopleTab } from './PeopleTab';
import { RequestsTab } from './RequestsTab';
import { ResidentDrawer } from './ResidentDrawer';
import { TenanciesTab, TenancyDrawer } from './TenanciesTab';
import { UnitDrawer } from './UnitDrawer';

const P = PERMISSIONS.residents;
type TabKey = 'flats' | 'join' | 'people' | 'tenancies' | 'requests';

/** Residents (admin, spec 11.1). */
export function ResidentsScreen() {
  return (
    <Gate view={P.people.view} feature="residents.person_registry" title="Residents">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canExport = usePermission(P.people.export);
  const canCreate = usePermission(P.people.create);
  const canRequests = usePermission(P.requests.view);
  const tenanciesOn = useFeature('residents.tenancies');
  const joinOn = useFeature('residents.invitation_and_self_registration');
  const run = useRun();
  const [tab, setTab] = useState<TabKey>('flats');
  const [tick, setTick] = useState(0);
  const [unit, setUnit] = useState<number | null>(null);
  const [person, setPerson] = useState<number | null>(null);
  const [tenancy, setTenancy] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ unitId?: number; label?: string } | null>(null);
  const stats = useLoad(() => residentsService.stats().catch(() => null), tick);
  const s = stats.data;
  const changed = () => {
    setTick(t => t + 1);
    stats.reload();
  };
  const pendingJoin = s?.openRequests.join ?? 0;
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'flats', label: 'Flats' },
    ...(canRequests && joinOn ? [{ key: 'join' as const, label: `Join requests (${pendingJoin})` }] : []),
    { key: 'people', label: 'People' },
    ...(tenanciesOn ? [{ key: 'tenancies' as const, label: 'Tenancies' }] : []),
    ...(canRequests ? [{ key: 'requests' as const, label: 'Requests' }] : []),
  ];
  const exportCsv = async () => {
    await run(async () => {
      const r = await residentsService.exportCsv();
      window.open(r.downloadUrl, '_blank', 'noopener');
    });
  };
  return (
    <Page>
      <PageHead
        title="Residents"
        sub={s ? `${s.units} flats · ${s.ownerOccupied + s.rented} occupied` : undefined}
        actions={
          <>
            {canExport && (
              <Button variant="glass" onClick={() => void exportCsv()}>
                Export CSV
              </Button>
            )}
            {canCreate && <Button onClick={() => setAdding({})}>Add resident</Button>}
          </>
        }
      />
      <Tabs label="Residents sections" tabs={tabs} value={tab} onChange={setTab} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'flats' && <FlatsTab stats={s} refreshKey={tick} onOpen={setUnit} />}
        {tab === 'join' && <JoinRequestsTab refreshKey={tick} onChanged={changed} />}
        {tab === 'people' && <PeopleTab refreshKey={tick} onOpen={setPerson} />}
        {tab === 'tenancies' && <TenanciesTab refreshKey={tick} onChanged={changed} />}
        {tab === 'requests' && <RequestsTab refreshKey={tick} onChanged={changed} />}
      </div>
      {unit !== null && (
        <UnitDrawer
          unitId={unit}
          onClose={() => setUnit(null)}
          onChanged={changed}
          onOpenResident={setPerson}
          onOpenTenancy={setTenancy}
          onAddResident={(unitId, label) => setAdding({ unitId, label })}
        />
      )}
      {person !== null && (
        <ResidentDrawer residentId={person} onClose={() => setPerson(null)} onChanged={changed} />
      )}
      {tenancy !== null && (
        <TenancyDrawer id={tenancy} onClose={() => setTenancy(null)} onChanged={changed} />
      )}
      {adding && (
        <AddResidentDialog
          unitId={adding.unitId}
          unitLabel={adding.label}
          onClose={() => setAdding(null)}
          onDone={() => {
            setAdding(null);
            changed();
          }}
        />
      )}
    </Page>
  );
}
