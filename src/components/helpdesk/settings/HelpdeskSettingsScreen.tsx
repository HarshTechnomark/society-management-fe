'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { CategoriesTab } from './CategoriesTab';
import { EscalationTab } from './EscalationTab';
import { PreferencesTab } from './PreferencesTab';
import { SlaTab } from './SlaTab';

type Tab = 'CATEGORIES' | 'SLA' | 'ESCALATION' | 'PREFERENCES';

/** Settings > Helpdesk (spec 11.5): categories, SLA policies, escalation rules and preferences. */
export function HelpdeskSettingsScreen() {
  const canView = usePermission(PERMISSIONS.helpdesk.settings.view);
  const canEdit = usePermission(PERMISSIONS.helpdesk.settings.edit);
  const [tab, setTab] = useState<Tab>('CATEGORIES');
  return (
    <Page>
      <PageHead
        title="Helpdesk settings"
        sub="Categories, response targets, escalation and the rules tickets follow."
      />
      {!canView ? (
        <Alert tone="warn">You do not have permission to see the helpdesk settings.</Alert>
      ) : (
        <Card>
          {!canEdit && (
            <Alert tone="info" className="mb-3">
              You can look at these settings but not change them.
            </Alert>
          )}
          <Segments
            label="Helpdesk settings"
            value={tab}
            onChange={setTab}
            options={[
              { key: 'CATEGORIES', label: 'Categories' },
              { key: 'SLA', label: 'SLA policies' },
              { key: 'ESCALATION', label: 'Escalation rules' },
              { key: 'PREFERENCES', label: 'Preferences' },
            ]}
          />
          {tab === 'CATEGORIES' && <CategoriesTab canEdit={canEdit} />}
          {tab === 'SLA' && <SlaTab canEdit={canEdit} />}
          {tab === 'ESCALATION' && <EscalationTab canEdit={canEdit} />}
          {tab === 'PREFERENCES' && <PreferencesTab canEdit={canEdit} />}
        </Card>
      )}
    </Page>
  );
}
