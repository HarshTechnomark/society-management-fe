'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { accessControlService } from '@/services/access-control.service';
import type { Catalogue, RoleDetail } from '@/types/accessControl';
import { accessErrorText, fieldError } from '../format';
import { PermissionMatrix } from './PermissionMatrix';

interface Props {
  /** Edit this role. */
  roleId?: number;
  /** New role, optionally cloned from this one. */
  cloneFrom?: number;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 &()'.-]*$/;
const labelOf = (cat: Catalogue | null, key: string) =>
  cat?.masters.flatMap(m => m.subMasters.flatMap(s => s.permissions)).find(p => p.key === key)?.label ?? key;

/** Spec 11.7. Full page on desktop; the matrix scrolls inside its accordion on phones. */
export function RoleEditor({ roleId, cloneFrom }: Props) {
  const sourceId = roleId ?? cloneFrom;
  const role = useLoad(() => (sourceId ? accessControlService.role(sourceId) : Promise.resolve(null)));
  if (sourceId && role.loading && !role.data)
    return (
      <Page>
        <div className="skeleton h-8 w-60" />
      </Page>
    );
  if (sourceId && (role.error || !role.data))
    return (
      <Page>
        <ErrorState error={role.error} title="This role could not be opened" />
      </Page>
    );
  return (
    <Editor
      key={`${role.data?.id}-${role.data?.version}`}
      role={role.data}
      isClone={!!cloneFrom && !roleId}
      reload={role.reload}
    />
  );
}

function Editor({
  role,
  isClone,
  reload,
}: {
  role: RoleDetail | null;
  isClone: boolean;
  reload: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.settings.roles.edit);
  const canCreate = usePermission(PERMISSIONS.settings.roles.create);
  const creating = !role || isClone;
  const readOnly = creating ? !canCreate : !canEdit || !!role?.isLocked;

  const [scope, setScope] = useState<'society' | 'gate' | 'work'>(
    role && (role.scope === 'gate' || role.scope === 'work') ? role.scope : 'society',
  );
  const catScope = creating ? scope : (role!.scope as 'society' | 'gate' | 'work' | 'resident');
  const catalogue = useLoad(() => accessControlService.catalogue(catScope), catScope);
  return (
    <EditorBody
      role={role}
      isClone={isClone}
      creating={creating}
      readOnly={readOnly}
      scope={scope}
      setScope={setScope}
      catalogue={catalogue.data}
      catalogueError={catalogue.error}
      reload={reload}
      toast={toast.show}
      push={router.push}
      canEdit={canEdit}
    />
  );
}

interface BodyProps {
  role: RoleDetail | null;
  isClone: boolean;
  creating: boolean;
  readOnly: boolean;
  scope: 'society' | 'gate' | 'work';
  setScope: (s: 'society' | 'gate' | 'work') => void;
  catalogue: Catalogue | null;
  catalogueError: unknown;
  reload: () => void;
  toast: (m: string, tone?: 'success' | 'warning' | 'error') => void;
  push: (url: string) => void;
  canEdit: boolean;
}

function EditorBody({
  role,
  isClone,
  creating,
  readOnly,
  scope,
  setScope,
  catalogue,
  catalogueError,
  reload,
  toast,
  push,
  canEdit,
}: BodyProps) {
  const canDelete = usePermission(PERMISSIONS.settings.roles.delete);
  const original = useMemo(() => new Set(role?.permissionKeys ?? []), [role]);
  const privileged = useMemo(() => {
    const s = new Set<string>();
    catalogue?.masters.forEach(m =>
      m.subMasters.forEach(sm => sm.permissions.forEach(p => p.isPrivileged && s.add(p.key))),
    );
    return s;
  }, [catalogue]);
  const held = useMemo(() => {
    const s = new Set<string>();
    catalogue?.masters.forEach(m =>
      m.subMasters.forEach(sm => sm.permissions.forEach(p => p.heldByMe !== false && s.add(p.key))),
    );
    return s;
  }, [catalogue]);

  // A clone starts from the source keys the caller may hand out.
  const initial = useMemo(
    () => (isClone && catalogue ? new Set([...original].filter(k => held.has(k))) : original),
    [isClone, catalogue, original, held],
  );
  const droppedOnClone = isClone && catalogue ? original.size - initial.size : 0;

  const [name, setName] = useState(isClone ? '' : (role?.name ?? ''));
  const [description, setDescription] = useState(role?.description ?? '');
  const [mfa, setMfa] = useState(role?.requiresMfa ?? false);
  const [edited, setEdited] = useState<Set<string> | null>(null);
  const selected = edited ?? initial;

  const [review, setReview] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{ text: string; stale?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const hasPrivileged = [...selected].some(k => privileged.has(k));
  const mfaOn = mfa || hasPrivileged;
  const added = [...selected].filter(k => !original.has(k)).sort();
  const removed = [...original].filter(k => !selected.has(k)).sort();
  const keysChanged = added.length + removed.length > 0;
  const system = !!role?.isSystem && !isClone;
  const mfaChanged = !creating && !system && mfaOn !== role!.requiresMfa;
  const dirty = creating
    ? true
    : keysChanged ||
      mfaChanged ||
      (!system && (name.trim() !== role!.name || description.trim() !== (role!.description ?? '')));
  const needsReason = !creating && (keysChanged || mfaChanged);

  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      const f: Record<string, string> = {};
      for (const k of ['name', 'description', 'permissionKeys', 'reason'] as const) {
        const m = fieldError(e, k);
        if (m) f[k] = m;
      }
      if (e.code === 'VALIDATION_FAILED' && Object.keys(f).length) {
        setErrors(f);
        setFormError(null);
        return;
      }
      if (e.code === 'ROLE_NAME_TAKEN') setErrors({ name: accessErrorText(e) });
      setFormError({ text: accessErrorText(e), stale: e.code === 'STALE_VERSION' });
    } else setFormError({ text: accessErrorText(e) });
  };

