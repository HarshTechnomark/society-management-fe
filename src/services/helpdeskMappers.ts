/** Response mapping for the module 15 admin calls (spec 8.7 to 8.21): one place that reconciles backend shapes. */
import type {
  Assignees,
  CreatedTicket,
  Priority,
  SimilarTicket,
  SlaState,
  Ticket,
  TicketAction,
  TicketAssignment,
  TicketComment,
  TicketCounts,
  TicketKind,
  TicketList,
  TicketListItem,
  TicketSla,
  TicketStats,
  TicketStatus,
} from '@/types/helpdesk';

type Obj = Record<string, unknown>;
export const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
export const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
export const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
export const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

export function mapListItem(raw: unknown): TicketListItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    ticketNo: str(r.ticketNo),
    kind: str(r.kind, 'PERSONAL') as TicketKind,
    title: str(r.title),
    status: str(r.status, 'OPEN') as TicketStatus,
    priority: str(r.priority, 'P3') as Priority,
    categoryName: str(r.categoryName),
    locationLabel: str(r.locationLabel),
    affectedUnitCount: num(r.affectedUnitCount),
    upvoteCount: num(r.upvoteCount),
    assigneeLabel: strOrNull(r.assigneeLabel),
    assigneeInactive: r.assigneeInactive === true,
    slaState: str(r.slaState, 'NONE') as SlaState,
    resolutionDueAt: strOrNull(r.resolutionDueAt),
    createdAt: str(r.createdAt),
    lastActivityAt: str(r.lastActivityAt, str(r.createdAt)),
  };
}

export function mapCounts(raw: unknown): TicketCounts {
  const c = obj(raw);
  return {
    OPEN: num(c.OPEN),
    BUILDING: num(c.BUILDING),
    FLATS: num(c.FLATS),
    URGENT: num(c.URGENT),
    RESOLVED: num(c.RESOLVED),
    ALL: num(c.ALL),
  };
}

export function mapList(
  rows: unknown[],
  counts: unknown,
  pagination?: { total?: number; totalPages?: number },
): TicketList {
  return {
    items: rows.map(mapListItem),
    counts: mapCounts(counts),
    total: pagination?.total ?? rows.length,
    totalPages: Math.max(1, pagination?.totalPages ?? 1),
  };
}

const named = (v: unknown) => {
  const o = obj(v);
  return o.id == null ? null : { id: num(o.id), name: str(o.name) };
};

function mapAssignment(v: unknown): TicketAssignment | null {
  const a = obj(v);
  if (a.id == null && a.assigneeLabel == null) return null;
  return {
    id: num(a.id),
    assigneeType: str(a.assigneeType, 'MEMBER') as TicketAssignment['assigneeType'],
    assigneeLabel: str(a.assigneeLabel),
    externalMobile: strOrNull(a.externalMobile),
    workOrderId: numOrNull(a.workOrderId),
    assignedAt: str(a.assignedAt),
  };
}

function mapSla(v: unknown): TicketSla {
  const s = obj(v);
  return {
    policyId: numOrNull(s.policyId),
    calendar: str(s.calendar, 'TWENTY_FOUR_SEVEN'),
    responseDueAt: strOrNull(s.responseDueAt),
    resolutionDueAt: strOrNull(s.resolutionDueAt),
    firstResponseAt: strOrNull(s.firstResponseAt),
    pausedMinutes: num(s.pausedMinutes),
    responseBreached: s.responseBreached === true,
    resolutionBreached: s.resolutionBreached === true,
    escalationLevel: num(s.escalationLevel),
    slaState: str(s.slaState, 'NONE') as SlaState,
  };
}

export function mapComment(raw: unknown): TicketComment {
  const c = obj(raw);
  return {
    id: num(c.id),
    kind: str(c.kind, 'COMMENT'),
    visibility: c.visibility === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC',
    authorRole: str(c.authorRole),
    authorLabel: str(c.authorLabel),
    body: str(c.body),
    fromStatus: strOrNull(c.fromStatus),
    toStatus: strOrNull(c.toStatus),
    fileIds: arr(c.fileIds).map(x => num(x)),
    notifyAffected: c.notifyAffected === true,
    createdAt: str(c.createdAt),
    canDelete: c.canDelete === true,
    metadata: obj(c.metadata),
  };
}

export function mapSimilar(raw: unknown): SimilarTicket {
  const s = obj(raw);
  return {
    id: num(s.id),
    ticketNo: str(s.ticketNo),
    title: str(s.title),
    status: str(s.status),
    priority: str(s.priority, 'P3') as Priority,
    locationLabel: strOrNull(s.locationLabel),
    upvoteCount: num(s.upvoteCount),
    createdAt: str(s.createdAt),
  };
}

