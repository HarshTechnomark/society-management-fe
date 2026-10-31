import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MfaScreen } from '@/components/auth/MfaScreen';

export const metadata: Metadata = { title: 'Two-step verification' };

export default function Page() {
  return (
    <Suspense>
      <MfaScreen />
    </Suspense>
  );
}
