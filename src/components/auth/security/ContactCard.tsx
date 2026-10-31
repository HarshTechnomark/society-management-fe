'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { OtpInput } from '@/components/ui/OtpInput';
import { useToast } from '@/components/ui/Toast';
import { Row, SecurityCard } from './SecurityCard';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage } from '@/lib/authErrors';
import { isValidEmail, isValidMobile, maskMobile, normaliseMobile } from '@/lib/validation';
import { authService } from '@/services/auth.service';
import type { SecurityOverview } from '@/types/auth';

type Dialog = null | 'mobile' | 'email';

export function ContactCard({ data, onChanged }: { data: SecurityOverview; onChanged: () => void }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [mobile, setMobile] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setDialog(null);
    setMobile('');
    setChallengeId(null);
    setCode('');
    setEmail('');
    setEmailSent(false);
    setFieldError(null);
    setError(null);
  };

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REAUTH_REQUIRED') return;
      setCode('');
      if (e instanceof ApiError && e.code === 'MOBILE_IN_USE')
        setFieldError('This number already belongs to another account.');
      else if (e instanceof ApiError && e.code === 'MOBILE_UNCHANGED')
        setFieldError('That is already your number.');
      else if (e instanceof ApiError && e.code === 'EMAIL_IN_USE')
        setFieldError('This email already belongs to another account.');
      else if (e instanceof ApiError && e.code === 'EMAIL_UNCHANGED')
        setFieldError('That is already your email.');
      else if (e instanceof ApiError && e.code === 'OTP_INVALID') setError('That code is not correct.');
      else if (e instanceof ApiError && e.code === 'OTP_EXPIRED')
        setError('That code has expired. Start again.');
      else setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startMobile = () => {
    if (!isValidMobile(mobile)) return setFieldError('Enter a valid 10-digit mobile number.');
    setFieldError(null);
    void guard(async () =>
      setChallengeId((await authService.mobileStart(normaliseMobile(mobile))).challengeId),
    );
  };
  const confirmMobile = (value: string) =>
    guard(async () => {
      await authService.mobileConfirm(challengeId!, value);
      close();
      toast.show('Mobile number changed.');
      onChanged();
    });
  const sendEmail = () => {
    if (!isValidEmail(email)) return setFieldError('Enter a valid email address.');
    setFieldError(null);
    void guard(async () => {
      await authService.emailChange(email.trim().toLowerCase());
      setEmailSent(true);
    });
  };

  return (
    <SecurityCard title="Mobile and email" id="contact">
      <Row>
        <div>
          <b>Mobile</b>
          <p className="text-[13px] text-muted">{maskMobile(data.mobile) || 'Not set'}</p>
        </div>
        <Button variant="glass" size="sm" onClick={() => setDialog('mobile')}>
          Change mobile
        </Button>
      </Row>
      <Row>
        <div>
          <b>Email</b> {data.email && !data.emailVerified && <Chip tone="warn">Unverified</Chip>}
          <p className="text-[13px] text-muted">{data.email ?? 'Not set'}</p>
        </div>
        <Button variant="glass" size="sm" onClick={() => setDialog('email')}>
          {data.email ? 'Change email' : 'Add email'}
        </Button>
      </Row>

      <Modal
        open={dialog === 'mobile'}
        onClose={close}
        title="Change mobile number"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {challengeId ? (
              <Button loading={busy} disabled={code.length !== 6} onClick={() => confirmMobile(code)}>
                Confirm
              </Button>
            ) : (
              <Button loading={busy} onClick={startMobile}>
                Send OTP
              </Button>
            )}
          </>
        }
      >
        <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
        {challengeId ? (
          <>
            <p className="mb-2 text-[14px] text-muted">We sent a 6-digit code to your new number.</p>
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={confirmMobile}
              disabled={busy}
              invalid={!!error}
            />
          </>
        ) : (
          <Input
            label="New mobile number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            error={fieldError}
            required
          />
        )}
      </Modal>

      <Modal
        open={dialog === 'email'}
        onClose={close}
        title={data.email ? 'Change email' : 'Add email'}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {emailSent ? 'Close' : 'Cancel'}
            </Button>
            {!emailSent && (
              <Button loading={busy} onClick={sendEmail}>
                Send confirmation link
              </Button>
            )}
          </>
        }
      >
        <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
        {emailSent ? (
          <Alert tone="ok">
            We sent a link to {email.trim().toLowerCase()}. Your email changes when you open it.
          </Alert>
        ) : (
          <Input
            label="New email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={fieldError}
            required
          />
        )}
      </Modal>
    </SecurityCard>
  );
}
