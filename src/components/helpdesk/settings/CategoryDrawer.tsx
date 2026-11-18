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
  CategoryInput,
  CategoryScope,
  DefaultAssigneeType,
  Priority,
  SlaPolicy,
} from '@/types/helpdesk';
import { helpdeskError } from '../admin/format';
import { usePeople, useRoleOptions } from './pickers';
import { ASSIGNEE_TYPE_LABEL, PRIORITIES, PRIORITY_NAME, SCOPE_LABEL } from './settingsFormat';

/** Add or edit a category or sub-category with every field of spec 8.2. */
export function CategoryDrawer({
  category,
  parent,
  policies,
  onClose,
  onSaved,
}: {
  category?: Category;
  parent?: Category;
  policies: SlaPolicy[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const sub = !!parent;
  const roles = useRoleOptions();
  const { people } = usePeople();
  const [name, setName] = useState(category?.name ?? '');
  const [scope, setScope] = useState<CategoryScope>(category?.scope ?? parent?.scope ?? 'BOTH');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [priority, setPriority] = useState<string>(category?.defaultPriority ?? (sub ? '' : 'P3'));
  const [policy, setPolicy] = useState(category?.slaPolicyId != null ? String(category.slaPolicyId) : '');
  const [type, setType] = useState<DefaultAssigneeType>(
    category?.defaultAssigneeType ?? (sub ? 'INHERIT' : 'NONE'),
  );
  const [roleKey, setRoleKey] = useState(category?.defaultRoleKey ?? '');
  const [userId, setUserId] = useState(
    category?.defaultAssigneeUserId != null ? String(category.defaultAssigneeUserId) : '',
  );
  const [staffId, setStaffId] = useState(
    category?.defaultStaffId != null ? String(category.defaultStaffId) : '',
  );
  const [vendorId, setVendorId] = useState(
    category?.defaultVendorId != null ? String(category.defaultVendorId) : '',
  );
  const [flags, setFlags] = useState({
    isChargeable: category?.isChargeable ?? false,
    requiresAfterPhoto: category?.requiresAfterPhoto ?? false,
    isSafety: category?.isSafety ?? false,
    linksInvoice: category?.linksInvoice ?? false,
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const n = name.trim();
  const errors = {
    name: n.length < 2 || n.length > 60 ? 'Enter 2 to 60 characters.' : null,
    icon: icon && !/^[a-z0-9-]{2,30}$/.test(icon) ? 'Use 2 to 30 lowercase letters, digits or dashes.' : null,
    priority: !sub && !priority ? 'Choose a default priority.' : null,
    assignee:
      (type === 'ROLE' && !roleKey) ||
      (type === 'MEMBER' && !userId) ||
      (type === 'STAFF' && !staffId) ||
      (type === 'VENDOR' && !vendorId)
        ? 'Choose who gets it.'
        : null,
  };
  const scopes: CategoryScope[] =
    parent && parent.scope !== 'BOTH' ? [parent.scope] : ['PERSONAL', 'BUILDING', 'BOTH'];
  const types: DefaultAssigneeType[] = sub
    ? ['INHERIT', 'NONE', 'ROLE', 'MEMBER', 'STAFF', 'VENDOR']
    : ['NONE', 'ROLE', 'MEMBER', 'STAFF', 'VENDOR'];

  const save = async () => {
    setTouched(true);
    setProblem(null);
    if (Object.values(errors).some(Boolean)) return;
    const body: CategoryInput = {
      name: n,
      scope,
      ...(icon ? { icon } : {}),
      defaultPriority: (priority || null) as Priority | null,
      slaPolicyId: policy ? Number(policy) : null,
      defaultAssigneeType: type,
      ...(type === 'ROLE' ? { defaultRoleKey: roleKey } : {}),
      ...(type === 'MEMBER' ? { defaultAssigneeUserId: Number(userId) } : {}),
      ...(type === 'STAFF' ? { defaultStaffId: Number(staffId) } : {}),
      ...(type === 'VENDOR' ? { defaultVendorId: Number(vendorId) } : {}),
      ...flags,
    };
    setBusy(true);
    try {
      if (category) await svc.updateCategory(category.id, { ...body, version: category.version });
      else await svc.createCategory({ ...body, name: n, scope, ...(parent ? { parentId: parent.id } : {}) });
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
      title={
        category ? `Edit ${category.name}` : sub ? `New sub-category of ${parent!.name}` : 'New category'
      }
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
          maxLength={60}
          onChange={e => setName(e.target.value)}
          error={touched ? errors.name : null}
          required
        />
        <Select
          label="For"
          value={scope}
          onChange={e => setScope(e.target.value as CategoryScope)}
          options={scopes.map(s => ({ value: s, label: SCOPE_LABEL[s] }))}
        />
        <Input
          label="Icon (optional)"
          hint="A short name such as lift or water-drop."
          value={icon}
          onChange={e => setIcon(e.target.value)}
          error={touched ? errors.icon : null}
        />
        <Select
          label="Default priority"
          value={priority}
          onChange={e => setPriority(e.target.value)}
          error={touched ? errors.priority : null}
          options={[
            ...(sub ? [{ value: '', label: 'Same as the main category' }] : []),
            ...PRIORITIES.map(p => ({ value: p, label: PRIORITY_NAME[p] })),
          ]}
        />
        <Select
          label="SLA policy"
          value={policy}
          onChange={e => setPolicy(e.target.value)}
          options={[
            { value: '', label: 'The default policy' },
            ...policies.map(p => ({ value: String(p.id), label: p.name })),
          ]}
        />
        <Select
          label="New tickets go to"
          value={type}
          onChange={e => setType(e.target.value as DefaultAssigneeType)}
          options={types.map(t => ({ value: t, label: ASSIGNEE_TYPE_LABEL[t] }))}
        />
        {type === 'ROLE' && (
          <Select
            label="Role"
            value={roleKey}
            onChange={e => setRoleKey(e.target.value)}
            error={touched ? errors.assignee : null}
            options={[
              { value: '', label: 'Choose a role' },
              ...roles.roles.map(r => ({ value: r.key, label: r.name })),
            ]}
          />
        )}
        {type === 'MEMBER' && (
          <Select
            label="Member"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            error={touched ? errors.assignee : null}
            options={[
              { value: '', label: 'Choose a member' },
              ...people.members.map(m => ({ value: String(m.userId), label: m.name })),
            ]}
          />
        )}
        {type === 'STAFF' && (
          <Select
            label="Staff member"
            value={staffId}
            onChange={e => setStaffId(e.target.value)}
            error={touched ? errors.assignee : null}
            options={[
              { value: '', label: 'Choose staff' },
              ...people.staff.map(m => ({ value: String(m.staffId), label: m.name })),
            ]}
          />
        )}
        {type === 'VENDOR' && (
          <Select
            label="Vendor"
            value={vendorId}
            onChange={e => setVendorId(e.target.value)}
            error={touched ? errors.assignee : null}
            options={[
              { value: '', label: 'Choose a vendor' },
              ...people.vendors.map(m => ({ value: String(m.vendorId), label: m.name })),
            ]}
          />
        )}
        <fieldset className="grid gap-1 border-0 p-0">
          <legend className="mb-1 text-[13px] font-semibold">Rules for this category</legend>
          <Checkbox
            className="!mb-1"
            checked={flags.isSafety}
            onChange={e => setFlags(f => ({ ...f, isSafety: e.target.checked }))}
            label="Safety issue (alerts the committee at once)"
          />
          <Checkbox
            className="!mb-1"
            checked={flags.isChargeable}
            onChange={e => setFlags(f => ({ ...f, isChargeable: e.target.checked }))}
            label="Chargeable work (estimate, approval, invoice)"
          />
          <Checkbox
            className="!mb-1"
            checked={flags.requiresAfterPhoto}
            onChange={e => setFlags(f => ({ ...f, requiresAfterPhoto: e.target.checked }))}
            label="An after photo is needed to resolve"
          />
          <Checkbox
            className="!mb-1"
            checked={flags.linksInvoice}
            onChange={e => setFlags(f => ({ ...f, linksInvoice: e.target.checked }))}
            label="Can be about an invoice (billing query)"
          />
        </fieldset>
      </div>
    </Drawer>
  );
}
