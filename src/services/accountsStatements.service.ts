/** Bank statements, lines, matching and the BRS (spec 8.14 route 38, 8.16 routes 43 to 51). */
import { api, apiList } from '@/lib/apiClient';
import { normalisePagination, rows } from './accountsReadHelpers';
import {
  normaliseBankOption,
  normaliseBrs,
  normaliseCandidate,
  normaliseImport,
  normaliseLine,
} from './accountsStatementsMappers';
import type {
  BankAccountOption,
  Brs,
  Candidate,
  CreateEntryInput,
  ImportStatementInput,
  LineQuery,
  PagedList,
  StatementImport,
  StatementLine,
  StatementQuery,
} from '@/types/accountsStatements';

type Query = Record<string, string | number | boolean | undefined>;
const clean = (q: object): Query =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v !== undefined)) as Query;
const post = (path: string, body: unknown, idempotent = false) =>
  api<unknown>(path, { method: 'POST', body, idempotent });

/** The statement answers carry the bank account id only: the names come from the bank account list (empty when it is not available). */
async function bankLabels(): Promise<Map<number, string>> {
  try {
    const list = await api<unknown>('/accounts/bank-accounts');
    return new Map(
      rows(list)
        .map(normaliseBankOption)
        .map(o => [o.id, o.label] as const),
    );
  } catch {
    return new Map();
  }
}
const labelled = (s: StatementImport, names: Map<number, string>): StatementImport =>
  s.bankAccountLabel ? s : { ...s, bankAccountLabel: names.get(s.bankAccountId) ?? '' };

export const accountsStatementsService = {
  async list(q: StatementQuery = {}): Promise<PagedList<StatementImport>> {
    const r = await apiList<unknown>('/accounts/bank-statements', { query: clean(q) });
    const names = await bankLabels();
    const items = rows(r.data)
      .map(normaliseImport)
      .map(s => labelled(s, names));
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  /** `activity: false` for the parsing poll so the idle timer is not bumped. */
  async get(id: number, poll = false): Promise<StatementImport> {
    const s = normaliseImport(
      await api<unknown>(`/accounts/bank-statements/${id}`, poll ? { activity: false } : {}),
    );
    return s.bankAccountLabel || poll ? s : labelled(s, await bankLabels());
  },
  async lines(id: number, q: LineQuery = {}): Promise<PagedList<StatementLine>> {
    const r = await apiList<unknown>(`/accounts/bank-statements/${id}/lines`, { query: clean(q) });
    const items = rows(r.data).map(normaliseLine);
    return { items, pagination: normalisePagination(r.pagination, items.length) };
  },
  import: (body: ImportStatementInput) => post('/accounts/bank-statements', body, true).then(normaliseImport),
  /** `202`: the matching runs as a job and the answer is the statement as it was; the counts show on the statement afterwards. */
  autoMatch: (id: number): Promise<StatementImport> =>
    post(`/accounts/bank-statements/${id}/auto-match`, {}).then(normaliseImport),
  markReconciled: (id: number, version: number) =>
    post(`/accounts/bank-statements/${id}/mark-reconciled`, { version }),
  candidates: (lineId: number): Promise<Candidate[]> =>
    api<unknown>(`/accounts/bank-statement-lines/${lineId}/candidates`).then(d =>
      rows(d).map(normaliseCandidate),
    ),
  match: (lineId: number, body: { journalLineId: number; version: number }) =>
    post(`/accounts/bank-statement-lines/${lineId}/match`, body),
  unmatch: (lineId: number, version: number) =>
    post(`/accounts/bank-statement-lines/${lineId}/unmatch`, { version }),
  ignore: (lineId: number, body: { reason: string; version: number }) =>
    post(`/accounts/bank-statement-lines/${lineId}/ignore`, body),
  createEntry: (lineId: number, body: CreateEntryInput) =>
    post(`/accounts/bank-statement-lines/${lineId}/create-entry`, body, true),
  brs: (bankAccountId: number, asOf?: string): Promise<Brs> =>
    api<unknown>(`/accounts/bank-accounts/${bankAccountId}/brs`, { query: clean({ asOf }) }).then(
      normaliseBrs,
    ),
  /** Active bank accounts for the upload picker. The caller treats a 404 as "type the number". */
  bankAccounts: (): Promise<BankAccountOption[]> =>
    api<unknown>('/accounts/bank-accounts').then(d =>
      rows(d)
        .map(normaliseBankOption)
        .filter(o => o.id > 0),
    ),
};
