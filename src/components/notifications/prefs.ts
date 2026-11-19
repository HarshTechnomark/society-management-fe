import {
  PREF_CHANNELS,
  type PrefChannel,
  type Preferences,
  type PreferencesInput,
  type QuietMode,
} from '@/types/notifications';

export interface PrefsDraft {
  locale: string;
  categories: Record<string, Record<PrefChannel, boolean>>;
  quietMode: QuietMode;
  quietStart: string;
  quietEnd: string;
  whatsappOptIn: boolean;
}

export const draftOf = (p: Preferences): PrefsDraft => ({
  locale: p.locale ?? '',
  categories: Object.fromEntries(p.categories.filter(c => !c.locked).map(c => [c.key, { ...c.channels }])),
  quietMode: p.quietHours.mode,
  quietStart: p.quietHours.start,
  quietEnd: p.quietHours.end,
  whatsappOptIn: p.whatsapp.optIn,
});

/** The PUT body (spec 8.23): only switchable categories, all four channels each; times only for CUSTOM quiet hours. */
export const toBody = (d: PrefsDraft, version: number): PreferencesInput => ({
  version,
  locale: d.locale || null,
  categories: Object.fromEntries(
    Object.entries(d.categories).map(([k, ch]) => [
      k,
      Object.fromEntries(PREF_CHANNELS.map(c => [c, ch[c]])) as Record<PrefChannel, boolean>,
    ]),
  ),
  quietHours:
    d.quietMode === 'CUSTOM'
      ? { mode: 'CUSTOM', start: d.quietStart, end: d.quietEnd }
      : { mode: d.quietMode },
  whatsappOptIn: d.whatsappOptIn,
});

/** "Start and end must differ" and the HH:MM shape of spec 8.23. */
export function quietProblem(d: PrefsDraft): string | null {
  if (d.quietMode !== 'CUSTOM') return null;
  const ok = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!ok.test(d.quietStart) || !ok.test(d.quietEnd)) return 'Choose a start and an end time.';
  if (d.quietStart === d.quietEnd) return 'The start and end time must be different.';
  return null;
}
