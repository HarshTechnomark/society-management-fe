/** Response mapping for the module 14 calls: one place that reconciles backend shapes. */
import type {
  ApprovalAction,
  ApprovalCounts,
  ApprovalDetail,
  ApprovalFact,
  ApprovalList,
  ApprovalRow,
  ApprovalStatus,
  ApprovalStep,
  ApprovalTypeInfo,
  BulkResult,
  DecisionResult,
  MyAction,
  ResidentRequest,
} from '@/types/approvals';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const status = (v: unknown): ApprovalStatus => str(v, 'PENDING') as ApprovalStatus;

export function mapRow(raw: unknown): ApprovalRow {
  const r = obj(raw);
  const my = obj(r.myAction);
  const onBehalf = obj(my.onBehalfOf);
  return {
    id: num(r.id),
    type: str(r.type),
    typeLabel: str(r.typeLabel),
    title: str(r.title),
    summary: str(r.summary),
    amountPaise: numOrNull(r.amountPaise),
    status: status(r.status),
    currentStepNo: num(r.currentStepNo, 1),
    totalSteps: num(r.totalSteps, 1),
    currentStepName: strOrNull(r.currentStepName),
    approvalsNeeded: num(r.approvalsNeeded, 1),
    approvalsGiven: num(r.approvalsGiven),
    requesterName: str(obj(r.requester).name, str(r.requestedByName)),
    requesterId: numOrNull(obj(r.requester).userId),
    decidedByName: strOrNull(obj(r.decidedBy).name) ?? strOrNull(r.decidedByName),
    decidedAt: strOrNull(r.decidedAt),
    decisionComment: strOrNull(r.decisionComment) ?? strOrNull(r.decisionReason),
    createdAt: str(r.createdAt),
    dueAt: strOrNull(r.dueAt),
    isOverdue: r.isOverdue === true,
    stepUpRequired: r.stepUpRequired === true,
    bulkEligible: r.bulkEligible === true,
    stuck: r.stuckAt != null || r.hasEligibleApprover === false,
    canAct: my.canAct === true,
    onBehalfOfName: strOrNull(onBehalf.name),
    reason: strOrNull(my.reason),
    version: num(r.version, 1),
  };
}

export function mapList(rows: unknown[], pagination: unknown, meta?: unknown): ApprovalList {
  const p = obj(pagination);
  return {
    items: rows.map(mapRow),
    total: num(p.total, rows.length),
    totalPages: Math.max(1, num(p.totalPages, 1)),
    truncated: obj(meta).truncated === true,
  };
}

export function mapCounts(raw: unknown): ApprovalCounts {
  const r = obj(raw);
  const by: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(r.forMeByType))) by[k] = num(v);
  return {
    forMe: num(r.forMe),
    forMeByType: by,
    overdueForMe: num(r.overdueForMe),
    allPending: num(r.allPending),
    submittedOpen: num(r.submittedOpen),
    stuck: num(r.stuck),
  };
}

export function mapTypes(raw: unknown): ApprovalTypeInfo[] {
  const list = Array.isArray(raw) ? raw : arr(obj(raw).types);
  return list.map(x => {
    const r = obj(x);
    return {
      type: str(r.type),
      label: str(r.label),
      isMoney: r.isMoney === true,
      allowBulk: r.allowBulk === true,
      allowsChanges: r.allowsChanges === true,
      cancellable: r.cancellable === true,
      residentVisible: r.residentVisible === true,
    };
  });
}

export function mapAction(raw: unknown): ApprovalAction {
  const r = obj(raw);
  return {
    action: str(r.action),
    actorName: strOrNull(r.actorName),
    onBehalfOfName: strOrNull(r.onBehalfOfName),
    actorRoleKey: strOrNull(r.actorRoleKey),
    stepNo: numOrNull(r.stepNo),
    comment: strOrNull(r.comment),
    at: str(r.at),
  };
}

