'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Gate } from '@/components/setup/Gate';
import { PERMISSIONS } from '@/constants/permissions';
import { ChargeHeadsTab } from './ChargeHeadsTab';
import { LateFeeTab } from './LateFeeTab';
import { RatesTab } from './RatesTab';
import { SplitRulesTab } from './SplitRulesTab';

type Tab = 'rates' | 'heads' | 'split' | 'late';
const TABS: { key: Tab; label: string; feature: string; title: string }[] = [
  { key: 'rates', label: 'Rates', feature: 'billing.versioned_billing_rules', title: 'Billing rates' },
  { key: 'heads', label: 'Charge heads', feature: 'billing.charge_head_master', title: 'Charge heads' },
  { key: 'split', label: 'Split rules', feature: 'billing.calculation_methods', title: 'Split rules' },
  { key: 'late', label: 'Late fee', feature: 'billing.late_fee_and_interest', title: 'Late fee policy' },
];

/** Settings > Billing (spec 11.5): charge heads, rates with versions, split rules and the late fee policy. */
export function BillingSetupScreen() {
  return (
    <Gate view={PERMISSIONS.settings.billingRules.view} title="Billing rules">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [tab, setTab] = useState<Tab>('rates');
  const current = TABS.find(t => t.key === tab)!;
  return (
    <Page>
      <PageHead
        title="Billing rules"
        sub="Charge heads, rates, split rules and the late fee policy used by every billing run."
        actions={
          <Link href="/admin/settings" className="text-[14px] font-semibold underline">
            Bill dates and other billing settings
          </Link>
        }
      />
      <Card>
        <div role="tablist" aria-label="Billing rules" className="mb-4 flex flex-wrap gap-1.5">
          {TABS.map(t => (
            <Button
              key={t.key}
              size="sm"
              role="tab"
              aria-selected={tab === t.key}
              variant={tab === t.key ? 'primary' : 'glass'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div role="tabpanel" aria-label={current.label}>
          <FeatureGate feature={current.feature} title={current.title}>
            {tab === 'rates' && <RatesTab />}
            {tab === 'heads' && <ChargeHeadsTab />}
            {tab === 'split' && <SplitRulesTab />}
            {tab === 'late' && <LateFeeTab />}
          </FeatureGate>
        </div>
      </Card>
    </Page>
  );
}
