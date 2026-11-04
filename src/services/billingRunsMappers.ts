/**
 * Normalisers from the module 11 backend shapes (spec sections 7.5, 7.6, 8.5 to 8.10) to the screen shapes in
 * `types/billingRuns.ts`. All shape guessing lives here. Every normaliser tolerates missing optional fields and
 * never throws.
 */
import { inr, shortDate } from '@/lib/money';
import type {
  HeadTotal,
  ItemStatus,
  Pagination,
  RateRow,
  Run,
  RunCounts,
  RunCycle,
  RunItem,
  RunLine,
  RunStatus,
  RunType,
  ScopeType,
  SplitInput,
  SplitRuleInput,
} from '@/types/billingRuns';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const list = (v: unknown): R[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strN = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
/** Decimal columns arrive as strings ("1.1613") or numbers; null stays null. */
const numN = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d);

/** `warningCodes` is a comma list in the table and may come as an array. */
export const codeList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x !== '')
    : typeof v === 'string'
      ? v
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [];

export function normaliseCounts(raw: unknown, fallback: R = {}): RunCounts {
  const c = obj(raw);
  const pick = (a: string, b: string) => num(c[a], num(fallback[b]));
  return {
    items: pick('items', 'itemCount'),
    ready: pick('ready', 'readyCount'),
    exceptions: pick('exceptions', 'exceptionCount'),
    excluded: pick('excluded', 'excludedCount'),
    warnings: pick('warnings', 'warningCount'),
    skipped: pick('skipped', 'skippedCount'),
    issued: pick('issued', 'issuedCount'),
  };
}

const headTotal = (raw: unknown): HeadTotal => {
  const h = obj(raw);
  return { headKey: str(h.headKey), name: str(h.name, str(h.headKey)), amountPaise: num(h.amountPaise) };
};

const splitInput = (raw: unknown): SplitInput => {
  const s = obj(raw);
  return { billSplitRuleId: num(s.billSplitRuleId), amountPaise: num(s.amountPaise) };
};

/**
 * PATCH, recompute and cancel answer only `{ id, runLabel, runType, periodStart, periodEnd, billDate, status, version }`.
 * This keeps what the screen already has (counts, totals, scope) and takes just those fields from the answer; the
 * preview hash and stale flag are cleared because the run is being computed again.
 */
export function mergeShortRun(prev: Run, shortRaw: unknown): Run {
  const r = obj(shortRaw);
  return {
    ...prev,
    status: (strN(r.status) ?? prev.status) as RunStatus,
    version: num(r.version, prev.version),
    runLabel: str(r.runLabel, prev.runLabel),
    billDate: str(r.billDate, prev.billDate),
    previewHash: null,
    isStale: false,
    computeError: null,
  };
}

export function normaliseRun(raw: unknown): Run {
  const r = obj(raw);
  return {
    id: num(r.id),
    runLabel: str(r.runLabel),
    runType: str(r.runType, 'REGULAR') as RunType,
    status: str(r.status, 'DRAFT') as RunStatus,
    cycle: str(r.cycle, 'MONTHLY') as RunCycle,
    periodStart: str(r.periodStart),
    periodEnd: str(r.periodEnd),
    billDate: str(r.billDate),
    scopeType: str(r.scopeType, 'ALL_UNITS') as ScopeType,
    scopeValues: Array.isArray(r.scopeValues) ? r.scopeValues.map(v => num(v)) : [],
    counts: normaliseCounts(r.counts, r),
    subtotalPaise: num(r.subtotalPaise),
    taxPaise: num(r.taxPaise),
    roundOffPaise: num(r.roundOffPaise),
    totalPaise: num(r.totalPaise),
    previousRunTotalPaise: numN(r.previousRunTotalPaise),
    changePct: numN(r.changePct),
    byHead: list(r.byHead).map(headTotal),
    computedAt: strN(r.computedAt),
    isStale: bool(r.isStale),
    previewHash: strN(r.previewHash),
    approvalRequestId: numN(r.approvalRequestId),
    computeError: strN(r.computeError),
    lastError: strN(r.lastError),
    cancelReason: strN(r.cancelReason),
    notes: strN(r.notes),
    splitInputs: list(r.splitInputs).map(splitInput),
    createdAt: strN(r.createdAt),
    publishedAt: strN(r.publishedAt),
    approvedAt: strN(r.approvedAt),
    issuedAt: strN(r.issuedAt),
    version: num(r.version, 1),
  };
}

