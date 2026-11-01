'use client';
import { useSearchParams } from 'next/navigation';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { GrantsTable } from './GrantsTable';

/** P-06 Support › Access grants (prototype `Pages.support`, tab `access`). The red banner is the global one (P-07). */
export function SupportScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.supportAccess.view);
  const params = useSearchParams();
  const societyId = Number(params.get('societyId')) || undefined;
  return (
    <Page>
      <PageHead
        title="Support access"
        sub="Time-boxed, scoped and consented access to a society. Every grant is audited under both identities."
      />
      <Card>
        {!ready ? (
          <div className="skeleton h-24 w-full" />
        ) : canView ? (
          <GrantsTable societyId={societyId} />
        ) : (
          <EmptyState title="No access" text="You do not have permission to see support access grants." />
        )}
      </Card>
    </Page>
  );
}
