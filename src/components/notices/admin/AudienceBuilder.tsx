'use client';
import { useEffect, useState } from 'react';
import { useLocations } from '@/components/helpdesk/admin/pickers';
import { FlatPicker, Segments } from '@/components/residents/common';
import { Chip } from '@/components/ui/Chip';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { useLoad } from '@/hooks/useLoad';
import { accessControlService } from '@/services/access-control.service';
import { noticesService } from '@/services/notices.service';
import { plural } from '@/lib/plural';
import type { AudienceInput, AudiencePreview, AudienceRelation, AudienceType } from '@/types/notices';
import { noticeError } from './format';

export interface AudienceState {
  type: AudienceType;
  relation: AudienceRelation;
  buildingIds: number[];
  units: { id: number; label: string }[];
  roleKeys: string[];
}
export const EMPTY_AUDIENCE: AudienceState = {
  type: 'ALL',
  relation: 'ANY',
  buildingIds: [],
  units: [],
  roleKeys: [],
};

/** The audience of the API body (spec 8.2); null while the chosen type still has nothing selected. */
export function audienceInput(a: AudienceState): AudienceInput | null {
  if (a.type === 'ALL') return { type: 'ALL', relation: a.relation };
  if (a.type === 'BUILDINGS')
    return a.buildingIds.length ? { type: 'BUILDINGS', relation: a.relation, ids: a.buildingIds } : null;
  if (a.type === 'UNITS')
    return a.units.length ? { type: 'UNITS', relation: a.relation, ids: a.units.map(u => u.id) } : null;
  return a.roleKeys.length ? { type: 'ROLES', relation: 'ANY', roleKeys: a.roleKeys } : null;
}

const TYPES: { key: AudienceType; label: string }[] = [
  { key: 'ALL', label: 'All residents' },
  { key: 'BUILDINGS', label: 'Towers' },
  { key: 'UNITS', label: 'Flats' },
  { key: 'ROLES', label: 'Committee and staff' },
];
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

/** Live count shown under the audience: "<n> flats will receive this." (spec 11.2). */
function usePreview(audience: AudienceInput | null) {
  const key = JSON.stringify(audience);
  const [state, setState] = useState<{ key: string; data: AudiencePreview | null; error: string | null }>({
    key: '',
    data: null,
    error: null,
  });
  useEffect(() => {
    if (!audience) return;
    let live = true;
    const t = setTimeout(() => {
      noticesService.audiencePreview(audience).then(
        data => live && setState({ key, data, error: null }),
        e => live && setState({ key, data: null, error: noticeError(e) }),
      );
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the serialised `audience`
  }, [key]);
  return audience && state.key === key ? state : { key, data: null, error: null };
}

export function AudienceBuilder({
  value,
  onChange,
  canTarget = true,
  onPreview,
  types,
  preview: showPreview = true,
}: {
  value: AudienceState;
  onChange: (next: AudienceState) => void;
  /** False below the `communication.audience_targeting` plan: only "All residents" is offered. */
  canTarget?: boolean;
  onPreview?: (p: AudiencePreview | null) => void;
  /** Which audience types to offer (surveys have no role audience). */
  types?: AudienceType[];
  /** False when the count call is not allowed for this screen (surveys). */
  preview?: boolean;
}) {
  const { buildings } = useLocations();
  const roles = useLoad(
    () =>
      value.type === 'ROLES'
        ? accessControlService
            .roles({ limit: 100 })
            .then(r => r.data.filter(x => x.scope === 'society' || x.scope === 'gate'))
        : Promise.resolve([]),
    value.type === 'ROLES' ? 'roles' : 'none',
  );
  const preview = usePreview(showPreview ? audienceInput(value) : null);
  useEffect(() => onPreview?.(preview.data), [preview.data, onPreview]);
  const set = (p: Partial<AudienceState>) => onChange({ ...value, ...p });
  const p = preview.data;
  return (
    <fieldset className="mb-4">
      <legend className="mb-1.5 text-[13px] font-semibold">Send to</legend>
      <Segments
        label="Audience"
        options={canTarget ? TYPES.filter(t => !types || types.includes(t.key)) : TYPES.slice(0, 1)}
        value={value.type}
        onChange={type => set({ type })}
      />
      {value.type !== 'ROLES' && canTarget && (
        <Select
          label="Who in those flats"
          value={value.relation}
          onChange={e => set({ relation: e.target.value as AudienceRelation })}
          options={[
            { value: 'ANY', label: 'Owners and tenants' },
            { value: 'OWNERS', label: 'Owners only' },
            { value: 'TENANTS', label: 'Tenants only' },
          ]}
        />
      )}
      {value.type === 'BUILDINGS' && (
        <div role="group" aria-label="Towers" className="mb-2">
          {buildings.map(b => (
            <Checkbox
              key={b.buildingId}
              label={b.name}
              className="!mb-1"
              checked={value.buildingIds.includes(b.buildingId)}
              onChange={() => set({ buildingIds: toggle(value.buildingIds, b.buildingId) })}
            />
          ))}
        </div>
      )}
      {value.type === 'UNITS' && (
        <div className="mb-2">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {value.units.map(u => (
              <Chip key={u.id} tone="info">
                {u.label}
                <button
                  type="button"
                  aria-label={`Remove ${u.label}`}
                  className="ml-1.5 font-bold"
                  onClick={() => set({ units: value.units.filter(x => x.id !== u.id) })}
                >
                  x
                </button>
              </Chip>
            ))}
          </div>
          <FlatPicker
            value={null}
            onChange={(id, label) => {
              if (id && !value.units.some(u => u.id === id)) set({ units: [...value.units, { id, label }] });
            }}
          />
        </div>
      )}
      {value.type === 'ROLES' && (
        <div role="group" aria-label="Roles" className="mb-2">
          {(roles.data ?? []).map(r => (
            <Checkbox
              key={r.key}
              label={r.name}
              className="!mb-1"
              checked={value.roleKeys.includes(r.key)}
              onChange={() => set({ roleKeys: toggle(value.roleKeys, r.key) })}
            />
          ))}
        </div>
      )}
      {p && (
        <p role="status" className="rounded-xl bg-[#d8ebf3] px-3 py-2 text-[13.5px] text-[#0a4a63]">
          {value.type === 'ROLES'
            ? `${plural(p.people, 'person', 'people')} will receive this.`
            : `${plural(p.units, 'flat')} will receive this.`}
          {value.type !== 'ROLES' &&
            ` ${plural(p.people, 'person', 'people')}, ${p.withoutLogin} without a login.`}
        </p>
      )}
      {preview.error && (
        <p role="alert" className="text-[12.5px] font-medium text-bad">
          {preview.error}
        </p>
      )}
    </fieldset>
  );
}
