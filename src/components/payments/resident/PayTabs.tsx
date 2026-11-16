'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui/cx';
import { useLoad } from '@/hooks/useLoad';
import { paymentsResidentService } from '@/services/paymentsResident.service';

/** The pay section's own links; AutoPay shows only when the AutoPay route says it is available. */
export function PayTabs() {
  const path = usePathname() ?? '';
  const autopay = useLoad(() => paymentsResidentService.mandates(), 'autopay');
  const items = [
    { href: '/resident/pay', label: 'Pay', exact: true },
    { href: '/resident/pay/collections', label: 'Collections' },
    { href: '/resident/pay/receipts', label: 'Receipts' },
    { href: '/resident/pay/advance', label: 'Advance' },
    ...(autopay.data ? [{ href: '/resident/pay/autopay', label: 'AutoPay' }] : []),
  ];
  const active = (i: { href: string; exact?: boolean }) =>
    i.exact ? path === i.href || path.startsWith('/resident/pay/status') : path.startsWith(i.href);
  return (
    <nav aria-label="Payment sections" className="mb-4 flex flex-wrap gap-1.5">
      {items.map(i => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active(i) ? 'page' : undefined}
          className={cx(
            'rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
            active(i) ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 text-ink-2 hover:bg-white/90',
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