  const validateName = () => {
    const n = name.trim();
    if (n.length < 3 || n.length > 50 || !NAME_RE.test(n))
      return "Use 3 to 50 letters, numbers and & ( ) ' . -";
    return null;
  };

  const create = async () => {
    const e: Record<string, string> = {};
    const nm = validateName();
    if (nm) e.name = nm;
    if (description.length > 300) e.description = 'Use 300 characters or fewer.';
    if (selected.size === 0) e.permissionKeys = 'Pick at least one permission.';
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const made = await accessControlService.createRole({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        scope,
        ...(isClone && role ? { basedOnRoleId: role.id } : {}),
        permissionKeys: [...selected].sort(),
        requiresMfa: mfaOn,
      });
      toast(`Role "${made.name}" created.`);
      push(`/admin/roles/${made.id}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const openReview = () => {
    const e: Record<string, string> = {};
    if (!system) {
      const nm = validateName();
      if (nm) e.name = nm;
    }
    if (description.length > 300) e.description = 'Use 300 characters or fewer.';
    if (selected.size === 0) e.permissionKeys = 'A role needs at least one permission.';
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setReview(true);
  };

  const save = async () => {
    const r = reason.trim();
    if (needsReason && (r.length < 5 || r.length > 500)) {
      setErrors({ reason: 'Enter between 5 and 500 characters.' });
      return;
    }
    setBusy(true);
    try {
      await accessControlService.updateRole(role!.id, {
        version: role!.version,
        ...(!system && name.trim() !== role!.name ? { name: name.trim() } : {}),
        ...(!system && description.trim() !== (role!.description ?? '')
          ? { description: description.trim() || null }
          : {}),
        ...(keysChanged ? { permissionKeys: [...selected].sort() } : {}),
        ...(mfaChanged ? { requiresMfa: mfaOn } : {}),
        ...(needsReason ? { reason: r } : {}),
      });
      toast('Role saved.');
      setReview(false);
      setReason('');
      setEdited(null);
      reload();
    } catch (err) {
      setReview(false);
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const title = creating ? (isClone ? `Clone of ${role!.name}` : 'New role') : role!.name;
  return (
    <Page>
      <PageHead
        title={title}
        sub={
          creating
            ? 'Pick what this role can do. You can only give permissions you hold yourself.'
            : (role!.description ?? 'Change what this role can do. Members get the change at once.')
        }
        actions={
          <>
            {!creating && (
              <Chip tone={role!.isSystem ? 'neutral' : 'gold'}>{role!.isSystem ? 'System' : 'Custom'}</Chip>
            )}
            <Button variant="glass" size="sm" onClick={() => push('/admin/roles')}>
              Back to roles
            </Button>
          </>
        }
      />
      {role?.isLocked && !creating && (
        <Alert tone="info">Only SocietyApp support can change the Chairman role.</Alert>
      )}
      {!creating && !role!.isLocked && !canEdit && (
        <Alert tone="info">You can view this role but not change it.</Alert>
      )}
      {droppedOnClone > 0 && (
        <Alert tone="warn">
          {droppedOnClone} permission(s) of the source role are not available to you and were left out.
        </Alert>
      )}
      {formError && (
        <Alert tone="bad">
          {formError.text}{' '}
          {formError.stale && (
            <button type="button" className="font-bold underline" onClick={reload}>
              Reload
            </button>
          )}
          {formError.text.includes('Upgrade your plan') &&
            ' Open Settings, Subscription to change your plan.'}
        </Alert>
      )}

      <Card className="mb-4">
        {creating && (
          <Select
            label="Role type"
            value={scope}
            onChange={e => setScope(e.target.value as 'society' | 'gate' | 'work')}
            disabled={isClone}
            options={[
              { value: 'society', label: 'Society (committee and staff)' },
              { value: 'gate', label: 'Gate (guards)' },
              { value: 'work', label: 'Work (staff and vendors)' },
            ]}
          />
        )}
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          error={errors.name}
          disabled={readOnly || system}
          hint={system ? 'System roles keep their name.' : undefined}
          required={!system}
        />
        <Input
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          error={errors.description}
          disabled={readOnly || system}
        />
        {!system && (
          <Checkbox
            label={
              hasPrivileged
                ? 'Needs two-step sign-in (required because the role holds sensitive permissions)'
                : 'Needs two-step sign-in'
            }
            checked={mfaOn}
            disabled={readOnly || hasPrivileged}
            onChange={e => setMfa(e.target.checked)}
          />
        )}
        {system && (
          <p className="text-[13px] text-muted">
            Two-step sign-in: {role!.requiresMfa ? 'required' : 'not required'}. Only SocietyApp support can
            change this for system roles.
          </p>
        )}
      </Card>

      <Card title="Permissions" sub={`${selected.size} selected`}>
        {errors.permissionKeys && <Alert tone="bad">{errors.permissionKeys}</Alert>}
        {catalogueError ? (
          <ErrorState error={catalogueError} />
        ) : !catalogue ? (
          <div className="skeleton h-40 w-full" />
        ) : (
          <PermissionMatrix
            catalogue={catalogue}
            selected={selected}
            onChange={setEdited}
            readOnly={readOnly}
          />
        )}
      </Card>

      {!readOnly && (
        <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-[20px] bg-[rgba(251,247,240,0.95)] p-3 shadow-lg">
          {!creating && role!.isSystem && (
            <Button variant="glass" onClick={() => setResetting(true)}>
              Reset to default
            </Button>
          )}
          {!creating && !role!.isSystem && canDelete && (
            <Button
              variant="danger-soft"
              onClick={() => setDeleting(true)}
              disabled={role!.memberCount + role!.pendingInvitationCount > 0}
              title={role!.memberCount + role!.pendingInvitationCount > 0 ? 'This role is in use' : undefined}
            >
              Delete role
            </Button>
          )}
          {creating ? (
            <Button loading={busy} onClick={create}>
              Create role
            </Button>
          ) : (
            <Button disabled={!dirty} onClick={openReview}>
              Save
            </Button>
          )}
        </div>
      )}

      <Modal
        open={review}
        onClose={() => setReview(false)}
        title="Review changes"
        description={
          keysChanged
            ? `Adding ${added.length}, removing ${removed.length}`
            : 'Name, description or two-step setting only.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setReview(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save}>
              Confirm and save
            </Button>
          </>
        }
      >
        {added.length > 0 && (
          <div className="mb-3">
            <h3 className="text-[13px] font-bold text-ok">Adding</h3>
            <ul className="list-disc pl-5 text-[13.5px]">
              {added.map(k => (
                <li key={k}>{labelOf(catalogue, k)}</li>
              ))}
            </ul>
          </div>
        )}
        {removed.length > 0 && (
          <div className="mb-3">
            <h3 className="text-[13px] font-bold text-bad">Removing</h3>
            <ul className="list-disc pl-5 text-[13.5px]">
              {removed.map(k => (
                <li key={k}>{labelOf(catalogue, k)}</li>
              ))}
            </ul>
          </div>
        )}
        {needsReason && (
          <Input
            label="Reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            error={errors.reason}
            required
          />
        )}
      </Modal>

      <ConfirmReason
        open={resetting}
        title={`Reset ${role?.name} to default?`}
        description="Its permissions go back to the SocietyApp default for this role."
        confirmLabel="Reset to default"
        onCancel={() => setResetting(false)}
        onConfirm={async r => {
          try {
            await accessControlService.resetRole(role!.id, { version: role!.version, reason: r });
            toast('Role reset to default.');
            setResetting(false);
            reload();
          } catch (e) {
            setResetting(false);
            fail(e);
          }
        }}
      />
      <ConfirmReason
        open={deleting}
        title={`Delete ${role?.name}?`}
        description="This cannot be undone. A role that members still use cannot be deleted."
        confirmLabel="Delete role"
        onCancel={() => setDeleting(false)}
        onConfirm={async r => {
          try {
            await accessControlService.deleteRole(role!.id, { version: role!.version, reason: r });
            toast('Role deleted.');
            push('/admin/roles');
          } catch (e) {
            setDeleting(false);
            fail(e);
          }
        }}
      />
    </Page>
  );
}
