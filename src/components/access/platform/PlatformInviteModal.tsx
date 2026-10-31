'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { ApiError } from '@/lib/apiClient';
import { isValidEmail, isValidMobile, normaliseMobile } from '@/lib/validation';
import { accessControlService } from '@/services/access-control.service';
import type { Invitation, RoleSummary } from '@/types/accessControl';
import { accessErrorText, fieldError } from '../format';

export const TEAM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_EMAIL_DOMAIN ?? 'societyapp.in';

type Errors = Partial<Record<'name' | 'email' | 'mobile' | 'roleId', string>>;

/** Spec 11.10: invite a teammate (name, work email, mobile, role). */
export function PlatformInviteModal({
  open,
  roles,
  onClose,
  onInvited,
}: {
  open: boolean;
  roles: RoleSummary[];
  onClose: () => void;
  onInvited: (inv: Invitation) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [roleId, setRoleId] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setEmail('');
    setMobile('');
    setRoleId('');
    setErrors({});
    setFormError(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 120) e.name = 'Enter their full name.';
    const mail = email.trim().toLowerCase();
    if (!isValidEmail(mail)) e.email = 'Enter a valid work email address.';
    else if (!mail.endsWith(`@${TEAM_DOMAIN}`)) e.email = `Use a work email ending with @${TEAM_DOMAIN}.`;
    if (!isValidMobile(mobile)) e.mobile = 'Enter a 10 digit mobile number starting with 6 to 9.';
    if (!roleId) e.roleId = 'Pick a role.';
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const inv = await accessControlService.platformInvite({
        name: n,
        email: mail,
        mobile: normaliseMobile(mobile),
        roleId: Number(roleId),
      });
      reset();
      onInvited(inv);
    } catch (err) {
      const f: Errors = {};
      for (const k of ['name', 'email', 'mobile', 'roleId'] as const) {
        const m = fieldError(err, k);
        if (m) f[k] = m;
      }
      if (err instanceof ApiError && err.code === 'EMAIL_DOMAIN_NOT_ALLOWED')
        setErrors({ email: `Use a work email ending with @${TEAM_DOMAIN}.` });
      else if (err instanceof ApiError && err.code === 'EMAIL_IN_USE')
        setErrors({ email: accessErrorText(err) });
      else if (err instanceof ApiError && err.code === 'ALREADY_MEMBER')
        setErrors({ mobile: 'This person is already on the platform team.' });
      else if (Object.keys(f).length) setErrors(f);
      else
        setFormError(
          err instanceof ApiError && err.code === 'INVITATION_ALREADY_PENDING'
            ? 'This person already has a pending invitation. Resend it from the list.'
            : accessErrorText(err),
        );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite a teammate"
      description="They get an SMS and an email with a link, then sign in and add two-step sign-in. The link is valid for 7 days."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Send invite
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        {formError && <Alert tone="bad">{formError}</Alert>}
        <Input
          label="Full name"
          value={name}
          onChange={e => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label="Work email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
          hint={`Must end with @${TEAM_DOMAIN}`}
          required
        />
        <Input
          label="Mobile"
          type="tel"
          inputMode="numeric"
          value={mobile}
          onChange={e => setMobile(e.target.value)}
          error={errors.mobile}
          required
        />
        <Select
          label="Role"
          value={roleId}
          onChange={e => setRoleId(e.target.value)}
          error={errors.roleId}
          required
          options={[
            { value: '', label: 'Select a role' },
            ...roles.map(r => ({ value: String(r.id), label: r.name })),
          ]}
        />
      </form>
    </Modal>
  );
}
