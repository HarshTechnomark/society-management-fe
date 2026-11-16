import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AppPicker } from '@/components/auth/AppPicker';

export const metadata: Metadata = { title: 'Choose where to go' };

export default function Page() {
  return (
    <Suspense>
      <AppPicker />
    </Suspense>
  );
}
