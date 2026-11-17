import { ApiError, api } from '@/lib/apiClient';
import type { BankAccount, BankAccountInput, BankAccountPatch, BankOption } from '@/types/accountsBank';
import { mapBank, mapBankOption } from './accountsBankMappers';
import { rowsOf, str } from './accountsFundsMappers';

const base = '/accounts/bank-accounts';
let missing: ApiError | null = null;
/** Forgets what the session learned about the list route (used by tests). */
export const resetAccountsBankSession = () => {
  missing = null;
};

export const accountsBankService = {
  list: () => api<unknown>(base).then(r => rowsOf(r).map(mapBank)),
  /** Active bank accounts for pickers. A 404 is remembered and not asked again. */
  options: async (): Promise<BankOption[]> => {
    if (missing) throw missing;
    try {
      const r = await api<unknown>(base);
      return rowsOf(r)
        .map(mapBankOption)
        .filter(b => b.active)
        .map(({ id, label, isCollection }) => ({ id, label, isCollection }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) missing = e;
      throw e;
    }
  },
  create: (body: BankAccountInput) =>
    api<unknown>(base, { method: 'POST', body, idempotent: true }).then(mapBank),
  update: (id: number, body: BankAccountPatch) =>
    api<unknown>(`${base}/${id}`, { method: 'PATCH', body }).then(mapBank),
  verify: (id: number, version: number) =>
    api<unknown>(`${base}/${id}/verify`, { method: 'POST', body: { version }, idempotent: true }).then(
      mapBank,
    ),
  setCollection: (id: number, version: number) =>
    api<unknown>(`${base}/${id}/set-collection`, {
      method: 'POST',
      body: { version },
      idempotent: true,
    }).then(mapBank),
  close: (id: number, body: { reason: string; version: number }) =>
    api<unknown>(`${base}/${id}/close`, { method: 'POST', body, idempotent: true }).then(mapBank),
  /** The full number: step-up is asked by the API client; the caller must not keep it. */
  reveal: (id: number) =>
    api<unknown>(`${base}/${id}/reveal`).then(r => str((r as Record<string, unknown> | null)?.accountNumber)),
};
