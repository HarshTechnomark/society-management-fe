import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginScreen } from '@/components/auth/LoginScreen';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
