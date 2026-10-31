import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifyEmailScreen } from '@/components/auth/VerifyEmailScreen';

export const metadata: Metadata = { title: 'Email confirmed' };

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailScreen />
    </Suspense>
  );
}
