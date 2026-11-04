import { Suspense } from 'react';
import { TeamScreen } from '@/components/access/team/TeamScreen';

export const metadata = { title: 'Committee and team' };

export default function Page() {
  return (
    <Suspense>
      <TeamScreen />
    </Suspense>
  );
}
