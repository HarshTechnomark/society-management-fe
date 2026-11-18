/** Response mapping for Settings > Helpdesk (spec 8.1 to 8.6). */
import type {
  Calendar,
  Category,
  EscalationRule,
  HelpdeskSettings,
  Priority,
  SlaPolicy,
} from '@/types/helpdesk';
import { arr, num, numOrNull, obj, str, strOrNull } from './helpdeskMappers';

export function mapCategory(raw: unknown): Category {
  const c = obj(raw);
  return {
    id: num(c.id),
    name: str(c.name),
    scope: str(c.scope, 'BOTH') as Category['scope'],
    icon: strOrNull(c.icon),
    defaultPriority: (strOrNull(c.defaultPriority) as Priority | null) ?? null,
    slaPolicyId: numOrNull(c.slaPolicyId),
    defaultAssigneeType: str(c.defaultAssigneeType, 'NONE') as Category['defaultAssigneeType'],
    defaultRoleKey: strOrNull(c.defaultRoleKey),
    defaultAssigneeUserId: numOrNull(c.defaultAssigneeUserId),
    defaultStaffId: numOrNull(c.defaultStaffId),
    defaultVendorId: numOrNull(c.defaultVendorId),
    isChargeable: c.isChargeable === true,
    requiresAfterPhoto: c.requiresAfterPhoto === true,
    isSafety: c.isSafety === true,
    linksInvoice: c.linksInvoice === true,
    sortOrder: num(c.sortOrder),
    status: c.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    version: num(c.version, 1),
    children: arr(c.children).map(mapCategory),
  };
}
export const mapCategories = (raw: unknown): Category[] => arr(raw).map(mapCategory);

const cal = (v: unknown): Calendar => (v === 'BUSINESS_HOURS' ? 'BUSINESS_HOURS' : 'TWENTY_FOUR_SEVEN');

export function mapPolicy(raw: unknown): SlaPolicy {
  const p = obj(raw);
  return {
    id: num(p.id),
    name: str(p.name),
    description: strOrNull(p.description),
    isDefault: p.isDefault === true,
    status: p.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    p1ResponseMinutes: num(p.p1ResponseMinutes),
    p1ResolutionMinutes: num(p.p1ResolutionMinutes),
    p2ResponseMinutes: num(p.p2ResponseMinutes),
    p2ResolutionMinutes: num(p.p2ResolutionMinutes),
    p3ResponseMinutes: num(p.p3ResponseMinutes),
    p3ResolutionMinutes: num(p.p3ResolutionMinutes),
    p4ResponseMinutes: num(p.p4ResponseMinutes),
    p4ResolutionMinutes: num(p.p4ResolutionMinutes),
    p2Calendar: cal(p.p2Calendar),
    p3Calendar: cal(p.p3Calendar),
    p4Calendar: cal(p.p4Calendar),
    version: num(p.version, 1),
  };
}
export const mapPolicies = (raw: unknown): SlaPolicy[] => arr(raw).map(mapPolicy);

export function mapRule(raw: unknown): EscalationRule {
  const r = obj(raw);
  return {
    id: num(r.id),
    name: str(r.name),
    triggerType: str(r.triggerType, 'RESOLUTION_SLA') as EscalationRule['triggerType'],
    thresholdPercent: numOrNull(r.thresholdPercent),
    level: num(r.level, 1),
    categoryId: numOrNull(r.categoryId),
    priority: (strOrNull(r.priority) as Priority | null) ?? null,
    targetType: str(r.targetType, 'ROLE') as EscalationRule['targetType'],
    targetRoleKey: strOrNull(r.targetRoleKey),
    targetDesignation: strOrNull(r.targetDesignation),
    targetUserId: numOrNull(r.targetUserId),
    targetLabel: strOrNull(r.targetUserName ?? r.targetLabel),
    categoryName: strOrNull(r.categoryName),
    notifyAssignee: r.notifyAssignee === true,
    status: r.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    version: num(r.version, 1),
  };
}
export const mapRules = (raw: unknown): EscalationRule[] => arr(raw).map(mapRule);

/** The namespace comes back as an object keyed by setting key (`{ value, version }`) or as a list of `{ key, value, version }`. */
export function mapSettings(raw: unknown): HelpdeskSettings {
  const out: HelpdeskSettings = {};
  const put = (key: string, v: unknown) => {
    const o = obj(v);
    const has = 'value' in o;
    const value = has ? o.value : v;
    if (typeof value === 'number' || typeof value === 'boolean')
      out[key] = { key, value, version: num(o.version, 1) };
    else if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
      out[key] = { key, value: Number(value), version: num(o.version, 1) };
    else if (value === 'true' || value === 'false')
      out[key] = { key, value: value === 'true', version: num(o.version, 1) };
  };
  if (Array.isArray(raw)) for (const it of raw) put(str(obj(it).key), it);
  else for (const [k, v] of Object.entries(obj(obj(raw).settings ?? raw))) put(k, v);
  return out;
}
