/** Module 13 society balance calls (spec 8.1 to 8.3). */
import { api } from '@/lib/apiClient';
import { mapBalance, mapFundStatement, mapHistory, mapResidentFinances } from './accountsBalanceMappers';

export const accountsBalanceService = {
  /** `quiet` is for background polling: it does not bump the session idle timer. */
  balance: async (quiet = false) => mapBalance(await api<unknown>('/society-balance', { activity: !quiet })),
  history: async (from: string, to: string) =>
    mapHistory(await api<unknown>('/society-balance/history', { query: { from, to } })),
  residentFinances: async (quiet = false) =>
    mapResidentFinances(await api<unknown>('/me/society-finances', { activity: !quiet })),
  fundStatement: async (id: number) =>
    mapFundStatement(await api<unknown>(`/me/society-finances/funds/${id}/statement`)),
};
