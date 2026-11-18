'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { helpdeskSettingsService as svc } from '@/services/helpdeskSettings.service';
import type { EscalationRule } from '@/types/helpdesk';
import { helpdeskError, isStale, plainError } from '../admin/format';
import { ConfirmDialog } from './ConfirmDialog';
import { RuleDrawer } from './RuleDrawer';
import { PRIORITY_NAME, TRIGGER_LABEL, humanRole } from './settingsFormat';

/** Escalation rules as an L1, L2, L3 matrix (spec 8.5). */
export function EscalationTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const load = useLoad(() => svc.rules(), 'rules');
  const cats = useLoad(() => svc.categories('ACTIVE').catch(() => []), 'rule-cats');
  const [editing, setEditing] = useState<EscalationRule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<EscalationRule | null>(null);
  const catName = (id: number | null) => (cats.data ?? []).find(c => c.id === id)?.name;

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
  if (load.loading || !load.data)
    return (
      <div
        aria-busy="true"
        aria-label="Loading"
        className="skeleton h-40 w-full"
        data-testid="skeleton-row"
      />
    );
  const rules = load.data;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">
          Who is told, and when, as a ticket runs late or the resident is unhappy.
        </p>
        {canEdit && <Button onClick={() => setEditing('new')}>Add rule</Button>}
      </div>
      {rules.length === 0 && (
        <EmptyState title="No escalation rules" text="Add a rule so late tickets reach someone senior." />
      )}
      {[1, 2, 3].map(level => {
        const list = rules.filter(r => r.level === level);
        if (list.length === 0) return null;
        return (
          <section key={level} aria-label={`Level ${level}`} className="rounded-2xl bg-white/50 p-3 sm:p-4">
            <h3 className="mb-2 text-[15px] font-bold">Level {level}</h3>
            <ul className="grid gap-2">
              {list.map(r => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-[14px]">
                  <strong>{r.name}</strong>
                  {(TRIGGER_LABEL[r.triggerType] ?? '').toLowerCase() !== r.name.trim().toLowerCase() && (
                    <Chip>
                      {TRIGGER_LABEL[r.triggerType]}
                      {r.thresholdPercent != null ? ` at ${r.thresholdPercent}%` : ''}
                    </Chip>
                  )}
                  {(TRIGGER_LABEL[r.triggerType] ?? '').toLowerCase() === r.name.trim().toLowerCase() &&
                    r.thresholdPercent != null && <Chip>{`at ${r.thresholdPercent}%`}</Chip>}
                  {r.categoryId != null && <Chip tone="info">{catName(r.categoryId) ?? 'One category'}</Chip>}
                  {r.priority && <Chip>{PRIORITY_NAME[r.priority]}</Chip>}
                  <span className="text-muted">
                    to{' '}
                    {humanRole(r.targetLabel ?? r.targetRoleKey ?? r.targetDesignation) ??
                      `member ${r.targetUserId}`}
                  </span>
                  {r.status === 'INACTIVE' && <Chip>Off</Chip>}
                  {canEdit && (
                    <span className="ml-auto flex gap-1.5">
                      <Button size="xs" variant="glass" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button size="xs" variant="danger-soft" onClick={() => setDeleting(r)}>
                        Delete
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {editing && (
        <RuleDrawer
          rule={editing === 'new' ? undefined : editing}
          categories={cats.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load.reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}`}
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const r = deleting;
            setDeleting(null);
            await run(() => svc.deleteRule(r.id, r.version), 'Rule deleted');
          }}
        >
          Tickets that are already escalated keep their history.
        </ConfirmDialog>
      )}
    </div>
  );
}
