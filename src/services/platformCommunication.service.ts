/** Module 16 platform console calls: template registry (8.35) and delivery log (8.36). */
import { api, apiList } from '@/lib/apiClient';
import {
  mapDeliveryPage,
  mapPreview,
  mapTemplateDetail,
  mapTemplatePage,
} from './platformCommunicationMappers';
import type { DeliveryQuery, TemplatePatch, TemplateQuery } from '@/types/platformCommunication';

type Query = Record<string, string | number | boolean | undefined>;
const pick = (q: object): Query => {
  const out = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Query;
  // the strict query wants `q` of 2 to 80 characters
  if (typeof out.q === 'string' && out.q.trim().length < 2) delete out.q;
  return out;
};

export const platformCommunicationService = {
  templates: async (q: TemplateQuery = {}) => {
    const r = await apiList<unknown>('/platform/notification-templates', { query: pick(q), plan: false });
    return mapTemplatePage(r.data, r.pagination);
  },
  template: (id: number) => api<unknown>(`/platform/notification-templates/${id}`).then(mapTemplateDetail),
  /** PATCH needs a recent step-up; the API client opens the step-up dialog on 401 REAUTH_REQUIRED. */
  saveTemplate: (id: number, body: TemplatePatch) =>
    api<unknown>(`/platform/notification-templates/${id}`, { method: 'PATCH', body }).then(mapTemplateDetail),
  preview: (id: number, data?: Record<string, string>) =>
    api<unknown>(`/platform/notification-templates/${id}/preview`, {
      method: 'POST',
      body: data ? { data } : {},
    }).then(mapPreview),

  deliveries: async (q: DeliveryQuery = {}) => {
    const r = await apiList<unknown>('/platform/notification-deliveries', { query: pick(q), plan: false });
    return mapDeliveryPage(r.data, r.pagination);
  },
};
