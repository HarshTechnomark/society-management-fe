import { Suspense } from 'react';
import { PlatformSupportScreen } from '@/components/platformOps/support/PlatformSupportScreen';

export const metadata = { title: 'Support' };

export default function Page() {
  return (
    <Suspense>
      <PlatformSupportScreen />
    </Suspense>
  );
}
