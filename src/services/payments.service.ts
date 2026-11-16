/** Module 12 admin payment calls (spec 8.10 to 8.17 and the cheque routes). Money and create calls send an Idempotency-Key. */
import { api, apiBlob, apiList, ApiError } from '@/lib/apiClient';
import {
  mapBankAccount,
  mapCollectionOption,
  mapCollectionRequest,
  mapDeposit,
  mapLiveItem,
  mapOpenInvoice,
  mapOfflineResult,
  mapPaymentDetail,
  mapPaymentPage,
  mapSummary,
  rowsOf,
} from './paymentsMappers';
import type {
  BounceInput,
  OfflinePaymentInput,
  PaymentQuery,
  ReallocationTarget,
  ReceiptChannel,
  ReverseReasonCode,
} from '@/types/payments';

let banksMissing: ApiError | null = null;
/** Forgets what the session learned about optional routes (used by tests). */
export const resetPaymentsSession = () => {
  banksMissing = null;
};

export const paymentsService = {
  list: async (q: PaymentQuery) => {
    const r = await apiList<unknown>('/payments', { query: { ...q } });
    return mapPaymentPage(r.data, r.pagination);
  },
  get: (id: number) => api<unknown>(`/payments/${id}`).then(mapPaymentDetail),
  /** CSV of the payments the filters match (`finance.payments.export`). */
  exportCsv: (q: PaymentQuery) =>
    apiBlob('/payments/export', {
      query: { ...q, page: undefined, limit: undefined, type: 'PAYMENTS', format: 'csv' },
    }),
  summary: (month?: string) =>
    api<unknown>('/payments/summary', { query: { month: month || undefined } }).then(mapSummary),
  liveFeed: () =>
    api<unknown>('/payments/live-feed', { activity: false }).then(r => rowsOf(r).map(mapLiveItem)),

  recordOffline: (body: OfflinePaymentInput) =>
    api<unknown>('/payments/offline', { method: 'POST', body, idempotent: true }).then(mapOfflineResult),

  depositCheques: (body: { paymentIds: number[]; depositedOn: string; bankAccountId: number }) =>
    api<unknown>('/payments/cheques/deposit', { method: 'POST', body, idempotent: true }).then(mapDeposit),
  clearCheque: (id: number, body: { clearedOn: string; version: number }) =>
    api<unknown>(`/payments/${id}/cheque/clear`, { method: 'POST', body }),
  bounceCheque: (id: number, body: BounceInput) =>
    api<unknown>(`/payments/${id}/cheque/bounce`, { method: 'POST', body, idempotent: true }).then(
      mapPaymentDetail,
    ),
  returnCheque: (id: number, body: { reason: string; version: number }) =>
    api<unknown>(`/payments/${id}/cheque/return`, { method: 'POST', body }),

  /** Needs a fresh step-up; the API client opens the confirm dialog on `REAUTH_REQUIRED` and retries. */
  reverse: (id: number, body: { reasonCode: ReverseReasonCode; reason: string; version: number }) =>
    api<unknown>(`/payments/${id}/reverse`, { method: 'POST', body, idempotent: true }),
  reallocate: (id: number, body: { targets: ReallocationTarget[]; reason: string; version: number }) =>
    api<unknown>(`/payments/${id}/reallocate`, { method: 'POST', body, idempotent: true }),
  reviewDone: (id: number, body: { note: string; version: number }) =>
    api<unknown>(`/payments/${id}/review-done`, { method: 'POST', body, idempotent: true }),
  receiptUrl: (id: number) => api<{ url: string }>(`/payments/${id}/receipt-url`),
  resendReceipt: (id: number, channels: ReceiptChannel[]) =>
    api<unknown>(`/payments/${id}/receipt/resend`, {
      method: 'POST',
      body: { channels },
      idempotent: true,
    }).then(r => {
      const n = (r as { sent?: unknown } | null)?.sent;
      return typeof n === 'number' ? n : 0;
    }),

  // helpers for the Record payment modal and the deposit screen
  /** Published optional collections (module 12 8.21). */
  liveCollections: async () => {
    const r = await apiList<unknown>('/collections', {
      query: { status: 'PUBLISHED', isMandatory: false, limit: 50 },
    });
    return rowsOf(r.data).map(mapCollectionOption);
  },
  /** The open request of one flat in a collection (8.23). */
  collectionRequestFor: async (collectionId: number, unitLabel: string) => {
    const r = await apiList<unknown>(`/collections/${collectionId}/requests`, {
      query: { q: unitLabel, limit: 20 },
    });
    return rowsOf(r.data).map(mapCollectionRequest);
  },
  /** Open invoices of a flat, for the reallocate dialog. */
  openInvoices: async (unitId: number) => {
    const r = await apiList<unknown>('/invoices', { query: { unitId, limit: 50 } });
    return rowsOf(r.data)
      .map(mapOpenInvoice)
      .filter(i => ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status));
  },
  /** Society bank accounts (module 13 `GET /accounts/bank-accounts`). */
  bankAccounts: async () => {
    // Module 13 may not exist yet: a 404 is remembered for the session and not asked again.
    if (banksMissing) throw banksMissing;
    try {
      const r = await api<unknown>('/accounts/bank-accounts');
      return (
        Array.isArray(r) ? r : rowsOf(r, 'bankAccounts').length ? rowsOf(r, 'bankAccounts') : rowsOf(r)
      ).map(mapBankAccount);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) banksMissing = e;
      throw e;
    }
  },
};
