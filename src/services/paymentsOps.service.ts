/** Module 12 admin operations (spec 8.7, 8.16 to 8.20): refunds, payment orders, AutoPay mandates, links, advances. */
import { api, apiList } from '@/lib/apiClient';
import {
  normaliseAdvances,
  normaliseLink,
  normaliseMandate,
  normaliseOrder,
  normalisePagination,
  normaliseRefund,
  rows,
} from './paymentsOpsMappers';
import type {
  CompleteRefundInput,
  CreateLinkInput,
  MandateQuery,
  OrderQuery,
  RefundQuery,
  RequestRefundInput,
} from '@/types/paymentsOps';

type Query = Record<string, string | number | boolean | undefined>;

async function list<T>(path: string, q: object, map: (r: unknown) => T, plan = true) {
  const r = await apiList<unknown>(path, { query: q as Query, plan });
  const items = rows(r.data).map(map);
  return { items, pagination: normalisePagination(r.pagination, items.length) };
}

export const paymentsOpsService = {
  refunds: (q: RefundQuery = {}) => list('/refunds', q, normaliseRefund),
  refund: (id: number) => api<unknown>(`/refunds/${id}`).then(normaliseRefund),
  requestRefund: (body: RequestRefundInput) =>
    api<unknown>('/refunds', { method: 'POST', body, idempotent: true }).then(normaliseRefund),
  completeRefund: (id: number, body: CompleteRefundInput) =>
    api<unknown>(`/refunds/${id}/complete`, { method: 'POST', body }).then(normaliseRefund),

  orders: (q: OrderQuery = {}) => list('/payment-orders', q, normaliseOrder),
  order: (id: number) => api<unknown>(`/payment-orders/${id}`).then(normaliseOrder),
  cancelOrder: (id: number, reason: string) =>
    api<unknown>(`/payment-orders/${id}/cancel`, { method: 'POST', body: { reason } }).then(normaliseOrder),
  checkOrder: (id: number) =>
    api<unknown>(`/payment-orders/${id}/check`, { method: 'POST', body: {} }).then(normaliseOrder),

  mandates: (q: MandateQuery = {}) => list('/autopay-mandates', q, normaliseMandate, false),
  cancelMandate: (id: number, body: { reason: string; version: number }) =>
    api<unknown>(`/autopay-mandates/${id}/cancel`, { method: 'POST', body }),

  createLink: (body: CreateLinkInput) =>
    api<unknown>('/payment-links', { method: 'POST', body, idempotent: true }).then(normaliseLink),

  advances: (unitId: number, q: { page?: number; limit?: number } = {}) =>
    api<unknown>(`/units/${unitId}/advances`, { query: q }).then(normaliseAdvances),
};
