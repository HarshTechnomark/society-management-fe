import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EnrollScreen } from '@/components/auth/EnrollScreen';

export const metadata: Metadata = { title: 'Set up your authenticator' };

export default function Page() {
  return (
    <Suspense>
      <EnrollScreen />
    </Suspense>
  );
}
