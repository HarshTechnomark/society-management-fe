'use client';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/Toast';
import { PasswordMeter } from '../PasswordMeter';
import { SecurityCard } from './SecurityCard';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage, lockMessage, lockSeconds } from '@/lib/authErrors';
import { passwordOk } from '@/lib/validation';
import { authService } from '@/services/auth.service';
import { useLock } from '../useLock';

export function PasswordCard({
  hasPassword,
  email,
  onChanged,
}: {
  hasPassword: boolean;
  email: string | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useLock();

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setAlert(null);
    const errs: Record<string, string> = {};
    if (hasPassword && !current) errs.current = 'Enter your current password.';
    if (!passwordOk(next, email ?? '')) errs.next = 'Your new password does not meet every rule yet.';
    if (confirm !== next) errs.confirm = 'The two passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await authService.changePassword({
        ...(hasPassword ? { currentPassword: current } : {}),
        newPassword: next,
      });
      toast.show(
        r.otherSessionsRevoked > 0
          ? `Password updated. ${r.otherSessionsRevoked} other ${r.otherSessionsRevoked === 1 ? 'device was' : 'devices were'} signed out.`
          : 'Password updated.',
      );
      setCurrent('');
      setNext('');
      setConfirm('');
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CURRENT_PASSWORD_INCORRECT')
        setErrors({ current: 'That is not your current password.' });
      else if (e instanceof ApiError && e.code === 'PASSWORD_SAME_AS_CURRENT')
        setErrors({ next: 'Choose a password different from the current one.' });
      else if (e instanceof ApiError && e.code === 'PASSWORD_POLICY_FAILED')
        setErrors({ next: 'That password does not meet the rules or is too common.' });
      else if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') lock.lock(lockSeconds(e));
      else if (!(e instanceof ApiError && e.code === 'REAUTH_REQUIRED')) setAlert(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SecurityCard title={hasPassword ? 'Change password' : 'Set a password'} id="password">
      <div aria-live="assertive">
        {alert && <Alert tone="bad">{alert}</Alert>}
        {lock.locked && <Alert tone="bad">{lockMessage(lock.left)}</Alert>}
      </div>
      {!email && (
        <Alert tone="warn">
          Add and confirm an email first. A password only works for sign-in once your email is confirmed.
        </Alert>
      )}
      <form onSubmit={submit} noValidate>
        {hasPassword && (
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            error={errors.current}
            required
          />
        )}
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={e => setNext(e.target.value)}
          error={errors.next}
          required
        />
        <PasswordMeter password={next} email={email ?? ''} />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          error={errors.confirm}
          required
        />
        <Button type="submit" loading={busy} disabled={lock.locked}>
          Update password
        </Button>
      </form>
    </SecurityCard>
  );
}
