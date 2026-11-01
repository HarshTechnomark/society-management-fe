import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignupDetailsScreen } from '@/components/auth/SignupDetailsScreen';

export const metadata: Metadata = { title: 'Create your society' };

export default function Page() {
  return (
    <Suspense>
      <SignupDetailsScreen />
    </Suspense>
  );
}