function mapStep(raw: unknown): ApprovalStep {
  const r = obj(raw);
  const mode = str(r.mode, 'ANY_OF');
  const seats = arr(r.slots).length;
  // The API sends `requiredCount: null` for ANY_OF (one) and ALL_OF (every seat).
  const required =
    r.requiredCount != null ? num(r.requiredCount, 1) : mode === 'ALL_OF' ? Math.max(1, seats) : 1;
  return {
    stepNo: num(r.stepNo, 1),
    name: str(r.name),
    mode,
    requiredCount: required,
    approvalsGiven: num(r.approvalsGiven),
    approvedBy: arr(r.approvedBy).map(x => str(x)),
    slots: arr(r.slots).map(s => ({
      type: str(obj(s).type),
      ref: str(obj(s).ref),
      label: str(obj(s).label),
    })),
    state: str(r.state, 'UPCOMING'),
  };
}

function mapMy(raw: unknown): MyAction {
  const r = obj(raw);
  return {
    canApprove: r.canApprove === true,
    canReject: r.canReject === true,
    canRequestChanges: r.canRequestChanges === true,
    canCancel: r.canCancel === true,
    onBehalfOptions: arr(r.onBehalfOptions).map(o => ({
      userId: num(obj(o).userId),
      name: str(obj(o).name),
    })),
    reason: strOrNull(r.reason),
  };
}

export function mapDetail(raw: unknown): ApprovalDetail {
  const r = obj(raw);
  const d = obj(r.description);
  const facts: ApprovalFact[] = arr(d.facts).map(f => ({
    label: str(obj(f).label),
    value: str(obj(f).value),
    kind: str(obj(f).kind, 'text'),
  }));
  return {
    id: num(r.id),
    type: str(r.type),
    typeLabel: str(r.typeLabel),
    entityType: str(r.entityType),
    entityId: num(r.entityId),
    title: str(r.title),
    summary: str(r.summary),
    amountPaise: numOrNull(r.amountPaise),
    status: status(r.status),
    round: num(r.round, 1),
    ruleName: strOrNull(r.ruleName),
    requesterId: numOrNull(obj(r.requester).userId) ?? numOrNull(r.requesterUserId),
    steps: arr(r.steps).map(mapStep),
    facts,
    link: strOrNull(d.link),
    actions: arr(r.actions).map(mapAction),
    dueAt: strOrNull(r.dueAt),
    stepUpRequired: r.stepUpRequired === true,
    stepUpAbovePaise: numOrNull(r.stepUpAbovePaise),
    myAction: mapMy(r.myAction),
    version: num(r.version, 1),
  };
}

export function mapDecision(raw: unknown, message = ''): DecisionResult {
  const r = obj(raw);
  return {
    id: num(r.id),
    status: status(r.status),
    stepCompleted: r.stepCompleted === true,
    version: num(r.version, 1),
    message,
  };
}

export function mapBulk(raw: unknown, message = ''): BulkResult {
  const r = obj(raw);
  const results = arr(r.results).map(x => {
    const i = obj(x);
    return {
      id: num(i.id),
      ok: i.ok === true,
      status: i.status ? status(i.status) : null,
      code: strOrNull(i.code),
      message: strOrNull(i.message),
    };
  });
  return {
    approved: num(r.approved, results.filter(i => i.ok).length),
    skipped: num(r.skipped, results.filter(i => !i.ok).length),
    results,
    message,
  };
}

export function mapResidentRequest(raw: unknown): ResidentRequest {
  const r = obj(raw);
  return {
    id: num(r.id),
    type: str(r.type),
    typeLabel: str(r.typeLabel),
    title: str(r.title),
    status: status(r.status),
    statusLabel: str(r.statusLabel),
    submittedAt: str(r.submittedAt),
    decidedAt: strOrNull(r.decidedAt),
    reason: strOrNull(r.reason),
    timeline: arr(r.timeline).map(t => ({ label: str(obj(t).label), at: str(obj(t).at) })),
    canCancel: r.canCancel === true,
    version: num(r.version, 1),
  };
}
