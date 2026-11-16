import type { ReactNode } from 'react';
import { AppGate } from '@/components/auth/AppGate';
import { ResidentNav } from '@/components/residents/app/ResidentNav';

/** The resident frame (my.societyapp.in): a scrolling row of section links above the page. */
export default function ResidentLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate app="RESIDENT">
      <ResidentNav>{children}</ResidentNav>
    </AppGate>
  );
}
