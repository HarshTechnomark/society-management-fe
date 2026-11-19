/** Response mapping for the module 16 emergency calls. Tolerant: a missing field becomes a neutral value. */
import type {
  ActiveEmergency,
  EmergencyCounts,
  EmergencyDetail,
  EmergencyListItem,
  EmergencyStatus,
  EmergencyType,
  NeedHelpItem,
  ResponseStatus,
  RollCall,
  RollCallStatus,
  RollCallUnit,
} from '@/types/communication';

type Obj = Record<string, unknown>;
export const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : arr(obj(v).items));

const TYPES: EmergencyType[] = [
  'FIRE',
  'GAS_LEAK',
  'WATER',
  'LIFT_STUCK',
  'SECURITY_THREAT',
  'MEDICAL',
  'POWER',
  'NATURAL_DISASTER',
  'OTHER',
];
const emType = (v: unknown): EmergencyType =>
  TYPES.includes(v as EmergencyType) ? (v as EmergencyType) : 'OTHER';
const STATUSES: EmergencyStatus[] = ['ACTIVE', 'RESOLVED', 'CANCELLED'];
const emStatus = (v: unknown): EmergencyStatus =>
  STATUSES.includes(v as EmergencyStatus) ? (v as EmergencyStatus) : 'ACTIVE';
const respStatus = (v: unknown): ResponseStatus | null => (v === 'SAFE' || v === 'NEED_HELP' ? v : null);

export function mapListItem(raw: unknown): EmergencyListItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    type: emType(r.type),
    title: str(r.title),
    status: emStatus(r.status),
    isDrill: r.isDrill === true,
    startedAt: str(r.startedAt),
    recipientCount: num(r.recipientCount),
    unitCount: num(r.unitCount),
    safeCount: num(r.safeCount),
    helpCount: num(r.helpCount),
    version: num(r.version, 1),
  };
}

function mapCounts(raw: unknown, base: EmergencyListItem): EmergencyCounts {
  const c = obj(raw);
  const units = c.units == null ? base.unitCount : num(c.units);
  const safe = c.safe == null ? base.safeCount : num(c.safe);
  const needHelp = c.needHelp == null ? base.helpCount : num(c.needHelp);
  return {
    units,
    safe,
    needHelp,
    noResponse: c.noResponse == null ? Math.max(0, units - safe - needHelp) : num(c.noResponse),
    peopleSafe: num(c.peopleSafe),
  };
}

function mapNeedHelp(raw: unknown): NeedHelpItem {
  const r = obj(raw);
  const by = r.attendedBy;
  return {
    responseId: num(r.responseId ?? r.id),
    unitLabel: str(r.unitLabel),
    note: strOrNull(r.note),
    peopleCount: num(r.peopleCount, 1),
    at: str(r.at ?? r.respondedAt),
    attendedBy: by && typeof by === 'object' ? strOrNull(obj(by).name) : strOrNull(by),
  };
}

export function mapDetail(raw: unknown): EmergencyDetail {
  const r = obj(raw);
  const base = mapListItem(r);
  const aud = obj(r.audience);
  const audType = str(aud.type ?? r.audienceType, 'ALL');
  return {
    ...base,
    message: str(r.message),
    collectResponses: r.collectResponses !== false,
    includeStaff: r.includeStaff !== false,
    audienceType: audType === 'BUILDINGS' ? 'BUILDINGS' : 'ALL',
    audienceBuildingIds: arr(aud.ids ?? r.audienceBuildingIds).map(x => num(x)),
    updateCount: num(r.updateCount),
    lastUpdateMessage: strOrNull(r.lastUpdateMessage),
    lastUpdateAt: strOrNull(r.lastUpdateAt),
    lastRealertAt: strOrNull(r.lastRealertAt),
    resolvedAt: strOrNull(r.resolvedAt),
    allClearMessage: strOrNull(r.allClearMessage),
    cancelledAt: strOrNull(r.cancelledAt),
    cancelReason: strOrNull(r.cancelReason),
    startedByName: strOrNull(r.startedByName ?? obj(r.startedBy).name),
    counts: mapCounts(r.counts, base),
    needHelp: arr(r.needHelp).map(mapNeedHelp),
    updates: arr(r.updates).map(u => {
      const x = obj(u);
      return {
        message: str(x.message),
        at: str(x.at ?? x.createdAt),
        byName: strOrNull(x.byName ?? obj(x.by).name),
      };
    }),
  };
}

const rollStatus = (v: unknown): RollCallStatus => (v === 'SAFE' || v === 'NEED_HELP' ? v : 'NO_RESPONSE');

function mapUnit(raw: unknown): RollCallUnit {
  const r = obj(raw);
  return {
    unitId: num(r.unitId),
    unitLabel: str(r.unitLabel),
    buildingCode: str(r.buildingCode),
    floor: numOrNull(r.floor),
    status: rollStatus(r.status),
    peopleCount: numOrNull(r.peopleCount),
    note: strOrNull(r.note),
    respondedAt: strOrNull(r.respondedAt),
    channel: strOrNull(r.channel),
    contacts: arr(r.contacts).map(c => ({ name: str(obj(c).name), mobile: str(obj(c).mobile) })),
  };
}

/** `data` is the list of units (or `{ items }`); `byFloor` sits beside the list (`extra`) or inside `data`. */
export function mapRollCall(
  data: unknown,
  extra: unknown,
  pagination?: { total?: number; totalPages?: number },
): RollCall {
  const d = obj(data);
  const e = obj(extra);
  const floors = arr(e.byFloor ?? d.byFloor);
  return {
    items: rows(data).map(mapUnit),
    byFloor: floors.map(f => {
      const x = obj(f);
      return {
        buildingCode: str(x.buildingCode),
        floor: numOrNull(x.floor),
        units: num(x.units),
        safe: num(x.safe),
        needHelp: num(x.needHelp),
      };
    }),
    total: num(pagination?.total, rows(data).length),
    pages: num(pagination?.totalPages, 1),
  };
}

export function mapActive(raw: unknown): ActiveEmergency {
  const r = obj(raw);
  return {
    id: num(r.id),
    type: emType(r.type),
    title: str(r.title),
    message: str(r.message),
    isDrill: r.isDrill === true,
    startedAt: str(r.startedAt),
    collectResponses: r.collectResponses !== false,
    lastUpdateMessage: strOrNull(r.lastUpdateMessage),
    version: `${str(r.version ?? r.updateCount)}|${str(r.lastRealertAt)}|${str(r.lastUpdateAt)}|${str(r.lastUpdateMessage)}`,
    myUnits: arr(r.myUnits).map(u => ({
      unitId: num(obj(u).unitId),
      label: str(obj(u).label),
      response: respStatus(obj(u).response),
    })),
    myResponse: respStatus(r.myResponse),
  };
}
export const mapActiveList = (raw: unknown): ActiveEmergency[] => rows(raw).map(mapActive);
