/** Response mapping for the rules, settings and delegation calls (spec 8.12 to 8.18). */
import type {
  ApprovalRule,
  ApprovalSettings,
  Delegation,
  DelegationDisplayStatus,
  RuleStep,
  RuleWarning,
  SimulationResult,
  StepMode,
} from '@/types/approvalsRules';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strs = (v: unknown): string[] => arr(v).map(x => str(x));
const strsOrNull = (v: unknown): string[] | null => (Array.isArray(v) ? strs(v) : null);

export function mapStep(raw: unknown, i = 0): RuleStep {
  const s = obj(raw);
  return {
    stepNo: num(s.stepNo, i + 1),
    name: str(s.name),
    mode: str(s.mode, 'ANY_OF') as StepMode,
    roleKeys: strs(s.roleKeys),
    userIds: arr(s.userIds).map(x => num(x)),
    requiredCount: numOrNull(s.requiredCount),
  };
}

export const mapWarnings = (v: unknown): RuleWarning[] =>
  arr(v).map(w => ({ code: str(obj(w).code), message: str(obj(w).message) }));

export function mapRule(raw: unknown): ApprovalRule {
  const r = obj(raw);
  return {
    id: num(r.id),
    type: str(r.type),
    name: str(r.name),
    description: r.description == null || r.description === '' ? null : str(r.description),
    priority: num(r.priority, 100),
    isActive: r.isActive !== false,
    isDefault: r.isDefault === true,
    minAmountPaise: num(r.minAmountPaise),
    maxAmountPaise: numOrNull(r.maxAmountPaise),
    categoryKeys: strsOrNull(r.categoryKeys),
    requesterRoleKeys: strsOrNull(r.requesterRoleKeys),
    action: r.action === 'AUTO_APPROVE' ? 'AUTO_APPROVE' : 'REQUIRE_APPROVAL',
    steps: arr(r.steps).map(mapStep),
    fallbackRoleKeys: strs(r.fallbackRoleKeys),
    slaHours: num(r.slaHours, 48),
    reminderEveryHours: num(r.reminderEveryHours, 24),
    escalateAfterHours: numOrNull(r.escalateAfterHours),
    escalationRoleKeys: strs(r.escalationRoleKeys),
    escalationCanApprove: r.escalationCanApprove === true,
    stepUpAbovePaise: numOrNull(r.stepUpAbovePaise),
    openRequests: num(r.openRequests),
    version: num(r.version, 1),
    updatedAt: str(r.updatedAt),
    warnings: mapWarnings(r.warnings),
  };
}

export const mapRules = (raw: unknown): ApprovalRule[] => arr(raw).map(mapRule);

export function mapSimulation(raw: unknown): SimulationResult {
  const r = obj(raw);
  return {
    matchedRuleId: numOrNull(r.matchedRuleId),
    ruleName: str(r.ruleName),
    routing: str(r.routing),
    stepUpRequired: r.stepUpRequired === true,
    steps: arr(r.steps).map((s, i) => {
      const o = obj(s);
      return {
        stepNo: num(o.stepNo, i + 1),
        name: str(o.name),
        mode: str(o.mode, 'ANY_OF') as StepMode,
        eligibleNow: arr(o.eligibleNow).map(p => ({
          userId: num(obj(p).userId),
          name: str(obj(p).name),
          roleKey: str(obj(p).roleKey),
          via: str(obj(p).via, 'ROLE'),
        })),
        vacantSlots: arr(o.vacantSlots).map(v =>
          typeof v === 'string' ? v : str(obj(v).label, str(obj(v).slotRef, str(obj(v).roleKey))),
        ),
      };
    }),
  };
}

export const mapSettings = (raw: unknown): ApprovalSettings => ({
  stepUpAbovePaise: num(obj(raw).stepUpAbovePaise, 2500000),
  bulkApproveBelowPaise: num(obj(raw).bulkApproveBelowPaise, 2500000),
});

export function mapDelegation(raw: unknown): Delegation {
  const d = obj(raw);
  return {
    id: num(d.id),
    delegatorUserId: num(obj(d.delegator).userId, num(d.delegatorUserId)),
    delegatorName: str(obj(d.delegator).name, str(d.delegatorName)),
    delegateUserId: num(obj(d.delegate).userId, num(d.delegateUserId)),
    delegateName: str(obj(d.delegate).name, str(d.delegateName)),
    source: str(d.source, 'OUT_OF_OFFICE'),
    types: strsOrNull(d.types),
    maxAmountPaise: numOrNull(d.maxAmountPaise),
    startsAt: str(d.startsAt),
    endsAt: str(d.endsAt),
    reason: str(d.reason),
    displayStatus: str(d.displayStatus, str(d.status, 'ACTIVE')) as DelegationDisplayStatus,
    version: num(d.version, 1),
  };
}
