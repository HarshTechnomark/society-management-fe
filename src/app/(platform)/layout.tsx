import type { ReactNode } from 'react';
import { PlatformSupportBanner } from '@/components/societies/platform/PlatformSupportBanner';

/** The platform console frame: the red support access banner (module 05 P-07) above every screen. */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlatformSupportBanner />
      {children}
    </>
  );
}
