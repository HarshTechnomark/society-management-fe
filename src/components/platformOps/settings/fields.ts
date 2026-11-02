import type { SettingCategory } from '@/types/platformOps';

export type FieldKind =
  'text' | 'int' | 'decimal' | 'paise' | 'select' | 'bool' | 'offsets' | 'ips' | 'sla' | 'state';

export interface SettingField {
  key: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  suffix?: string;
}

export interface SettingsTab {
  id: string;
  label: string;
  /** Categories whose keys this tab edits, in registry order. */
  category: SettingCategory;
  fields: SettingField[];
}

/** GST state codes (module 06 `GST_STATE_CODES`). */
export const STATE_CODES: [string, string][] = [
  ['01', 'Jammu and Kashmir'],
  ['02', 'Himachal Pradesh'],
  ['03', 'Punjab'],
  ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'],
  ['06', 'Haryana'],
  ['07', 'Delhi'],
  ['08', 'Rajasthan'],
  ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'],
  ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'],
  ['13', 'Nagaland'],
  ['14', 'Manipur'],
  ['15', 'Mizoram'],
  ['16', 'Tripura'],
  ['17', 'Meghalaya'],
  ['18', 'Assam'],
  ['19', 'West Bengal'],
  ['20', 'Jharkhand'],
  ['21', 'Odisha'],
  ['22', 'Chhattisgarh'],
  ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'],
  ['26', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['27', 'Maharashtra'],
  ['29', 'Karnataka'],
  ['30', 'Goa'],
  ['31', 'Lakshadweep'],
  ['32', 'Kerala'],
  ['33', 'Tamil Nadu'],
  ['34', 'Puducherry'],
  ['35', 'Andaman and Nicobar Islands'],
  ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'],
  ['38', 'Ladakh'],
];

const opts = (...v: number[]) => v.map(n => ({ value: String(n), label: `${n} minutes` }));

/** Spec 11.8 tabs and the registry keys each one edits (spec 7.1). */
export const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'general',
    label: 'General',
    category: 'GENERAL',
    fields: [
      { key: 'company.platformName', label: 'Platform name', kind: 'text' },
      { key: 'company.supportEmail', label: 'Support email', kind: 'text' },
      { key: 'company.legalName', label: 'Legal name', kind: 'text' },
      { key: 'company.gstin', label: 'GSTIN', kind: 'text' },
      { key: 'company.stateCode', label: 'GST state code', kind: 'state' },
      { key: 'company.pan', label: 'PAN', kind: 'text' },
      { key: 'company.address', label: 'Registered address', kind: 'text' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing defaults',
    category: 'BILLING',
    fields: [
      { key: 'billing.sacCode', label: 'SAC code', kind: 'text' },
      { key: 'billing.gstRatePct', label: 'GST rate', kind: 'decimal', suffix: '%' },
      { key: 'billing.netTermsDays', label: 'Payment terms (days)', kind: 'int' },
      { key: 'billing.reminderOffsetsDays', label: 'Reminder ladder (day offsets)', kind: 'offsets' },
      { key: 'billing.pastDueAfterDays', label: 'Past due after (days)', kind: 'int' },
      { key: 'billing.suspendAfterDays', label: 'Suspend after (days)', kind: 'int' },
      { key: 'billing.dunningMinDuePaise', label: 'Minimum due for dunning', kind: 'paise' },
      { key: 'billing.maxGoodwillCreditPaise', label: 'Maximum goodwill credit', kind: 'paise' },
      { key: 'billing.tdsMaxRatePct', label: 'TDS maximum rate', kind: 'decimal', suffix: '%' },
      { key: 'billing.pendingOrderMinutes', label: 'Pending order (minutes)', kind: 'int' },
    ],
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    category: 'LIFECYCLE',
    fields: [
      { key: 'lifecycle.trialDays', label: 'Trial length (days)', kind: 'int' },
      { key: 'lifecycle.trialMaxExtensions', label: 'Trial extensions allowed', kind: 'int' },
      {
        key: 'lifecycle.autoCloseSuspendedDays',
        label: 'Auto-close suspended after (days, 0 = never)',
        kind: 'int',
      },
      { key: 'lifecycle.retentionDaysAfterClose', label: 'Keep data after close (days)', kind: 'int' },
      { key: 'exports.fullExportDownloadDays', label: 'Export link valid (days)', kind: 'int' },
      { key: 'exports.closureExportDownloadDays', label: 'Closure export link valid (days)', kind: 'int' },
      { key: 'exports.maxPerSocietyPer24h', label: 'Exports per society per day', kind: 'int' },
      { key: 'supportAccess.consentTimeoutMinutes', label: 'Support consent timeout (minutes)', kind: 'int' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    category: 'SECURITY',
    fields: [
      { key: 'security.idleMinutes', label: 'Idle sign-out', kind: 'select', options: opts(5, 15, 30, 60) },
      { key: 'security.stepUpMinutes', label: 'Step-up window', kind: 'select', options: opts(5, 10) },
      { key: 'security.ipAllowlist', label: 'IP allowlist (one address or range per line)', kind: 'ips' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    category: 'NOTIFICATIONS',
    fields: [
      { key: 'alerts.pastDue', label: 'Alert when a society goes past due', kind: 'bool' },
      { key: 'alerts.jobFailed', label: 'Alert when jobs fail', kind: 'bool' },
      { key: 'alerts.trialEnding', label: 'Alert when a trial is ending', kind: 'bool' },
      { key: 'alerts.providerDown', label: 'Alert when a provider is down', kind: 'bool' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    category: 'SUPPORT',
    fields: [
      { key: 'support.slaHours', label: 'Response and resolution targets (hours)', kind: 'sla' },
      { key: 'support.autoCloseDays', label: 'Auto-close resolved tickets after (days)', kind: 'int' },
      {
        key: 'support.waitingAutoResolveDays',
        label: 'Auto-resolve waiting tickets after (days)',
        kind: 'int',
      },
      { key: 'support.maxOpenTicketsPerSociety', label: 'Open tickets per society', kind: 'int' },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    category: 'DATA',
    fields: [
      { key: 'audit.archiveAfterMonths', label: 'Archive audit entries after (months)', kind: 'int' },
      { key: 'audit.archivePaused', label: 'Pause archiving', kind: 'bool' },
    ],
  },
  {
    id: 'status',
    label: 'Status',
    category: 'STATUS',
    fields: [{ key: 'status.publicEnabled', label: 'Show the public status page', kind: 'bool' }],
  },
];

export const SECURITY_KEYS = new Set(SETTINGS_TABS.find(t => t.id === 'security')!.fields.map(f => f.key));

/** The value shown in a field's input, as text, from the stored value. */
export function toDraft(kind: FieldKind, value: unknown): string {
  switch (kind) {
    case 'paise':
      return String(Number(value) / 100);
    case 'offsets':
      return Array.isArray(value) ? value.join(', ') : '';
    case 'ips':
      return Array.isArray(value) ? value.join('\n') : '';
    case 'sla':
      return JSON.stringify(value);
    case 'bool':
      return value ? 'true' : 'false';
    default:
      return String(value ?? '');
  }
}

/** The API value for a field's text, or an error text. */
export function fromDraft(kind: FieldKind, text: string): { value?: unknown; error?: string } {
  const t = text.trim();
  switch (kind) {
    case 'int':
    case 'select': {
      if (!/^-?\d+$/.test(t)) return { error: 'Enter a whole number.' };
      return { value: Number(t) };
    }
    case 'decimal': {
      if (!/^\d+(\.\d+)?$/.test(t)) return { error: 'Enter a number, for example 18.' };
      return { value: Number(t).toFixed(4) };
    }
    case 'paise': {
      const c = t.replace(/,/g, '');
      if (!/^\d+(\.\d{1,2})?$/.test(c)) return { error: 'Enter an amount in rupees.' };
      return { value: Math.round(Number(c) * 100) };
    }
    case 'offsets': {
      const parts = t.split(/[\s,]+/).filter(Boolean);
      if (parts.length === 0 || parts.some(p => !/^-?\d+$/.test(p)))
        return { error: 'Enter whole numbers separated by commas.' };
      return { value: Array.from(new Set(parts.map(Number))).sort((a, b) => a - b) };
    }
    case 'ips':
      return {
        value: t
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean),
      };
    case 'bool':
      return { value: t === 'true' };
    case 'sla':
      try {
        return { value: JSON.parse(t) };
      } catch {
        return { error: 'Enter valid hours.' };
      }
    default:
      return { value: t };
  }
}
