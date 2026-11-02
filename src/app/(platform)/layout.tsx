import type { ReactNode } from 'react';
import { PlatformShell } from '@/components/platformOps/PlatformShell';
import { PlatformSupportBanner } from '@/components/societies/platform/PlatformSupportBanner';

/** The platform console frame: navigation, and the red support access banner (module 05 P-07) above every screen. */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformShell>
      <PlatformSupportBanner />
      {children}
    </PlatformShell>
  );
}
