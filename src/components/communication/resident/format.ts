import type { Tone } from '@/components/ui/Chip';

export const NOTICE_CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'GENERAL', label: 'General' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'GOVERNANCE', label: 'Governance' },
  { value: 'FESTIVAL', label: 'Festival' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'COMMUNITY', label: 'Community' },
];
export const categoryLabel = (c: string) => NOTICE_CATEGORIES.find(x => x.value === c)?.label ?? c;
export const TONE: Record<string, Tone> = { info: 'info', ok: 'ok', warn: 'warn', bad: 'bad' };
export const UTILITY_LABEL: Record<string, string> = {
  WATER: 'Water supply',
  POWER: 'Power',
  LIFT: 'Lift',
  GAS: 'Gas',
  INTERNET: 'Internet',
  DG_BACKUP: 'Generator backup',
  OTHER: 'Utility',
};

/** Where a notice action button leads. */
export function actionHref(a: { type: string; refId: number | null; url: string | null }): string | null {
  if (a.type === 'PAY_COLLECTION' && a.refId) return `/resident/pay/collections/${a.refId}`;
  if (a.type === 'PAY_DUES') return '/resident/bills';
  if (a.type === 'LINK') return a.url;
  return null;
}

/** Deep links from the inbox are app paths of the admin or shared form; keep resident ones, map known ones. */
export function residentLink(deepLink: string | null): string | null {
  if (!deepLink) return null;
  if (/^https?:\/\//i.test(deepLink)) return deepLink;
  if (deepLink.startsWith('/resident/')) return deepLink;
  const m = /^\/notices\/(\d+)/.exec(deepLink);
  if (m) return `/resident/notices/${m[1]}`;
  if (deepLink.startsWith('/emergency')) return '/resident/emergency-alert';
  return deepLink;
}
