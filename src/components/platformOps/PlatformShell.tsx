'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS } from '@/constants/permissions';
import { hasPermission } from '@/hooks/usePermission';
import { signOut, useMe } from '@/lib/auth';
import type { PermissionKey } from '@/constants/permissions';
import type { Me } from '@/types/auth';

const P = PERMISSIONS.platform;

interface NavItem {
  href: string;
  label: string;
  /** Any one of these keys opens the screen. */
  keys: PermissionKey[];
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Prototype sidebar: Overview, Tenants, Operations, Governance (spec 11, introduction). */
export const PLATFORM_NAV: NavGroup[] = [
  { title: 'Overview', items: [{ href: '/platform', label: 'Dashboard', keys: [P.dashboard.view] }] },
  {
    title: 'Tenants',
    items: [
      { href: '/platform/societies', label: 'Societies', keys: [P.societies.view] },
      { href: '/platform/organizations', label: 'Organizations', keys: [P.societies.view] },
      { href: '/platform/plans', label: 'Plans', keys: [P.plans.view] },
      { href: '/platform/flags', label: 'Feature flags', keys: [P.featureFlags.view] },
      { href: '/platform/billing', label: 'Billing', keys: [P.billing.view] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/platform/jobs', label: 'Jobs and queues', keys: [P.jobs.view] },
      { href: '/platform/support', label: 'Support', keys: [P.tickets.view, P.supportAccess.view] },
      { href: '/platform/health', label: 'Platform health', keys: [P.health.view] },
      { href: '/platform/announcements', label: 'Announcements', keys: [P.announcements.view] },
    ],
  },
  {
    title: 'Governance',
    items: [
      { href: '/platform/audit', label: 'Audit trail', keys: [P.auditLog.view] },
      { href: '/platform/team', label: 'Platform team', keys: [P.team.view] },
      { href: '/platform/settings', label: 'Settings', keys: [P.settings.view] },
    ],
  },
];

/** The groups with only the screens this person may open. */
export function visibleNav(me: Me | null): NavGroup[] {
  if (!me) return [];
  return PLATFORM_NAV.map(g => ({
    ...g,
    items: g.items.filter(i => i.keys.some(k => hasPermission(me, k))),
  })).filter(g => g.items.length > 0);
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const path = usePathname() ?? '';
  const active = (href: string) => (href === '/platform' ? path === href : path.startsWith(href));
  return (
    <>
      {groups.map(g => (
        <div key={g.title} className="mb-4">
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-faint">{g.title}</p>
          <ul>
            {g.items.map(i => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={onNavigate}
                  aria-current={active(i.href) ? 'page' : undefined}
                  className={cx(
                    'block rounded-full px-3 py-2 text-[14px] font-semibold',
                    active(i.href) ? 'bg-navy text-[#FDF8EE]' : 'text-ink-2 hover:bg-black/5',
                  )}
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Sidebar on desktop; top bar with a menu sheet on phones. */
export function PlatformShell({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const groups = visibleNav(me);
  const signOutButton = (
    <Button variant="glass" size="sm" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
  return (
    <div className="min-[900px]:flex">
      <aside
        aria-label="Platform sections"
        className="hidden w-[240px] shrink-0 border-r border-[var(--line)] min-[900px]:sticky min-[900px]:top-0 min-[900px]:block min-[900px]:h-screen min-[900px]:overflow-y-auto min-[900px]:p-4"
      >
        <p className="px-3 pb-4 pt-2 text-[18px] font-bold tracking-tight">SocietyApp</p>
        <nav aria-label="Platform">
          {me ? <NavLinks groups={groups} /> : <div className="skeleton mx-3 h-40" />}
        </nav>
        <div className="px-3 pt-2">{signOutButton}</div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[rgba(251,247,240,0.95)] px-4 py-2.5 min-[900px]:hidden">
          <p className="text-[16px] font-bold">SocietyApp platform</p>
          <Button variant="glass" size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            Menu
          </Button>
        </header>
        <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
          <nav aria-label="Platform menu">
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="pt-2">{signOutButton}</div>
        </Drawer>
        {children}
      </div>
    </div>
  );
}
