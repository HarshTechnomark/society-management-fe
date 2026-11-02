/** Every module 06 network call (spec section 8). Screens import from here and never call `fetch` themselves. */
import { api, apiBlob, apiList, type Pagination } from '@/lib/apiClient';
import type {
  ApprovalItem,
  BillingSummary,
  CreditLedger,
  CreditNoteInput,
  DunningItem,
  GstRow,
  InvoiceDetail,
  InvoiceListItem,
  InvoiceQuery,
  ManualInvoiceInput,
  ManualPaymentInput,
  PaymentItem,
  PaymentOrder,
  PaymentQuery,
  RefundInput,
  RevenueReport,
  TdsClaimInput,
  TdsRow,
  VerifyResult,
} from '@/types/platformBilling';

export interface Page<T> {
  items: T[];
  pagination: Pagination | null;
}

const post = <T>(path: string, body: unknown = {}, idempotent = false) =>
  api<T>(path, { method: 'POST', body, idempotent });

/** Accepts `data: [...]` with `pagination` (the API's way) and `data: { items }` alike. */
async function list<T>(path: string, query: object = {}): Promise<Page<T>> {
  const r = await apiList<T>(path, { query: query as Record<string, string | number | undefined> });
  const d = r.data as unknown;
  const items = Array.isArray(d) ? d : ((d as { items?: T[] } | null)?.items ?? []);
  return { items, pagination: r.pagination ?? null };
}

async function credits(
  path: string,
  query: object = {},
): Promise<Page<CreditLedger['items'][number]> & { balancePaise: number }> {
  const r = await apiList<unknown>(path, { query: query as Record<string, string | number | undefined> });
  const d = r.data as unknown as { balancePaise?: number; items?: CreditLedger['items'] } | null;
  return { items: d?.items ?? [], balancePaise: d?.balancePaise ?? 0, pagination: r.pagination ?? null };
}

