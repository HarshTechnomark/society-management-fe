'use client';
import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { useLoad } from '@/hooks/useLoad';
import { accessControlService } from '@/services/access-control.service';
import { committeeService } from '@/services/committee.service';

export interface RoleOption {
  key: string;
  name: string;
}
export interface MemberOption {
  userId: number;
  name: string;
  designation: string;
}

/** Society-scope roles (their keys are what the rules store). */
export function useRoles() {
  const load = useLoad(
    () =>
      accessControlService
        .roles({ scope: 'society' })
        .then(r =>
          r.data.filter(x => x.scope === 'society').map<RoleOption>(x => ({ key: x.key, name: x.name })),
        )
        .catch(() => [] as RoleOption[]),
    'roles',
  );
  const names = useMemo(() => Object.fromEntries((load.data ?? []).map(r => [r.key, r.name])), [load.data]);
  return { roles: load.data ?? [], names, loading: load.loading };
}

/** Office-bearers who can be named in a step, simulated as requester or given a delegation. */
export function useMembers() {
  const load = useLoad(async () => {
    const overview = await committeeService.overview();
    if (!overview.current) return [] as MemberOption[];
    const term = await committeeService.term(overview.current.id);
    const seen = new Set<number>();
    return term.seats.flatMap<MemberOption>(s => {
      if (s.userId == null || seen.has(s.userId)) return [];
      seen.add(s.userId);
      return [{ userId: s.userId, name: s.name, designation: s.designation }];
    });
  }, 'members');
  return { members: load.data ?? [], loading: load.loading };
}

/** A group of role check boxes; keeps the chosen keys in the order of the role list. */
export function RoleChecks({
  legend,
  roles,
  value,
  onChange,
  disabled,
  error,
}: {
  legend: string;
  roles: RoleOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  error?: string;
}) {
  // A key the list does not know (an old role) is still shown, so saving does not drop it silently.
  const all = [...roles, ...value.filter(v => !roles.some(r => r.key === v)).map(k => ({ key: k, name: k }))];
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1 text-[13px] font-semibold text-ink">{legend}</legend>
      <div className="grid gap-x-4 sm:grid-cols-2">
        {all.map(r => (
          <Checkbox
            key={r.key}
            className="!mb-1.5"
            label={r.name}
            checked={value.includes(r.key)}
            onChange={e => onChange(e.target.checked ? [...value, r.key] : value.filter(k => k !== r.key))}
          />
        ))}
      </div>
      {error && <p className="mt-1 text-[12.5px] font-medium text-bad">{error}</p>}
    </fieldset>
  );
}
