'use client';
import { useMemo } from 'react';
import { Select } from '@/components/ui/Select';
import { cx } from '@/components/ui/cx';
import { useLoad } from '@/hooks/useLoad';
import { societySetupService } from '@/services/society-setup.service';
import type { LocationNode } from '@/types/societySetup';
import type { TicketCategory } from '@/types/helpdeskResident';

/** Category tiles, then sub-category chips (spec 11.6). */
export function CategoryPicker({
  categories,
  categoryId,
  subCategoryId,
  onChange,
  suggested = [],
  error,
}: {
  categories: TicketCategory[];
  categoryId: number | null;
  subCategoryId: number | null;
  onChange: (categoryId: number | null, subCategoryId: number | null) => void;
  suggested?: number[];
  error?: string | null;
}) {
  const current = categories.find(c => c.id === categoryId);
  return (
    <div>
      <div className="mb-1 text-[13px] font-semibold">Category</div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Category">
        {categories.map(c => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === categoryId}
            onClick={() => onChange(c.id, null)}
            className={cx(
              'rounded-[14px] px-3 py-2.5 text-left text-[14px] font-semibold',
              c.id === categoryId ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/90',
            )}
          >
            {c.name}
            {suggested.includes(c.id) && c.id !== categoryId && (
              <span className="ml-1 text-[11px] font-medium text-muted">suggested</span>
            )}
          </button>
        ))}
      </div>
      {current && current.children.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Sub-category">
          {current.children.map(s => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === subCategoryId}
              onClick={() => onChange(current.id, s.id === subCategoryId ? null : s.id)}
              className={cx(
                'rounded-full px-3 py-1 text-[13px] font-semibold',
                s.id === subCategoryId ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/90',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-[12.5px] text-bad">{error}</p>}
    </div>
  );
}

/** Walks the location tree one level at a time: building, then floor, then spot (`GET /locations`). */
export function LocationPicker({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (id: number | null, label: string) => void;
  error?: string | null;
}) {
  const tree = useLoad(() => societySetupService.locations({ status: 'ACTIVE' }), 'locations');
  const roots = useMemo(() => tree.data ?? [], [tree.data]);
  /** The chain of chosen nodes from the top down to `value`. */
  const chain = useMemo(() => {
    const out: LocationNode[] = [];
    const walk = (nodes: LocationNode[]): boolean => {
      for (const n of nodes) {
        out.push(n);
        if (n.id === value || walk(n.children ?? [])) return true;
        out.pop();
      }
      return false;
    };
    if (value != null) walk(roots);
    return out;
  }, [roots, value]);
  const levels: LocationNode[][] = [roots];
  for (const n of chain) if (n.children?.length) levels.push(n.children);
  const levelName = (level: number, opts: LocationNode[]) =>
    level === 0 ? 'Building' : opts[0]?.nodeType === 'FLOOR' ? 'Floor' : 'Spot';

  const pick = (level: number, id: string) => {
    if (!id) {
      const parent = level > 0 ? chain[level - 1] : null;
      onChange(parent ? parent.id : null, parent ? (parent.pathLabel ?? parent.name) : '');
      return;
    }
    const node = levels[level].find(n => String(n.id) === id);
    if (node)
      onChange(
        node.id,
        node.pathLabel ??
          chain
            .slice(0, level)
            .concat(node)
            .map(n => n.name)
            .join(' › '),
      );
  };

  if (tree.loading) return <div className="skeleton h-12 w-full" />;
  if (tree.error)
    return <p className="text-[13px] text-bad">The places could not be loaded. Reload the page.</p>;
  return (
    <div className="grid gap-2" role="group" aria-label="Where is it?">
      {levels.map((opts, level) => (
        <Select
          key={level}
          label={levelName(level, opts)}
          value={chain[level] ? String(chain[level].id) : ''}
          onChange={e => pick(level, e.target.value)}
          error={level === 0 ? error : undefined}
          options={[
            { value: '', label: level === 0 ? 'Choose a building' : 'Whole level' },
            ...opts.map(n => ({ value: String(n.id), label: n.name })),
          ]}
        />
      ))}
    </div>
  );
}