const line = (raw: unknown): RunLine => {
  const l = obj(raw);
  return {
    headKey: str(l.headKey, str(l.chargeHeadKey)),
    description: str(l.description, str(l.name)),
    amountPaise: num(l.amountPaise),
    prorationDays: numN(l.prorationDays),
    periodDays: numN(l.periodDays),
  };
};

export function normaliseItem(raw: unknown): RunItem {
  const i = obj(raw);
  return {
    id: num(i.id),
    unitId: num(i.unitId),
    unitLabel: str(i.unitLabel),
    billToName: strN(i.billToName),
    billToRelation: strN(i.billToRelation) as RunItem['billToRelation'],
    status: str(i.status, 'READY') as ItemStatus,
    exceptionCode: strN(i.exceptionCode),
    exceptionMessage: strN(i.exceptionMessage),
    warningCodes: codeList(i.warningCodes),
    // CGST, SGST and ROUND_OFF lines are shown as the tax and round-off rows, so only the charge lines are listed
    lines: list(i.lines ?? i.linesSnapshot)
      .filter(l => l.lineKind === undefined || l.lineKind === 'CHARGE')
      .map(line),
    subtotalPaise: num(i.subtotalPaise),
    taxPaise: num(i.taxPaise),
    roundOffPaise: num(i.roundOffPaise),
    totalPaise: num(i.totalPaise),
    previousTotalPaise: numN(i.previousTotalPaise),
    variancePct: numN(i.variancePct),
    excludedReason: strN(i.excludedReason),
    invoiceId: numN(i.invoiceId),
    version: num(i.version, 1),
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

export const rows = (data: unknown): unknown[] =>
  Array.isArray(data) ? data : Array.isArray(obj(data).items) ? (obj(data).items as unknown[]) : [];

const RATE_NAME: Record<string, string> = {
  FLAT_PER_UNIT: 'per flat',
  PER_SQFT: 'per sq ft',
  PER_UNIT_TYPE: 'by flat type',
  METERED: 'by meter reading',
  SPLIT_TOTAL: 'split of a total bill',
  PERCENT_OF_HEADS: 'percent of other heads',
  NONE: 'not charged',
};

/** "₹3.20 per sq ft" for an approved rule version (spec 8.2 version fields). */
export function rateText(version: unknown): string {
  const v = obj(version);
  const type = str(v.rateType);
  switch (type) {
    case 'FLAT_PER_UNIT':
      return `${inr(num(v.amountPaise))} ${RATE_NAME[type]}`;
    case 'PER_SQFT':
      return `${inr(num(v.ratePerSqftPaise))} ${RATE_NAME[type]}`;
    case 'PERCENT_OF_HEADS':
      return `${str(v.percent)} % of other heads`;
    case '':
      return 'No rate set';
    default:
      return RATE_NAME[type] ?? type;
  }
}

const SCOPE_NAME: Record<string, string> = {
  ALL_UNITS: 'All flats',
  BUILDINGS: 'Some buildings',
  UNIT_TYPES: 'Some flat types',
  UNITS: 'Some flats',
};

/**
 * The approved version of a rule in force on `periodStart`: the next version once it has started (`effectiveFrom` on or
 * before the period start), else the current one when it has not ended before the period start. Without a period start,
 * the current version (today's rate).
 */
export function versionOn(
  rule: Record<string, unknown>,
  periodStart?: string,
): Record<string, unknown> | null {
  const cur = rule.currentVersion ? obj(rule.currentVersion) : null;
  if (!periodStart) return cur;
  const next = rule.nextVersion ? obj(rule.nextVersion) : null;
  if (next && str(next.effectiveFrom).slice(0, 10) <= periodStart) return next;
  const curTo = cur ? strN(cur.effectiveTo)?.slice(0, 10) : null;
  return cur && !(curTo && curTo < periodStart) ? cur : null;
}

/**
 * One read-only rate row per rule, from `GET /billing/rules`: the rate in force on `periodStart` (a new rate says from
 * when), and a pending one if any.
 */
export function normaliseRates(data: unknown, periodStart?: string): RateRow[] {
  return rows(data)
    .map(obj)
    .filter(r => str(r.status, 'ACTIVE') !== 'ARCHIVED')
    .map(r => {
      const head = obj(r.chargeHead);
      const pending = r.pendingVersion ? obj(r.pendingVersion) : null;
      const v = versionOn(r, periodStart);
      const isNew = !!v && !!r.nextVersion && v === obj(r.nextVersion);
      return {
        ruleId: num(r.id),
        headName: str(r.chargeHeadName, str(head.name, str(r.name))),
        scopeText: SCOPE_NAME[str(r.scopeType)] ?? '',
        rateText: v
          ? `${rateText(v)}${isNew ? ` from ${shortDate(str(v.effectiveFrom).slice(0, 10))}` : ''}`
          : periodStart && r.nextVersion
            ? 'No approved rate for this period'
            : 'No approved rate yet',
        pendingText: pending
          ? `Waiting for approval: ${rateText(pending)}${strN(pending.effectiveFrom) ? ` from ${str(pending.effectiveFrom)}` : ''}`
          : null,
      };
    });
}

/**
 * Split rules whose total is typed for each run (`amountSource = RUN_INPUT`). The backend takes an amount only for the
 * split rules that an approved SPLIT_TOTAL rate of an active rule uses on the period start (any other id is a 400), so
 * when the rules are given the list is narrowed to those; `periodStart` picks the rate version in force.
 */
export function normaliseSplitInputs(
  data: unknown,
  rulesData?: unknown,
  periodStart?: string,
): SplitRuleInput[] {
  const used = rulesData === undefined ? null : usedSplitRuleIds(rulesData, periodStart);
  return rows(data)
    .map(obj)
    .filter(r => str(r.amountSource) === 'RUN_INPUT' && str(r.status, 'ACTIVE') !== 'ARCHIVED')
    .filter(r => used === null || used.has(num(r.id)))
    .map(r => ({ id: num(r.id), name: str(r.name), description: str(r.description) }));
}

export function usedSplitRuleIds(rulesData: unknown, periodStart?: string): Set<number> {
  const out = new Set<number>();
  for (const r of rows(rulesData).map(obj)) {
    if (str(r.status, 'ACTIVE') === 'ARCHIVED') continue;
    for (const v of [r.currentVersion, r.nextVersion].map(obj)) {
      if (str(v.rateType) !== 'SPLIT_TOTAL' || str(v.status, 'APPROVED') !== 'APPROVED') continue;
      const from = str(v.effectiveFrom).slice(0, 10);
      const to = strN(v.effectiveTo)?.slice(0, 10) ?? null;
      if (periodStart && ((from && from > periodStart) || (to && to < periodStart))) continue;
      out.add(num(v.billSplitRuleId));
    }
  }
  return out;
}

/** The billing cycle from `GET /society/settings?namespace=billing` rows (`billing.cycle`). Defaults to monthly. */
export function normaliseCycle(data: unknown): RunCycle {
  const hit = rows(data)
    .map(obj)
    .find(s => s.key === 'billing.cycle' || s.key === 'cycle');
  const v = hit?.value;
  return v === 'QUARTERLY' || v === 'HALF_YEARLY' || v === 'ANNUAL' ? v : 'MONTHLY';
}
