'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AuthHeading, AuthShell } from './AuthShell';
import { PasswordMeter } from './PasswordMeter';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage } from '@/lib/authErrors';
import { passwordOk, passwordRules } from '@/lib/validation';
import { authService } from '@/services/auth.service';
import type { LinkStatus } from '@/types/auth';

const REASON: Record<string, string> = {
  INVALID: 'This link is not valid.',
  EXPIRED: 'This link has expired.',
  USED: 'This link was already used.',
};
const CODE_REASON: Record<string, string> = {
  LINK_INVALID: REASON.INVALID,
  LINK_EXPIRED: REASON.EXPIRED,
  LINK_USED: REASON.USED,
};

/** "Choose a new password" (reset link) and "Set your password" (invite setup link). */
export function ChoosePasswordScreen({ mode }: { mode: 'reset' | 'setup' }) {
  const token = useSearchParams().get('token') ?? '';
  const purpose = mode === 'reset' ? 'PASSWORD_RESET' : 'ACCOUNT_SETUP';
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      // setState from a promise callback keeps the effect free of synchronous updates
      void Promise.resolve().then(() => setStatus({ valid: false, reason: 'INVALID' }));
      return;
    }
    let live = true;
    authService
      .linkStatus(token, purpose)
      .then(s => live && setStatus(s))
      .catch(e => live && setLinkError(authErrorMessage(e)));
    return () => {
      live = false;
    };
  }, [token, purpose]);

  const title = mode === 'reset' ? 'Choose a new password' : 'Set your password';
  const submitLabel = mode === 'reset' ? 'Update password' : 'Set password';
  const email = status?.email ?? '';

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setAlert(null);
    const next: Record<string, string> = {};
    if (!passwordOk(password, email)) next.password = 'Your password does not meet every rule yet.';
    if (confirm !== password) next.confirm = 'The two passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await (mode === 'reset'
        ? authService.resetPassword(token, password)
        : authService.setupPassword(token, password));
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && CODE_REASON[e.code])
        setStatus({ valid: false, reason: e.code.replace('LINK_', '') as 'INVALID' });
      else if (e instanceof ApiError && e.code === 'PASSWORD_POLICY_FAILED') {
        const failed = new Set((e.errors ?? []).map(x => x.message));
        const text = passwordRules('', email)
          .filter(r => failed.has(r.key))
          .map(r => r.text.toLowerCase());
        setErrors({ password: text.length ? `Needs: ${text.join(', ')}.` : 'That password is not allowed.' });
      } else setAlert(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <AuthShell>
        <AuthHeading
          title={mode === 'reset' ? 'Password updated' : 'You are all set'}
          lead={
            mode === 'reset'
              ? 'Your password was changed and your other sessions were signed out.'
              : 'Your password is set. Sign in to continue.'
          }
        />
        <Link
          href={`/login?r=${mode === 'reset' ? 'reset' : 'invite'}`}
          className={buttonClasses('primary', 'md', true)}
        >
          Continue to sign in
        </Link>
      </AuthShell>
    );

  if (linkError)
    return (
      <AuthShell>
        <AuthHeading title={title} />
        <Alert tone="bad">{linkError}</Alert>
      </AuthShell>
    );

  if (!status)
    return (
      <AuthShell>
        <AuthHeading title={title} />
        <p className="text-muted" aria-busy="true">
          Checking your link...
        </p>
      </AuthShell>
    );

  if (!status.valid)
    return (
      <AuthShell>
        <AuthHeading
          title={REASON[status.reason ?? 'INVALID']}
          lead={
            mode === 'reset'
              ? 'Request a new reset link to continue.'
              : 'Ask your admin to send the invitation again, or request a link.'
          }
        />
        <Link href="/forgot" className={buttonClasses('primary', 'md', true)}>
          Request a new link
        </Link>
      </AuthShell>
    );

  return (
    <AuthShell>
      <AuthHeading
        title={title}
        lead={
          email ? (
            <>
              For <b className="text-ink">{email}</b>
            </>
          ) : undefined
        }
      />
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
      <form onSubmit={submit} noValidate>
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <PasswordMeter password={password} email={email} />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          error={errors.confirm}
          required
        />
        <Button type="submit" block loading={busy}>
          {submitLabel}
        </Button>
      </form>
    </AuthShell>
  );
}
