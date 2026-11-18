/** Module 16 inbox (bell), preferences and push subscription calls (spec 8.20 to 8.24). */
import { api, apiList } from '@/lib/apiClient';
import { mapNotifications, mapPreferences, mapPush } from './notificationsMappers';
import { arr, num, obj, str } from './helpdeskMappers';
import { pick } from './notices.service';
import type {
  NotificationList,
  Preferences,
  PreferencesInput,
  PushSubscriptionRow,
} from '@/types/notifications';

export const INBOX_KEYS = ['unread', 'category', 'page', 'limit'];

export interface PushRegistration {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
  app: 'PLATFORM' | 'ADMIN' | 'RESIDENT' | 'GATE' | 'WORK';
}

export const notificationsService = {
  /** GET /notifications: society and personal items of the signed-in user. */
  list: async (
    q: { unread?: boolean; category?: string; page?: number; limit?: number } = {},
  ): Promise<NotificationList> => {
    const r = await apiList<unknown>('/notifications', { query: pick(q, INBOX_KEYS), activity: false });
    return mapNotifications(r.data, r.pagination);
  },
  /** GET /notifications/unread-count -> `{ count }`; polled in the background, so it is not user activity. */
  unreadCount: async (): Promise<number> =>
    num(obj(await api<unknown>('/notifications/unread-count', { activity: false })).count),
  /** POST /notifications/:id/read */
  markRead: (id: number) => api<unknown>(`/notifications/${id}/read`, { method: 'POST', body: {} }),
  /** POST /notifications/read-all -> `{ updated }` */
  markAllRead: async (category?: string): Promise<number> =>
    num(
      obj(
        await api<unknown>('/notifications/read-all', {
          method: 'POST',
          body: category ? { category } : {},
        }),
      ).updated,
    ),

  /** GET /me/notification-preferences */
  preferences: (): Promise<Preferences> => api<unknown>('/me/notification-preferences').then(mapPreferences),
  /** PUT /me/notification-preferences (replaces everything; returns the saved preferences). */
  savePreferences: (body: PreferencesInput): Promise<Preferences> =>
    api<unknown>('/me/notification-preferences', { method: 'PUT', body }).then(mapPreferences),

  /** GET /me/push-subscriptions */
  pushList: async (): Promise<PushSubscriptionRow[]> => {
    const r = await api<unknown>('/me/push-subscriptions');
    return arr(Array.isArray(r) ? r : obj(r).items).map(mapPush);
  },
  /** POST /me/push-subscriptions -> `{ id, status }` */
  pushRegister: async (body: PushRegistration): Promise<{ id: number; status: string }> => {
    const r = obj(await api<unknown>('/me/push-subscriptions', { method: 'POST', body }));
    return { id: num(r.id), status: str(r.status, 'ACTIVE') };
  },
  /** DELETE /me/push-subscriptions/:id */
  pushRemove: (id: number) => api<unknown>(`/me/push-subscriptions/${id}`, { method: 'DELETE' }),
  /** POST /me/push-subscriptions/:id/test */
  pushTest: (id: number) => api<unknown>(`/me/push-subscriptions/${id}/test`, { method: 'POST', body: {} }),
  /** GET /public/push/vapid-public-key */
  vapidKey: async (): Promise<string> =>
    str(obj(await api<unknown>('/public/push/vapid-public-key')).publicKey),
};
