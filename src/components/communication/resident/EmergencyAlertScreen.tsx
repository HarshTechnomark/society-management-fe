'use client';
import { EmptyState } from '@/components/common/EmptyState';
import { Page, PageHead } from '@/components/common/PageHead';
import { useActiveEmergency } from '../useActiveEmergency';
import { EmergencyResponseCard } from './EmergencyResponseCard';

/** `/resident/emergency-alert`: the response screen, also the target of the push click. */
export function EmergencyAlertScreen() {
  const { list, reload, loading } = useActiveEmergency('me');
  return (
    <Page>
      <PageHead title="Emergency alert" />
      {loading && list.length === 0 ? (
        <div className="skeleton h-40 w-full" />
      ) : list.length === 0 ? (
        <EmptyState title="No active alert" text="There is no emergency alert for your society right now." />
      ) : (
        list.map(a => (
          <div key={a.id} className="glass mb-4 bg-[#a3201a] p-5 text-white">
            <EmergencyResponseCard alert={a} onAnswered={reload} />
          </div>
        ))
      )}
    </Page>
  );
}
