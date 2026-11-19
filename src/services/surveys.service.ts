/** Module 16 admin survey calls (spec 8.31 to 8.33). */
import { api, apiBlob, apiList } from '@/lib/apiClient';
import { mapList, mapResults, mapSurvey } from './surveysMappers';
import { pick } from './notices.service';
import type { Survey, SurveyInput, SurveyList, SurveyListQuery, SurveyResults } from '@/types/surveys';

export const SURVEY_LIST_KEYS = ['status', 'q', 'sortBy', 'sortOrder', 'page', 'limit'];

export const surveysService = {
  /** GET /surveys */
  list: async (q: SurveyListQuery = {}): Promise<SurveyList> => {
    const r = await apiList<unknown>('/surveys', { query: pick(q, SURVEY_LIST_KEYS) });
    return mapList(r.data, r.pagination);
  },
  /** GET /surveys/:id */
  get: (id: number): Promise<Survey> => api<unknown>(`/surveys/${id}`).then(mapSurvey),
  /** POST /surveys (Idempotency-Key) */
  create: (body: SurveyInput): Promise<Survey> =>
    api<unknown>('/surveys', { method: 'POST', body, idempotent: true }).then(mapSurvey),
  /** PATCH /surveys/:id (DRAFT only; `questions` replaces the whole set) */
  update: (id: number, body: SurveyInput & { version: number }): Promise<Survey> =>
    api<unknown>(`/surveys/${id}`, { method: 'PATCH', body }).then(mapSurvey),
  /** DELETE /surveys/:id?version= */
  remove: (id: number, version: number) =>
    api<unknown>(`/surveys/${id}`, { method: 'DELETE', query: { version } }),
  /** POST /surveys/:id/publish (Idempotency-Key) */
  publish: (id: number, body: { version: number; closesAt?: string }): Promise<Survey> =>
    api<unknown>(`/surveys/${id}/publish`, { method: 'POST', body, idempotent: true }).then(mapSurvey),
  close: (id: number, version: number): Promise<Survey> =>
    api<unknown>(`/surveys/${id}/close`, { method: 'POST', body: { version } }).then(mapSurvey),
  cancel: (id: number, body: { version: number; reason: string }): Promise<Survey> =>
    api<unknown>(`/surveys/${id}/cancel`, { method: 'POST', body }).then(mapSurvey),
  /** GET /surveys/:id/results */
  results: (id: number): Promise<SurveyResults> => api<unknown>(`/surveys/${id}/results`).then(mapResults),
  /** GET /surveys/:id/results/export: the CSV as a file. */
  exportResults: (id: number) => apiBlob(`/surveys/${id}/results/export`),
};
