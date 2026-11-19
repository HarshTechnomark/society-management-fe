/** Module 16 inbox (bell), preferences and push subscription calls (spec 8.20 to 8.24): one service for the admin, resident and platform apps. */
import { api, apiEnvelope } from '@/lib/apiClient';
import { mapNotifications, mapPreferences, mapPush } from './notificationsMappers';
import { arr, num, obj, str } from './helpdeskMappers';
import { pick } from './notices.service';
import type {
  InboxScope,
  NotificationList,
  Preferences,
  PreferencesInput,
  PushRegistration,
  PushSubscriptionRow,
} from '@/types/notifications';

/** The inbox queries are strict (`limit` is at most 50). */
export const INBOX_KEYS = ['unread', 'category', 'page', 'limit'];

const base = (scope: InboxScope) => (scope === 'platform' ? '/platform/notifications' : '/notifications');
/** The unread-count poll is a background call, not user activity, so it does not bump the idle timer. */
const quiet = { plan: false, activity: false } as const;

export const notificationsService = {
  /** GET /notifications (or /platform/notifications): `data[]` plus `pagination` and `unreadCount` beside it. */
  list: async (
    q: { unread?: boolean; category?: string; page?: number; limit?: number } = {},
    scope: InboxScope = 'society',
  ): Promise<NotificationList> => {
    const env = await apiEnvelope(base(scope), { query: pick(q, INBOX_KEYS), plan: false });
    const p = obj(env.pagination);
    return mapNotifications(
      env.data,
      { total: p.total == null ? undefined : num(p.total), totalPages: num(p.totalPages, 1) },
      num(env.unreadCount),
    );
  },
  /** GET /notifications/unread-count -> `{ count }`; polled in the background. */
  unreadCount: async (scope: InboxScope = 'society'): Promise<number> =>
    num(obj(await api<unknown>(`${base(scope)}/unread-count`, quiet)).count),
  /** POST /notifications/:id/read */
  markRead: (id: number, scope: InboxScope = 'society') =>
    api<unknown>(`${base(scope)}/${id}/read`, { method: 'POST', body: {}, plan: false }),
  /** POST /notifications/read-all -> `{ updated }` */
  markAllRead: async (category?: string, scope: InboxScope = 'society'): Promise<number> =>
    num(
      obj(
        await api<unknown>(`${base(scope)}/read-all`, {
          method: 'POST',
          body: category ? { category } : {},
          plan: false,
        }),
      ).updated,
    ),

  /** GET /me/notification-preferences */
  preferences: (): Promise<Preferences> =>
    api<unknown>('/me/notification-preferences', { plan: false }).then(mapPreferences),
  /** PUT /me/notification-preferences (replaces everything; returns the saved preferences). */
  savePreferences: (body: PreferencesInput): Promise<Preferences> =>
    api<unknown>('/me/notification-preferences', { method: 'PUT', body, plan: false }).then(mapPreferences),

  /** GET /me/push-subscriptions (a plain array of the active ones). */
  pushList: async (): Promise<PushSubscriptionRow[]> => {
    const r = await api<unknown>('/me/push-subscriptions', { plan: false });
    return arr(Array.isArray(r) ? r : obj(r).items).map(mapPush);
  },
  /** POST /me/push-subscriptions -> 201 `{ id, status }` */
  pushRegister: async (body: PushRegistration): Promise<{ id: number; status: string }> => {
    const r = obj(await api<unknown>('/me/push-subscriptions', { method: 'POST', body, plan: false }));
    return { id: num(r.id), status: str(r.status, 'ACTIVE') };
  },
  /** DELETE /me/push-subscriptions/:id -> 204 */
  pushRemove: (id: number) => api<unknown>(`/me/push-subscriptions/${id}`, { method: 'DELETE', plan: false }),
  /** POST /me/push-subscriptions/:id/test -> `{ sent }` */
  pushTest: (id: number) =>
    api<unknown>(`/me/push-subscriptions/${id}/test`, { method: 'POST', body: {}, plan: false }),
  /** GET /public/push/vapid-public-key */
  vapidKey: async (): Promise<string> =>
    str(obj(await api<unknown>('/public/push/vapid-public-key', { plan: false })).publicKey),
};
