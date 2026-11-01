import type { ReactNode } from 'react';
import { AdminShell } from '@/components/societies/admin/AdminShell';

/** The society admin frame: status and support banners, the closed page and the hand-off end page (module 05). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
