import type { ReactNode } from 'react';

/** The public group (module 02): every screen draws its own split brand panel through `AuthShell`. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
