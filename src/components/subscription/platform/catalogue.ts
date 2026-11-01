import { FEATURES, MODULE_NAMES, featureMeta } from '@/constants/features';
import type { CatalogueItem, EntitlementRow } from '@/types/subscriptions';

export interface KeyInfo {
  key: string;
  title: string;
  moduleNo: number;
  isAlwaysOn: boolean;
  isPlanned: boolean;
}

/**
 * Feature keys by key, from `GET /platform/entitlement-catalogue` when it loaded and from the mirror in
 * `constants/features.ts` otherwise (spec 2.3: the API is the source of truth).
 */
export function catalogueIndex(items?: CatalogueItem[] | null): Map<string, KeyInfo> {
  const out = new Map<string, KeyInfo>();
  if (items?.length) {
    for (const c of items)
      if (c.kind === 'FEATURE')
        out.set(c.key, {
          key: c.key,
          title: c.title,
          moduleNo: c.moduleNo ?? 0,
          isAlwaysOn: c.isAlwaysOn,
          isPlanned: c.catalogueStatus === 'PLANNED',
        });
    return out;
  }
  for (const f of FEATURES)
    out.set(f.key, {
      key: f.key,
      title: f.title,
      moduleNo: f.moduleNo,
      isAlwaysOn: f.minPlan === 'ALWAYS',
      isPlanned: f.minPlan === 'PLANNED',
    });
  return out;
}

/** Key details for an entitlement row, falling back to the row itself for keys the index does not know. */
export function infoFor(row: EntitlementRow, index: Map<string, KeyInfo>): KeyInfo {
  const known = index.get(row.entitlementKey);
  if (known) return known;
  const meta = featureMeta(row.entitlementKey);
  return {
    key: row.entitlementKey,
    title: meta?.title ?? row.entitlementKey,
    moduleNo: row.moduleNo ?? meta?.moduleNo ?? 0,
    isAlwaysOn: row.catalogueMinPlan === 'ALWAYS',
    isPlanned: row.catalogueMinPlan === 'PLANNED',
  };
}

export const moduleName = (n: number) => MODULE_NAMES[n] ?? `Module ${n}`;
export const moduleLabel = (n: number) => `${String(n).padStart(2, '0')} · ${moduleName(n)}`;
/** Modules that own feature keys (the "N of M" on plan cards). */
export const MODULE_COUNT = Object.keys(MODULE_NAMES).length;

export interface ModuleGroup {
  moduleNo: number;
  keys: KeyInfo[];
}

/** Feature rows grouped by owner module; PLANNED keys are left out (spec 2.3: hidden from the plan editor). */
export function groupByModule(rows: EntitlementRow[], index: Map<string, KeyInfo>): ModuleGroup[] {
  const groups = new Map<number, KeyInfo[]>();
  for (const r of rows) {
    if (r.kind !== 'FEATURE') continue;
    const info = infoFor(r, index);
    if (info.isPlanned) continue;
    const list = groups.get(info.moduleNo) ?? [];
    list.push(info);
    groups.set(info.moduleNo, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([moduleNo, keys]) => ({ moduleNo, keys: keys.sort((a, b) => a.title.localeCompare(b.title)) }));
}

export type Coverage = 'ALL' | 'SOME' | 'NONE';

/** Whether a module is fully, partly or not included, judged on its keys that can be switched. */
export function coverage(group: ModuleGroup, enabled: ReadonlySet<string>): Coverage {
  const optional = group.keys.filter(k => !k.isAlwaysOn);
  if (optional.length === 0) return 'ALL';
  const on = optional.filter(k => enabled.has(k.key)).length;
  return on === 0 ? 'NONE' : on === optional.length ? 'ALL' : 'SOME';
}

export const enabledKeys = (rows: EntitlementRow[]) =>
  new Set(rows.filter(r => r.kind === 'FEATURE' && r.isEnabled).map(r => r.entitlementKey));

export const limitOf = (rows: EntitlementRow[], key: string) =>
  rows.find(r => r.entitlementKey === key)?.limitValue ?? null;
