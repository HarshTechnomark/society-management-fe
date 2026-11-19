/** Response mapping for the module 16 inbox, preferences and push calls (spec 8.20 to 8.24). */
import { arr, num, obj, str, strOrNull } from './helpdeskMappers';
import {
  PREF_CHANNELS,
  type NotificationItem,
  type NotificationList,
  type NotificationTone,
  type PrefCategory,
  type PrefChannel,
  type Preferences,
  type PushSubscriptionRow,
  type QuietMode,
} from '@/types/notifications';

export function mapItem(raw: unknown): NotificationItem {
  const r = obj(raw);
  const tone = str(r.tone, 'info');
  return {
    id: num(r.id),
    templateKey: str(r.templateKey),
    category: str(r.category),
    tone: (['info', 'ok', 'warn', 'bad'].includes(tone) ? tone : 'info') as NotificationTone,
    title: str(r.title),
    body: str(r.body),
    deepLink: strOrNull(r.deepLink),
    readAt: strOrNull(r.readAt),
    createdAt: str(r.createdAt),
  };
}

export function mapNotifications(
  rows: unknown,
  pagination?: { total?: number; totalPages?: number },
  unreadCount = 0,
): NotificationList {
  const items = arr(rows).map(mapItem);
  return {
    items,
    total: pagination?.total ?? items.length,
    totalPages: Math.max(1, pagination?.totalPages ?? 1),
    unreadCount: num(unreadCount),
  };
}

const channels = (v: unknown): Record<PrefChannel, boolean> => {
  const c = obj(v);
  return Object.fromEntries(PREF_CHANNELS.map(k => [k, c[k] !== false])) as Record<PrefChannel, boolean>;
};

export function mapPreferences(raw: unknown): Preferences {
  const r = obj(raw);
  const q = obj(r.quietHours);
  const w = obj(r.whatsapp);
  const e = obj(r.email);
  return {
    locale: strOrNull(r.locale),
    effectiveLocale: str(r.effectiveLocale, str(r.locale, 'en-IN')),
    categories: arr(r.categories).map((c): PrefCategory => ({
      key: str(obj(c).key),
      locked: obj(c).locked === true,
      channels: channels(obj(c).channels),
    })),
    quietHours: {
      mode: str(q.mode, 'SOCIETY_DEFAULT') as QuietMode,
      start: str(q.start, '22:00'),
      end: str(q.end, '07:00'),
    },
    whatsapp: { optIn: w.optIn === true, optInAt: strOrNull(w.optInAt), available: w.available !== false },
    email: { address: strOrNull(e.address), bounced: e.bounced === true },
    version: num(r.version, 1),
  };
}

export function mapPush(raw: unknown): PushSubscriptionRow {
  const r = obj(raw);
  return {
    id: num(r.id),
    app: str(r.app),
    deviceLabel: str(r.deviceLabel, 'This browser'),
    status: str(r.status, 'ACTIVE'),
    createdAt: str(r.createdAt),
    lastSuccessAt: strOrNull(r.lastSuccessAt),
    isThisDevice: r.isThisDevice === true,
  };
}
