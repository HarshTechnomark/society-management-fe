import type { ReactNode } from 'react';
import { AppGate } from '@/components/auth/AppGate';

/** The gate console: on the single sign-in address only a signed-in GATE session may open it. */
export default function GateLayout({ children }: { children: ReactNode }) {
  return <AppGate app="GATE">{children}</AppGate>;
}
