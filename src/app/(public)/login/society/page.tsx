import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SocietyPicker } from '@/components/auth/SocietyPicker';

export const metadata: Metadata = { title: 'Choose a society' };

export default function Page() {
  return (
    <Suspense>
      <SocietyPicker />
    </Suspense>
  );
}
