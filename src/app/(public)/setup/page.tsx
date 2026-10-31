import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ChoosePasswordScreen } from '@/components/auth/ChoosePasswordScreen';

export const metadata: Metadata = { title: 'Set your password' };

export default function Page() {
  return (
    <Suspense>
      <ChoosePasswordScreen mode="setup" />
    </Suspense>
  );
}
