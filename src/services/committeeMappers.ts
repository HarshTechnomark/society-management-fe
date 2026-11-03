/**
 * Normalisers from the module 10 backend response shapes (spec section 8) to the shapes the screens use
 * (types/committee.ts). All shape guessing lives here, so adjusting to the real backend is a change in one file.
 * Every normaliser tolerates missing optional fields and never throws.
 */
import type {
  ActivationResult,
  Banner,
  ChangeSummary,
  CommitteeOverview,
  CurrentSummary,
  Delegation,
  DraftSummary,
  Plan,
  PlanAction,
  PlanIssue,
  Seat,
  Term,
  TermListItem,
} from '@/types/committee';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const list = (v: unknown): R[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strN = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const numN = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d);
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export function normaliseSeat(raw: unknown): Seat {
  const s = obj(raw);
  return {
    seatId: str(s.seatId),
    userId: numN(s.userId),
    memberId: numN(s.memberId),
    name: str(s.name),
    designation: str(s.designation, 'MEMBER') as Seat['designation'],
    joinMode: str(s.joinMode, 'ELECTED') as Seat['joinMode'],
    unitId: numN(s.unitId),
    unitLabel: strN(s.unitLabel),
    portfolios: strs(s.portfolios) as Seat['portfolios'],
    mobile: strN(s.mobile),
    publicEmail: strN(s.publicEmail),
    photoFileId: numN(s.photoFileId),
    showOnResidentPage: bool(s.showOnResidentPage, true),
    status: str(s.status, 'PLANNED') as Seat['status'],
    fromDate: strN(s.fromDate),
    toDate: strN(s.toDate),
    roleKey: strN(s.roleKey),
    expectedRoleKey: strN(s.expectedRoleKey),
    roleBeforeKey: strN(s.roleBeforeKey),
    replaceExistingRole: bool(s.replaceExistingRole),
    exitReason: strN(s.exitReason) as Seat['exitReason'],
    exitNote: strN(s.exitNote),
    resolutionRef: strN(s.resolutionRef),
    flags: strs(s.flags) as Seat['flags'],
  };
}

export function normaliseTerm(raw: unknown): Term {
  const t = obj(raw);
  const h = obj(t.handover);
  return {
    id: num(t.id),
    name: str(t.name),
    kind: str(t.kind, 'ELECTED') as Term['kind'],
    source: str(t.source, 'MANUAL') as Term['source'],
    status: str(t.status, 'DRAFT') as Term['status'],
    startDate: str(t.startDate),
    endDate: str(t.endDate),
    actualEndDate: strN(t.actualEndDate),
    tookChargeOn: strN(t.tookChargeOn),
    strength: num(t.strength),
    resolutionRef: strN(t.resolutionRef),
    notes: strN(t.notes),
    predecessorTermId: numN(t.predecessorTermId),
    successorTermId: numN(t.successorTermId),
    electionId: numN(t.electionId),
    daysLeft: numN(t.daysLeft),
    isOverdue: bool(t.isOverdue),
    seats: list(t.seats).map(normaliseSeat),
    handover: {
      total: num(h.total),
      done: num(h.done),
      notApplicable: num(h.notApplicable),
      completedAt: strN(h.completedAt),
    },
    version: num(t.version, 1),
  };
}

export function normaliseListItem(raw: unknown): TermListItem {
  const t = obj(raw);
  return {
    id: num(t.id),
    name: str(t.name),
    kind: str(t.kind, 'ELECTED') as TermListItem['kind'],
    source: str(t.source, 'MANUAL') as TermListItem['source'],
    status: str(t.status, 'ENDED') as TermListItem['status'],
    startDate: str(t.startDate),
    endDate: str(t.endDate),
    actualEndDate: strN(t.actualEndDate),
    tookChargeOn: strN(t.tookChargeOn),
    strength: num(t.strength),
    seatedCount: num(t.seatedCount),
    officeBearers: list(t.officeBearers).map(o => ({
      designation: str(o.designation, 'MEMBER') as TermListItem['officeBearers'][number]['designation'],
      name: str(o.name),
    })),
    electionId: numN(t.electionId),
    version: num(t.version, 1),
  };
}

function normaliseCurrent(raw: unknown): CurrentSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = obj(raw);
  const h = obj(c.handover);
  return {
    id: num(c.id),
    name: str(c.name),
    kind: str(c.kind, 'ELECTED') as CurrentSummary['kind'],
    source: str(c.source, 'MANUAL') as CurrentSummary['source'],
    status: str(c.status, 'ACTIVE') as CurrentSummary['status'],
    startDate: str(c.startDate),
    endDate: str(c.endDate),
    tookChargeOn: strN(c.tookChargeOn),
    daysLeft: numN(c.daysLeft),
    isOverdue: bool(c.isOverdue),
    strength: num(c.strength),
    seatedCount: num(c.seatedCount),
    vacancies: num(c.vacancies),
    vacantDesignations: strs(c.vacantDesignations) as CurrentSummary['vacantDesignations'],
    handover: { total: num(h.total), done: num(h.done), completedAt: strN(h.completedAt) },
    attentionCount: num(c.attentionCount),
    version: num(c.version, 1),
  };
}

