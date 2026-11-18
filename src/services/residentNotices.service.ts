/** Module 16 resident calls: notice board, surveys (8.18, 8.19, 8.34), inbox (8.20, 8.21), preferences and push (8.23, 8.24). */
import { api, apiEnvelope, apiList } from '@/lib/apiClient';
import {
  mapInboxPage,
  mapNoticeDetail,
  mapNoticePage,
  mapPreferences,
  mapPushList,
  mapSurveyDetail,
  mapSurveyList,
} from './residentNoticesMappers';
import type {
  AckResult,
  InboxQuery,
  NoticeQuery,
  PreferencesInput,
  PushRegistration,
  SurveyAnswer,
  SurveySubmitResult,
} from '@/types/residentNotices';

type Query = Record<string, string | number | boolean | undefined>;
const pick = (q: object): Query =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Query;
const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });

/** `platform` is the platform console bell (8.22, same shapes). */
export type InboxScope = 'society' | 'platform';
const inboxBase = (scope: InboxScope) =>
  scope === 'platform' ? '/platform/notifications' : '/notifications';

export const residentNoticesService = {
  /** GET /me/notices (8.19). */
  notices: async (q: NoticeQuery = {}) => {
    const r = await apiList<unknown>('/me/notices', { query: pick(q), plan: false });
    return mapNoticePage(r.data, r.pagination);
  },
  notice: (id: number) => api<unknown>(`/me/notices/${id}`, { plan: false }).then(mapNoticeDetail),
  /** POST /me/notices/:id/acknowledge (8.18). */
  acknowledge: (id: number) =>
    post<Record<string, unknown>>(`/me/notices/${id}/acknowledge`, {}).then((r): AckResult => ({
      noticeId: Number(r?.noticeId ?? id),
      acknowledgedAt: String(r?.acknowledgedAt ?? ''),
      revisionNo: Number(r?.revisionNo ?? 1),
    })),
  /** GET /me/notices/:id/attachments/:fileId/download-url (8.17). */
  fileUrl: (id: number, fileId: number) =>
    api<{ url: string; expiresAt?: string }>(`/me/notices/${id}/attachments/${fileId}/download-url`),

  /** GET /me/surveys and /me/surveys/:id (8.34). */
  surveys: () => api<unknown>('/me/surveys', { plan: false }).then(mapSurveyList),
  survey: (id: number) => api<unknown>(`/me/surveys/${id}`, { plan: false }).then(mapSurveyDetail),
  submitSurvey: (id: number, body: { unitId?: number; answers: SurveyAnswer[] }) =>
    post<Record<string, unknown>>(`/me/surveys/${id}/responses`, body, true).then(
      (r): SurveySubmitResult => ({
        submissionId: String(r?.submissionId ?? ''),
        submittedAt: String(r?.submittedAt ?? ''),
      }),
    ),

  /** GET /notifications (8.20): `unreadCount` sits beside `data`. */
  inbox: async (q: InboxQuery = {}, scope: InboxScope = 'society') =>
    mapInboxPage(await apiEnvelope(inboxBase(scope), { query: pick(q), plan: false, activity: false })),
  unreadCount: (background = true, scope: InboxScope = 'society') =>
    api<{ count?: number }>(`${inboxBase(scope)}/unread-count`, { plan: false, activity: !background }).then(
      r => Number(r?.count ?? 0),
    ),
  markRead: (id: number, scope: InboxScope = 'society') => post<unknown>(`${inboxBase(scope)}/${id}/read`),
  markAllRead: (category?: string, scope: InboxScope = 'society') =>
    post<{ updated?: number }>(`${inboxBase(scope)}/read-all`, category ? { category } : {}),

  /** GET and PUT /me/notification-preferences (8.23). */
  preferences: () => api<unknown>('/me/notification-preferences', { plan: false }).then(mapPreferences),
  savePreferences: (body: PreferencesInput) =>
    api<unknown>('/me/notification-preferences', { method: 'PUT', body }).then(mapPreferences),

  /** Push subscriptions (8.24). */
  pushList: () => api<unknown>('/me/push-subscriptions', { plan: false }).then(mapPushList),
  pushRegister: (body: PushRegistration) =>
    post<{ id: number; status: string }>('/me/push-subscriptions', body),
  pushRevoke: (id: number) => api<void>(`/me/push-subscriptions/${id}`, { method: 'DELETE' }),
  pushTest: (id: number) => post<unknown>(`/me/push-subscriptions/${id}/test`),
  vapidKey: () => api<{ publicKey: string }>('/public/push/vapid-public-key', { plan: false }),
};
