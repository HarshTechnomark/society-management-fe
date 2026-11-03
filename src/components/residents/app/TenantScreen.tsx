'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { residentsService } from '@/services/residents.service';
import type { Tenancy } from '@/types/residents';
import { Empty, Loading, StatusChip, useRun } from '../common';
import { POLICE_LABEL, POLICE_TONE, TENANCY_LABEL, TENANCY_TONE, agreementEndInfo } from '../format';
import { PoliceDialog } from '../TenanciesTab';
import { TenancyForm } from '../TenancyForm';

const H = PERMISSIONS.resident.household;

/** My tenant (spec 11.2, owners): tenancy cards, add tenant, submit, police verification and renewal date. */
export function TenantScreen() {
  return (
    <Gate view={H.view} feature="residents.tenancies" title="My tenant">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(H.create);
  const run = useRun();
  const [adding, setAdding] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [police, setPolice] = useState<Tenancy | null>(null);
  const house = useLoad(() => residentsService.household(), 'h');
  const load = useLoad(() => residentsService.myTenancies(), 't');
  const owned = (house.data?.units ?? []).filter(
    u => u.myRelation === 'OWNER' || u.myRelation === 'CO_OWNER',
  );
  const chosen = owned.find(u => String(u.unitId) === unitId) ?? owned[0];
  return (
    <Page>
      <PageHead
        title="My tenant"
        sub="The tenant of your flat, the agreement and the police verification."
        actions={canCreate && owned.length > 0 && <Button onClick={() => setAdding(true)}>Add tenant</Button>}
      />
      {owned.length > 1 && (
        <Select
          label="Flat"
          value={String(chosen?.unitId ?? '')}
          onChange={e => setUnitId(e.target.value)}
          options={owned.map(u => ({ value: String(u.unitId), label: u.unitLabel }))}
        />
      )}
      {house.data && owned.length === 0 && (
        <Card className="mb-4">
          <p className="text-[14px]">Only the owner of a flat can add a tenant.</p>
        </Card>
      )}
      <Loading load={load} rows={2}>
        {list =>
          list.length === 0 ? (
            <Card>
              <Empty
                title="No tenant yet"
                text="Add your tenant with the agreement. The committee approves it."
              />
            </Card>
          ) : (
            <ul className="grid gap-3">
              {list.map(t => {
                const end = agreementEndInfo(t.agreementEnd, t.status);
                return (
                  <li key={t.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[17px] font-bold">{t.tenant.name}</p>
                          <p className="text-[13.5px] text-muted">
                            Flat {t.unit.label}
                            {t.tenant.mobile ? ` · ${t.tenant.mobile}` : ''}
                          </p>
                        </div>
                        <StatusChip status={t.status} labels={TENANCY_LABEL} tones={TENANCY_TONE} />
                      </div>
                      <p className="mt-2 text-[14px]">
                        Agreement {shortDate(t.agreementStart)} to {shortDate(t.agreementEnd)}{' '}
                        {end.tone !== 'neutral' && <Chip tone={end.tone}>{end.text.split(' · ')[1]}</Chip>}
                      </p>
                      <p className="text-[14px]">
                        Rent {inr(t.monthlyRentPaise)} · maintenance paid by{' '}
                        {t.maintenancePayer === 'TENANT' ? 'the tenant' : 'you'}
                      </p>
                      <div className="mt-2">
                        <StatusChip
                          status={t.policeVerificationStatus}
                          labels={POLICE_LABEL}
                          tones={POLICE_TONE}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {t.status === 'DRAFT' && canCreate && (
                          <Button
                            onClick={async () => {
                              if (
                                await run(
                                  () => residentsService.submitTenancy(t.id, t.version),
                                  'Submitted for approval',
                                )
                              )
                                load.reload();
                            }}
                          >
                            Submit
                          </Button>
                        )}
                        {(t.status === 'ACTIVE' ||
                          t.status === 'APPROVED' ||
                          t.status === 'EXPIRED_OVERSTAY') &&
                          t.policeVerificationStatus !== 'VERIFIED' &&
                          canCreate && (
                            <Button variant="glass" onClick={() => setPolice(t)}>
                              Upload police verification
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
      {adding && chosen && (
        <TenancyForm
          as="owner"
          unitId={chosen.unitId}
          unitLabel={chosen.unitLabel}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load.reload();
          }}
        />
      )}
      {police && (
        <PoliceDialog
          mine
          t={police}
          onClose={() => setPolice(null)}
          onDone={() => {
            setPolice(null);
            load.reload();
          }}
        />
      )}
    </Page>
  );
}
