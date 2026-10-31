'use client';
import { useMemo, useState } from 'react';
import { ACTIONS, type PermissionAction } from '@/constants/permissions';
import type { Catalogue, CatalogueEntry, CatalogueSubMaster } from '@/types/accessControl';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MASTER_LABEL: Record<string, string> = { ai: 'AI', hr: 'HR' };
export const masterLabel = (m: string) => MASTER_LABEL[m] ?? cap(m.replace(/_/g, ' '));

const LOCK_TEXT = 'You do not have this permission';

function Lock() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function Shield() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    </svg>
  );
}

interface Props {
  catalogue: Catalogue;
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  readOnly?: boolean;
}

/** Permission matrix grouped by master (accordion): one row per sub-master, one column per action. */
export function PermissionMatrix({ catalogue, selected, onChange, readOnly }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const q = query.trim().toLowerCase();

  const masters = useMemo(
    () =>
      catalogue.masters
        .map(m => ({
          ...m,
          subMasters: m.subMasters.filter(
            s =>
              !q ||
              s.label.toLowerCase().includes(q) ||
              `${m.master}.${s.subMaster}`.includes(q) ||
              m.master.includes(q),
          ),
        }))
        .filter(m => m.subMasters.length > 0),
    [catalogue, q],
  );

  const editable = (e: CatalogueEntry) => !readOnly && e.heldByMe !== false;
  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    onChange(next);
  };
  const rowEntries = (s: CatalogueSubMaster) => s.permissions.filter(editable);
  const selectRow = (s: CatalogueSubMaster) => {
    const next = new Set(selected);
    const cells = rowEntries(s);
    const all = cells.every(c => next.has(c.key));
    cells.forEach(c => (all ? next.delete(c.key) : next.add(c.key)));
    onChange(next);
  };
  const viewOnly = (s: CatalogueSubMaster) => {
    const next = new Set(selected);
    rowEntries(s).forEach(c => (c.action === 'view' ? next.add(c.key) : next.delete(c.key)));
    onChange(next);
  };
  const toggleMaster = (m: string) =>
    setOpen(o => {
      const n = new Set(o);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search permissions"
          placeholder="Search permissions"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none sm:max-w-xs"
        />
        <p className="text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Shield /> Sensitive: needs two-step sign-in
          </span>
          {' · '}
          <span className="inline-flex items-center gap-1">
            <Lock /> {LOCK_TEXT}
          </span>
        </p>
      </div>
      {masters.length === 0 && (
        <p className="py-6 text-center text-muted">No permission matches that search.</p>
      )}
      <div className="flex flex-col gap-2">
        {masters.map(m => {
          const keys = m.subMasters.flatMap(s => s.permissions.map(p => p.key));
          const count = keys.filter(k => selected.has(k)).length;
          const isOpen = !!q || open.has(m.master);
          const panelId = `matrix-${m.master}`;
          return (
            <section key={m.master} className="rounded-[18px] border border-[var(--line)] bg-white/50">
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleMaster(m.master)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-bold"
                >
                  <span>{masterLabel(m.master)}</span>
                  <span className="text-[12.5px] font-semibold text-muted">
                    {count} of {keys.length} <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                  </span>
                </button>
              </h3>
              {isOpen && (
                <div id={panelId} className="overflow-x-auto border-t border-[var(--line)]">
                  <table className="w-full min-w-[720px] text-[13.5px]">
                    <caption className="sr-only">{masterLabel(m.master)} permissions</caption>
                    <thead>
                      <tr className="text-left text-[11.5px] uppercase text-muted">
                        <th scope="col" className="px-3 py-2">
                          Area
                        </th>
                        {ACTIONS.map(a => (
                          <th key={a} scope="col" className="px-1 py-2 text-center">
                            {cap(a)}
                          </th>
                        ))}
                        <th scope="col" className="px-3 py-2">
                          <span className="sr-only">Row helpers</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.subMasters.map(s => (
                        <tr key={s.subMaster} className="border-t border-[var(--line)]">
                          <th scope="row" className="px-3 py-2 text-left font-semibold">
                            {s.label}
                          </th>
                          {ACTIONS.map(a => {
                            const e = s.permissions.find(p => p.action === (a as PermissionAction));
                            if (!e) return <td key={a} className="px-1 py-2" />;
                            const can = editable(e);
                            const locked = !readOnly && e.heldByMe === false;
                            return (
                              <td key={a} className="px-1 py-2 text-center">
                                <label
                                  className="inline-flex items-center gap-1"
                                  title={
                                    locked ? LOCK_TEXT : e.isPrivileged ? 'Sensitive permission' : undefined
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    className="h-[18px] w-[18px] accent-[#143041]"
                                    aria-label={`${cap(a)} ${s.label}`}
                                    checked={selected.has(e.key)}
                                    disabled={!can}
                                    onChange={ev => toggle(e.key, ev.target.checked)}
                                  />
                                  {locked && (
                                    <span className="text-faint" data-testid="lock-icon">
                                      <Lock />
                                      <span className="sr-only">{LOCK_TEXT}</span>
                                    </span>
                                  )}
                                  {e.isPrivileged && (
                                    <span className="text-gold-ink" data-testid="shield-icon">
                                      <Shield />
                                      <span className="sr-only">Sensitive permission</span>
                                    </span>
                                  )}
                                </label>
                              </td>
                            );
                          })}
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {!readOnly && (
                              <>
                                <button
                                  type="button"
                                  className="rounded-full px-2 py-1 text-[12px] font-semibold text-navy hover:bg-black/5"
                                  onClick={() => selectRow(s)}
                                  aria-label={`Select row ${s.label}`}
                                >
                                  Select row
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full px-2 py-1 text-[12px] font-semibold text-navy hover:bg-black/5"
                                  onClick={() => viewOnly(s)}
                                  aria-label={`View only ${s.label}`}
                                >
                                  View only
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