export const platformBillingService = {
  // society side
  summary: () => api<BillingSummary>('/subscription/billing-summary'),
  invoices: (q: InvoiceQuery = {}) => list<InvoiceListItem>('/subscription/invoices', q),
  invoice: (id: number) => api<InvoiceDetail>(`/subscription/invoices/${id}`),
  pdfUrl: (id: number) => api<{ url: string; expiresAt: string }>(`/subscription/invoices/${id}/pdf-url`),
  createOrder: (id: number, amountPaise?: number) =>
    post<PaymentOrder>(
      `/subscription/invoices/${id}/payment-orders`,
      amountPaise === undefined ? {} : { amountPaise },
      true,
    ),
  verify: (paymentId: number, gatewayPaymentId: string) =>
    post<VerifyResult>(`/subscription/payments/${paymentId}/verify`, { gatewayPaymentId }),
  payments: (q: PaymentQuery = {}) => list<PaymentItem>('/subscription/payments', q),
  credits: (q: { page?: number; limit?: number; entryType?: string } = {}) =>
    credits('/subscription/credits', q),
  claimTds: (invoiceId: number, body: TdsClaimInput) =>
    post<{ id: number; status: string }>(`/subscription/invoices/${invoiceId}/tds-claims`, body, true),
  attachCertificate: (claimId: number, body: { certificateFileId: number; version: number }) =>
    api<{ id: number }>(`/subscription/tds-claims/${claimId}`, { method: 'PATCH', body }),
  startAutopay: (body: { method: 'UPI_AUTOPAY' | 'EMANDATE'; maxAmountPaise: number }) =>
    post<{ authUrl: string }>('/subscription/autopay', body),
  cancelAutopay: () => api<unknown>('/subscription/autopay', { method: 'DELETE' }),

  // platform: invoices
  platformInvoices: (q: InvoiceQuery = {}) => list<InvoiceListItem>('/platform/invoices', q),
  exportInvoices: (q: InvoiceQuery = {}) => apiBlob('/platform/invoices/export', { query: q as never }),
  platformInvoice: (id: number) => api<InvoiceDetail>(`/platform/invoices/${id}`),
  platformPdfUrl: (id: number) => api<{ url: string; expiresAt: string }>(`/platform/invoices/${id}/pdf-url`),
  createInvoice: (body: ManualInvoiceInput) => post<InvoiceDetail>('/platform/invoices', body, true),
  createCreditNote: (invoiceId: number, body: CreditNoteInput) =>
    post<InvoiceDetail>(`/platform/invoices/${invoiceId}/credit-notes`, body, true),
  approveInvoice: (id: number, version: number) =>
    post<unknown>(`/platform/invoices/${id}/approve`, { version }),
  rejectInvoice: (id: number, version: number, reason: string) =>
    post<unknown>(`/platform/invoices/${id}/reject`, { version, reason }),
  remind: (id: number, note?: string) =>
    post<unknown>(`/platform/invoices/${id}/remind`, note ? { note } : {}),
  extendGrace: (id: number, body: { days: number; reason: string; version: number }) =>
    post<unknown>(`/platform/invoices/${id}/extend-grace`, body),
  requestWriteOff: (id: number, body: { reason: string; version: number }) =>
    post<unknown>(`/platform/invoices/${id}/write-off`, body),
  approveWriteOff: (id: number, version: number) =>
    post<unknown>(`/platform/invoices/${id}/write-off/approve`, { version }),
  rejectWriteOff: (id: number, version: number, reason: string) =>
    post<unknown>(`/platform/invoices/${id}/write-off/reject`, { version, reason }),
  recordTds: (invoiceId: number, body: TdsClaimInput) =>
    post<unknown>(`/platform/invoices/${invoiceId}/tds-claims`, body, true),

  // platform: payments, refunds, credits
  platformPayments: (q: PaymentQuery = {}) => list<PaymentItem>('/platform/payments', q),
  recordPayment: (body: ManualPaymentInput) =>
    post<{ id: number; status: string }>('/platform/payments', body, true),
  approvePayment: (id: number, version: number) =>
    post<unknown>(`/platform/payments/${id}/approve`, { version }),
  rejectPayment: (id: number, version: number, reason: string) =>
    post<unknown>(`/platform/payments/${id}/reject`, { version, reason }),
  tdsDecision: (id: number, body: { decision: 'VERIFIED' | 'REJECTED'; reason?: string; version: number }) =>
    post<unknown>(`/platform/payments/${id}/tds-decision`, body),
  completeRefund: (id: number, body: { bankReference: string; receivedOn: string; version: number }) =>
    post<unknown>(`/platform/payments/${id}/complete-refund`, body),
  requestRefund: (societyId: number, body: RefundInput) =>
    post<unknown>(`/platform/societies/${societyId}/refunds`, body, true),
  societyCredits: (societyId: number, q: { page?: number; limit?: number; status?: string } = {}) =>
    credits(`/platform/societies/${societyId}/credits`, q),
  requestCredit: (societyId: number, body: { amountPaise: number; reason: string }) =>
    post<unknown>(`/platform/societies/${societyId}/credits`, body, true),
  approveCredit: (id: number, version: number) =>
    post<unknown>(`/platform/credits/${id}/approve`, { version }),
  rejectCredit: (id: number, version: number, reason: string) =>
    post<unknown>(`/platform/credits/${id}/reject`, { version, reason }),

  // platform: boards and reports
  approvals: (q: { type?: string; page?: number; limit?: number } = {}) =>
    list<ApprovalItem>('/platform/billing/approvals', q),
  dunning: (q: { status?: string; page?: number; limit?: number } = {}) =>
    list<DunningItem>('/platform/billing/dunning', q),
  revenue: (q: { asOf?: string; months?: number } = {}) =>
    api<RevenueReport>('/platform/billing/revenue', { query: q }),
  gstSummary: (month: string) =>
    api<GstRow[] | { rows: GstRow[] }>('/platform/billing/gst-summary', { query: { month } }).then(r =>
      Array.isArray(r) ? r : (r?.rows ?? []),
    ),
  gstCsv: (month: string) => apiBlob('/platform/billing/gst-summary', { query: { month, format: 'csv' } }),
  tdsReceivable: (q: { financialYear: string; quarter?: number; status?: string }) =>
    api<TdsRow[] | { rows: TdsRow[] }>('/platform/billing/tds-receivable', { query: q }).then(r =>
      Array.isArray(r) ? r : (r?.rows ?? []),
    ),
  tdsCsv: (financialYear: string, quarter?: number) =>
    apiBlob('/platform/billing/tds-receivable', { query: { financialYear, quarter, format: 'csv' } }),
};
