'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthHeading, AuthShell, BackLink, linkClass } from './AuthShell';
import { useCountdown } from '@/hooks/useCountdown';
import { authErrorMessage } from '@/lib/authErrors';
import { useClientApp } from '@/lib/clientApp';
import { isValidEmail } from '@/lib/validation';
import { authService } from '@/services/auth.service';

/** "Forgot your password?" and, after sending, "Check your email". The API answers the same for every address. */
export function ForgotScreen() {
  const app = useClientApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const wait = useCountdown(resendAt);

  const send = async (address: string) => {
    setBusy(true);
    setAlert(null);
    try {
      await authService.forgotPassword(address);
      setSentTo(address);
      setResendAt(Date.now() + 30_000);
    } catch (e) {
      setAlert(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    setError(null);
    void send(email.trim().toLowerCase());
  };

  if (sentTo)
    return (
      <AuthShell>
        <AuthHeading title="Check your email" />
        <p className="mb-4 text-muted">
          If an account exists for <b className="text-ink">{sentTo}</b>, a reset link is on its way. It
          expires in 15 minutes.
        </p>
        <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
        <Button variant="glass" block loading={busy} disabled={wait > 0} onClick={() => send(sentTo)}>
          {wait > 0 ? `Resend link in ${wait}s` : 'Resend link'}
        </Button>
        <p className="mt-4 text-center text-[14px]">
          <button type="button" className={linkClass} onClick={() => setSentTo(null)}>
            Use a different email
          </button>
        </p>
      </AuthShell>
    );

  return (
    <AuthShell>
      <BackLink href="/login">Back to sign in</BackLink>
      <AuthHeading
        title="Forgot your password?"
        lead="Enter your email and we will send you a link to choose a new one."
      />
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
      <form onSubmit={submit} noValidate>
        <Input
          label={app === 'PLATFORM' ? 'Work email' : 'Email'}
          type="email"
          autoComplete="username"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={error}
          required
        />
        <Button type="submit" block loading={busy}>
          Send reset link
        </Button>
      </form>
      {app === 'ADMIN' && (
        <p className="mt-4 text-center text-[14px]">
          Prefer a code on your phone?{' '}
          <Link href="/login" className={linkClass}>
            Sign in with a mobile OTP
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
