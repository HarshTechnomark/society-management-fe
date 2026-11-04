/** Module 11 network calls of the invoice list, drawer and notes (spec 8.11 to 8.17). Screens never call `fetch`. */
import { api, apiBlob, apiList } from '@/lib/apiClient';
import {
  normaliseCancel,
  normaliseHeadOption,
  normaliseInvoice,
  normaliseNote,
  normalisePagination,
  normalisePdfUrl,
  normaliseRow,
  normaliseUnitOption,
  rows,
} from './billingInvoicesMappers';
import type { AdHocInput, CreditNoteInput, DebitNoteInput, InvoiceQuery } from '@/types/billingInvoices';

type Query = Record<string, string | number | boolean | undefined>;
const post = (path: string, body: unknown) => api<unknown>(path, { method: 'POST', body, idempotent: true });

export const billingInvoicesService = {
  list: async (q: InvoiceQuery = {}) => {
    const r = await apiList<unknown>('/invoices', { query: q as Query });
    const items = rows(r.data).map(normaliseRow);
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  /** CSV of the same filters (needs `finance.billing.export`; at most 50,000 rows). */
  exportCsv: (q: InvoiceQuery = {}) => {
    const filters: Query = { ...(q as Query), page: undefined, limit: undefined };
    return apiBlob('/invoices/export', { query: { ...filters, format: 'csv' } });
  },
  get: (id: number) => api<unknown>(`/invoices/${id}`).then(normaliseInvoice),
  pdfUrl: (id: number) => api<unknown>(`/invoices/${id}/pdf-url`).then(normalisePdfUrl),
  /** The full note with its lines (the invoice detail lists notes without lines). */
  note: (id: number) => api<unknown>(`/billing/notes/${id}`).then(normaliseNote),
  /** Issued debit notes of a bill with their lines: their charge lines can be credited too (BR-11-41). */
  debitNotesWithLines: (d: { notes: { id: number; noteType: string; status: string }[] }) =>
    Promise.all(
      d.notes
        .filter(n => n.noteType === 'DEBIT' && n.status === 'ISSUED')
        .map(n => billingInvoicesService.note(n.id)),
    ),
  notePdfUrl: (id: number) => api<unknown>(`/billing/notes/${id}/pdf-url`).then(normalisePdfUrl),
  createAdHoc: (body: AdHocInput) => post('/invoices', body).then(normaliseInvoice),
  creditNote: (invoiceId: number, body: CreditNoteInput) =>
    post(`/invoices/${invoiceId}/credit-notes`, body).then(normaliseNote),
  debitNote: (invoiceId: number, body: DebitNoteInput) =>
    post(`/invoices/${invoiceId}/debit-notes`, body).then(normaliseNote),
  cancel: (invoiceId: number, reason: string) =>
    post(`/invoices/${invoiceId}/cancel`, { reason }).then(normaliseCancel),
  /** Step-up (`REAUTH_REQUIRED`) is handled by the API client, which retries with the same key. */
  writeOff: (invoiceId: number, amountPaise: number, reason: string) =>
    post(`/invoices/${invoiceId}/write-off`, { amountPaise, reason }).then(normaliseNote),
  remind: (invoiceId: number) => api<unknown>(`/invoices/${invoiceId}/remind`, { method: 'POST', body: {} }),

  /** Active, non-system charge heads for the forms. */
  heads: async () => {
    const r = await apiList<unknown>('/billing/charge-heads', { query: { status: 'ACTIVE', limit: 100 } });
    return rows(r.data)
      .filter(h => !(h as { isSystem?: boolean }).isSystem)
      .map(normaliseHeadOption);
  },
  units: async (q: string) => {
    const r = await apiList<unknown>('/units', { query: { q: q || undefined, status: 'ACTIVE', limit: 20 } });
    return rows(r.data).map(normaliseUnitOption);
  },
};
