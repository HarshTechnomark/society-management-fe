'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { useMe } from '@/lib/auth';
import { societiesService } from '@/services/societies.service';
import { emitStatusChanged } from '../events';
import { SCOPE_PLAIN, clockTime, firstName, societyErrorText } from '../format';

/** A-02 Consent approval page (deep link from push, WhatsApp or email), phone-first. */
export function ConsentApproval({ id }: { id: number }) {
  const { me } = useMe();
  const toast = useToast();
  const canApprove = usePermission(PERMISSIONS.settings.supportAccess.approve);
  const grant = useLoad(() => societiesService.societyGrant(id), id);
  const [busy, setBusy] = useState(false);
  const [denying, setDenying] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  const societyName =
    me?.memberships.find(m => m.societyId === me.activeSocietyId)?.societyName ??
    grant.data?.society.name ??
    'Your society';

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto w-full max-w-[520px] px-4 py-6">
      <div className="glass p-5 sm:p-7">{body}</div>
    </main>
  );

  if (grant.error) {
    const gone = grant.error instanceof ApiError && grant.error.code === 'SUPPORT_GRANT_NOT_FOUND';
    return shell(
      gone ? (
        <>
          <h1 className="text-[22px] font-bold">Request not found</h1>
          <p className="mt-2 text-muted">This request does not exist or belongs to another society.</p>
        </>
      ) : (
        <ErrorState error={grant.error} />
      ),
    );
  }
  const g = grant.data;
  if (!g) return shell(<div className="skeleton h-40 w-full" />);

  const decided = g.status !== 'PENDING_CONSENT' || done;

  const approve = async () => {
    setBusy(true);
    setAlert(null);
    try {
      const r = await societiesService.approveGrant(g.id, g.version);
      setDone(`Approved. SocietyApp support has access until ${clockTime(r?.endsAt)}.`);
      emitStatusChanged();
    } catch (e) {
      if (e instanceof ApiError && ['INVALID_STATE', 'CONSENT_WINDOW_EXPIRED'].includes(e.code))
        grant.reload();
      setAlert(societyErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return shell(
    <>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">{societyName}</p>
      <h1 className="mt-1 text-[24px] font-bold tracking-tight">SocietyApp support asks for access</h1>
      <div aria-live="assertive">
        {alert && (
          <Alert tone="bad" className="mt-3">
            {alert}
          </Alert>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-[15px]">
        <dt className="text-muted">Who</dt>
        <dd>{firstName(g.requester.name)}, SocietyApp Support</dd>
        <dt className="text-muted">Access</dt>
        <dd>
          {firstName(g.requester.name)} {SCOPE_PLAIN[g.scope]} your society’s data
        </dd>
        <dt className="text-muted">For</dt>
        <dd>{g.durationMinutes} minutes from when you approve</dd>
        <dt className="text-muted">Why</dt>
        <dd>{g.reason}</dd>
        {g.ticketRef && (
          <>
            <dt className="text-muted">Ticket</dt>
            <dd>{g.ticketRef}</dd>
          </>
        )}
      </dl>
      {done ? (
        <Alert tone="ok" className="mt-5">
          {done}
        </Alert>
      ) : decided ? (
        <Alert tone="info" className="mt-5">
          This request is no longer waiting for a decision.
        </Alert>
      ) : canApprove ? (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button block loading={busy} onClick={approve}>
            Approve
          </Button>
          <Button block variant="glass" onClick={() => setDenying(true)}>
            Deny
          </Button>
        </div>
      ) : (
        <Alert tone="info" className="mt-5">
          Only the chairman or society admin can decide this request.
        </Alert>
      )}
      <p className="mt-5 text-[13px] text-muted">
        Everything support does is recorded in your audit trail. You can end access at any time from{' '}
        <Link href="/admin/settings/support-access" className="text-navy underline">
          Settings › Support access
        </Link>
        .
      </p>
      <ConfirmReason
        open={denying}
        title="Deny this request?"
        description="Support is told that you said no."
        confirmLabel="Deny"
        onCancel={() => setDenying(false)}
        onConfirm={async reason => {
          try {
            await societiesService.denyGrant(g.id, { reason, version: g.version });
            setDone('Denied. Support has been told.');
            toast.show('Request denied');
            emitStatusChanged();
          } catch (e) {
            setAlert(societyErrorText(e));
          }
          setDenying(false);
        }}
      />
    </>,
  );
}
