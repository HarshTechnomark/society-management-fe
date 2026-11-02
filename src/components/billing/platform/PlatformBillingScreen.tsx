'use client';
import { useState } from 'react';
import { Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { Tabs } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { ApprovalsTab } from './ApprovalsTab';
import { DunningTab } from './DunningTab';
import { GstTdsTab } from './GstTdsTab';
import { InvoicesTab } from './InvoicesTab';
import { PaymentsTab } from './PaymentsTab';
import { RevenueTab } from './RevenueTab';

type Tab = 'invoices' | 'approvals' | 'payments' | 'dunning' | 'revenue' | 'gst';

/** Spec 11.1 Platform › Billing. */
export function PlatformBillingScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.billing.view);
  const [tab, setTab] = useState<Tab>('invoices');
  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Billing" />
        <EmptyState title="You do not have access to billing" />
      </Page>
    );
  return (
    <Page>
      <PageHead title="Billing" sub="Platform GST invoices to societies, dunning and revenue." />
      <Tabs<Tab>
        label="Billing sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'invoices', label: 'Invoices' },
          { value: 'approvals', label: 'Approvals' },
          { value: 'payments', label: 'Payments' },
          { value: 'dunning', label: 'Dunning' },
          { value: 'revenue', label: 'Revenue' },
          { value: 'gst', label: 'GST and TDS' },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'approvals' && <ApprovalsTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'dunning' && <DunningTab />}
        {tab === 'revenue' && <RevenueTab />}
        {tab === 'gst' && <GstTdsTab />}
      </div>
    </Page>
  );
}
