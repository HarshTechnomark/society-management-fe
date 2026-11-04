'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS, type PermissionKey } from '@/constants/permissions';
import { hasPermission } from '@/hooks/usePermission';
import { signOut, useMe } from '@/lib/auth';
import type { Me } from '@/types/auth';

interface NavItem {
  href: string;
  label: string;
  /** Any one of these keys shows the link; empty means everyone. */
  keys: PermissionKey[];
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const S = PERMISSIONS.settings;
const U = PERMISSIONS.residents.units;
const R = PERMISSIONS.residents;
const F = PERMISSIONS.finance;

/** Links to the admin pages that exist today (modules 02, 03, 05, 07, 08). */
export const ADMIN_NAV: NavGroup[] = [
  {
    title: 'Setup',
    items: [
      { href: '/admin/setup', label: 'Set up your society', keys: [S.society.view] },
      { href: '/admin/profile', label: 'Society profile', keys: [S.society.view] },
      { href: '/admin/buildings', label: 'Buildings', keys: [U.view] },
      { href: '/admin/units', label: 'Flats', keys: [U.view] },
      { href: '/admin/locations', label: 'Locations', keys: [U.view] },
      { href: '/admin/holidays', label: 'Holidays', keys: [S.society.view] },
      { href: '/admin/settings', label: 'Settings', keys: [S.society.view] },
      { href: '/admin/settings/billing', label: 'Billing rules', keys: [S.billingRules.view] },
      {
        href: '/admin/settings/billing/opening-balances',
        label: 'Opening balances',
        keys: [PERMISSIONS.finance.billing.view],
      },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/admin/residents', label: 'Residents', keys: [R.people.view] },
      { href: '/admin/team', label: 'Team', keys: [S.members.view] },
      { href: '/admin/roles', label: 'Roles', keys: [S.roles.view] },
    ],
  },
  {
    title: 'Billing',
    items: [
      { href: '/admin/billing/runs', label: 'Billing runs', keys: [F.billing.view] },
      { href: '/admin/billing/dues', label: 'Dues', keys: [F.billing.view] },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/admin/settings/subscription', label: 'Subscription', keys: [S.subscription.view] },
      { href: '/admin/settings/support-access', label: 'Support access', keys: [S.supportAccess.view] },
      { href: '/admin/settings/data-export', label: 'Data export', keys: [S.dataExport.view] },
      { href: '/admin/audit', label: 'Audit trail', keys: [S.auditLog.view] },
      { href: '/admin/support', label: 'Help and support', keys: [] },
    ],
  },
];

export function visibleAdminNav(me: Me | null): NavGroup[] {
  if (!me) return [];
  return ADMIN_NAV.map(g => ({
    ...g,
    items: g.items.filter(i => i.keys.length === 0 || i.keys.some(k => hasPermission(me, k))),
  })).filter(g => g.items.length > 0);
}

/** The most specific link wins, so `/admin/settings/subscription` does not light up "Settings". */
export function activeHref(path: string): string | null {
  const all = ADMIN_NAV.flatMap(g => g.items.map(i => i.href));
  const hits = all.filter(h => path === h || path.startsWith(h + '/'));
  return hits.sort((a, b) => b.length - a.length)[0] ?? null;
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const path = usePathname() ?? '';
  const current = activeHref(path);
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
                  aria-current={current === i.href ? 'page' : undefined}
                  className={cx(
                    'block rounded-full px-3 py-2 text-[14px] font-semibold',
                    current === i.href ? 'bg-navy text-[#FDF8EE]' : 'text-ink-2 hover:bg-black/5',
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
export function AdminNav({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const groups = visibleAdminNav(me);
  const signOutButton = (
    <Button variant="glass" size="sm" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
  return (
    <div className="min-[900px]:flex">
      <aside
        aria-label="Admin sections"
        className="hidden w-[232px] shrink-0 border-r border-[var(--line)] min-[900px]:sticky min-[900px]:top-0 min-[900px]:block min-[900px]:h-screen min-[900px]:overflow-y-auto min-[900px]:p-4"
      >
        <p className="px-3 pb-4 pt-2 text-[18px] font-bold tracking-tight">SocietyApp</p>
        <nav aria-label="Admin">
          {me ? <NavLinks groups={groups} /> : <div className="skeleton mx-3 h-40" />}
        </nav>
        <div className="px-3 pt-2">{signOutButton}</div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[rgba(251,247,240,0.95)] px-4 py-2.5 min-[900px]:hidden">
          <p className="text-[16px] font-bold">SocietyApp admin</p>
          <Button variant="glass" size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            Menu
          </Button>
        </header>
        <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
          <nav aria-label="Admin menu">
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="pt-2">{signOutButton}</div>
        </Drawer>
        {children}
      </div>
    </div>
  );
}
