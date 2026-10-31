import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OtpScreen } from '@/components/auth/OtpScreen';

export const metadata: Metadata = { title: 'Enter the code' };

export default function Page() {
  return (
    <Suspense>
      <OtpScreen />
    </Suspense>
  );
}
