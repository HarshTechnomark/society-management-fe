import type { UsageItem } from '@/types/subscriptions';

/** Display names of the 12 limit keys (spec 2.5). */
export const LIMIT_LABELS: Record<string, string> = {
  'limit.flats': 'Flats',
  'limit.admin_seats': 'Admin seats',
  'limit.custom_roles': 'Custom roles',
  'limit.sms_per_month': 'SMS this month',
  'limit.whatsapp_per_month': 'WhatsApp this month',
  'limit.storage_gb': 'Storage',
  'limit.guard_devices': 'Guard consoles',
  'limit.scheduled_reports': 'Scheduled reports',
  'limit.automation_rules': 'Automation rules',
  'limit.ai_messages_per_month': 'AI messages this month',
  'limit.api_keys': 'API keys',
  'limit.societies_per_org': 'Societies per organisation',
};
export const limitLabel = (key: string) =>
  LIMIT_LABELS[key] ?? key.replace(/^limit\./, '').replace(/_/g, ' ');

const GB = 1_073_741_824;

/** Plan-editor labels for limits (blank = unlimited). */
export const PLAN_LIMIT_KEYS = Object.keys(LIMIT_LABELS).filter(k => k !== 'limit.societies_per_org');

/** Used and limit as text; storage arrives in bytes with `limitBytes`. */
export function usageText(u: UsageItem): { used: string; limit: string | null } {
  if (u.limitKey === 'limit.storage_gb') {
    const gb = (b: number) => `${(Math.round((b / GB) * 10) / 10).toLocaleString('en-IN')} GB`;
    return { used: gb(u.used), limit: u.limit === null ? null : gb(u.limitBytes ?? u.limit * GB) };
  }
  return {
    used: u.used.toLocaleString('en-IN'),
    limit: u.limit === null ? null : u.limit.toLocaleString('en-IN'),
  };
}

export const usagePercent = (u: UsageItem): number | null =>
  u.limit === null
    ? null
    : (u.percent ?? (u.limit > 0 ? Math.floor((u.used * 100) / u.limit) : u.used > 0 ? 100 : 0));
