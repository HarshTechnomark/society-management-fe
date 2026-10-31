'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { OtpInput } from '@/components/ui/OtpInput';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { QrCode } from '../QrCode';
import { RecoveryCodes } from '../RecoveryCodes';
import { Row, SecurityCard } from './SecurityCard';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage } from '@/lib/authErrors';
import { groupSecret } from '@/lib/validation';
import { authService } from '@/services/auth.service';
import type { SecurityOverview, TotpSetup } from '@/types/auth';

type Dialog = null | 'setup' | 'off' | 'regen';

/** Shows new recovery codes once. Sticky: Esc and outside clicks do nothing until the user confirms they saved them. */
export function RecoveryCodesDialog({ codes, onDone }: { codes: string[] | null; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <Modal
      open={!!codes}
      sticky
      onClose={onDone}
      title="Save your recovery codes"
      description="Each code works once. We cannot show them again."
      footer={
        <Button disabled={!saved} onClick={onDone}>
          Done
        </Button>
      }
    >
      {codes && <RecoveryCodes codes={codes} />}
      <Checkbox
        label="I have saved these codes somewhere safe"
        checked={saved}
        onChange={e => setSaved(e.target.checked)}
      />
    </Modal>
  );
}

export function AuthenticatorCard({ data, onChanged }: { data: SecurityOverview; onChanged: () => void }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const low = data.mfaEnabled && data.recoveryCodesRemaining <= 2;

  const close = () => {
    setDialog(null);
    setSetup(null);
    setCode('');
    setError(null);
  };

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'REAUTH_REQUIRED')) {
        setCode('');
        setError(
          e instanceof ApiError && (e.code === 'TOTP_INVALID' || e.code === 'TOTP_REUSED')
            ? 'That code is not correct. Check the time on your phone and try again.'
            : e instanceof ApiError && e.code === 'MFA_MANDATORY'
              ? 'Two-step sign-in is required for your role, so it cannot be turned off.'
              : authErrorMessage(e),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const openSetup = () => {
    setDialog('setup');
    void guard(async () => setSetup(await authService.totpSetup()));
  };
  const confirmSetup = (value: string) =>
    guard(async () => {
      const r = await authService.totpConfirm(value);
      close();
      setCodes(r.recoveryCodes);
      onChanged();
    });
  const turnOff = () =>
    guard(async () => {
      await authService.totpOff();
      close();
      toast.show('Authenticator turned off.');
      onChanged();
    });
  const regenerate = () =>
    guard(async () => {
      const r = await authService.newRecoveryCodes();
      close();
      setCodes(r.recoveryCodes);
      onChanged();
    });

  return (
    <SecurityCard title="Authenticator and recovery" id="authenticator">
      {low && (
        <Alert tone="warn">
          You have {data.recoveryCodesRemaining} recovery{' '}
          {data.recoveryCodesRemaining === 1 ? 'code' : 'codes'} left. Generate new codes soon.
        </Alert>
      )}
      <Row>
        <div>
          <b>Authenticator app</b>{' '}
          <Chip tone={data.mfaEnabled ? 'ok' : 'neutral'}>{data.mfaEnabled ? 'On' : 'Off'}</Chip>
          {data.mfaMandatory && <p className="text-[13px] text-muted">Required for your role.</p>}
        </div>
        {data.mfaEnabled ? (
          !data.mfaMandatory && (
            <Button variant="danger-soft" size="sm" onClick={() => setDialog('off')}>
              Turn off
            </Button>
          )
        ) : (
          <Button size="sm" onClick={openSetup}>
            Set up authenticator
          </Button>
        )}
      </Row>
      {data.mfaEnabled && (
        <Row>
          <div>
            <b>Recovery codes</b>
            <p className="text-[13px] text-muted">{data.recoveryCodesRemaining} of 10 recovery codes left</p>
          </div>
          <Button variant="glass" size="sm" onClick={() => setDialog('regen')}>
            Generate new codes
          </Button>
        </Row>
      )}

      <Modal
        open={dialog === 'setup'}
        onClose={close}
        title="Set up your authenticator"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!setup || code.length !== 6} onClick={() => confirmSetup(code)}>
              Verify and turn on
            </Button>
          </>
        }
      >
        <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
        {setup ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-4">
              <QrCode value={setup.otpauthUri} />
              <dl className="min-w-0 text-[13.5px]">
                <dt className="text-muted">Or enter this key</dt>
                <dd className="mb-2 break-all font-mono text-[15px] font-semibold">
                  {groupSecret(setup.secret)}
                </dd>
                <dt className="text-muted">Account</dt>
                <dd className="break-all font-semibold">{setup.accountLabel}</dd>
              </dl>
            </div>
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={confirmSetup}
              disabled={busy}
              invalid={!!error}
              label="Authenticator code"
            />
          </>
        ) : (
          !error && <p className="text-muted">Preparing your key...</p>
        )}
      </Modal>

      <Modal
        open={dialog === 'off'}
        onClose={close}
        title="Turn off the authenticator?"
        description="Your recovery codes will be deleted too. You can set it up again later."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={turnOff}>
              Turn off
            </Button>
          </>
        }
      >
        <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
      </Modal>

      <Modal
        open={dialog === 'regen'}
        onClose={close}
        title="Generate new recovery codes?"
        description="Your old codes stop working as soon as new ones are made."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button loading={busy} onClick={regenerate}>
              Generate new codes
            </Button>
          </>
        }
      >
        <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
      </Modal>

      <RecoveryCodesDialog codes={codes} onDone={() => setCodes(null)} />
    </SecurityCard>
  );
}
