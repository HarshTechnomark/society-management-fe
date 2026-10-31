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

interface Props {
  open: boolean;
  roles: RoleSummary[];
  onClose: () => void;
  onInvited: (inv: Invitation) => void;
  /** Called for `INVITATION_ALREADY_PENDING` when the user picks "Resend". */
  onResend: (invitationId: number) => Promise<void> | void;
  onLimit?: (e: ApiError) => void;
}

type Errors = Partial<Record<'name' | 'mobile' | 'email' | 'roleId' | 'message' | 'locationLabel', string>>;

/** Spec 11.2: "Invite a committee member". */
export function InviteModal({ open, roles, onClose, onInvited, onResend, onLimit }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [roleId, setRoleId] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setEmail('');
    setMobile('');
    setRoleId('');
    setLocation('');
    setMessage('');
    setErrors({});
    setFormError(null);
    setPendingId(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const validate = (): Errors => {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 120 || !/^[A-Za-z][A-Za-z .'-]*$/.test(n))
      e.name = 'Enter their full name (letters only).';
    if (!isValidMobile(mobile)) e.mobile = 'Enter a 10 digit mobile number starting with 6 to 9.';
    if (email.trim() && !isValidEmail(email)) e.email = 'Enter a valid email address.';
    if (!roleId) e.roleId = 'Pick a role.';
    if (location.trim().length > 60) e.locationLabel = 'Use 60 characters or fewer.';
    if (message.length > 300) e.message = 'Use 300 characters or fewer.';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    setFormError(null);
    setPendingId(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const inv = await accessControlService.invite({
        name: name.trim(),
        mobile: normaliseMobile(mobile),
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
        roleId: Number(roleId),
        ...(location.trim() ? { locationLabel: location.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      reset();
      onInvited(inv);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields: Errors = {};
        for (const f of ['name', 'mobile', 'email', 'roleId', 'message', 'locationLabel'] as const) {
          const m = fieldError(err, f);
          if (m) fields[f] = m;
        }
        if (err.code === 'VALIDATION_FAILED' && Object.keys(fields).length) setErrors(fields);
        else {
          if (err.code === 'EMAIL_IN_USE') setErrors({ email: accessErrorText(err) });
          else if (err.code === 'ALREADY_MEMBER' || err.code === 'MEMBER_SUSPENDED')
            setErrors({ mobile: accessErrorText(err) });
          else setFormError(accessErrorText(err));
          if (err.code === 'INVITATION_ALREADY_PENDING') setPendingId(err.metaNumber('invitationId') ?? null);
          if (err.code === 'USAGE_LIMIT_EXCEEDED') onLimit?.(err);
        }
      } else setFormError(accessErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite a committee member"
      description="They get a message with a link, sign in with their mobile, then add their authenticator if the role needs it."
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
          autoComplete="off"
        />
        <Input
          label="Email (optional)"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="off"
        />
        <Input
          label="Mobile"
          type="tel"
          inputMode="numeric"
          value={mobile}
          onChange={e => setMobile(e.target.value)}
          error={errors.mobile}
          required
          autoComplete="off"
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
        <Input
          label="Flat or office (optional)"
          value={location}
          onChange={e => setLocation(e.target.value)}
          error={errors.locationLabel}
          autoComplete="off"
        />
        <div className="mb-4">
          <label htmlFor="invite-message" className="mb-1.5 block text-[13px] font-semibold">
            Message (optional)
          </label>
          <textarea
            id="invite-message"
            rows={3}
            maxLength={300}
            value={message}
            onChange={e => setMessage(e.target.value)}
            aria-invalid={errors.message ? true : undefined}
            className="w-full rounded-[16px] border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 py-3 text-[15px] focus:border-navy focus:outline-none"
          />
          {errors.message && <p className="mt-1 text-[12.5px] font-medium text-bad">{errors.message}</p>}
        </div>
        <p className="text-[12.5px] text-muted">
          The invitation goes by SMS and WhatsApp. The link is valid for 7 days.
        </p>
        {pendingId !== null && (
          <p className="mt-2">
            <Button
              size="sm"
              variant="glass"
              onClick={async () => {
                await onResend(pendingId);
                close();
              }}
            >
              Resend the invitation
            </Button>
          </p>
        )}
      </form>
    </Modal>
  );
}
