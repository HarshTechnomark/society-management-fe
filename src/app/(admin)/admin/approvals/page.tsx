import { Suspense } from 'react';
import { ApprovalsScreen } from '@/components/approvals/inbox/ApprovalsScreen';

export const metadata = { title: 'Approvals' };

export default function Page() {
  return (
    <Suspense>
      <ApprovalsScreen />
    </Suspense>
  );
}
