'use client';
import { Page, PageHead, Card } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { useLoad } from '@/hooks/useLoad';
import { societySetupService } from '@/services/society-setup.service';
import { Gate } from './Gate';
import { ProfileForm } from './ProfileForm';

/** Settings > Society (spec 11.2). */
export function ProfileScreen() {
  return (
    <Gate view={PERMISSIONS.settings.society.view} feature="property.society_profile" title="Society profile">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canEdit = usePermission(PERMISSIONS.settings.society.edit);
  const { data, error, loading, reload } = useLoad(() => societySetupService.society());
  return (
    <Page>
      <PageHead title="Society profile" sub="Shown on invoices and receipts." />
      <Card>
        {error ? (
          <ErrorState
            error={error}
            action={
              <button className="underline" onClick={reload}>
                Try again
              </button>
            }
          />
        ) : loading || !data ? (
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
          </div>
        ) : (
          <ProfileForm key={data.version} society={data} canEdit={canEdit} onSaved={() => reload()} />
        )}
      </Card>
    </Page>
  );
}
