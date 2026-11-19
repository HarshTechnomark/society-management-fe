/** Module 16 inbox and preferences shapes (spec 8.20 to 8.24). */
export type NotificationTone = 'info' | 'ok' | 'warn' | 'bad';
export interface NotificationItem {
  id: number;
  templateKey: string;
  category: string;
  tone: NotificationTone;
  title: string;
  body: string;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface NotificationList {
  items: NotificationItem[];
  total: number;
  totalPages: number;
  /** `unreadCount` sits next to `data` and `pagination` in the list envelope. */
  unreadCount: number;
}
/** Which bell: the society inbox (`/notifications`) or the platform console inbox (`/platform/notifications`). */
export type InboxScope = 'society' | 'platform';
/** Which app the page runs in; decides links, the push `app` field and the screens' wording. */
export type NotificationApp = 'ADMIN' | 'RESIDENT' | 'PLATFORM';
export type PrefChannel = 'PUSH' | 'SMS' | 'WHATSAPP' | 'EMAIL';
export const PREF_CHANNELS: PrefChannel[] = ['PUSH', 'SMS', 'WHATSAPP', 'EMAIL'];
export interface PrefCategory {
  key: string;
  locked: boolean;
  channels: Record<PrefChannel, boolean>;
}
export type QuietMode = 'SOCIETY_DEFAULT' | 'CUSTOM' | 'OFF';
export interface Preferences {
  locale: string | null;
  effectiveLocale: string;
  categories: PrefCategory[];
  quietHours: { mode: QuietMode; start: string; end: string };
  whatsapp: { optIn: boolean; optInAt: string | null; available: boolean };
  email: { address: string | null; bounced: boolean };
  version: number;
}
export interface PreferencesInput {
  version: number;
  locale: string | null;
  categories: Record<string, Record<PrefChannel, boolean>>;
  quietHours: { mode: QuietMode; start?: string; end?: string };
  whatsappOptIn: boolean;
}
export interface PushSubscriptionRow {
  id: number;
  app: string;
  deviceLabel: string;
  status: string;
  createdAt: string;
  lastSuccessAt: string | null;
  isThisDevice: boolean;
}
export interface PushRegistration {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
  /** Must match the app the request comes from (the API answers 422 otherwise). */
  app: 'PLATFORM' | 'ADMIN' | 'RESIDENT' | 'GATE' | 'WORK';
}
