import type { ReactNode } from 'react';
import { AppGate } from '@/components/auth/AppGate';

/** The staff and vendor app: on the single sign-in address only a signed-in WORK session may open it. */
export default function WorkLayout({ children }: { children: ReactNode }) {
  return <AppGate app="WORK">{children}</AppGate>;
}
