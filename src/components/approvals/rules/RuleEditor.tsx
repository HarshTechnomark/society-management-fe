'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { approvalsRulesService } from '@/services/approvalsRules.service';
import type { ApprovalRule, RuleStep, RuleWarning, StepMode } from '@/types/approvalsRules';
import { RoleChecks, useMembers, useRoles } from './pickers';
import {
  MODE_LABEL,
  WARNING_TEXT,
  emptyStep,
  formFrom,
  inputFrom,
  rulesError,
  validateRule,
  type RuleForm,
} from './rulesFormat';

/** Create or edit one rule (spec 11.3): steps builder, escalation, and the API's warnings after saving. */
export function RuleEditor({
  type,
  typeName,
  isMoney,
  rule,
  readOnly,
  onClose,
  onSaved,
}: {
  type: string;
  typeName: string;
  isMoney: boolean;
  rule?: ApprovalRule;
  readOnly: boolean;
  onClose: () => void;
  onSaved: (rule: ApprovalRule) => void;
}) {
  const { roles } = useRoles();
  const { members } = useMembers();
  const [f, setF] = useState<RuleForm>(() => formFrom(rule));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<RuleWarning[] | null>(null);
  const [saved, setSaved] = useState<ApprovalRule | null>(null);
  const errors = validateRule(f, isMoney);
  const show = (k: string) => (touched ? errors[k] : undefined);
  const set = <K extends keyof RuleForm>(k: K, v: RuleForm[K]) => setF(p => ({ ...p, [k]: v }));
  const setStep = (i: number, patch: Partial<RuleStep>) =>
    set(
      'steps',
      f.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );
  const auto = f.action === 'AUTO_APPROVE';

  const save = async () => {
    setTouched(true);
    setApiError(null);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      const body = inputFrom(f, isMoney);
      const r = rule
        ? await approvalsRulesService.update(rule.id, { ...body, version: rule.version })
        : await approvalsRulesService.create({ ...body, type });
      setSaved(r);
      if (r.warnings.length === 0) onSaved(r);
      else setWarnings(r.warnings);
    } catch (e) {
      setApiError(rulesError(e));
    } finally {
      setBusy(false);
    }
  };

  if (saved && warnings) {
    return (
      <Drawer
        open
        size={640}
        onClose={() => onSaved(saved)}
        title="Rule saved"
        footer={<Button onClick={() => onSaved(saved)}>Done</Button>}
      >
        <p className="mb-3 text-[14px]">
          &ldquo;{saved.name}&rdquo; is saved. Please check {warnings.length === 1 ? 'this' : 'these'}:
        </p>
        <ul className="grid gap-2" aria-label="Warnings">
          {warnings.map((w, i) => (
            <li key={i}>
              <Alert tone="warn">
                <strong>{WARNING_TEXT[w.code] ?? 'Check'}: </strong>
                {w.message}
              </Alert>
            </li>
          ))}
        </ul>
      </Drawer>
    );
  }

  return (
    <Drawer
      open
      size={640}
      onClose={busy ? () => {} : onClose}
      title={rule ? `Edit rule: ${rule.name}` : `New ${typeName} rule`}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button loading={busy} onClick={() => void save()}>
              {rule ? 'Save rule' : 'Add rule'}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly || busy} className="grid min-w-0 gap-3 border-0 p-0">
        {readOnly && <Alert tone="info">You can look at rules but not change them.</Alert>}
        {apiError && <Alert tone="bad">{apiError}</Alert>}
        <Input
          label="Name"
          value={f.name}
          onChange={e => set('name', e.target.value)}
          error={show('name')}
          required
        />
        <Textarea
          label="Description"
          value={f.description}
          onChange={e => set('description', e.target.value)}
          error={show('description')}
          rows={2}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Priority"
            hint="Lower numbers are checked first."
            inputMode="numeric"
            value={f.priority}
            onChange={e => set('priority', e.target.value)}
            error={show('priority')}
          />
          <Select
            label="What happens"
            value={f.action}
            onChange={e => set('action', e.target.value as RuleForm['action'])}
            options={[
              { value: 'REQUIRE_APPROVAL', label: 'Require approval' },
              { value: 'AUTO_APPROVE', label: 'Approve automatically' },
            ]}
          />
          <Input
            label="Amount from (₹)"
            inputMode="decimal"
            value={f.minRupees}
            onChange={e => set('minRupees', e.target.value)}
            error={show('min')}
          />
          <Input
            label="Amount up to (₹)"
            hint="Leave empty for no limit."
            inputMode="decimal"
            value={f.maxRupees}
            onChange={e => set('maxRupees', e.target.value)}
            error={show('max')}
          />
        </div>
        <Input
          label="Categories"
          hint="Codes separated by commas. Empty means any category."
          value={f.categories}
          onChange={e => set('categories', e.target.value)}
          error={show('categories')}
        />
        <RoleChecks
          legend="Raised by roles (empty means anyone)"
          roles={roles}
          value={f.requesterRoles}
          onChange={v => set('requesterRoles', v)}
          error={show('requesterRoles')}
        />
        <Checkbox
          label="Rule is active"
          checked={f.isActive}
          onChange={e => set('isActive', e.target.checked)}
        />

        {!auto && (
          <section aria-label="Steps" className="grid gap-3">
            <h3 className="text-[15px] font-semibold">Steps</h3>
            {show('steps') && <p className="text-[12.5px] font-medium text-bad">{errors.steps}</p>}
            {f.steps.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[rgba(20,35,44,0.12)] p-3"
                role="group"
                aria-label={`Step ${i + 1}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold">Step {i + 1}</span>
                  {f.steps.length > 1 && !readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        set(
                          'steps',
                          f.steps.filter((_, j) => j !== i),
                        )
                      }
                    >
                      Remove step {i + 1}
                    </Button>
                  )}
                </div>
                <div className="grid gap-3">
                  <Input
                    label={`Step ${i + 1} name`}
                    hint='Shown as "Waiting for ...".'
                    value={s.name}
                    onChange={e => setStep(i, { name: e.target.value })}
                  />
                  <Select
                    label={`Step ${i + 1} rule`}
                    value={s.mode}
                    onChange={e => setStep(i, { mode: e.target.value as StepMode, requiredCount: null })}
                    options={Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label }))}
                  />
                  {s.mode === 'N_OF' && (
                    <Input
                      label={`Step ${i + 1} number of approvals`}
                      inputMode="numeric"
                      value={s.requiredCount == null ? '' : String(s.requiredCount)}
                      onChange={e =>
                        setStep(i, { requiredCount: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  )}
                  <RoleChecks
                    legend="Roles"
                    roles={roles}
                    value={s.roleKeys}
                    onChange={v => setStep(i, { roleKeys: v })}
                  />
                  <div>
                    <Select
                      label={`Step ${i + 1} add a member`}
                      value=""
                      onChange={e => {
                        const id = Number(e.target.value);
                        if (id && !s.userIds.includes(id)) setStep(i, { userIds: [...s.userIds, id] });
                      }}
                      options={[
                        { value: '', label: 'Choose a member' },
                        ...members
                          .filter(m => !s.userIds.includes(m.userId))
                          .map(m => ({
                            value: String(m.userId),
                            label: `${m.name} (${m.designation})`,
                          })),
                      ]}
                    />
                    {s.userIds.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {s.userIds.map(id => (
                          <li
                            key={id}
                            className="flex items-center gap-1 rounded-full bg-[rgba(20,35,44,0.08)] px-2.5 py-1 text-[13px]"
                          >
                            {members.find(m => m.userId === id)?.name ?? `Member ${id}`}
                            <button
                              type="button"
                              aria-label={`Remove member ${id} from step ${i + 1}`}
                              className="px-1 font-bold"
                              onClick={() => setStep(i, { userIds: s.userIds.filter(u => u !== id) })}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {show(`step${i + 1}`) && (
                    <p className="text-[12.5px] font-medium text-bad">{errors[`step${i + 1}`]}</p>
                  )}
                </div>
              </div>
            ))}
            {f.steps.length < 5 && !readOnly && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => set('steps', [...f.steps, emptyStep(f.steps.length + 1)])}
                >
                  Add a step
                </Button>
              </div>
            )}
            <RoleChecks
              legend="If nobody in a step is free, ask these roles (up to 3)"
              roles={roles}
              value={f.fallbackRoles}
              onChange={v => set('fallbackRoles', v)}
              error={show('fallback')}
            />
          </section>
        )}

        <section aria-label="Timing" className="grid gap-3 sm:grid-cols-2">
          <h3 className="text-[15px] font-semibold sm:col-span-2">Timing and escalation</h3>
          <Input
            label="Decide within (hours)"
            inputMode="numeric"
            value={f.slaHours}
            onChange={e => set('slaHours', e.target.value)}
            error={show('sla')}
          />
          <Input
            label="Remind every (hours)"
            inputMode="numeric"
            value={f.reminderEvery}
            onChange={e => set('reminderEvery', e.target.value)}
            error={show('reminder')}
          />
          <div className="sm:col-span-2">
            <Checkbox
              label="Escalate when not decided in time"
              checked={f.escalate}
              onChange={e => set('escalate', e.target.checked)}
            />
          </div>
          {f.escalate && (
            <>
              <Input
                label="Escalate after (hours)"
                inputMode="numeric"
                value={f.escalateAfter}
                onChange={e => set('escalateAfter', e.target.value)}
                error={show('escalate')}
              />
              <div className="sm:col-span-2">
                <RoleChecks
                  legend="Escalate to"
                  roles={roles}
                  value={f.escalationRoles}
                  onChange={v => set('escalationRoles', v)}
                  error={show('escalationRoles')}
                />
              </div>
              <div className="sm:col-span-2">
                <Checkbox
                  label="Escalation contacts may approve"
                  checked={f.escalationCanApprove}
                  onChange={e => set('escalationCanApprove', e.target.checked)}
                />
              </div>
            </>
          )}
          {isMoney && (
            <Input
              className="sm:col-span-2"
              label="Ask for a fresh code at or above (₹)"
              hint="Empty uses the society setting."
              inputMode="decimal"
              value={f.stepUpRupees}
              onChange={e => set('stepUpRupees', e.target.value)}
              error={show('stepUp')}
            />
          )}
        </section>
      </fieldset>
    </Drawer>
  );
}
