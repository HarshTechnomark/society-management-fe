/** Small tolerant readers shared by the settlement and statement mappers (module 13). Never throw. */
import type { Pagination } from '@/types/accountsSettlements';

export type R = Record<string, unknown>;
export const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
export const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
export const strN = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
export const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
export const numN = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const rows = (data: unknown): unknown[] =>
  Array.isArray(data) ? data : Array.isArray(obj(data).items) ? (obj(data).items as unknown[]) : [];

export function normalisePagination(raw: unknown, shown: number): Pagination {
  const p = obj(raw);
  return {
    page: num(p.page, 1),
    limit: num(p.limit, shown || 20),
    total: num(p.total, shown),
    totalPages: Math.max(1, num(p.totalPages, 1)),
  };
}
