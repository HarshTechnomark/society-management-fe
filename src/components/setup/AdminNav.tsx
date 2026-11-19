'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { SwitchAppButton } from '@/components/auth/SwitchAppButton';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { cx } from '@/components/ui/cx';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { APPROVAL_REQUEST_KEYS } from '@/components/approvals/links';
import { useApprovalCounts } from '@/components/approvals/useApprovalCounts';
import { PERMISSIONS, type PermissionKey } from '@/constants/permissions';
import { hasPermission } from '@/hooks/usePermission';
import { hasFeature, useEntitlements } from '@/lib/entitlements';
import { signOut, useMe } from '@/lib/auth';
import type { Me } from '@/types/auth';

interface NavItem {
  href: string;
  label: string;
  /** Any one of these keys shows the link; empty means everyone. */
  keys: PermissionKey[];
  /** Hidden (not greyed) when the plan of the society lacks this entitlement. */
  feature?: string;
  /** Shows the "waiting for me" count of `GET /approvals/counts` next to the label. */
  badge?: 'approvalsForMe';
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const S = PERMISSIONS.settings;
const U = PERMISSIONS.residents.units;
const R = PERMISSIONS.residents;
const F = PERMISSIONS.finance;
const AP = PERMISSIONS.approvals.inbox.view;
const HD = PERMISSIONS.helpdesk;
const CM = PERMISSIONS.communication;

/** Links to the admin pages that exist today (modules 02, 03, 05, 07 to 14). */
export const ADMIN_NAV: NavGroup[] = [
  {
    title: 'Approvals',
    items: [
      // Makers who only submit still reach "Submitted by me".
      {
        href: '/admin/approvals',
        label: 'Approvals',
        keys: [AP, ...APPROVAL_REQUEST_KEYS],
        badge: 'approvalsForMe',
      },
      { href: '/admin/approvals/rules', label: 'Approval rules', keys: [S.approvalRules.view] },
      { href: '/admin/approvals/settings', label: 'Approval settings', keys: [S.approvalRules.view] },
      // Out of plan, the screen explains the upgrade and still lists and revokes old delegations.
      { href: '/admin/approvals/delegations', label: 'Delegations', keys: [AP, S.approvalRules.view] },
    ],
  },
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
        label: 'Opening arrears',
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
      { href: '/admin/billing/invoices', label: 'Invoices', keys: [F.billing.view] },
      { href: '/admin/billing/dues', label: 'Dues', keys: [F.billing.view] },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/admin/payments', label: 'Payments', keys: [F.payments.view] },
      { href: '/admin/payments/cheques', label: 'Cheques', keys: [F.payments.view] },
      { href: '/admin/collections', label: 'Collections', keys: [F.collections.view] },
      { href: '/admin/payments/refunds', label: 'Refunds', keys: [F.payments.view] },
      { href: '/admin/payments/orders', label: 'Payment orders', keys: [F.payments.view] },
      {
        href: '/admin/payments/links',
        label: 'Payment links',
        keys: [F.payments.view],
        feature: 'payments.payment_links',
      },
      {
        href: '/admin/payments/autopay',
        label: 'AutoPay',
        keys: [F.payments.view],
        feature: 'payments.upi_autopay_mandates',
      },
    ],
  },
  {
    title: 'Accounts',
    items: [
      { href: '/admin/accounts', label: 'Society balance', keys: [F.accounts.view] },
      { href: '/admin/accounts/cash-book', label: 'Cash book', keys: [F.expenses.view] },
      { href: '/admin/accounts/expenses', label: 'Expenses', keys: [F.expenses.view] },
      { href: '/admin/accounts/funds', label: 'Funds', keys: [F.accounts.view] },
      { href: '/admin/accounts/bank', label: 'Bank accounts', keys: [F.bank.view] },
      { href: '/admin/accounts/settlements', label: 'Settlements', keys: [F.bank.view] },
      { href: '/admin/accounts/bank/statements', label: 'Bank statements', keys: [F.bank.view] },
      { href: '/admin/accounts/deposits', label: 'Deposits', keys: [F.accounts.view] },
      { href: '/admin/accounts/ledger', label: 'Chart of accounts', keys: [F.accounts.view] },
      { href: '/admin/accounts/journals', label: 'Journals', keys: [F.accounts.view] },
      { href: '/admin/accounts/opening-balances', label: 'Opening balances', keys: [F.accounts.view] },
      { href: '/admin/accounts/reports', label: 'Reports', keys: [F.accounts.view] },
      { href: '/admin/accounts/periods', label: 'Periods and year close', keys: [F.accounts.view] },
    ],
  },
  {
    title: 'Communication',
    items: [
      { href: '/admin/notices', label: 'Notices', keys: [CM.notices.view] },
      {
        href: '/admin/surveys',
        label: 'Surveys',
        keys: [CM.surveys.view],
        feature: 'communication.surveys_with_analytics',
      },
    ],
  },
  {
    title: 'Issues',
    items: [
      { href: '/admin/issues', label: 'Issues', keys: [HD.tickets.view] },
      { href: '/admin/settings/helpdesk', label: 'Helpdesk settings', keys: [HD.settings.view] },
      {
        href: '/admin/emergency',
        label: 'Emergencies',
        keys: [PERMISSIONS.communication.emergency.create, PERMISSIONS.security.incidents.view],
      },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/admin/notifications', label: 'Notifications', keys: [] },
      { href: '/admin/settings/notifications', label: 'Notification settings', keys: [] },
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
    items: g.items.filter(
      i =>
        (i.keys.length === 0 || i.keys.some(k => hasPermission(me, k))) &&
        (!i.feature || hasFeature(i.feature)),
    ),
  })).filter(g => g.items.length > 0);
}

