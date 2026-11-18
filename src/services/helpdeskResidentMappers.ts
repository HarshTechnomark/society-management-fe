/** Response mapping for the module 15 resident and field calls. */
import type {
  BuildingIssueRow,
  IssueReported,
  QrLocation,
  ResidentTicket,
  TicketCategory,
  TicketComment,
  TicketList,
  TransparencyMonth,
  UpvoteResult,
} from '@/types/helpdeskResident';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : arr(obj(v).items));
const ids = (v: unknown): number[] =>
  arr(v)
    .map(x => num(x))
    .filter(n => n > 0);

export function mapCategory(raw: unknown): TicketCategory {
  const r = obj(raw);
  return {
    id: num(r.id),
    name: str(r.name),
    icon: strOrNull(r.icon),
    isChargeable: r.isChargeable === true,
    requiresAfterPhoto: r.requiresAfterPhoto === true,
    linksInvoice: r.linksInvoice === true,
    children: arr(r.children).map(mapCategory),
  };
}
export const mapCategories = (raw: unknown): TicketCategory[] => rows(raw).map(mapCategory);

export function mapComment(raw: unknown): TicketComment {
  const r = obj(raw);
  return {
    id: num(r.id),
    kind: str(r.kind, 'COMMENT'),
    authorLabel: str(r.authorLabel),
    authorRole: str(r.authorRole),
    body: str(r.body),
    fromStatus: strOrNull(r.fromStatus),
    toStatus: strOrNull(r.toStatus),
    fileIds: ids(r.fileIds),
    createdAt: str(r.createdAt),
  };
}

export function mapTicket(raw: unknown): ResidentTicket {
  const r = obj(raw);
  const assignment = obj(r.assignment);
  const sla = obj(r.sla);
  const charge = r.charge ? obj(r.charge) : null;
  const csat = obj(r.csat);
  const comments = (Array.isArray(r.recentComments) ? r.recentComments : arr(r.comments)).map(mapComment);
  return {
    id: num(r.id),
    ticketNo: str(r.ticketNo),
    kind: r.kind === 'BUILDING' ? 'BUILDING' : 'PERSONAL',
    title: str(r.title),
    description: str(r.description),
    status: str(r.status),
    waitingReason: strOrNull(r.waitingReason),
    priority: str(r.priority),
    categoryName: str(r.categoryName ?? obj(r.category).name),
    locationLabel: strOrNull(r.locationLabel ?? obj(r.location).pathLabel),
    unitLabel: strOrNull(r.unitLabel ?? obj(r.unit).label),
    affectedLevel: strOrNull(r.affectedLevel),
    affectedUnitCount: num(r.affectedUnitCount),
    upvoteCount: num(r.upvoteCount),
    iUpvoted: r.iUpvoted === true,
    myRelation: strOrNull(r.myRelation),
    reporterLabel: strOrNull(r.reporterLabel),
    assigneeLabel: strOrNull(r.assigneeLabel ?? assignment.assigneeLabel),
    slaState: strOrNull(r.slaState ?? sla.slaState),
    resolutionDueAt: strOrNull(r.resolutionDueAt ?? sla.resolutionDueAt),
    fileIds: ids(r.fileIds),
    comments,
    allowedActions: arr(r.allowedActions).map(a => str(a).toUpperCase()),
    canDecideEstimate: typeof r.canDecideEstimate === 'boolean' ? r.canDecideEstimate : null,
    canRate: typeof r.canRate === 'boolean' ? r.canRate : null,
    charge: charge
      ? {
          status: str(charge.status),
          estimatePaise: num(charge.estimatePaise),
          estimateNote: strOrNull(charge.estimateNote),
        }
      : null,
    myRating: numOrNull(r.myRating ?? csat.myScore),
    version: num(r.version, 1),
    createdAt: str(r.createdAt),
    lastActivityAt: strOrNull(r.lastActivityAt),
    resolvedAt: strOrNull(r.resolvedAt),
    escalationRequestedAt: strOrNull(r.escalationRequestedAt),
  };
}

export function mapTicketList(data: unknown, pagination?: unknown): TicketList {
  const p = obj(pagination);
  const items = rows(data).map(mapTicket);
  return {
    items,
    total: num(p.total, items.length),
    page: num(p.page, 1),
    pages: num(p.totalPages ?? p.pages, 1),
  };
}

export function mapIssueRow(raw: unknown): BuildingIssueRow {
  const r = obj(raw);
  return {
    id: num(r.id),
    ticketNo: str(r.ticketNo),
    title: str(r.title),
    status: str(r.status),
    priority: str(r.priority),
    locationLabel: strOrNull(r.locationLabel),
    affectedLevel: strOrNull(r.affectedLevel),
    affectedUnitCount: num(r.affectedUnitCount),
    upvoteCount: num(r.upvoteCount),
    iUpvoted: r.iUpvoted === true,
    isRequester: r.isRequester === true,
    assigneeLabel: strOrNull(r.assigneeLabel),
    slaState: strOrNull(r.slaState),
    resolutionDueAt: strOrNull(r.resolutionDueAt),
    createdAt: str(r.createdAt),
  };
}
export const mapIssueRows = (raw: unknown): BuildingIssueRow[] => rows(raw).map(mapIssueRow);

export function mapQr(raw: unknown): QrLocation {
  const r = obj(raw);
  const l = obj(r.location);
  return {
    location: {
      id: num(l.id),
      pathLabel: str(l.pathLabel),
      nodeType: str(l.nodeType),
      areaType: strOrNull(l.areaType),
    },
    suggestedAffectedLevel: strOrNull(r.suggestedAffectedLevel),
    suggestedCategoryIds: ids(r.suggestedCategoryIds),
    openIssuesHere: arr(r.openIssuesHere).map(mapIssueRow),
  };
}

export function mapTransparency(raw: unknown): TransparencyMonth[] {
  return arr(obj(raw).months ?? raw).map(m => {
    const r = obj(m);
    return {
      month: str(r.month),
      buildingIssuesRaised: num(r.buildingIssuesRaised),
      resolved: num(r.resolved),
      medianResolutionHours: numOrNull(r.medianResolutionHours),
      resolutionMetPct: numOrNull(r.resolutionMetPct),
    };
  });
}

export function mapReported(raw: unknown, message = ''): IssueReported {
  const r = obj(raw);
  return {
    id: num(r.id),
    ticketNo: str(r.ticketNo),
    status: str(r.status),
    priority: str(r.priority),
    affectedUnitCount: num(r.affectedUnitCount),
    message,
  };
}

export function mapUpvote(raw: unknown): UpvoteResult {
  const r = obj(raw);
  return { ticketId: num(r.ticketId), upvoteCount: num(r.upvoteCount), iUpvoted: r.iUpvoted === true };
}
