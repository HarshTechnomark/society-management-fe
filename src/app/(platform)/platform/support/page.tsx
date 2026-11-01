import { Suspense } from 'react';
import { SupportScreen } from '@/components/societies/platform/SupportScreen';

export const metadata = { title: 'Support access' };

export default function Page() {
  return (
    <Suspense>
      <SupportScreen />
    </Suspense>
  );
}
