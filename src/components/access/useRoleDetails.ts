import { useEffect, useState } from 'react';
import { accessControlService } from '@/services/access-control.service';
import type { RoleDetail, RoleSummary } from '@/types/accessControl';

/** Loads `GET /roles/:id` for each role once (the list has no permission keys). Failed ones are left out. */
export function useRoleDetails(roles: RoleSummary[] | undefined): Map<number, RoleDetail> | null {
  const [map, setMap] = useState<Map<number, RoleDetail> | null>(null);
  const ids = roles?.map(r => r.id).join(',');
  useEffect(() => {
    if (!roles) return;
    let live = true;
    void Promise.all(roles.map(r => accessControlService.role(r.id).catch(() => null))).then(list => {
      if (live) setMap(new Map(list.filter((d): d is RoleDetail => !!d).map(d => [d.id, d])));
    });
    return () => {
      live = false;
    };
    // `ids` stands for the list; a new array with the same roles must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return map;
}

/**
 * Roles the caller may hand out (BR-03-5): every key of a society-scope role must be held by the caller.
 * Field roles (gate, work) are exempt. Roles of any other scope than society, gate and work never appear.
 * While details are still loading, every role is offered; the API has the last word.
 */
export function assignableRoles(
  roles: RoleSummary[],
  details: Map<number, RoleDetail> | null,
  held: ReadonlySet<string>,
): RoleSummary[] {
  return roles.filter(r => {
    if (r.scope !== 'society' && r.scope !== 'gate' && r.scope !== 'work') return false;
    if (r.scope !== 'society') return true;
    const d = details?.get(r.id);
    return !d || d.permissionKeys.every(k => held.has(k));
  });
}
