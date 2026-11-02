'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { Tabs } from '@/components/societies/bits';
import { AccessGrantsPanel } from '@/components/societies/platform/SupportScreen';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { TicketsTab } from './TicketsTab';

type Tab = 'tickets' | 'access';

/** Spec 11.2 Support: tabs Tickets (module 07) and Access grants (module 05). */
export function PlatformSupportScreen() {
  const { ready } = useMe();
  const params = useSearchParams();
  const canTickets = usePermission(PERMISSIONS.platform.tickets.view);
  const canGrants = usePermission(PERMISSIONS.platform.supportAccess.view);
  const [tab, setTab] = useState<Tab>(
    params.get('tab') === 'access' || params.get('societyId') ? 'access' : 'tickets',
  );
  const initial = {
    priority: params.get('priority') ?? undefined,
    slaBreached: params.get('slaBreached') === 'true' ? true : undefined,
  };
  const tabs = [
    ...(canTickets ? [{ value: 'tickets' as Tab, label: 'Tickets' }] : []),
    ...(canGrants ? [{ value: 'access' as Tab, label: 'Access grants' }] : []),
  ];
  const active: Tab = tabs.some(t => t.value === tab) ? tab : (tabs[0]?.value ?? 'tickets');
  return (
    <Page>
      <PageHead title="Support" sub="Tickets from societies, and time-boxed access to their data." />
      {ready && tabs.length === 0 ? (
        <EmptyState title="You do not have access to support" />
      ) : (
        <>
          <Tabs<Tab> label="Support sections" value={active} onChange={setTab} tabs={tabs} />
          <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
            {active === 'tickets' ? <TicketsTab initial={initial} /> : <AccessGrantsPanel />}
          </div>
        </>
      )}
    </Page>
  );
}
