/** Sub-module 12-FE-4 resident calls (spec 8.2 to 8.9, 8.24): the Pay tab, receipts, advance, AutoPay, collections. */
import { api, apiList, ApiError } from '@/lib/apiClient';
import {
  mapAdvances,
  mapCollection,
  mapCollectionDetail,
  mapMandate,
  mapMandateCreated,
  mapOrderCreated,
  mapOrderState,
  mapPaymentPage,
  mapPayables,
  mapPublicLink,
  mapReceiptUrl,
  mapCheckout,
  rows,
} from './paymentsResidentMappers';
import type {
  CreateMandateInput,
  CreateOrderInput,
  DeclareInput,
  DevPayResult,
  MandateCreated,
  OrderCreated,
} from '@/types/paymentsResident';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

/** The public link calls carry no session: a plain fetch that reads the same envelope (spec 8.24). */
async function publicCall<T>(
  path: string,
  init: { method?: string; token: string; body?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'X-Pay-Token': init.token,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: unknown;
    code?: string;
    message?: string;
    errors?: { field: string; message: string }[];
    requestId?: string;
  } | null;
  if (!res.ok || !json?.success)
    throw new ApiError(
      res.status,
      json?.code ?? 'INTERNAL_ERROR',
      json?.message ?? 'Something went wrong',
      json?.errors,
      json?.requestId,
    );
  return json.data as T;
}

let autopayAvailable: Promise<boolean> | null = null;
/** Forgets what the session learned about AutoPay (used by tests). */
export const resetResidentSession = () => {
  autopayAvailable = null;
};

export const paymentsResidentService = {
  /** Whether AutoPay is offered: asked once per session; a "not available" answer is remembered (no repeat 422). */
  autopayAvailable: (): Promise<boolean> => {
    autopayAvailable ??= api<unknown>('/me/autopay-mandates', { plan: false }).then(
      () => true,
      e => {
        if (e instanceof ApiError && e.status !== 0 && e.status < 500) return false;
        autopayAvailable = null; // a network or server error is not an answer
        return false;
      },
    );
    return autopayAvailable;
  },
  /** The pay list also says whether AutoPay is offered: remember it so the mandates route is never called for nothing. */
  payables: (unitId: number) =>
    api<unknown>('/me/payables', { query: { unitId } })
      .then(mapPayables)
      .then(p => {
        if (p.autopayAvailable === false) autopayAvailable = Promise.resolve(false);
        return p;
      }),
  createOrder: (input: CreateOrderInput): Promise<OrderCreated> =>
    api<unknown>('/me/payables/payment-orders', { method: 'POST', body: input, idempotent: true }).then(
      mapOrderCreated,
    ),
  verify: (orderId: number, gatewayPaymentId: string) =>
    api<unknown>(`/me/payables/payment-orders/${orderId}/verify`, {
      method: 'POST',
      body: { gatewayPaymentId },
    }).then(mapOrderState),
  order: (orderId: number, background = false) =>
    api<unknown>(`/me/payment-orders/${orderId}`, background ? { activity: false } : {}).then(mapOrderState),
  cancelOrder: (orderId: number) =>
    api<unknown>(`/me/payment-orders/${orderId}/cancel`, { method: 'POST' }).then(mapOrderState),
  /** Development only: what the fake gateway's checkout would do (`POST /dev/payments/:gatewayOrderId/pay`). */
  devPay: (gatewayOrderId: string, status: 'captured' | 'failed'): Promise<DevPayResult> =>
    api<{ gatewayPaymentId: string; status: string }>(`/dev/payments/${gatewayOrderId}/pay`, {
      method: 'POST',
      body: { status },
    }),

  payments: async (
    q: { unitId?: number; from?: string; to?: string; page?: number; limit?: number } = {},
  ) => {
    const r = await apiList<unknown>('/me/payments', { query: { ...q } });
    return mapPaymentPage(r.data, r.pagination);
  },
  receiptUrl: (paymentId: number) =>
    api<unknown>(`/me/payments/${paymentId}/receipt-url`).then(mapReceiptUrl),
  declare: (input: DeclareInput) =>
    api<unknown>('/me/payments/declared', { method: 'POST', body: input, idempotent: true }),
  advances: (unitId: number, page = 1) =>
    api<unknown>('/me/advances', { query: { unitId, page } }).then(mapAdvances),

  mandates: () => api<unknown>('/me/autopay-mandates', { plan: false }).then(r => rows(r).map(mapMandate)),
  createMandate: (input: CreateMandateInput): Promise<MandateCreated> =>
    api<unknown>('/me/autopay-mandates', { method: 'POST', body: input, idempotent: true }).then(
      mapMandateCreated,
    ),
  pauseMandate: (id: number, version: number) =>
    api<unknown>(`/me/autopay-mandates/${id}/pause`, { method: 'POST', body: { version } }),
  resumeMandate: (id: number, version: number) =>
    api<unknown>(`/me/autopay-mandates/${id}/resume`, { method: 'POST', body: { version } }),
  cancelMandate: (id: number, version: number, reason?: string) =>
    api<unknown>(`/me/autopay-mandates/${id}/cancel`, {
      method: 'POST',
      body: reason ? { version, reason } : { version },
    }),

  collections: () => api<unknown>('/me/collections').then(r => rows(r).map(mapCollection)),
  collection: (id: number) => api<unknown>(`/me/collections/${id}`).then(mapCollectionDetail),

  publicLink: (code: string, token: string) =>
    publicCall<unknown>(`/public/pay/${encodeURIComponent(code)}`, { token }).then(mapPublicLink),
  publicCheckout: (code: string, token: string) =>
    publicCall<{ checkout?: unknown } & Record<string, unknown>>(
      `/public/pay/${encodeURIComponent(code)}/checkout`,
      { method: 'POST', token, body: { token } },
    ).then(r => mapCheckout(r.checkout ?? r)),
  publicVerify: (code: string, token: string, gatewayPaymentId: string) =>
    publicCall<unknown>(`/public/pay/${encodeURIComponent(code)}/verify`, {
      method: 'POST',
      token,
      body: { token, gatewayPaymentId },
    }).then(mapOrderState),
};
