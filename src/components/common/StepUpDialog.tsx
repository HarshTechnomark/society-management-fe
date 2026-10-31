'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { OtpInput } from '@/components/ui/OtpInput';
import { ApiError, configureApiClient } from '@/lib/apiClient';
import { loadMe, useMe } from '@/lib/auth';
import { getAssertion, passkeysSupported } from '@/lib/webauthn';
import { formatCountdown, maskMobile } from '@/lib/validation';
import { authService } from '@/services/auth.service';

interface Props {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

function describe(e: unknown, method: 'TOTP' | 'OTP' | 'PASSKEY'): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  switch (e.code) {
    case 'TOTP_INVALID':
      return 'That code is not correct. Check the time on your phone and try again.';
    case 'TOTP_REUSED':
      return 'That code was already used. Wait for the next one and try again.';
    case 'OTP_INVALID': {
      const left = e.metaNumber('attemptsLeft');
      return `That code is not correct.${left !== undefined ? ` ${left} attempts left.` : ''}`;
    }
    case 'OTP_EXPIRED':
    case 'CHALLENGE_INVALID':
      return method === 'OTP' ? 'That code has expired. Send a new one.' : 'That took too long. Try again.';
    case 'PASSKEY_INVALID':
      return 'That passkey was not accepted. Try again or use another method.';
    case 'ACCOUNT_LOCKED': {
      const s = e.metaNumber('retryAfterSeconds') ?? e.retryAfterSeconds;
      return s
        ? `Too many attempts. Try again in ${formatCountdown(s)}.`
        : 'Too many attempts. Try again later.';
    }
    default:
      return e.message;
  }
}

/** "Confirm it is you": a fresh authenticator code, a mobile OTP (when MFA is off) or a passkey. */
export function StepUpDialog({ open, onSuccess, onCancel }: Props) {
  const { me } = useMe();
  const [method, setMethod] = useState<'TOTP' | 'OTP' | 'PASSKEY' | null>(null);
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) void loadMe();
  }, [open]);

  const user = me?.user;
  const base: 'TOTP' | 'OTP' | null = user ? (user.mfaEnabled ? 'TOTP' : 'OTP') : null;
  const active = method ?? base;
  const canPasskey = !!user && user.passkeyCount > 0 && passkeysSupported();

  const reset = () => {
    setCode('');
    setError(null);
  };

  const run = async (fn: () => Promise<unknown>, m: 'TOTP' | 'OTP' | 'PASSKEY') => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setCode('');
      onSuccess();
    } catch (e) {
      setError(describe(e, m));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = (c: string) => {
    if (busy || c.length !== 6) return;
    if (active === 'TOTP') void run(() => authService.reauth({ method: 'TOTP', code: c }), 'TOTP');
    else if (active === 'OTP' && challengeId)
      void run(() => authService.reauth({ method: 'OTP', code: c, challengeId }), 'OTP');
  };

  const sendOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const ch = await authService.reauthOtp();
      setChallengeId(ch.challengeId);
    } catch (e) {
      setError(describe(e, 'OTP'));
    } finally {
      setBusy(false);
    }
  };

  const signInWithPasskey = () =>
    run(async () => {
      const { challengeId: id, publicKey } = await authService.reauthPasskeyOptions();
      const credential = await getAssertion(publicKey);
      if (!credential) throw new ApiError(0, 'PASSKEY_INVALID', 'Cancelled');
      await authService.reauth({ method: 'PASSKEY', challengeId: id, credential });
    }, 'PASSKEY');

  const cancel = () => {
    reset();
    setMethod(null);
    setChallengeId(null);
    onCancel();
  };

  const showBoxes = active === 'TOTP' || (active === 'OTP' && challengeId);

  return (
    <Modal
      open={open}
      onClose={cancel}
      title="Confirm it is you"
      description="This action needs a fresh confirmation."
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          {showBoxes && (
            <Button loading={busy} disabled={code.length !== 6} onClick={() => verifyCode(code)}>
              Verify
            </Button>
          )}
        </>
      }
    >
      <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
      {!user && <p className="text-[14px] text-muted">Loading...</p>}
      {active === 'TOTP' && (
        <>
          <p className="mb-2 text-[14px] text-muted">Enter the 6-digit code from your authenticator app.</p>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={verifyCode}
            disabled={busy}
            invalid={!!error}
            autoFocus
          />
        </>
      )}
      {active === 'OTP' && !challengeId && (
        <Button block loading={busy} onClick={sendOtp}>
          Send code to {maskMobile(user?.mobile)}
        </Button>
      )}
      {active === 'OTP' && challengeId && (
        <>
          <p className="mb-2 text-[14px] text-muted">We sent a 6-digit code to {maskMobile(user?.mobile)}.</p>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={verifyCode}
            disabled={busy}
            invalid={!!error}
            autoFocus
          />
        </>
      )}
      {canPasskey && (
        <Button
          variant="glass"
          block
          className="mt-2"
          loading={busy && method === 'PASSKEY'}
          onClick={() => {
            setMethod('PASSKEY');
            void signInWithPasskey();
          }}
        >
          Use a passkey instead
        </Button>
      )}
    </Modal>
  );
}

interface StepUpCtx {
  /** Opens the dialog and resolves true after a successful confirmation. */
  requestStepUp: () => Promise<boolean>;
}
const Ctx = createContext<StepUpCtx>({ requestStepUp: async () => false });
export const useStepUp = () => useContext(Ctx);

/** Registers the dialog with the API client so a `401 REAUTH_REQUIRED` opens it and then retries the request. */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const requestStepUp = useCallback(
    () =>
      new Promise<boolean>(resolve => {
        // A second request while the dialog is open shares the same answer.
        const prev = resolver.current;
        resolver.current = ok => {
          prev?.(ok);
          resolve(ok);
        };
        setOpen(true);
      }),
    [],
  );

  useEffect(() => {
    configureApiClient({ stepUp: requestStepUp });
    return () => configureApiClient({ stepUp: null });
  }, [requestStepUp]);

  const finish = (ok: boolean) => {
    setOpen(false);
    const r = resolver.current;
    resolver.current = null;
    r?.(ok);
  };

  return (
    <Ctx.Provider value={{ requestStepUp }}>
      {children}
      <StepUpDialog open={open} onSuccess={() => finish(true)} onCancel={() => finish(false)} />
    </Ctx.Provider>
  );
}
