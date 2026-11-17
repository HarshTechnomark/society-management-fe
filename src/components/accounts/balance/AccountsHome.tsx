'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { accountsBalanceService as svc } from '@/services/accountsBalance.service';
import { BalanceChart } from './BalanceChart';
import { SocietyBalanceCard } from './SocietyBalanceCard';
import { plainBalanceError, ymd } from './format';

const DAYS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

export const ACCOUNTS_LINKS = [
  {
    href: '/admin/accounts/cash-book',
    label: 'Cash book',
    text: 'Every rupee in and out, with a running balance.',
  },
  {
    href: '/admin/accounts/expenses',
    label: 'Expenses',
    text: 'Add, approve and track what the society spends.',
  },
  { href: '/admin/accounts/funds', label: 'Funds', text: 'Sinking, repair and other earmarked funds.' },
  {
    href: '/admin/accounts/bank-accounts',
    label: 'Bank accounts',
    text: 'Accounts, statements and reconciliation.',
  },
  { href: '/admin/accounts/settlements', label: 'Settlements', text: 'Online payments reaching the bank.' },
  { href: '/admin/accounts/deposits', label: 'Deposits', text: 'Resident deposits held by the society.' },
  {
    href: '/admin/accounts/ledger',
    label: 'Ledger and journals',
    text: 'Chart of accounts and journal entries.',
  },
  { href: '/admin/accounts/reports', label: 'Reports', text: 'Trial balance, income and expenditure.' },
];

/** Accounts landing page (spec 11): the balance card, a history chart and links to the other Accounts screens. */
export function AccountsHome() {
  return (
    <Gate view={PERMISSIONS.finance.accounts.view} title="Accounts">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [days, setDays] = useState(30);
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return { from: ymd(from), to: ymd(to) };
  }, [days]);
  const hist = useLoad(() => svc.history(range.from, range.to), days);
  return (
    <Page>
      <PageHead title="Accounts" sub="The society’s money at a glance, and the books behind it." />
      <SocietyBalanceCard />
      <Card title="Balance over time" className="mb-4">
        <div role="group" aria-label="Period" className="mb-3 flex gap-2">
          {DAYS.map(d => (
            <button
              key={d.days}
              type="button"
              aria-pressed={days === d.days}
              onClick={() => setDays(d.days)}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${days === d.days ? 'bg-[#c9a961] text-[#1d2a30]' : 'bg-[rgba(20,35,44,0.07)]'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {hist.loading ? (
          <div className="skeleton h-28 w-full" aria-label="Loading chart" />
        ) : hist.error != null ? (
          <ErrorState
            error={plainBalanceError(hist.error)}
            action={
              <Button size="sm" onClick={hist.reload}>
                Try again
              </Button>
            }
          />
        ) : (
          <BalanceChart points={hist.data ?? []} />
        )}
      </Card>
      <Card title="Accounts screens">
        <ul className="grid gap-3 sm:grid-cols-2">
          {ACCOUNTS_LINKS.map(l => (
            <li key={l.href}>
              <Link href={l.href} className="block rounded-xl bg-[rgba(20,35,44,0.05)] p-3">
                <span className="block text-[14.5px] font-bold">{l.label}</span>
                <span className="text-[13px] text-muted">{l.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  );
}
