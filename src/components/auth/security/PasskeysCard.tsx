'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/common/EmptyState';
import { Row, SecurityCard } from './SecurityCard';
import { fmtDate } from './format';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage } from '@/lib/authErrors';
import { createCredential, passkeysSupported } from '@/lib/webauthn';
import { authService } from '@/services/auth.service';
import type { Passkey } from '@/types/auth';

export function PasskeysCard({ passkeys, onChanged }: { passkeys: Passkey[]; onChanged: () => void }) {
  const toast = useToast();
  const [rename, setRename] = useState<Passkey | null>(null);
  const [remove, setRemove] = useState<Passkey | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PASSKEY_LIMIT_REACHED')
        setError('You already have 10 passkeys. Remove one first.');
      else if (e instanceof ApiError && e.code === 'PASSKEY_ALREADY_REGISTERED')
        setError('This passkey is already added.');
      else if (!(e instanceof ApiError && e.code === 'REAUTH_REQUIRED')) setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      const { challengeId, publicKey } = await authService.passkeyRegisterOptions();
      const credential = await createCredential(publicKey);
      if (!credential) return;
      await authService.passkeyRegister(challengeId, credential);
      toast.show('Passkey added.');
      onChanged();
    });

  return (
    <SecurityCard title="Passkeys" id="passkeys">
      <div aria-live="assertive">{error && !rename && !remove && <Alert tone="bad">{error}</Alert>}</div>
      {passkeys.length === 0 ? (
        <EmptyState
          title="No passkeys yet"
          text="A passkey lets you sign in with your fingerprint, face or screen lock."
        />
      ) : (
        <ul>
          {passkeys.map(p => (
            <li key={p.id}>
              <Row>
                <div className="min-w-0">
                  <b className="block truncate">{p.name}</b>
                  <span className="text-[13px] text-muted">Last used {fmtDate(p.lastUsedAt)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="glass"
                    size="xs"
                    aria-label={`Rename ${p.name}`}
                    onClick={() => {
                      setName(p.name);
                      setError(null);
                      setRename(p);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="danger-soft"
                    size="xs"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => {
                      setError(null);
                      setRemove(p);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </Row>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Button
          size="sm"
          loading={busy && !rename && !remove}
          disabled={!passkeysSupported() || passkeys.length >= 10}
          onClick={add}
        >
          Add a passkey
        </Button>
        {!passkeysSupported() && (
          <p className="mt-2 text-[13px] text-muted">This browser does not support passkeys.</p>
        )}
      </div>

      <Modal
        open={!!rename}
        onClose={() => setRename(null)}
        title="Rename passkey"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRename(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={name.trim().length < 1 || name.trim().length > 60}
              onClick={() =>
                run(async () => {
                  await authService.renamePasskey(rename!.id, name.trim());
                  setRename(null);
                  onChanged();
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
        <Input label="Name" value={name} maxLength={60} onChange={e => setName(e.target.value)} />
      </Modal>

      <Modal
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Remove this passkey?"
        description={remove ? `${remove.name} will no longer sign in to your account.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                run(async () => {
                  await authService.removePasskey(remove!.id);
                  setRemove(null);
                  toast.show('Passkey removed.');
                  onChanged();
                })
              }
            >
              Remove
            </Button>
          </>
        }
      >
        <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
      </Modal>
    </SecurityCard>
  );
}
