import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignupScreen } from '@/components/auth/SignupScreen';

export const metadata: Metadata = { title: 'Create a society' };

export default function Page() {
  return (
    <Suspense>
      <SignupScreen />
    </Suspense>
  );
}
