'use client';
import { useMemo } from 'react';
import { useLoad } from '@/hooks/useLoad';
import { accessControlService } from '@/services/access-control.service';
import { helpdeskService } from '@/services/helpdesk.service';
import type { Assignees } from '@/types/helpdesk';

export interface RoleOption {
  key: string;
  name: string;
}

/** Roles that can be a default assignee or an escalation target: society and work scope (spec 8.2). */
export function useRoleOptions() {
  const load = useLoad(async () => {
    const [a, b] = await Promise.all([
      accessControlService.roles({ scope: 'society' }).catch(() => ({ data: [] })),
      accessControlService.roles({ scope: 'work' }).catch(() => ({ data: [] })),
    ]);
    const seen = new Set<string>();
    return [...a.data, ...b.data].flatMap<RoleOption>(r => {
      if (seen.has(r.key)) return [];
      seen.add(r.key);
      return [{ key: r.key, name: r.name }];
    });
  }, 'roles');
  return { roles: load.data ?? [], loading: load.loading };
}

/** Members, staff and vendors a default assignee can be (the same list the ticket assign box uses). */
export function usePeople() {
  const load = useLoad(() => helpdeskService.assignees().catch(() => null as Assignees | null), 'people');
  const empty: Assignees = useMemo(() => ({ members: [], staff: [], vendors: [] }), []);
  return { people: load.data ?? empty, loading: load.loading };
}
