'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AuthHeading, AuthShell, Divider, linkClass } from './AuthShell';
import { useLock } from './useLock';
import { useSignInResult } from './useSignIn';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage, lockMessage, lockSeconds } from '@/lib/authErrors';
import { flow, readRememberedEmail, writeRememberedEmail } from '@/lib/authFlow';
import { identifierKind } from '@/lib/identifier';
import { getAssertion, passkeysSupported } from '@/lib/webauthn';
import { isValidEmail, isValidMobile, normaliseMobile } from '@/lib/validation';
import { authService } from '@/services/auth.service';

/**
 * The one sign-in page for every role. A single box takes a mobile number or an email: a mobile number gets a code by SMS, an email
 * asks for its password. Passkeys work as before. Which app the person lands in is decided by the API after sign-in
 * (and asked, when they can open more than one), so nothing on this page depends on the address.
 */
export function UnifiedLoginForm({ notice }: { notice?: ['info' | 'warn' | 'ok', string] }) {
  const router = useRouter();
  const { handle, suffix } = useSignInResult();
  const [identifier, setIdentifier] = useState(() => readRememberedEmail());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => !!readRememberedEmail());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useLock();
  const kind = identifierKind(identifier);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') {
      lock.lock(lockSeconds(e));
      setAlert(null);
    } else setAlert(authErrorMessage(e));
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setAlert(null);
    if (kind === 'email') {
      const next: Record<string, string> = {};
      if (!isValidEmail(identifier)) next.identifier = 'Enter a valid email address.';
      if (!password) next.password = 'Enter your password.';
      setErrors(next);
      if (Object.keys(next).length) return;
      setBusy(true);
      try {
        const email = identifier.trim().toLowerCase();
        const result = await authService.passwordLogin(email, password);
        writeRememberedEmail(remember ? email : null);
        handle(result);
      } catch (e) {
        fail(e);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (kind === 'mobile') {
      if (!isValidMobile(identifier))
        return setErrors({ identifier: 'Enter a valid 10-digit mobile number.' });
      setErrors({});
      setBusy(true);
      try {
        const n = normaliseMobile(identifier);
        const ch = await authService.sendOtp(n, 'LOGIN');
        flow.set({ otp: { ...ch, purpose: 'LOGIN', mobile: n } });
        router.push(`/login/otp${suffix}`);
      } catch (e) {
        fail(e);
      } finally {
        setBusy(false);
      }
      return;
    }
    setErrors({ identifier: 'Enter your mobile number or your email address.' });
  };

  const passkey = async () => {
    setAlert(null);
    setBusy(true);
    try {
      const { challengeId, publicKey } = await authService.passkeyOptions();
      const credential = await getAssertion(publicKey);
      if (!credential) return;
      handle(await authService.passkeyVerify(challengeId, credential));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthHeading title="Welcome back" lead="Sign in with your mobile number or your email." />
      {notice && <Alert tone={notice[0]}>{notice[1]}</Alert>}
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
      {lock.locked && <Alert tone="bad">{lockMessage(lock.left)}</Alert>}
      <form onSubmit={submit} noValidate>
        <Input
          label="Mobile number or email"
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="98200 11111 or name@society.in"
          value={identifier}
          onChange={e => {
            setIdentifier(e.target.value);
            setErrors({});
          }}
          hint={
            kind === 'mobile'
              ? 'We will text a 6-digit code.'
              : kind === 'email'
                ? undefined
                : 'A mobile number gets a text code. An email asks for its password.'
          }
          error={errors.identifier}
          required
        />
        {kind === 'email' && (
          <>
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={errors.password}
              required
            />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="[&>div]:mb-0">
                <Checkbox
                  label="Remember my email"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
              </div>
              <Link href="/forgot" className={`${linkClass} text-[13.5px]`}>
                Forgot password?
              </Link>
            </div>
          </>
        )}
        <Button type="submit" block loading={busy} disabled={lock.locked}>
          {kind === 'email' ? 'Sign in' : kind === 'mobile' ? 'Send OTP' : 'Continue'}
        </Button>
      </form>
      {passkeysSupported() && (
        <>
          <Divider />
          <Button variant="glass" block onClick={passkey} disabled={busy}>
            Sign in with a passkey
          </Button>
        </>
      )}
      <p className="mt-4 text-center text-[14px]">
        New society?{' '}
        <Link href="/signup" className={linkClass}>
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