export function mapTicket(raw: unknown): Ticket {
  const t = obj(raw);
  const unit = obj(t.unit);
  const loc = obj(t.location);
  const charge = obj(t.charge);
  const slot = obj(t.preferredSlot);
  const sub = named(t.subCategory);
  return {
    id: num(t.id),
    ticketNo: str(t.ticketNo),
    kind: str(t.kind, 'PERSONAL') as TicketKind,
    title: str(t.title),
    description: str(t.description),
    status: str(t.status, 'OPEN') as TicketStatus,
    waitingReason: (strOrNull(t.waitingReason) as Ticket['waitingReason']) ?? null,
    priority: str(t.priority, 'P3') as Priority,
    category: named(t.category),
    subCategory: sub,
    unit: t.unit == null ? null : { id: num(unit.id), label: str(unit.label, str(unit.unitLabel)) },
    locationLabel: strOrNull(loc.pathLabel),
    affectedLevel: (strOrNull(t.affectedLevel) as Ticket['affectedLevel']) ?? null,
    affectedBuildingName: strOrNull(obj(t.affectedBuilding).name),
    affectedUnitCount: num(t.affectedUnitCount),
    channel: str(t.channel),
    requesterName: strOrNull(obj(t.requester).name),
    reporterRole: strOrNull(t.reporterRole),
    assignment: mapAssignment(t.assignment),
    sla: mapSla(t.sla),
    upvoteCount: num(t.upvoteCount),
    isRecurring: t.isRecurring === true,
    isChargeable: t.isChargeable === true || t.charge != null,
    mergedIntoTicketId: numOrNull(t.mergedIntoTicketId),
    mergedIntoTicketNo: strOrNull(t.mergedIntoTicketNo),
    reopenCount: num(t.reopenCount),
    charge:
      t.charge == null
        ? null
        : {
            status: str(charge.status, 'NONE'),
            estimatePaise: num(charge.estimatePaise),
            estimateNote: strOrNull(charge.estimateNote),
            finalPaise: num(charge.finalPaise),
            invoiceId: numOrNull(charge.invoiceId),
            decidedAt: strOrNull(charge.decidedAt),
          },
    invoiceId: numOrNull(t.invoiceId),
    preferredSlot: t.preferredSlot == null ? null : { from: str(slot.from), to: str(slot.to) },
    fileIds: arr(t.fileIds).map(x => num(x)),
    requiresAfterPhoto: t.requiresAfterPhoto === true,
    allowedActions: arr(t.allowedActions).map(a => str(a) as TicketAction),
    version: num(t.version, 1),
    createdAt: str(t.createdAt),
    lastActivityAt: str(t.lastActivityAt, str(t.createdAt)),
    comments: arr(t.recentComments).map(mapComment),
    similarOpen: arr(t.similarOpen).map(mapSimilar),
  };
}

export function mapCreated(raw: unknown): CreatedTicket {
  const t = obj(raw);
  return {
    id: num(t.id),
    ticketNo: str(t.ticketNo),
    kind: str(t.kind, 'PERSONAL') as TicketKind,
    affectedUnitCount: num(t.affectedUnitCount),
    similarOpenTicketIds: arr(t.similarOpenTicketIds).map(x => num(x)),
  };
}

export function mapStats(raw: unknown): TicketStats {
  const s = obj(raw);
  const p = obj(s.openByPriority);
  return {
    open: num(s.open),
    openByPriority: { P1: num(p.P1), P2: num(p.P2), P3: num(p.P3), P4: num(p.P4) },
    urgent: num(s.urgent),
    unassigned: num(s.unassigned),
    breachedOpen: num(s.breachedOpen),
    created: num(s.created),
    resolved: num(s.resolved),
    responseMetPct: numOrNull(s.responseMetPct),
    resolutionMetPct: numOrNull(s.resolutionMetPct),
    medianFirstResponseMinutes: numOrNull(s.medianFirstResponseMinutes),
    medianResolutionMinutes: numOrNull(s.medianResolutionMinutes),
    reopenRatePct: numOrNull(s.reopenRatePct),
    csatAvg: numOrNull(s.csatAvg),
    csatCount: num(s.csatCount),
  };
}

export function mapAssignees(raw: unknown): Assignees {
  const a = obj(raw);
  return {
    members: arr(a.members).map(m => {
      const o = obj(m);
      return {
        userId: num(o.userId),
        name: str(o.name),
        roleName: str(o.roleName, str(o.roleKey)),
        openCount: num(o.openCount),
      };
    }),
    staff: arr(a.staff).map(m => {
      const o = obj(m);
      return {
        staffId: num(o.staffId),
        name: str(o.name),
        category: str(o.category),
        openCount: num(o.openCount),
      };
    }),
    vendors: arr(a.vendors).map(m => {
      const o = obj(m);
      return { vendorId: num(o.vendorId), name: str(o.name), category: str(o.category) };
    }),
  };
}
