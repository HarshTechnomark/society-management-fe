/**
 * Response mapping for the module 16 admin notice calls (spec 8.1 to 8.16): the one place that reconciles backend
 * shapes. Assumptions: lists come as `data: []` plus `pagination`; money-free; dates are ISO strings; missing
 * optional blocks become null or empty arrays.
 */
import { arr, num, numOrNull, obj, str, strOrNull } from './helpdeskMappers';
import type {
  AudiencePreview,
  Notice,
  NoticeAction,
  NoticeAudience,
  NoticeAttachment,
  NoticeCategory,
  NoticeChannel,
  NoticeKind,
  NoticeList,
  NoticeListItem,
  NoticePriority,
  NoticeStatus,
  NoticeTemplate,
  ReceiptItem,
  Receipts,
  ReceiptSummary,
} from '@/types/notices';

export { arr, obj };

const ids = (v: unknown): number[] | null => (Array.isArray(v) ? v.map(x => num(x)) : null);

export function mapAction(raw: unknown): NoticeAction {
  const r = obj(raw);
  const t = obj(r.target);
  return {
    type: str(r.type, 'LINK') as NoticeAction['type'],
    refId: numOrNull(r.refId),
    url: strOrNull(r.url),
    label: str(r.label),
    target: r.target ? { title: str(t.title), status: str(t.status) } : null,
  };
}

export function mapAudience(raw: unknown, fallbackLabel = ''): NoticeAudience {
  const r = obj(raw);
  return {
    type: str(r.type, 'ALL') as NoticeAudience['type'],
    relation: str(r.relation, 'ANY') as NoticeAudience['relation'],
    ids: ids(r.ids),
    roleKeys: Array.isArray(r.roleKeys) ? r.roleKeys.map(x => str(x)) : null,
    label: str(r.label, fallbackLabel),
  };
}

const author = (v: unknown) => {
  const a = obj(v);
  return v ? { id: num(a.id), name: str(a.name) } : null;
};

export function mapListItem(raw: unknown): NoticeListItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    number: str(r.number),
    kind: str(r.kind, 'STANDARD') as NoticeKind,
    category: str(r.category, 'GENERAL') as NoticeCategory,
    priority: str(r.priority, 'NORMAL') as NoticePriority,
    title: str(r.title),
    excerpt: str(r.excerpt),
    status: str(r.status, 'DRAFT') as NoticeStatus,
    isPinned: r.isPinned === true,
    requiresAck: r.requiresAck === true,
    audienceLabel: str(r.audienceLabel),
    actions: arr(r.actions).map(mapAction),
    publishedAt: strOrNull(r.publishedAt),
    scheduledAt: strOrNull(r.scheduledAt),
    recipientCount: num(r.recipientCount),
    readCount: num(r.readCount),
    ackCount: num(r.ackCount),
    author: author(r.author),
    version: num(r.version, 1),
  };
}

export function mapList(rows: unknown, pagination?: { total?: number; totalPages?: number }): NoticeList {
  const items = arr(rows).map(mapListItem);
  return {
    items,
    total: pagination?.total ?? items.length,
    totalPages: Math.max(1, pagination?.totalPages ?? 1),
  };
}

const attachment = (v: unknown): NoticeAttachment => {
  const a = obj(v);
  return {
    fileId: num(a.fileId),
    name: str(a.name),
    sizeBytes: num(a.sizeBytes),
    status: str(a.status, 'CLEAN'),
  };
};

