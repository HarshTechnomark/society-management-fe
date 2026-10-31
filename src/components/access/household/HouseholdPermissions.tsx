'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { accessControlService } from '@/services/access-control.service';
import type { HouseholdGrants } from '@/types/accessControl';
import { accessErrorText } from '../format';

/** Spec 11.8 wording; keys the API returns that are not listed keep the API label. */
const LABEL: Record<string, string> = {
  'resident.dues.view': 'See dues and statement',
  'resident.payments.create': 'Pay dues',
  'resident.requests.create': 'Raise requests',
  'resident.household.create': 'Add household members',
  'resident.amenities.create': 'Book amenities',
  'resident.visitors.create': 'Pre-approve guests',
  'resident.visitors.approve': 'Approve visitors at the gate',
};

export function HouseholdPermissions({ memberId }: { memberId: number }) {
  const data = useLoad(() => accessControlService.household(memberId));
  if (data.loading && !data.data)
    return (
      <Page>
        <div className="skeleton h-8 w-60" />
      </Page>
    );
  if (data.error || !data.data) {
    const e = data.error;
    const hidden = e instanceof ApiError && (e.code === 'MEMBER_NOT_FOUND' || e.code === 'GRANT_NOT_ALLOWED');
    return (
      <Page>
        {hidden ? (
          <Card>
            <p className="font-semibold">Permissions are only available for family members of your home.</p>
          </Card>
        ) : (
          <ErrorState error={e} />
        )}
      </Page>
    );
  }
  return <Form key={data.data.memberId} initial={data.data} />;
}

function Form({ initial }: { initial: HouseholdGrants }) {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.resident.household.edit);
  const [options, setOptions] = useState(initial.options);
  const [unitId, setUnitId] = useState(String(initial.unitIds[0] ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = initial.name.split(' ')[0];

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await accessControlService.saveHousehold(initial.memberId, {
        unitId: Number(unitId),
        allow: options.filter(o => o.kind === 'ALLOW' && o.enabled).map(o => o.permissionKey),
        deny: options.filter(o => o.kind === 'DENY' && !o.enabled).map(o => o.permissionKey),
      });
      setOptions(saved.options);
      toast.show(`Saved. ${first} will see this next time the app refreshes.`);
    } catch (e) {
      setError(accessErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHead
        title={`${initial.name}: permissions`}
        sub={`Choose what ${first} can do in the app for your home.`}
      />
      <Card>
        {error && <Alert tone="bad">{error}</Alert>}
        {!canEdit && <Alert tone="info">You can see these settings but not change them.</Alert>}
        {initial.unitIds.length > 1 && (
          <Select
            label="Home"
            value={unitId}
            onChange={e => setUnitId(e.target.value)}
            options={initial.unitIds.map(id => ({ value: String(id), label: `Home ${id}` }))}
          />
        )}
        <ul className="divide-y divide-[var(--line)]">
          {options.map(o => {
            const label = LABEL[o.permissionKey] ?? o.label;
            return (
              <li key={o.permissionKey} className="flex items-center justify-between gap-4 py-3">
                <span className="text-[15px] font-semibold">{label}</span>
                <Switch
                  label={label}
                  checked={o.enabled}
                  disabled={!canEdit || busy}
                  onChange={on =>
                    setOptions(list =>
                      list.map(x => (x.permissionKey === o.permissionKey ? { ...x, enabled: on } : x)),
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
        {canEdit && (
          <div className="mt-4 flex justify-end">
            <Button loading={busy} onClick={save}>
              Save
            </Button>
          </div>
        )}
      </Card>
    </Page>
  );
}
