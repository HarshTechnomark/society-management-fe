/**
 * Normalisers from the module 11 backend response shapes (spec 8.1 to 8.4) to the shapes the Settings > Billing
 * screens use (types/billingSetup.ts). Every response of the service goes through here, so a difference in the real
 * backend is fixed in this one file. They never throw on a missing optional field.
 */
import type {
  BillingRule,
  ChargeHead,
  LateFeePolicy,
  RuleVersion,
  ScopeValue,
  SimulateItem,
  SplitRule,
} from '@/types/billingSetup';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown, fallback = 0): number => num(v) ?? fallback;
/** MySQL may send tinyint booleans as 0 and 1. */
const bool = (v: unknown, fallback = false): boolean =>
  v === undefined || v === null ? fallback : v === true || v === 1 || v === '1' || v === 'true';

/** JSON columns may arrive as an object or as a JSON text. */
function json(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
const list = (v: unknown): unknown[] => {
  const j = json(v);
  return Array.isArray(j) ? j : [];
};
const scopeValues = (v: unknown): ScopeValue[] =>
  list(v).filter((x): x is ScopeValue => typeof x === 'string' || typeof x === 'number');
const numberMap = (v: unknown): Record<string, number> | null => {
  const j = json(v);
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(j as Obj)) {
    const n = num(x);
    if (n !== null) out[k] = n;
  }
  return out;
};
/** A DECIMAL(9,4) as text with four decimals: "21" and 21 both become "21.0000". */
export function decimal4(v: unknown): string | null {
  const n = num(v);
  return n === null ? null : n.toFixed(4);
}

export function normaliseChargeHead(raw: unknown): ChargeHead {
  const r = obj(raw);
  return {
    id: int(r.id),
    key: String(r.key ?? ''),
    name: String(r.name ?? ''),
    description: str(r.description),
    headType: (r.headType ?? 'OTHER') as ChargeHead['headType'],
    payerRouting: (r.payerRouting ?? 'BILL_TO') as ChargeHead['payerRouting'],
    gstTreatment: (r.gstTreatment ?? 'NONE') as ChargeHead['gstTreatment'],
    sacCode: str(r.sacCode),
    prorate: bool(r.prorate, true),
    interestBearing: bool(r.interestBearing, true),
    ledgerAccountCode: String(r.ledgerAccountCode ?? ''),
    fundId: num(r.fundId),
    isSystem: bool(r.isSystem),
    status: r.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    sortOrder: int(r.sortOrder, 100),
    version: int(r.version, 1),
  };
}

export function normaliseVersion(raw: unknown): RuleVersion | null {
  const r = obj(raw);
  if (r.id === undefined && r.versionNo === undefined) return null;
  const slabs = list(r.slabs).map(s => ({
    uptoMilli: num(obj(s).uptoMilli),
    ratePaise: int(obj(s).ratePaise),
  }));
  const base = list(r.baseChargeHeadIds)
    .map(num)
    .filter((x): x is number => x !== null);
  return {
    id: int(r.id),
    billingRuleId: int(r.billingRuleId),
    versionNo: int(r.versionNo, 1),
    rateType: (r.rateType ?? 'NONE') as RuleVersion['rateType'],
    amountPaise: num(r.amountPaise),
    ratePerSqftPaise: num(r.ratePerSqftPaise),
    unitTypeRates: numberMap(r.unitTypeRates),
    meterType: str(r.meterType),
    slabs: r.slabs === null || r.slabs === undefined ? null : slabs,
    minimumChargePaise: num(r.minimumChargePaise),
    missingReadingPolicy: str(r.missingReadingPolicy),
    billSplitRuleId: num(r.billSplitRuleId),
    percent: decimal4(r.percent),
    baseChargeHeadIds: r.baseChargeHeadIds === null || r.baseChargeHeadIds === undefined ? null : base,
    effectiveFrom: String(r.effectiveFrom ?? '').slice(0, 10),
    effectiveTo: str(r.effectiveTo)?.slice(0, 10) ?? null,
    status: (r.status ?? 'PENDING_APPROVAL') as RuleVersion['status'],
    reason: String(r.reason ?? ''),
    resolutionRef: str(r.resolutionRef),
    approvalRequestId: num(r.approvalRequestId),
    approvedAt: str(r.approvedAt),
    rejectedReason: str(r.rejectedReason),
  };
}

export function normaliseRule(raw: unknown): BillingRule {
  const r = obj(raw);
  const head = obj(r.chargeHead);
  return {
    id: int(r.id),
    chargeHeadId: int(r.chargeHeadId ?? head.id),
    chargeHeadKey: str(r.chargeHeadKey ?? head.key),
    chargeHeadName: str(r.chargeHeadName ?? head.name),
    name: String(r.name ?? ''),
    scopeType: (r.scopeType ?? 'ALL_UNITS') as BillingRule['scopeType'],
    scopeValues: scopeValues(r.scopeValues),
    status: r.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    sortOrder: int(r.sortOrder, 100),
    version: int(r.version, 1),
    currentVersion: normaliseVersion(r.currentVersion),
    nextVersion: normaliseVersion(r.nextVersion),
    pendingVersion: normaliseVersion(r.pendingVersion),
    versions: list(r.versions)
      .map(normaliseVersion)
      .filter((v): v is RuleVersion => v !== null),
  };
}

export function normaliseSplitRule(raw: unknown): SplitRule {
  const r = obj(raw);
  return {
    id: int(r.id),
    name: String(r.name ?? ''),
    description: str(r.description),
    basis: (r.basis ?? 'EQUAL') as SplitRule['basis'],
    amountSource: (r.amountSource ?? 'FIXED') as SplitRule['amountSource'],
    fixedAmountPaise: num(r.fixedAmountPaise),
    scopeType: (r.scopeType ?? 'ALL_UNITS') as SplitRule['scopeType'],
    scopeValues: scopeValues(r.scopeValues),
    weights: numberMap(r.weights) ?? {},
    status: r.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    version: int(r.version, 1),
  };
}

export function normalisePolicy(raw: unknown): LateFeePolicy {
  const r = obj(raw);
  return {
    id: int(r.id),
    policyType: (r.policyType ?? 'NONE') as LateFeePolicy['policyType'],
    interestRatePct: decimal4(r.interestRatePct),
    interestFrom: (str(r.interestFrom) as LateFeePolicy['interestFrom']) ?? null,
    flatFeePaise: num(r.flatFeePaise),
    graceDays: int(r.graceDays),
    minChargePaise: int(r.minChargePaise, 100),
    effectiveFrom: String(r.effectiveFrom ?? '').slice(0, 10),
    status: (r.status ?? 'PENDING_APPROVAL') as LateFeePolicy['status'],
    reason: String(r.reason ?? ''),
    resolutionRef: str(r.resolutionRef),
    approvalRequestId: num(r.approvalRequestId),
    approvedAt: str(r.approvedAt),
    rejectedReason: str(r.rejectedReason),
  };
}

/** `POST /billing/rules/simulate` answers `{ items: [...] }` (spec 8.2). */
export function normaliseSimulation(raw: unknown): SimulateItem[] {
  const r = obj(raw);
  const items = Array.isArray(raw) ? raw : Array.isArray(r.items) ? r.items : [];
  return items.map(i => {
    const o = obj(i);
    return {
      unitId: int(o.unitId),
      unitLabel: String(o.unitLabel ?? o.unitId ?? ''),
      amountPaise: num(o.amountPaise),
      exceptionCode: str(o.exceptionCode),
    };
  });
}
