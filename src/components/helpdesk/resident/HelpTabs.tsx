'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui/cx';
import { useFeatureState } from '@/lib/entitlements';

const ITEMS: { href: string; label: string; exact?: boolean; feature?: string }[] = [
  { href: '/resident/help', label: 'Help', exact: true },
  { href: '/resident/help/issues', label: 'Building issues' },
  {
    href: '/resident/help/transparency',
    label: 'How we are doing',
    feature: 'helpdesk.committee_transparency_board',
  },
];

/** The Help section's own links. */
export function HelpTabs() {
  const path = usePathname() ?? '';
  const transparency = useFeatureState('helpdesk.committee_transparency_board');
  const items = ITEMS.filter(i => !i.feature || transparency);
  return (
    <nav aria-label="Help sections" className="mb-4 flex flex-wrap gap-1.5">
      {items.map(i => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
              active ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 text-ink-2 hover:bg-white/90',
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