export function mapNotice(raw: unknown): Notice {
  const r = obj(raw);
  const ap = obj(r.approval);
  const u = obj(r.utility);
  const hasUtility = r.utility != null || r.utilityType != null;
  return {
    id: num(r.id),
    number: str(r.number),
    kind: str(r.kind, 'STANDARD') as NoticeKind,
    category: str(r.category, 'GENERAL') as NoticeCategory,
    priority: str(r.priority, 'NORMAL') as NoticePriority,
    title: str(r.title),
    body: str(r.body),
    locale: str(r.locale, 'en-IN'),
    status: str(r.status, 'DRAFT') as NoticeStatus,
    audience: mapAudience(r.audience, str(r.audienceLabel)),
    channels: arr(r.channels).map(c => str(c) as NoticeChannel),
    actions: arr(r.actions).map(mapAction),
    requiresAck: r.requiresAck === true,
    ackDueAt: strOrNull(r.ackDueAt),
    isPinned: r.isPinned === true,
    scheduledAt: strOrNull(r.scheduledAt),
    publishedAt: strOrNull(r.publishedAt),
    expiresAt: strOrNull(r.expiresAt),
    attachments: arr(r.attachments).map(attachment),
    approval: r.approval
      ? {
          requestId: num(ap.requestId),
          status: str(ap.status),
          statusLabel: str(ap.statusLabel, str(ap.status)),
        }
      : null,
    approvedBy: author(r.approvedBy),
    lastDecisionReason: strOrNull(r.lastDecisionReason),
    recalledReason: strOrNull(r.recalledReason),
    utility: hasUtility
      ? {
          type: str(u.type, str(r.utilityType)),
          startsAt: strOrNull(u.startsAt ?? r.outageStartsAt),
          endsAt: strOrNull(u.endsAt ?? r.outageEndsAt),
          restoredAt: strOrNull(u.restoredAt ?? r.restoredAt),
        }
      : null,
    revisionNo: num(r.revisionNo, 1),
    version: num(r.version, 1),
    author: author(r.author),
    createdAt: str(r.createdAt),
  };
}

export function mapPreview(raw: unknown): AudiencePreview {
  const r = obj(raw);
  return {
    units: num(r.units),
    people: num(r.people),
    withLogin: num(r.withLogin),
    withoutLogin: num(r.withoutLogin),
    withPush: num(r.withPush),
    sample: arr(r.sample).map(s => ({ unitId: num(obj(s).unitId), unitLabel: str(obj(s).unitLabel) })),
  };
}

export function mapTemplate(raw: unknown): NoticeTemplate {
  const r = obj(raw);
  return {
    key: str(r.key),
    locale: str(r.locale, 'en-IN'),
    title: str(r.title),
    body: str(r.body),
    category: str(r.category, 'GENERAL') as NoticeCategory,
    kind: str(r.kind, 'STANDARD') as NoticeKind,
    utilityType: strOrNull(r.utilityType),
  };
}

function mapSummary(raw: unknown): ReceiptSummary {
  const s = obj(raw);
  const ch: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(s.byChannel))) ch[k] = num(v);
  return {
    recipients: num(s.recipients),
    units: num(s.units),
    reached: num(s.reached),
    read: num(s.read),
    acknowledged: num(s.acknowledged),
    unitsAcknowledged: num(s.unitsAcknowledged),
    byBuilding: arr(s.byBuilding).map(b => ({
      buildingId: num(obj(b).buildingId),
      code: str(obj(b).code),
      units: num(obj(b).units),
      unitsRead: num(obj(b).unitsRead),
    })),
    byChannel: ch,
  };
}

function mapReceipt(raw: unknown): ReceiptItem {
  const r = obj(raw);
  return {
    receiptId: num(r.receiptId),
    unitId: numOrNull(r.unitId),
    unitLabel: str(r.unitLabel),
    name: str(r.name),
    relation: str(r.relation),
    mobile: str(r.mobile),
    reachedVia: strOrNull(r.reachedVia),
    firstReadAt: strOrNull(r.firstReadAt),
    acknowledgedAt: strOrNull(r.acknowledgedAt),
    remindersSent: num(r.remindersSent),
  };
}

/** `data` is `{ summary, items }`; the paging comes next to it. */
export function mapReceipts(raw: unknown, pagination?: { total?: number; totalPages?: number }): Receipts {
  const r = obj(raw);
  const items = arr(r.items).map(mapReceipt);
  return {
    summary: mapSummary(r.summary),
    items,
    total: pagination?.total ?? items.length,
    totalPages: Math.max(1, pagination?.totalPages ?? 1),
  };
}
