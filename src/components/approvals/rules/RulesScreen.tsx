'use client';
import { useMemo, useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { EmptyState } from '@/components/common/EmptyState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Loading } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useMe } from '@/lib/auth';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { plural } from '@/lib/plural';
import { describePlanLock } from '@/components/subscription/planLock';
import { approvalsService } from '@/services/approvals.service';
import { approvalsRulesService } from '@/services/approvalsRules.service';
import type { ApprovalRule } from '@/types/approvalsRules';
import { typeLabel } from '../format';
import { RuleEditor } from './RuleEditor';
import { SimulatorPanel } from './SimulatorPanel';
import { useRoles } from './pickers';
import { amountRange, rulesError, stepsSummary } from './rulesFormat';

type Editing = { type: string; rule?: ApprovalRule } | null;

/** Approval rules per type (spec 11.3): list, add, edit, switch on or off, delete, reset, and the simulator. */
export function RulesScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.settings.approvalRules.view);
  const canEdit = usePermission(PERMISSIONS.settings.approvalRules.edit);
  const toast = useToast();
  const { names } = useRoles();
  const types = useLoad(() => approvalsService.types().catch(() => []), 'types');
  const load = useLoad(() => approvalsRulesService.rules(), 'rules');
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<ApprovalRule | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const typeList = useMemo(() => types.data ?? [], [types.data]);
  const grouped = useMemo(() => {
    const m = new Map<string, ApprovalRule[]>();
    for (const r of load.data ?? []) m.set(r.type, [...(m.get(r.type) ?? []), r]);
    for (const t of typeList) if (!m.has(t.type)) m.set(t.type, []);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [load.data, typeList]);
  const info = (t: string) => typeList.find(x => x.type === t);

  const toggle = async (r: ApprovalRule, on: boolean) => {
    try {
      await approvalsRulesService.update(r.id, { isActive: on, version: r.version });
      toast.show(on ? 'Rule switched on.' : 'Rule switched off.');
    } catch (e) {
      toast.show(rulesError(e), 'error');
    }
    load.reload();
  };

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Approval rules" />
        <Card>
          <EmptyState title="You do not have access to this page" />
        </Card>
      </Page>
    );

  if (load.error instanceof ApiError && load.error.status === 402) {
    const lock = describePlanLock(load.error, true);
    return (
      <Page>
        <PageHead title="Approval rules" />
        <Alert tone="warn">
          <strong>{lock?.title}. </strong>
          {lock?.text}
        </Alert>
      </Page>
    );
  }

  return (
    <Page>
      <PageHead
        title="Approval rules"
        sub="Who must approve each kind of item, and from what amount. Open requests keep the rule they started with."
      />
      <div className="mb-4">
        <SimulatorPanel types={typeList} />
      </div>
      <Loading load={load} rows={4}>
        {() => (
          <div className="grid gap-3">
            {grouped.map(([type, rules]) => (
              <TypeSection
                key={type}
                type={type}
                label={typeLabel(type, info(type)?.label)}
                rules={rules}
                names={names}
                canEdit={canEdit}
                onAdd={() => setEditing({ type })}
                onEdit={r => setEditing({ type, rule: r })}
                onToggle={toggle}
                onDelete={setDeleting}
                onReset={() => setResetting(type)}
              />
            ))}
          </div>
        )}
      </Loading>

      {editing && (
        <RuleEditor
          type={editing.type}
          typeName={typeLabel(editing.type, info(editing.type)?.label)}
          isMoney={info(editing.type)?.isMoney ?? false}
          rule={editing.rule}
          readOnly={!canEdit}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show('Rule saved.');
            load.reload();
          }}
        />
      )}
      <ConfirmReason
        open={!!deleting}
        title={`Delete "${deleting?.name ?? ''}"?`}
        description="Requests already waiting keep using this rule. New ones will not."
        confirmLabel="Delete rule"
        onCancel={() => setDeleting(null)}
        onConfirm={async reason => {
          if (!deleting) return;
          try {
            const warnings = await approvalsRulesService.remove(deleting.id, {
              version: deleting.version,
              reason,
            });
            toast.show(warnings.length ? `Rule deleted. ${warnings[0].message}` : 'Rule deleted.');
            setDeleting(null);
            load.reload();
          } catch (e) {
            toast.show(rulesError(e), 'error');
          }
        }}
      />
      <ConfirmReason
        open={!!resetting}
        title={`Reset ${typeLabel(resetting ?? '', info(resetting ?? '')?.label)} rules to defaults?`}
        description="Every rule of this type, including your own, is removed and the standard rules are put back."
        confirmLabel="Reset to defaults"
        onCancel={() => setResetting(null)}
        onConfirm={async reason => {
          if (!resetting) return;
          try {
            await approvalsRulesService.resetDefaults({ type: resetting, reason });
            toast.show('Rules reset to defaults.');
            setResetting(null);
            load.reload();
          } catch (e) {
            toast.show(rulesError(e), 'error');
          }
        }}
      />
    </Page>
  );
}

function TypeSection({
  type,
  label,
  rules,
  names,
  canEdit,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  onReset,
}: {
  type: string;
  label: string;
  rules: ApprovalRule[];
  names: Record<string, string>;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (r: ApprovalRule) => void;
  onToggle: (r: ApprovalRule, on: boolean) => void;
  onDelete: (r: ApprovalRule) => void;
  onReset: () => void;
}) {
  const noneActive = rules.length > 0 && !rules.some(r => r.isActive);
  return (
    <details className="glass p-4" open={rules.length > 0 && rules.length <= 4} data-testid={`type-${type}`}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[16px] font-semibold">
        {label}
        <span className="text-[13px] font-normal text-muted">{plural(rules.length, 'rule')}</span>
        {noneActive && <Chip tone="warn">No active rule: everything is approved automatically</Chip>}
      </summary>
      <ul className="mt-3 grid gap-2">
        {rules.map(r => (
          <li key={r.id} className="rounded-2xl border border-[rgba(20,35,44,0.12)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.name}</span>
                  {r.isDefault && <Chip>Default</Chip>}
                  {!r.isActive && <Chip tone="neutral">Off</Chip>}
                  {r.openRequests > 0 && <Chip tone="info">{plural(r.openRequests, 'open request')}</Chip>}
                  {r.steps.some(
                    s => s.mode === 'N_OF' && (s.requiredCount ?? 0) > s.roleKeys.length + s.userIds.length,
                  ) && <Chip tone="warn">May get stuck</Chip>}
                </div>
                <p className="mt-1 text-[13.5px] text-muted">
                  {amountRange(r.minAmountPaise, r.maxAmountPaise)}
                  {r.categoryKeys ? ` · ${r.categoryKeys.join(', ')}` : ''} · {stepsSummary(r, names)}
                </p>
                <p className="text-[12.5px] text-muted">Priority {r.priority}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Switch
                  label={`${r.name} active`}
                  checked={r.isActive}
                  disabled={!canEdit}
                  onChange={on => void onToggle(r, on)}
                />
                <Button size="sm" variant="ghost" onClick={() => onEdit(r)}>
                  {canEdit ? 'Edit' : 'View'}
                </Button>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${r.name}`}
                    onClick={() => onDelete(r)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
        {rules.length === 0 && <li className="text-[14px] text-muted">No rules yet.</li>}
      </ul>
      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={onAdd}>
            Add rule
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset}>
            Reset to defaults
          </Button>
        </div>
      )}
    </details>
  );
}
