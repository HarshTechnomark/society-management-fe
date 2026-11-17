import { ApiError, api } from '@/lib/apiClient';
import type {
  Fund,
  FundInput,
  FundOption,
  FundPatch,
  FundStatement,
  FundTransferInput,
  FundTransferResult,
} from '@/types/accountsFunds';
import { mapFund, mapFundOption, mapStatement, mapTransfer, rowsOf } from './accountsFundsMappers';

const base = '/accounts/funds';
let missing: ApiError | null = null;
/** Forgets what the session learned about the list route (used by tests). */
export const resetAccountsFundsSession = () => {
  missing = null;
};

export const accountsFundsService = {
  list: (status: 'ACTIVE' | 'CLOSED' = 'ACTIVE') =>
    api<unknown>(base, { query: { status } }).then(r => rowsOf(r).map(mapFund)),
  /** Active funds for pickers. A 404 (module 13 not deployed) is remembered and not asked again. */
  options: async (): Promise<FundOption[]> => {
    if (missing) throw missing;
    try {
      const r = await api<unknown>(base, { query: { status: 'ACTIVE' } });
      return rowsOf(r)
        .map(mapFundOption)
        .filter(f => f.active)
        .map(({ id, label, fundType }) => ({ id, label, fundType }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) missing = e;
      throw e;
    }
  },
  create: (body: FundInput): Promise<Fund> =>
    api<unknown>(base, { method: 'POST', body, idempotent: true }).then(mapFund),
  update: (id: number, body: FundPatch): Promise<Fund> =>
    api<unknown>(`${base}/${id}`, { method: 'PATCH', body }).then(mapFund),
  statement: (id: number, from: string, to: string): Promise<FundStatement> =>
    api<unknown>(`${base}/${id}/statement`, { query: { from, to } }).then(mapStatement),
  transfer: (body: FundTransferInput): Promise<FundTransferResult> =>
    api<unknown>('/accounts/fund-transfers', { method: 'POST', body, idempotent: true }).then(mapTransfer),
};
