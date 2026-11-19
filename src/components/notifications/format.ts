import type { Tone } from '@/components/ui/Chip';
import type { NotificationApp, NotificationItem } from '@/types/notifications';
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

/**
 * Deep links are app-relative (`/notices/12`, `/surveys/3`, `/emergency/9`, `/settings/notifications`); the admin app
 * lives under `/admin` and the resident app under `/resident`. The admin screens list by status, so a notice, survey or
 * alert link opens the list.
 */
export const adminLink = (deepLink: string | null): string | null => {
  if (!deepLink) return null;
  if (/^https?:\/\//i.test(deepLink)) return null;
  const m = /^\/(notices|surveys|emergency)\/\d+\/?$/.exec(deepLink);
  if (m) return `/admin/${m[1]}`;
  return deepLink === '/admin' || deepLink.startsWith('/admin/')
    ? deepLink
    : `/admin${deepLink.startsWith('/') ? '' : '/'}${deepLink}`;
};

export function residentLink(deepLink: string | null): string | null {
  if (!deepLink) return null;
  if (/^https?:\/\//i.test(deepLink)) return null;
  if (deepLink.startsWith('/resident/')) return deepLink;
  const m = /^\/(notices|surveys)\/(\d+)/.exec(deepLink);
  if (m) return `/resident/${m[1]}/${m[2]}`;
  if (deepLink.startsWith('/emergency')) return '/resident/emergency-alert';
  if (deepLink === '/settings/notifications') return '/resident/notification-settings';
  return deepLink;
}

/** Where a tap on an inbox row goes in `app`; the platform console uses its own paths as sent. Never an outside address. */
export const linkFor = (app: NotificationApp, deepLink: string | null): string | null =>
  app === 'ADMIN'
    ? adminLink(deepLink)
    : app === 'RESIDENT'
      ? residentLink(deepLink)
      : /^\/[^/]/.test(deepLink ?? '')
        ? deepLink
        : null;

/** Home of the notification screens in each app. */
export const INBOX_PATH: Record<NotificationApp, string> = {
  ADMIN: '/admin/notifications',
  RESIDENT: '/resident/inbox',
  PLATFORM: '/platform/notifications',
};
export const SETTINGS_PATH: Record<NotificationApp, string | null> = {
  ADMIN: '/admin/settings/notifications',
  RESIDENT: '/resident/notification-settings',
  PLATFORM: null,
};

export const LOCALES = [
  { value: '', label: 'Same as my profile' },
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
];
