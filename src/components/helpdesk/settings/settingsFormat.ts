import { PRIORITY_LABEL } from '../admin/format';
import type { HelpdeskSettings, Priority, TriggerType } from '@/types/helpdesk';

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  RESPONSE_SLA: 'First reply is late',
  RESOLUTION_SLA: 'Fix is late',
  RESIDENT_REQUEST: 'Resident asks to escalate',
  LOW_CSAT: 'Low rating',
};
export const SCOPE_LABEL = {
  PERSONAL: 'Flat complaints',
  BUILDING: 'Building issues',
  BOTH: 'Both',
} as const;
export const ASSIGNEE_TYPE_LABEL: Record<string, string> = {
  NONE: 'Nobody',
  INHERIT: 'Same as the main category',
  ROLE: 'A role',
  MEMBER: 'A member',
  STAFF: 'Staff',
  VENDOR: 'A vendor',
};
export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4'];
/** One label table for every priority name in the admin and settings screens. */
export const PRIORITY_NAME: Record<Priority, string> = PRIORITY_LABEL;

/** The committee designations the API accepts for an escalation target. */
export const DESIGNATION_LABEL: Record<string, string> = {
  CHAIRMAN: 'Chairman',
  VICE_CHAIRMAN: 'Vice Chairman',
  SECRETARY: 'Secretary',
  JOINT_SECRETARY: 'Joint Secretary',
  TREASURER: 'Treasurer',
  MEMBER: 'Committee member',
};
/** "facility_manager" / "SECRETARY" become "Facility Manager" / "Secretary". */
export const humanRole = (v: string | null | undefined): string | undefined =>
  v
    ? (DESIGNATION_LABEL[v] ??
      v
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' '))
    : undefined;

export type TimeUnit = 'min' | 'h' | 'd';
const FACTOR: Record<TimeUnit, number> = { min: 1, h: 60, d: 1440 };
export const toMinutes = (value: string, unit: TimeUnit): number => Math.round(Number(value) * FACTOR[unit]);
/** The shortest exact unit: whole days, else whole hours, else minutes. */
export function fromMinutes(m: number): { value: string; unit: TimeUnit } {
  if (m > 0 && m % 1440 === 0) return { value: String(m / 1440), unit: 'd' };
  if (m > 0 && m % 60 === 0) return { value: String(m / 60), unit: 'h' };
  return { value: String(m), unit: 'min' };
}
export function minutesLabel(m: number): string {
  const { value, unit } = fromMinutes(m);
  return `${value} ${unit === 'min' ? 'min' : unit === 'h' ? 'h' : value === '1' ? 'day' : 'days'}`;
}

/** The preferences of spec 7.9 with their allowed ranges. */
export interface PrefDef {
  key: string;
  label: string;
  hint: string;
  min?: number;
  max?: number;
  bool?: boolean;
  unit?: string;
}
export const PREFS: PrefDef[] = [
  {
    key: 'helpdesk.autoCloseHours',
    label: 'Close a resolved ticket after',
    hint: 'Closes by itself when the resident does not answer.',
    min: 24,
    max: 336,
    unit: 'hours',
  },
  {
    key: 'helpdesk.reopenWindowDays',
    label: 'Residents can reopen within',
    hint: 'Also the time they have to rate the fix.',
    min: 1,
    max: 30,
    unit: 'days',
  },
  {
    key: 'helpdesk.maxReopens',
    label: 'Most reopens per ticket',
    hint: 'After this the resident must raise a new ticket.',
    min: 1,
    max: 10,
  },
  {
    key: 'helpdesk.waitingReminderHours',
    label: 'Remind a waiting resident after',
    hint: 'While a ticket waits on the resident.',
    min: 12,
    max: 168,
    unit: 'hours',
  },
  {
    key: 'helpdesk.waitingAutoResolveDays',
    label: 'Resolve a waiting ticket after',
    hint: 'Days times 24 must be more than the reminder hours.',
    min: 2,
    max: 30,
    unit: 'days',
  },
  {
    key: 'helpdesk.duplicateWindowHours',
    label: 'Look for similar issues in the last',
    hint: 'Used by the similar issue alert.',
    min: 1,
    max: 168,
    unit: 'hours',
  },
  {
    key: 'helpdesk.upvoteRaiseThreshold',
    label: 'Raise priority after this many Me too',
    hint: 'Standard plan and above.',
    min: 3,
    max: 100,
  },
  {
    key: 'helpdesk.lowCsatThreshold',
    label: 'A rating this low or lower counts as low',
    hint: 'Can trigger an escalation rule.',
    min: 1,
    max: 3,
    unit: 'stars',
  },
  {
    key: 'helpdesk.recurringCount',
    label: 'Recurring after this many tickets',
    hint: 'Same place and category.',
    min: 2,
    max: 10,
  },
  {
    key: 'helpdesk.recurringWindowDays',
    label: 'Counted within',
    hint: 'The window for the recurring count.',
    min: 7,
    max: 90,
    unit: 'days',
  },
  {
    key: 'helpdesk.chargeTolerancePct',
    label: 'Final charge may exceed the estimate by',
    hint: 'Above this the office cannot resolve the ticket.',
    min: 0,
    max: 50,
    unit: '%',
  },
  {
    key: 'helpdesk.chargeDueDays',
    label: 'Charge invoice is due in',
    hint: 'Days after the work is resolved.',
    min: 1,
    max: 60,
    unit: 'days',
  },
  {
    key: 'helpdesk.unassignedReminderMinutes',
    label: 'Remind about an unassigned ticket after',
    hint: 'The office is reminded.',
    min: 10,
    max: 240,
    unit: 'minutes',
  },
  {
    key: 'helpdesk.residentDailyTicketLimit',
    label: 'Most tickets one resident can raise a day',
    hint: 'Protects the helpdesk from floods.',
    min: 5,
    max: 100,
  },
  {
    key: 'helpdesk.showReporterOnBuildingIssues',
    label: 'Show who reported a building issue',
    hint: 'Other residents see the reporter name when on.',
    bool: true,
  },
];

/** Errors for the form, by key: the range of each number and the waiting rule of spec 7.9. */
export function prefErrors(values: Record<string, string | boolean>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of PREFS) {
    if (p.bool) continue;
    const v = String(values[p.key] ?? '').trim();
    const n = Number(v);
    if (!/^\d+$/.test(v) || n < (p.min ?? 0) || n > (p.max ?? Infinity))
      out[p.key] = `Enter a whole number from ${p.min} to ${p.max}.`;
  }
  const days = Number(values['helpdesk.waitingAutoResolveDays']);
  const hours = Number(values['helpdesk.waitingReminderHours']);
  if (!out['helpdesk.waitingAutoResolveDays'] && !out['helpdesk.waitingReminderHours'] && days * 24 <= hours)
    out['helpdesk.waitingAutoResolveDays'] = 'Days times 24 must be more than the reminder hours.';
  return out;
}

/** Only the settings the person changed, with the version each was read at. */
export function prefChanges(
  settings: HelpdeskSettings,
  values: Record<string, string | boolean>,
): { key: string; value: number | boolean; version?: number }[] {
  const out: { key: string; value: number | boolean; version?: number }[] = [];
  for (const p of PREFS) {
    const cur = settings[p.key];
    const raw = values[p.key];
    const next = p.bool ? raw === true : Number(raw);
    if (cur && cur.value === next) continue;
    if (!cur && raw === undefined) continue;
    out.push({ key: p.key, value: next, ...(cur ? { version: cur.version } : {}) });
  }
  return out;
}
