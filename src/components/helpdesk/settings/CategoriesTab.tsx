'use client';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { helpdeskError, isStale, plainError } from '../admin/format';
import { helpdeskSettingsService as svc } from '@/services/helpdeskSettings.service';
import type { Category } from '@/types/helpdesk';
import { CategoryDrawer } from './CategoryDrawer';
import { ConfirmDialog } from './ConfirmDialog';
import { PRIORITY_NAME, SCOPE_LABEL } from './settingsFormat';

type Editing = { category?: Category; parent?: Category } | null;

/** Categories: the tree with add, edit, move, archive and restore (spec 8.1 to 8.3). */
export function CategoriesTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [archived, setArchived] = useState(false);
  const load = useLoad(() => svc.categories('ALL'), 'cats');
  const policies = useLoad(() => svc.policies('ALL').catch(() => []), 'cat-policies');
  const [editing, setEditing] = useState<Editing>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const policyName = useMemo(
    () => Object.fromEntries((policies.data ?? []).map(p => [p.id, p.name])),
    [policies.data],
  );

  const visible = (c: Category) => archived || c.status === 'ACTIVE';
  const tops = (load.data ?? []).filter(visible);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.show(ok);
      load.reload();
    } catch (e) {
      toast.show(helpdeskError(e));
      if (isStale(e)) load.reload();
    }
  };
  const move = (list: Category[], i: number, dir: -1 | 1) => {
    const a = list[i];
    const b = list[i + dir];
    if (!a || !b) return;
    void run(async () => {
      await svc.updateCategory(a.id, { sortOrder: (i + dir) * 10, version: a.version });
      await svc.updateCategory(b.id, { sortOrder: i * 10, version: b.version });
    }, 'Order saved');
  };

  if (load.error != null)
    return (
      <ErrorState
        error={plainError(load.error)}
        action={
          <Button size="sm" onClick={load.reload}>
            Try again
          </Button>
        }
      />
    );
  if (load.loading)
    return (
      <div
        aria-busy="true"
        aria-label="Loading"
        className="skeleton h-40 w-full"
        data-testid="skeleton-row"
      />
    );

  const line = (c: Category, list: Category[], i: number, sub: boolean) => (
    <li key={c.id} className={`rounded-xl bg-white/50 p-3 ${sub ? 'ml-6' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-[14.5px]">{c.name}</strong>
        <Chip>{SCOPE_LABEL[c.scope]}</Chip>
        {c.defaultPriority && (
          <Chip tone={c.defaultPriority === 'P1' ? 'bad' : 'neutral'}>
            {PRIORITY_NAME[c.defaultPriority]}
          </Chip>
        )}
        {c.slaPolicyId != null && policyName[c.slaPolicyId] && (
          <Chip tone="info">{policyName[c.slaPolicyId]}</Chip>
        )}
        {c.isSafety && <Chip tone="bad">Safety</Chip>}
        {c.isChargeable && <Chip tone="gold">Chargeable</Chip>}
        {c.status === 'ARCHIVED' && <Chip>Archived</Chip>}
        {canEdit && (
          <span className="ml-auto flex flex-wrap gap-1.5">
            {c.status === 'ACTIVE' && (
              <>
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label={`Move ${c.name} up`}
                  disabled={i === 0}
                  onClick={() => move(list, i, -1)}
                >
                  Up
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label={`Move ${c.name} down`}
                  disabled={i === list.length - 1}
                  onClick={() => move(list, i, 1)}
                >
                  Down
                </Button>
                {!sub && (
                  <Button size="xs" variant="glass" onClick={() => setEditing({ parent: c })}>
                    Add sub-category
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="glass"
                  onClick={() =>
                    setEditing({
                      category: c,
                      ...(sub ? { parent: tops.find(t => t.children.some(x => x.id === c.id)) } : {}),
                    })
                  }
                >
                  Edit
                </Button>
                <Button size="xs" variant="danger-soft" onClick={() => setArchiving(c)}>
                  Archive
                </Button>
              </>
            )}
            {c.status === 'ARCHIVED' && (
              <Button
                size="xs"
                variant="glass"
                onClick={() => void run(() => svc.restoreCategory(c.id, c.version), 'Restored')}
              >
                Restore
              </Button>
            )}
          </span>
        )}
      </div>
    </li>
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[13.5px]">
          <Switch checked={archived} onChange={setArchived} label="Show archived" />
          Show archived
        </label>
        {canEdit && <Button onClick={() => setEditing({})}>Add category</Button>}
      </div>
      {tops.length === 0 ? (
        <EmptyState
          title="No categories"
          text="Add a category so residents and the office can sort their tickets."
        />
      ) : (
        <ul aria-label="Categories" className="grid gap-2">
          {tops.map((c, i) => (
            <li key={c.id} className="grid gap-2">
              <ul className="grid gap-2">
                {line(c, tops, i, false)}
                {c.children.filter(visible).map((s, j, kids) => line(s, kids, j, true))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <CategoryDrawer
          category={editing.category}
          parent={editing.parent}
          policies={(policies.data ?? []).filter(p => p.status === 'ACTIVE')}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load.reload();
          }}
        />
      )}
      {archiving && (
        <ConfirmDialog
          title={`Archive ${archiving.name}`}
          confirmLabel="Archive"
          onCancel={() => setArchiving(null)}
          onConfirm={async () => {
            const c = archiving;
            setArchiving(null);
            await run(() => svc.archiveCategory(c.id, c.version), 'Archived');
          }}
        >
          {archiving.children.length
            ? 'Its sub-categories are archived too. Existing tickets are not changed.'
            : 'Existing tickets are not changed.'}
        </ConfirmDialog>
      )}
    </div>
  );
}
