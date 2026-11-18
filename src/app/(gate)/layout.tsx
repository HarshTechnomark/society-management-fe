import type { ReactNode } from 'react';
import { GateEmergencyBanner } from '@/components/communication/gate/GateEmergencyBanner';
import { AppGate } from '@/components/auth/AppGate';

/** The gate console: on the single sign-in address only a signed-in GATE session may open it. */
export default function GateLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate app="GATE">
      <GateEmergencyBanner />
      {children}
    </AppGate>
  );
}
