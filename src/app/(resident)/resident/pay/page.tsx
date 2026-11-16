import { Suspense } from 'react';
import { PayScreen } from '@/components/payments/resident/PayScreen';

export const metadata = { title: 'Pay' };

export default function Page() {
  return (
    <Suspense>
      <PayScreen />
    </Suspense>
  );
}
