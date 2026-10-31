'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { SecurityCard } from './SecurityCard';
import { fmtDate } from './format';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage } from '@/lib/authErrors';
import { authService } from '@/services/auth.service';

function blockerText(m: string): string {
  const [key, name] = [m.split(':')[0], m.split(':').slice(1).join(':')];
  if (key === 'PLATFORM_USER') return 'Platform team accounts cannot be deleted here.';
  if (key === 'COMMITTEE_ROLE') return `You hold a committee role in ${name}. Hand it over first.`;
  if (key === 'LAST_SOCIETY_ADMIN')
    return `You are the last society admin of ${name}. Name another admin first.`;
  return m;
}

export function PendingDeletionBanner({ date, onCancelled }: { date: string; onCancelled: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-[#f6e6c9] px-4 py-3 text-[#6f4200]"
    >
      <span className="font-semibold">Your account will be deleted on {fmtDate(date)}.</span>
      <Button
        variant="glass"
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await authService.cancelDeletion();
            toast.show('Deletion cancelled.');
            onCancelled();
          } catch (e) {
            toast.show(authErrorMessage(e), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        Cancel deletion
      </Button>
    </div>
  );
}

export function DeleteAccountCard({
  scheduledFor,
  onChanged,
}: {
  scheduledFor: string | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setText('');
    setReason('');
    setError(null);
    setBlockers([]);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setBlockers([]);
    try {
      await authService.requestDeletion(reason.trim() || undefined);
      close();
      toast.show('Account deletion scheduled.', 'warning');
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCOUNT_DELETION_BLOCKED')
        setBlockers((e.errors ?? []).map(x => x.message));
      else if (!(e instanceof ApiError && e.code === 'REAUTH_REQUIRED')) setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SecurityCard title="Delete my account" id="delete" danger>
      {scheduledFor ? (
        <p className="text-[14px] text-muted">
          Your account is scheduled for deletion on {fmtDate(scheduledFor)}. Use Cancel deletion above to keep
          it.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[14px] text-muted">
            Your account is deleted after 30 days. Sign in during that time to cancel. This cannot be undone
            afterwards.
          </p>
          <Button variant="danger-soft" size="sm" onClick={() => setOpen(true)}>
            Delete my account
          </Button>
        </>
      )}
      <Modal
        open={open}
        onClose={close}
        title="Delete your account?"
        description="Type DELETE to confirm. You can cancel within 30 days."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} disabled={text !== 'DELETE'} onClick={submit}>
              Delete my account
            </Button>
          </>
        }
      >
        <div aria-live="assertive">
          {error && <Alert tone="bad">{error}</Alert>}
          {blockers.length > 0 && (
            <Alert tone="bad">
              <span className="block font-semibold">We cannot delete your account yet:</span>
              <ul className="list-disc pl-5">
                {blockers.map(b => (
                  <li key={b}>{blockerText(b)}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
        <Input label="Type DELETE" value={text} onChange={e => setText(e.target.value)} autoComplete="off" />
        <Input
          label="Reason (optional)"
          value={reason}
          maxLength={500}
          onChange={e => setReason(e.target.value)}
        />
      </Modal>
    </SecurityCard>
  );
}
