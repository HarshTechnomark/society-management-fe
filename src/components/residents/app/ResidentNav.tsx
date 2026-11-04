'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS, type PermissionKey } from '@/constants/permissions';
import { hasPermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import type { Me } from '@/types/auth';

const RES = PERMISSIONS.resident;
interface Item {
  href: string;
  label: string;
  /** Any one of these keys shows the link; empty means everyone. */
  keys: PermissionKey[];
}

/** Links to the module 09 resident screens (phone-first: a row that scrolls sideways). */
export const RESIDENT_NAV: Item[] = [
  { href: '/resident/home', label: 'My home', keys: [RES.household.view] },
  { href: '/resident/join', label: 'Join a society', keys: [] },
  { href: '/resident/confirm', label: 'Confirm requests', keys: [RES.household.view] },
  { href: '/resident/tenant', label: 'My tenant', keys: [RES.household.view] },
  { href: '/resident/requests', label: 'Requests', keys: [RES.requests.view] },
  { href: '/resident/directory', label: 'Directory', keys: [RES.community.view] },
  { href: '/resident/committee', label: 'Committee', keys: [RES.home.view] },
  { href: '/resident/privacy', label: 'Privacy', keys: [RES.home.view] },
  { href: '/resident/emergency', label: 'Emergency profile', keys: [RES.home.view] },
  { href: '/resident/pets', label: 'My pets', keys: [RES.home.view] },
  { href: '/resident/documents', label: 'My documents', keys: [RES.home.view] },
];

export function visibleResidentNav(me: Me | null): Item[] {
  return RESIDENT_NAV.filter(i => i.keys.length === 0 || (!!me && i.keys.some(k => hasPermission(me, k))));
}

export function ResidentNav({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const path = usePathname() ?? '';
  const items = visibleResidentNav(me);
  return (
    <div>
      <nav
        aria-label="Resident sections"
        className="sticky top-0 z-30 border-b border-[var(--line)] bg-[rgba(251,247,240,0.95)]"
      >
        <ul className="mx-auto flex max-w-[1100px] gap-1 overflow-x-auto px-3 py-2">
          {items.map(i => (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={path === i.href || path.startsWith(i.href + '/') ? 'page' : undefined}
                className={cx(
                  'block whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-semibold',
                  path === i.href || path.startsWith(i.href + '/')
                    ? 'bg-navy text-[#FDF8EE]'
                    : 'text-ink-2 hover:bg-black/5',
                )}
              >
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
