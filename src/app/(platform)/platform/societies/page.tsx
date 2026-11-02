import { Suspense } from 'react';
import { SocietiesScreen } from '@/components/societies/platform/SocietiesScreen';

export const metadata = { title: 'Societies' };

export default function Page() {
  return (
    <Suspense>
      <SocietiesScreen />
    </Suspense>
  );
}
