import type { Tone } from '@/components/ui/Chip';
import type { NotificationItem } from '@/types/notifications';
export { ago } from '@/components/approvals/format';

export const CATEGORY_LABEL: Record<string, string> = {
  BILLING: 'Billing',
  PAYMENTS: 'Payments',
  NOTICES: 'Notices',
  VISITORS: 'Visitors',
  HELPDESK: 'Helpdesk',
  APPROVALS: 'Approvals',
  COMMUNITY: 'Community',
  GOVERNANCE: 'Governance',
  ACCOUNT: 'Account',
  SYSTEM: 'System',
  EMERGENCY: 'Emergency',
  SECURITY: 'Security',
};
export const categoryLabel = (k: string) => CATEGORY_LABEL[k] ?? k;

export const toneOf = (t: NotificationItem['tone']): Tone => (t === 'info' ? 'info' : t);
export const TONE_DOT: Record<NotificationItem['tone'], string> = {
  info: 'bg-[#0a4a63]',
  ok: 'bg-[#14583a]',
  warn: 'bg-[#b27100]',
  bad: 'bg-bad',
};

/** Deep links are app-relative (`/approvals/77`); the admin app lives under `/admin`. */
export const adminLink = (deepLink: string | null): string | null => {
  if (!deepLink) return null;
  if (/^https?:\/\//i.test(deepLink)) return null;
  return deepLink === '/admin' || deepLink.startsWith('/admin/')
    ? deepLink
    : `/admin${deepLink.startsWith('/') ? '' : '/'}${deepLink}`;
};

export const LOCALES = [
  { value: '', label: 'Same as my profile' },
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
];