function normaliseDraft(raw: unknown): DraftSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = obj(raw);
  return {
    id: num(d.id),
    name: str(d.name),
    kind: str(d.kind, 'ELECTED') as DraftSummary['kind'],
    source: str(d.source, 'MANUAL') as DraftSummary['source'],
    startDate: str(d.startDate),
    endDate: str(d.endDate),
    strength: num(d.strength),
    seatCount: num(d.seatCount ?? d.seatedCount ?? (Array.isArray(d.seats) ? d.seats.length : 0)),
    electionId: numN(d.electionId),
    version: num(d.version, 1),
  };
}

function normaliseBanner(raw: unknown): Banner | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = obj(raw);
  switch (b.code) {
    case 'TERM_ENDING':
      return { code: 'TERM_ENDING', daysLeft: num(b.daysLeft) };
    case 'CARETAKER':
      return { code: 'CARETAKER', endedOn: strN(b.endedOn) };
    case 'DRAFT_FROM_ELECTION':
      return { code: 'DRAFT_FROM_ELECTION', draftId: num(b.draftId), electionId: numN(b.electionId) };
    case 'NO_COMMITTEE':
      return { code: 'NO_COMMITTEE' };
    default:
      return null;
  }
}

export function normaliseOverview(raw: unknown): CommitteeOverview {
  const o = obj(raw);
  return {
    current: normaliseCurrent(o.current),
    draft: normaliseDraft(o.draft),
    banner: normaliseBanner(o.banner),
  };
}

const issue = (raw: unknown): PlanIssue => {
  const i = obj(raw);
  return {
    code: str(i.code),
    message: str(i.message),
    seatIds: strs(i.seatIds),
    userIds: Array.isArray(i.userIds) ? i.userIds.filter((x): x is number => typeof x === 'number') : [],
  };
};

function action(raw: unknown): PlanAction {
  const a = obj(raw);
  const base = { userId: num(a.userId), memberId: num(a.memberId), name: str(a.name) };
  if (a.kind === 'NONE')
    return {
      kind: 'NONE',
      ...base,
      roleKey: str(a.roleKey),
      reason: str(a.reason, 'CONTINUING') as 'CONTINUING',
    };
  if (a.kind === 'END_MEMBERSHIP')
    return {
      kind: 'END_MEMBERSHIP',
      ...base,
      step: str(a.step),
      fromRoleKey: str(a.fromRoleKey),
      seatDelta: num(a.seatDelta),
    };
  return {
    kind: 'CHANGE_ROLE',
    ...base,
    step: str(a.step),
    fromRoleKey: str(a.fromRoleKey),
    toRoleKey: str(a.toRoleKey),
    seatDelta: num(a.seatDelta),
    reason: str(a.reason, 'CONTINUING') as 'INCOMING',
  };
}

/** The activation preview (8.7) and the changes preview (8.9) share one shape. */
export function normalisePlan(raw: unknown): Plan {
  const p = obj(raw);
  const s = obj(p.staffSeats);
  return {
    termId: num(p.termId),
    termVersion: num(p.termVersion, 1),
    actions: list(p.actions).map(action),
    staffSeats: { limit: numN(s.limit), used: num(s.used), delta: num(s.delta) },
    handoverDelegations: list(p.handoverDelegations).map((d): Delegation => ({
      designation: str(d.designation),
      fromName: str(d.fromName),
      toName: str(d.toName),
      days: num(d.days, 30),
    })),
    warnings: list(p.warnings).map(issue),
    blockers: list(p.blockers).map(issue),
    previewHash: str(p.previewHash),
  };
}

/** `data.summary` of an activation or a change set (8.8, 8.9). */
export function normaliseSummary(raw: unknown): ChangeSummary {
  const s = obj(obj(raw).summary);
  return {
    roleChanges: num(s.roleChanges),
    membershipsEnded: num(s.membershipsEnded),
    handoverDelegationsCreated: num(s.handoverDelegationsCreated),
    handoverDelegationsSkipped: Array.isArray(s.handoverDelegationsSkipped)
      ? s.handoverDelegationsSkipped.map(String)
      : [],
  };
}

/** The response of `POST .../activate` (8.8). */
export function normaliseActivation(raw: unknown): ActivationResult {
  const r = obj(raw);
  const t = r.term && typeof r.term === 'object' ? obj(r.term) : null;
  const e = r.endedTerm && typeof r.endedTerm === 'object' ? obj(r.endedTerm) : null;
  return {
    term: t
      ? {
          id: num(t.id),
          status: str(t.status),
          tookChargeOn: strN(t.tookChargeOn),
          version: num(t.version, 1),
        }
      : null,
    endedTerm: e ? { id: num(e.id), status: str(e.status), actualEndDate: strN(e.actualEndDate) } : null,
    summary: normaliseSummary(r),
  };
}
