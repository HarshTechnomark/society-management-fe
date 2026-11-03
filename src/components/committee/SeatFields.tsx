'use client';
import { useState } from 'react';
import { Avatar } from '@/components/access/Avatar';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { accessControlService } from '@/services/access-control.service';
import { residentsService } from '@/services/residents.service';
import type { Designation, Portfolio } from '@/types/committee';
import { DESIGNATION_LABEL, JOIN_LABEL, PORTFOLIO_LABEL, opts, roleLabel } from './format';
import { needsReplaceChoice, type SeatJoin, type SeatRow } from './termForm';
import { PORTFOLIOS } from '@/types/committee';

interface Candidate {
  userId: number;
  name: string;
  roleKey: string;
  roleName: string;
  flat: string | null;
  mobile: string | null;
  status: string;
}

/** Search the society's members by name or the last digits of the mobile and pick one holder. */
function HolderPicker({
  row,
  error,
  onPick,
}: {
  row: SeatRow;
  error?: string;
  onPick: (c: Candidate) => void;
}) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Candidate[] | null>(null);
  const search = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setFound(null);
      return;
    }
    try {
      const r = await accessControlService.members({ search: text.trim(), limit: 8 });
      setFound(
        r.data.map(m => ({
          userId: m.userId,
          name: m.name,
          roleKey: m.role.key,
          roleName: m.role.name,
          flat: m.locationLabel,
          mobile: m.mobile,
          status: m.status,
        })),
      );
    } catch {
      setFound([]);
    }
  };
  return (
    <div>
      {row.userId ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-[14px]">
          <Avatar name={row.name} />
          <span className="font-semibold">{row.name}</span>
          {row.roleName && <span className="text-muted">Now: {row.roleName}</span>}
        </p>
      ) : null}
      <Input
        label={row.userId ? 'Change person' : 'Person'}
        type="search"
        value={q}
        onChange={e => void search(e.target.value)}
        error={error}
        hint="Type a name or the last 4 digits of the mobile."
      />
      {found && (
        <ul className="mb-3 divide-y divide-[var(--line)] rounded-[14px] border border-[var(--line)] bg-white/70">
          {found.length === 0 && <li className="px-3 py-2 text-[13.5px] text-muted">Nobody found.</li>}
          {found.map(c => (
            <li key={c.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 text-[13.5px]">
                <span className="font-semibold">{c.name}</span>
                <span className="block text-muted">
                  {[c.flat, roleLabel(c.roleKey), c.mobile].filter(Boolean).join(' · ')}
                  {c.status !== 'ACTIVE' ? ' · Not active' : ''}
                </span>
              </span>
              <Button
                size="xs"
                variant="glass"
                disabled={c.status !== 'ACTIVE'}
                aria-label={`Choose ${c.name}`}
                onClick={() => {
                  onPick(c);
                  setQ('');
                  setFound(null);
                }}
              >
                Choose
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The flat that qualifies the holder: the current one stays in the list; search adds others. */
function FlatSelect({
  row,
  error,
  onPick,
}: {
  row: SeatRow;
  error?: string;
  onPick: (unitId: number | null, label: string) => void;
}) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ unitId: number; unitLabel: string }[]>([]);
  const search = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setFound([]);
      return;
    }
    try {
      const r = await residentsService.flats({ q: text.trim(), limit: 20 });
      setFound(r.items.map(f => ({ unitId: f.unitId, unitLabel: f.unitLabel })));
    } catch {
      setFound([]);
    }
  };
  const list = [
    ...(row.unitId ? [{ unitId: row.unitId, unitLabel: row.unitLabel || `Flat ${row.unitId}` }] : []),
    ...found.filter(f => f.unitId !== row.unitId),
  ];
  return (
    <div>
      <Input
        label="Search flat"
        type="search"
        value={q}
        onChange={e => void search(e.target.value)}
        placeholder="A-501"
        hint="The flat this person owns."
      />
      <Select
        label="Flat"
        value={row.unitId ? String(row.unitId) : ''}
        error={error}
        onChange={e => {
          const id = Number(e.target.value);
          onPick(id || null, list.find(f => f.unitId === id)?.unitLabel ?? '');
        }}
        options={[
          { value: '', label: 'Choose a flat' },
          ...list.map(f => ({ value: String(f.unitId), label: f.unitLabel })),
        ]}
      />
    </div>
  );
}

const JOIN_OPTS = opts<SeatJoin>({
  ELECTED: JOIN_LABEL.ELECTED,
  NOMINATED: JOIN_LABEL.NOMINATED,
  APPOINTED: JOIN_LABEL.APPOINTED,
});
const DESIGNATION_OPTS = opts<Designation>(DESIGNATION_LABEL);

/** One seat of the term editor (spec 11.3). `past` hides role and flat; `lockHolder` is for election drafts. */
export function SeatFields({
  index,
  row,
  past,
  lockHolder,
  errors,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  row: SeatRow;
  past: boolean;
  lockHolder: boolean;
  errors: Record<string, string>;
  canRemove: boolean;
  onChange: (patch: Partial<SeatRow>) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const toggle = (p: Portfolio) =>
    onChange({
      portfolios: row.portfolios.includes(p) ? row.portfolios.filter(x => x !== p) : [...row.portfolios, p],
    });
  return (
    <fieldset className="glass mb-3 p-4" data-testid="seat-row">
      <legend className="px-1 text-[14px] font-bold">Seat {n}</legend>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <div>
          {past ? (
            <Input
              label="Name of the member"
              value={row.name}
              error={errors.holder}
              onChange={e => onChange({ name: e.target.value })}
            />
          ) : lockHolder ? (
            <div className="mb-4">
              <p className="mb-1 text-[13px] font-semibold">Person</p>
              <p className="flex items-center gap-2 text-[14px]">
                <Avatar name={row.name} /> <span className="font-semibold">{row.name}</span>
              </p>
              <p className="mt-1.5 text-[12.5px] text-muted">
                Elected members come from the election result.
              </p>
            </div>
          ) : (
            <HolderPicker
              row={row}
              error={errors.holder}
              onPick={c =>
                onChange({
                  userId: c.userId,
                  name: c.name,
                  roleKey: c.roleKey,
                  roleName: c.roleName,
                  replace: false,
                  unitId: null,
                  unitLabel: '',
                })
              }
            />
          )}
        </div>
        <div>
          <Select
            label="Designation"
            value={row.designation}
            error={errors.designation}
            onChange={e => {
              const designation = e.target.value as Designation;
              onChange({ designation, ...(designation !== 'MEMBER' ? { show: true } : {}) });
            }}
            options={DESIGNATION_OPTS}
          />
          <Select
            label="How they joined"
            value={row.joinMode}
            onChange={e => onChange({ joinMode: e.target.value as SeatJoin })}
            options={JOIN_OPTS}
          />
        </div>
      </div>
      {!past && (row.userId || lockHolder) && (
        <FlatSelect
          row={row}
          error={errors.flat}
          onPick={(unitId, unitLabel) => onChange({ unitId, unitLabel })}
        />
      )}
      <div role="group" aria-label={`Portfolios of seat ${n}`} className="mb-4">
        <p className="mb-1.5 text-[13px] font-semibold">Portfolios</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {PORTFOLIOS.map(p => (
            <label key={p} className="flex items-center gap-1.5 text-[13.5px]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#143041]"
                checked={row.portfolios.includes(p)}
                onChange={() => toggle(p)}
              />
              {PORTFOLIO_LABEL[p]}
            </label>
          ))}
        </div>
      </div>
      <Input
        label="Public email"
        type="email"
        value={row.publicEmail}
        error={errors.publicEmail}
        onChange={e => onChange({ publicEmail: e.target.value })}
        hint="Shown to residents. Optional."
      />
      <Checkbox
        label="Show to residents"
        checked={row.designation === 'MEMBER' ? row.show : true}
        disabled={row.designation !== 'MEMBER'}
        onChange={e => onChange({ show: e.target.checked })}
        className="mb-2"
      />
      {row.designation !== 'MEMBER' && (
        <p className="mb-3 text-[12.5px] text-muted">Office bearers are always shown to residents.</p>
      )}
      {!past && needsReplaceChoice(row.roleKey) && (
        <Checkbox
          label={
            <>
              Replace current role
              <span className="block text-[12.5px] text-muted">
                Their {row.roleName ?? roleLabel(row.roleKey ?? '')} access ends while they are on the
                committee.
              </span>
            </>
          }
          checked={row.replace}
          onChange={e => onChange({ replace: e.target.checked })}
        />
      )}
      {canRemove && (
        <Button variant="danger-soft" size="xs" onClick={onRemove} aria-label={`Remove seat ${n}`}>
          Remove seat
        </Button>
      )}
    </fieldset>
  );
}
