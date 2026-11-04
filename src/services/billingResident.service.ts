/** Sub-module 11.5 resident calls (spec 8.21): my dues, my bills, the PDF link and the statement of my flat. */
import { api, apiList } from '@/lib/apiClient';
import { mapStatement } from './ledgerMappers';
import { mapInvoice, mapInvoiceList, mapMyDues, mapPdfUrl } from './billingDuesMappers';
import type { MyInvoiceQuery } from '@/types/billingDues';

export const billingResidentService = {
  dues: () => api<unknown>('/me/dues').then(mapMyDues),
  invoices: async (q: MyInvoiceQuery = {}) => {
    const r = await apiList<unknown>('/me/invoices', { query: { ...q } });
    return mapInvoiceList(r.data, r.pagination);
  },
  invoice: (id: number) => api<unknown>(`/me/invoices/${id}`).then(mapInvoice),
  pdfUrl: (id: number) => api<unknown>(`/me/invoices/${id}/pdf-url`).then(mapPdfUrl),
  statement: (unitId: number, from: string, to: string) =>
    api<unknown>(`/me/units/${unitId}/statement`, { query: { from, to } }).then(mapStatement),
};
