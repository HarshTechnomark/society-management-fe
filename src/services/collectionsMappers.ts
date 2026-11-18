/** Normalisers from the module 12 collection shapes (spec 7.8, 7.9, 8.21 to 8.23) to `types/collections.ts`. Never throw. */
import type {
  AmountMode,
  AudienceType,
  Collection,
  CollectionDetail,
  CollectionKind,
  CollectionRequest,
  CollectionStatus,
  Option,
  PayListVisibility,
  Pagination,
  RequestStatus,
  SpentLine,
} from '@/types/collections';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numN = (v: unknown): number | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const bool = (v: unknown, d = false): boolean =>
  typeof v === 'boolean' ? v : v === 1 ? true : v === 0 ? false : d;
const oneOf = <T extends string>(v: unknown, all: readonly T[], d: T): T =>
  typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : d;

export const rows = (data: unknown): unknown[] =>
  Array.isArray(data) ? data : Array.isArray(obj(data).items) ? (obj(data).items as unknown[]) : [];

export const KINDS = ['FESTIVAL', 'EVENT', 'REPAIR_CALL', 'DONATION', 'OTHER'] as const;
export const STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'CLOSED',
  'CANCELLED',
] as const;
const MODES = ['FIXED_PER_UNIT', 'MIN_PER_UNIT', 'VOLUNTARY'] as const;
const AUDIENCES = ['ALL', 'BUILDINGS', 'UNITS'] as const;
const VISIBILITY = ['HIDDEN', 'COUNT_ONLY', 'FLATS_ONLY', 'FLATS_AND_AMOUNTS'] as const;
const REQ = ['OPEN', 'PART_PAID', 'PAID', 'WAIVED', 'CANCELLED'] as const;

/** `percent = min(100, floor(collected x 100 / target))` when the API did not send it. */
export const percentOf = (collected: number, target: number): number =>
  target > 0 ? Math.max(0, Math.min(100, Math.floor((collected * 100) / target))) : 0;

export function normaliseCollection(raw: unknown): Collection {
  const c = obj(raw);
  const collectedPaise = num(c.collectedPaise);
  const targetPaise = num(c.targetPaise);
  return {
    id: num(c.id),
    title: str(c.title),
    kind: oneOf<CollectionKind>(c.kind, KINDS, 'OTHER'),
    isMandatory: bool(c.isMandatory),
    amountMode: oneOf<AmountMode>(c.amountMode, MODES, 'FIXED_PER_UNIT'),
    amountPerUnitPaise: num(c.amountPerUnitPaise),
    minAmountPaise: num(c.minAmountPaise),
    targetPaise,
    collectedPaise,
    percent: c.percent === undefined ? percentOf(collectedPaise, targetPaise) : num(c.percent),
    contributorCount: num(c.contributorCount),
    requestCount: num(c.requestCount),
    paidCount: num(c.paidCount),
    dueDate: str(c.dueDate),
    status: oneOf<CollectionStatus>(c.status, STATUSES, 'DRAFT'),
    fundId: numN(c.fundId),
    fundName: str(c.fundName),
    createdByName: str(c.createdByName),
    approvedByName: str(c.approvedByName),
    purpose: str(c.purpose),
    version: num(c.version, 1),
  };
}

const spent = (raw: unknown): SpentLine[] =>
  (Array.isArray(raw) ? raw : []).map(e => {
    const x = obj(e);
    return {
      title: str(x.title),
      category: str(x.category, str(x.categoryName)),
      date: str(x.date, str(x.expenseDate)),
      amountPaise: num(x.amountPaise),
    };
  });

export function normaliseDetail(raw: unknown): CollectionDetail {
  const c = obj(raw);
  const approval = obj(c.approval);
  const ids = Array.isArray(c.audienceIds) ? c.audienceIds.map(n => num(n)).filter(n => n > 0) : [];
  return {
    ...normaliseCollection(raw),
    audienceType: oneOf<AudienceType>(c.audienceType, AUDIENCES, 'ALL'),
    audienceIds: ids,
    includeVacant: bool(c.includeVacant),
    payListVisibility: oneOf<PayListVisibility>(c.payListVisibility, VISIBILITY, 'COUNT_ONLY'),
    sendNotice: bool(c.sendNotice, true),
    reminderCount: num(c.reminderCount),
    lastReminderAt: str(c.lastReminderAt) || null,
    rejectedReason: str(approval.reason, str(c.rejectedReason)),
    approvalStatus: str(approval.status),
    approvalRequestId: numN(approval.requestId) ?? numN(c.approvalRequestId),
    spentPaise: numN(c.spentPaise),
    expenses: spent(c.expenses),
    timeline: (Array.isArray(c.timeline) ? c.timeline : []).map(t => {
      const x = obj(t);
      return { at: str(x.at), event: str(x.event), by: str(x.by) };
    }),
  };
}

export function normaliseRequest(raw: unknown): CollectionRequest {
  const r = obj(raw);
  return {
    id: num(r.id),
    unitId: num(r.unitId),
    unitLabel: str(r.unitLabel),
    billToName: str(r.billToName),
    amountPaise: num(r.amountPaise),
    paidPaise: num(r.paidPaise),
    status: oneOf<RequestStatus>(r.status, REQ, 'OPEN'),
    invoiceId: numN(r.invoiceId),
    lastPaidAt: str(r.lastPaidAt) || null,
    version: num(r.version, 1),
  };
}

export function normalisePagination(raw: unknown, shown: number): Pagination {
  const p = obj(raw);
  return {
    page: num(p.page, 1),
    limit: num(p.limit, shown || 20),
    total: num(p.total, shown),
    totalPages: Math.max(1, num(p.totalPages, 1)),
  };
}

/** Funds of module 13 (`GET /funds`): only active ones can be chosen. */
export function normaliseFund(raw: unknown): Option & { active: boolean } {
  const f = obj(raw);
  const status = str(f.status);
  return {
    id: num(f.id),
    label: str(f.name, str(f.label)),
    active: f.isActive === false || (status !== '' && status !== 'ACTIVE') ? false : true,
  };
}

export function normaliseBuildingOption(raw: unknown): Option {
  const b = obj(raw);
  return { id: num(b.id), label: str(b.name, str(b.code)), count: num(obj(b.unitCounts).active) };
}

export function normaliseUnitOption(raw: unknown): Option {
  const u = obj(raw);
  return { id: num(u.id), label: str(u.label, str(u.unitLabel)) };
}

export function normaliseUrl(raw: unknown): { url: string; expiresAt: string | null } {
  const o = obj(raw);
  return { url: str(o.url), expiresAt: str(o.expiresAt) || null };
}

export function normaliseRemind(raw: unknown): { sentTo: number; reminderCount: number } {
  const o = obj(raw);
  return { sentTo: num(o.sentTo), reminderCount: num(o.reminderCount) };
}