/** The most specific link wins, so `/admin/settings/subscription` does not light up "Settings". */
export function activeHref(path: string): string | null {
  const all = ADMIN_NAV.flatMap(g => g.items.map(i => i.href));
  const hits = all.filter(h => path === h || path.startsWith(h + '/'));
  return hits.sort((a, b) => b.length - a.length)[0] ?? null;
}

function NavLinks({
  groups,
  forMe,
  onNavigate,
}: {
  groups: NavGroup[];
  forMe: number;
  onNavigate?: () => void;
}) {
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
                  {i.badge === 'approvalsForMe' && forMe > 0 && (
                    <span
                      aria-label={`${forMe} waiting for you`}
                      className="ml-2 inline-block min-w-[20px] rounded-full bg-bad px-1.5 text-center text-[11.5px] font-bold text-white"
                    >
                      {forMe > 99 ? '99+' : forMe}
                    </span>
                  )}
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
  useEntitlements(); // the menu follows the plan
  const [open, setOpen] = useState(false);
  const groups = visibleAdminNav(me);
  const path = usePathname() ?? '';
  const counts = useApprovalCounts(!!me && hasPermission(me, AP), path);
  const forMe = counts?.forMe ?? 0;
  const signOutButton = (
    <>
      <SwitchAppButton />
      <Button variant="glass" size="sm" onClick={() => void signOut()}>
        Sign out
      </Button>
    </>
  );
  return (
    <div className="min-[900px]:flex">
      <aside
        aria-label="Admin sections"
        className="hidden w-[232px] shrink-0 border-r border-[var(--line)] min-[900px]:sticky min-[900px]:top-0 min-[900px]:block min-[900px]:h-screen min-[900px]:overflow-y-auto min-[900px]:p-4"
      >
        <div className="flex items-center justify-between px-3 pb-4 pt-2">
          <p className="text-[18px] font-bold tracking-tight">SocietyApp</p>
          <NotificationBell app="ADMIN" refreshKey={path} />
        </div>
        <nav aria-label="Admin">
          {me ? <NavLinks groups={groups} forMe={forMe} /> : <div className="skeleton mx-3 h-40" />}
        </nav>
        <div className="px-3 pt-2">{signOutButton}</div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[rgba(251,247,240,0.95)] px-4 py-2.5 min-[900px]:hidden">
          <p className="text-[16px] font-bold">SocietyApp admin</p>
          <div className="flex items-center gap-2">
            <NotificationBell app="ADMIN" refreshKey={path} />
            <Button variant="glass" size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
              Menu
            </Button>
          </div>
        </header>
        <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
          <nav aria-label="Admin menu">
            <NavLinks groups={groups} forMe={forMe} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="pt-2">{signOutButton}</div>
        </Drawer>
        {children}
      </div>
    </div>
  );
}
