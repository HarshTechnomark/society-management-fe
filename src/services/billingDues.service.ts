/** Sub-module 11.5 admin calls: dashboard, defaulters, reminders (spec 8.18 and 8.22). */
import { ApiError, api, apiBlob, apiList } from '@/lib/apiClient';
import { mapBulkReminder, mapDefaulters, mapOpenInvoiceRef, mapSummary, rowsOf } from './billingDuesMappers';
import type { DefaulterQuery, FlatReminderResult } from '@/types/billingDues';

export const billingDuesService = {
  /** `month` is `YYYY-MM`; the API defaults to the current month. */
  summary: (month?: string) =>
    api<unknown>('/billing/summary', { query: { month: month || undefined } }).then(mapSummary),
  defaulters: (q: DefaulterQuery) =>
    api<unknown>('/billing/defaulters', { query: { ...q, format: 'json' } }).then(mapDefaulters),
  defaultersCsv: (q: DefaulterQuery) => apiBlob('/billing/defaulters', { query: { ...q, format: 'csv' } }),
  /** One invoice (`finance.billing.edit`): answers `{ sentAt }`. */
  remind: (invoiceId: number) =>
    api<{ sentAt?: string }>(`/invoices/${invoiceId}/remind`, { method: 'POST', body: {} }),
  /** Every overdue flat; the work runs in a job, the answer is the counts queued. */
  remindAllOverdue: (buildingId?: number) =>
    api<unknown>('/billing/reminders', {
      method: 'POST',
      body: { scope: 'OVERDUE', ...(buildingId ? { buildingId } : {}) },
      idempotent: true,
    }).then(mapBulkReminder),
  /** Open overdue invoices of one flat, so a defaulter row can be reminded. */
  async overdueInvoices(unitId: number) {
    const r = await apiList<unknown>('/invoices', {
      query: { unitId, status: 'OVERDUE', limit: 50 },
    });
    return rowsOf(r.data).map(mapOpenInvoiceRef);
  },
  /** Reminds every overdue invoice of a flat; one that was reminded in the last 24 hours is counted, not failed. */
  async remindFlat(unitId: number): Promise<FlatReminderResult> {
    const out: FlatReminderResult = { sent: 0, tooSoon: 0, failed: 0, firstError: null };
    for (const inv of await this.overdueInvoices(unitId)) {
      try {
        await this.remind(inv.id);
        out.sent += 1;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'REMINDER_TOO_SOON') out.tooSoon += 1;
        else {
          out.failed += 1;
          out.firstError ??= e;
        }
      }
    }
    return out;
  },
};
