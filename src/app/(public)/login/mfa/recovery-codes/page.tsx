import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RecoveryCodesScreen } from '@/components/auth/RecoveryCodesScreen';

export const metadata: Metadata = { title: 'Save your recovery codes' };

export default function Page() {
  return (
    <Suspense>
      <RecoveryCodesScreen />
    </Suspense>
  );
}
