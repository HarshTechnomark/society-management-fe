/** Module 16 resident calls: notice board and surveys (8.17 to 8.19, 8.34). The inbox, preferences and push calls live in `notifications.service`. */
import { api, apiList } from '@/lib/apiClient';
import { mapNoticeDetail, mapNoticePage, mapSurveyDetail, mapSurveyList } from './residentNoticesMappers';
import type { AckResult, NoticeQuery, SurveyAnswer, SurveySubmitResult } from '@/types/residentNotices';

type Query = Record<string, string | number | boolean | undefined>;
const pick = (q: object): Query =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Query;
const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });

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
};
