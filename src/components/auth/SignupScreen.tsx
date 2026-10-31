'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthHeading, AuthShell, BackLink, linkClass } from './AuthShell';
import { useLock } from './useLock';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage, lockMessage, lockSeconds } from '@/lib/authErrors';
import { flow } from '@/lib/authFlow';
import { useClientApp } from '@/lib/clientApp';
import { isValidMobile, normaliseMobile } from '@/lib/validation';
import { authService } from '@/services/auth.service';

/** Sign up (create a society), step one: verify the mobile. The OTP screen then hands `signupToken` to module 05. */
export function SignupScreen() {
  const app = useClientApp();
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useLock();

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setAlert(null);
    if (!isValidMobile(mobile)) return setError('Enter a valid 10-digit mobile number.');
    setError(null);
    setBusy(true);
    try {
      const n = normaliseMobile(mobile);
      const ch = await authService.sendOtp(n, 'SIGNUP');
      flow.set({ otp: { ...ch, purpose: 'SIGNUP', mobile: n } });
      router.push('/login/otp');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') lock.lock(lockSeconds(e));
      else setAlert(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (app !== 'ADMIN')
    return (
      <AuthShell>
        <AuthHeading title="Create a society" lead="Societies are created from the society admin app." />
        <Link href="/login" className={buttonClasses('primary', 'md', true)}>
          Back to sign in
        </Link>
      </AuthShell>
    );

  return (
    <AuthShell>
      <BackLink href="/login">Back to sign in</BackLink>
      <AuthHeading
        title="Verify your mobile"
        lead="First we confirm your number, then you add your society details."
      />
      <div aria-live="assertive">
        {alert && <Alert tone="bad">{alert}</Alert>}
        {lock.locked && <Alert tone="bad">{lockMessage(lock.left)}</Alert>}
      </div>
      <form onSubmit={submit} noValidate>
        <Input
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98200 11111"
          value={mobile}
          onChange={e => setMobile(e.target.value)}
          hint="We will text a 6-digit code."
          error={error}
          required
        />
        <Button type="submit" block loading={busy} disabled={lock.locked}>
          Send OTP
        </Button>
      </form>
      <p className="mt-4 text-center text-[14px]">
        Already have an account?{' '}
        <Link href="/login" className={linkClass}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
