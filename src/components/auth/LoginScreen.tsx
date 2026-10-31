'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { cx } from '@/components/ui/cx';
import { AuthHeading, AuthShell, Divider, linkClass } from './AuthShell';
import { useLock } from './useLock';
import { useSignInResult } from './useSignIn';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage, lockMessage, lockSeconds } from '@/lib/authErrors';
import { flow, readRememberedEmail, writeRememberedEmail } from '@/lib/authFlow';
import { allowsMobileLogin, allowsPasskey, allowsPasswordLogin, useClientApp } from '@/lib/clientApp';
import { getAssertion, passkeysSupported } from '@/lib/webauthn';
import { useHydrated } from '@/lib/clientApp';
import { isValidEmail, isValidMobile, normaliseMobile } from '@/lib/validation';
import { authService } from '@/services/auth.service';

const NOTICES: Record<string, ['info' | 'warn' | 'ok', string]> = {
  signedout: ['info', 'You have been signed out.'],
  idle: ['warn', 'You were signed out after a period of inactivity.'],
  reset: ['ok', 'Password updated. Sign in with your new password. Other sessions were signed out.'],
  invite: ['ok', 'Password set. Sign in to continue.'],
  expired: ['warn', 'Your session expired. Please sign in again.'],
  deleted: ['info', 'Your account is scheduled for deletion. Sign in within 30 days to cancel.'],
  challenge: ['warn', 'Your sign-in took too long. Please start again.'],
};

export function LoginScreen() {
  const hydrated = useHydrated();
  // The form reads localStorage and browser support, so it renders on the client only.
  return hydrated ? (
    <LoginForm />
  ) : (
    <AuthShell>
      <div className="min-h-[320px]" aria-busy="true" />
    </AuthShell>
  );
}

function LoginForm() {
  const app = useClientApp();
  const router = useRouter();
  const params = useSearchParams();
  const { handle, suffix } = useSignInResult();
  const canMobile = allowsMobileLogin(app);
  const canPassword = allowsPasswordLogin(app);
  const [mode, setMode] = useState<'mobile' | 'email'>(canMobile ? 'mobile' : 'email');
  const active = canMobile && canPassword ? mode : canMobile ? 'mobile' : 'email';

  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState(() => readRememberedEmail());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => !!readRememberedEmail());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useLock();

  const notice = NOTICES[params.get('r') ?? ''];

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') {
      lock.lock(lockSeconds(e));
      setAlert(null);
    } else setAlert(authErrorMessage(e));
  };

  const submitMobile = async (ev: FormEvent) => {
    ev.preventDefault();
    setAlert(null);
    if (!isValidMobile(mobile)) return setErrors({ mobile: 'Enter a valid 10-digit mobile number.' });
    setErrors({});
    setBusy(true);
    try {
      const n = normaliseMobile(mobile);
      const ch = await authService.sendOtp(n, 'LOGIN');
      flow.set({ otp: { ...ch, purpose: 'LOGIN', mobile: n } });
      router.push(`/login/otp${suffix}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async (ev: FormEvent) => {
    ev.preventDefault();
    setAlert(null);
    const next: Record<string, string> = {};
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const result = await authService.passwordLogin(email.trim().toLowerCase(), password);
      writeRememberedEmail(remember ? email.trim().toLowerCase() : null);
      handle(result);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
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

  const lockedNote = lock.locked && <Alert tone="bad">{lockMessage(lock.left)}</Alert>;

  return (
    <AuthShell>
      <AuthHeading
        title="Welcome back"
        lead={app === 'PLATFORM' ? 'Sign in to the console.' : 'Sign in to continue.'}
      />
      {notice && <Alert tone={notice[0]}>{notice[1]}</Alert>}
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
      {lockedNote}
      {canMobile && canPassword && (
        <div
          role="tablist"
          aria-label="Sign-in method"
          className="mb-4 flex w-full gap-0.5 rounded-full border border-white/80 bg-white/55 p-[3px]"
        >
          {(['mobile', 'email'] as const).map(m => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active === m}
              onClick={() => {
                setMode(m);
                setErrors({});
                setAlert(null);
              }}
              className={cx(
                'h-[34px] flex-1 rounded-full text-[13px] font-semibold',
                active === m ? 'bg-navy text-[#FDF8EE]' : 'text-muted',
              )}
            >
              {m === 'mobile' ? 'Mobile OTP' : 'Email and password'}
            </button>
          ))}
        </div>
      )}

      {active === 'mobile' ? (
        <form onSubmit={submitMobile} noValidate>
          <Input
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98200 11111"
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            hint="We will text a 6-digit code."
            error={errors.mobile}
            required
          />
          <Button type="submit" block loading={busy} disabled={lock.locked}>
            Send OTP
          </Button>
        </form>
      ) : (
        <form onSubmit={submitEmail} noValidate>
          <Input
            label={app === 'PLATFORM' ? 'Work email' : 'Email'}
            type="email"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={errors.email}
            required
          />
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
          <Button type="submit" block loading={busy} disabled={lock.locked}>
            Sign in
          </Button>
        </form>
      )}

      {allowsPasskey(app) && passkeysSupported() && (
        <>
          <Divider />
          <Button variant="glass" block onClick={passkey} disabled={busy}>
            Sign in with a passkey
          </Button>
        </>
      )}
      {app === 'ADMIN' && (
        <p className="mt-4 text-center text-[14px]">
          New society?{' '}
          <Link href="/signup" className={linkClass}>
            Create one
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
