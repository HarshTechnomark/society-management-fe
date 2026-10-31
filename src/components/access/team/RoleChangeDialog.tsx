'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { accessControlService } from '@/services/access-control.service';
import type { MemberRow, RoleSummary } from '@/types/accessControl';
import { accessErrorText } from '../format';

interface Props {
  member: MemberRow | null;
  roles: RoleSummary[];
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Spec 11.3: ConfirmReason with a "New role" select. Step-up is handled by the API client. */
export function RoleChangeDialog({ member, roles, onClose, onDone }: Props) {
  if (!member) return null;
  return <Body key={member.id} member={member} roles={roles} onClose={onClose} onDone={onDone} />;
}

function Body({ member, roles, onClose, onDone }: Props & { member: MemberRow }) {
  const [roleId, setRoleId] = useState(String(member.role.id));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ role?: string; reason?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const f: typeof fieldErr = {};
    if (Number(roleId) === member.role.id) f.role = 'Pick a different role.';
    const r = reason.trim();
    if (r.length < 5 || r.length > 500) f.reason = 'Enter between 5 and 500 characters.';
    setFieldErr(f);
    setError(null);
    if (f.role || f.reason) return;
    setBusy(true);
    try {
      await accessControlService.changeRole(member.id, {
        version: member.version,
        roleId: Number(roleId),
        reason: r,
      });
      onDone(`${member.name} is now ${roles.find(x => x.id === Number(roleId))?.name ?? 'updated'}.`);
    } catch (e) {
      setError(accessErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change role for ${member.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Change role
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      <Select
        label="New role"
        value={roleId}
        onChange={e => setRoleId(e.target.value)}
        error={fieldErr.role}
        options={[
          ...(roles.some(r => r.id === member.role.id)
            ? []
            : [{ value: String(member.role.id), label: member.role.name }]),
          ...roles.map(r => ({ value: String(r.id), label: r.name })),
        ]}
      />
      <Input
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        error={fieldErr.reason}
        required
      />
    </Modal>
  );
}
