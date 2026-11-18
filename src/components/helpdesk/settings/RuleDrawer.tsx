'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { helpdeskSettingsService as svc } from '@/services/helpdeskSettings.service';
import type {
  Category,
  EscalationInput,
  EscalationRule,
  Priority,
  TargetType,
  TriggerType,
} from '@/types/helpdesk';
import { helpdeskError } from '../admin/format';
import { usePeople, useRoleOptions } from './pickers';
import { DESIGNATION_LABEL, PRIORITIES, PRIORITY_NAME, TRIGGER_LABEL } from './settingsFormat';

const TRIGGERS = Object.keys(TRIGGER_LABEL) as TriggerType[];

/** Add or edit an escalation rule (spec 8.5): the trigger cannot change once saved. */
export function RuleDrawer({
  rule,
  categories,
  onClose,
  onSaved,
}: {
  rule?: EscalationRule;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const roles = useRoleOptions();
  const { people } = usePeople();
  const [name, setName] = useState(rule?.name ?? '');
  const [trigger, setTrigger] = useState<TriggerType>(rule?.triggerType ?? 'RESOLUTION_SLA');
  const [threshold, setThreshold] = useState(
    rule?.thresholdPercent != null ? String(rule.thresholdPercent) : '100',
  );
  const [level, setLevel] = useState(String(rule?.level ?? 1));
  const [categoryId, setCategoryId] = useState(rule?.categoryId != null ? String(rule.categoryId) : '');
  const [priority, setPriority] = useState<string>(rule?.priority ?? '');
  const [targetType, setTargetType] = useState<TargetType>(rule?.targetType ?? 'ROLE');
  const [roleKey, setRoleKey] = useState(rule?.targetRoleKey ?? '');
  const [designation, setDesignation] = useState(rule?.targetDesignation ?? '');
  const [userId, setUserId] = useState(rule?.targetUserId != null ? String(rule.targetUserId) : '');
  const [notify, setNotify] = useState(rule?.notifyAssignee ?? true);
  const [active, setActive] = useState((rule?.status ?? 'ACTIVE') === 'ACTIVE');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const slaTrigger = trigger === 'RESPONSE_SLA' || trigger === 'RESOLUTION_SLA';
  const n = name.trim();
  const pct = Number(threshold);
  const errors = {
    name: n.length < 2 || n.length > 80 ? 'Enter 2 to 80 characters.' : null,
    threshold:
      slaTrigger && (!/^\d+$/.test(threshold) || pct < 25 || pct > 1000)
        ? 'Enter a percent from 25 to 1000.'
        : null,
    target:
      (targetType === 'ROLE' && !roleKey) ||
      (targetType === 'DESIGNATION' && !designation.trim()) ||
      (targetType === 'MEMBER' && !userId)
        ? 'Choose who is told.'
        : null,
  };

  const save = async () => {
    setTouched(true);
    setProblem(null);
    if (Object.values(errors).some(Boolean)) return;
    const body: EscalationInput = {
      name: n,
      thresholdPercent: slaTrigger ? pct : null,
      level: Number(level),
      categoryId: categoryId ? Number(categoryId) : null,
      priority: (priority || null) as Priority | null,
      targetType,
      ...(targetType === 'ROLE' ? { targetRoleKey: roleKey } : {}),
      ...(targetType === 'DESIGNATION' ? { targetDesignation: designation.trim() } : {}),
      ...(targetType === 'MEMBER' ? { targetUserId: Number(userId) } : {}),
      notifyAssignee: notify,
      status: active ? 'ACTIVE' : 'INACTIVE',
    };
    setBusy(true);
    try {
      if (rule) await svc.updateRule(rule.id, { ...body, version: rule.version });
      else await svc.createRule({ ...body, name: n, triggerType: trigger });
      onSaved();
    } catch (e) {
      setProblem(helpdeskError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={busy ? () => {} : onClose}
      title={rule ? `Edit ${rule.name}` : 'New escalation rule'}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {problem && <Alert tone="bad">{problem}</Alert>}
        <Input
          label="Name"
          value={name}
          maxLength={80}
          onChange={e => setName(e.target.value)}
          error={touched ? errors.name : null}
          required
        />
        <Select
          label="When"
          value={trigger}
          disabled={!!rule}
          hint={rule ? 'The trigger cannot be changed. Add a new rule instead.' : undefined}
          onChange={e => setTrigger(e.target.value as TriggerType)}
          options={TRIGGERS.map(t => ({ value: t, label: TRIGGER_LABEL[t] }))}
        />
        {slaTrigger && (
          <Input
            label="At this percent of the time allowed"
            inputMode="numeric"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            error={touched ? errors.threshold : null}
          />
        )}
        <Select
          label="Level"
          value={level}
          onChange={e => setLevel(e.target.value)}
          options={[1, 2, 3].map(l => ({ value: String(l), label: `Level ${l}` }))}
        />
        <Select
          label="Only for category"
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          options={[
            { value: '', label: 'Every category' },
            ...categories.map(c => ({ value: String(c.id), label: c.name })),
          ]}
        />
        <Select
          label="Only for priority"
          value={priority}
          onChange={e => setPriority(e.target.value)}
          options={[
            { value: '', label: 'Every priority' },
            ...PRIORITIES.map(p => ({ value: p, label: PRIORITY_NAME[p] })),
          ]}
        />
        <Select
          label="Tell"
          value={targetType}
          onChange={e => setTargetType(e.target.value as TargetType)}
          options={[
            { value: 'ROLE', label: 'Everyone with a role' },
            { value: 'DESIGNATION', label: 'A committee designation' },
            { value: 'MEMBER', label: 'One member' },
          ]}
        />
        {targetType === 'ROLE' && (
          <Select
            label="Role"
            value={roleKey}
            onChange={e => setRoleKey(e.target.value)}
            error={touched ? errors.target : null}
            options={[
              { value: '', label: 'Choose a role' },
              ...roles.roles.map(r => ({ value: r.key, label: r.name })),
            ]}
          />
        )}
        {targetType === 'DESIGNATION' && (
          <Select
            label="Designation"
            value={designation}
            onChange={e => setDesignation(e.target.value)}
            error={touched ? errors.target : null}
            options={[
              { value: '', label: 'Choose a designation' },
              ...Object.entries(DESIGNATION_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        )}
        {targetType === 'MEMBER' && (
          <Select
            label="Member"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            error={touched ? errors.target : null}
            options={[
              { value: '', label: 'Choose a member' },
              ...people.members.map(m => ({ value: String(m.userId), label: m.name })),
            ]}
          />
        )}
        <Checkbox
          className="!mb-0"
          checked={notify}
          onChange={e => setNotify(e.target.checked)}
          label="Also tell the person it is assigned to"
        />
        <Checkbox
          className="!mb-0"
          checked={active}
          onChange={e => setActive(e.target.checked)}
          label="Rule is on"
        />
      </div>
    </Drawer>
  );
}
