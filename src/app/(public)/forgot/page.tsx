import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ForgotScreen } from '@/components/auth/ForgotScreen';

export const metadata: Metadata = { title: 'Forgot your password?' };

export default function Page() {
  return (
    <Suspense>
      <ForgotScreen />
    </Suspense>
  );
}
