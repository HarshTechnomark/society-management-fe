import type { ReactNode } from 'react';
import { ResidentNav } from '@/components/residents/app/ResidentNav';

/** The resident frame (my.societyapp.in): a scrolling row of section links above the page. */
export default function ResidentLayout({ children }: { children: ReactNode }) {
  return <ResidentNav>{children}</ResidentNav>;
}
