'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthHeading, AuthShell } from '@/components/auth/AuthShell';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/common/ErrorState';
import { ApiError, loginUrl } from '@/lib/apiClient';
import { loadMe, setMe } from '@/lib/auth';
import { accessControlService } from '@/services/access-control.service';
import { authService } from '@/services/auth.service';
import type { Me } from '@/types/auth';
import type { InvitationPreview } from '@/types/accessControl';
import { fmtDate } from '../format';

const NOT_USABLE: Record<string, string> = {
  ACCEPTED: 'This invitation was already used.',
  DECLINED: 'This invitation was declined.',
  REVOKED: 'This invitation was withdrawn by the society.',
  EXPIRED: 'This invitation has expired. Ask the society to send a new one.',
};

/** Words for the accept and decline errors (spec 8.16, 8.17 and 11.9). */
function describe(e: unknown, preview: InvitationPreview): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  switch (e.code) {
    case 'INVITATION_MOBILE_MISMATCH':
      return `This invitation is for ${preview.mobileMasked}. Sign out and sign in with that number.`;
    case 'INVITATION_EXPIRED':
      return NOT_USABLE.EXPIRED;
    case 'INVITATION_NOT_PENDING':
      return 'This invitation was already answered or withdrawn.';
    case 'INVITATION_NOT_FOUND':
      return 'This invitation link is not valid.';
    case 'ALREADY_MEMBER':
      return 'You are already a member of this society.';
    case 'USAGE_LIMIT_EXCEEDED':
      return 'The society has no free admin seat right now. The invitation stays valid. Ask them to free a seat, then try again.';
    case 'MEMBERSHIP_LIMIT_REACHED':
      return 'You are already in 20 societies. Leave one before accepting.';
    case 'SOCIETY_CLOSED':
      return 'This society is closed.';
    case 'RATE_LIMITED':
      return 'Too many tries. Wait a minute and try again.';
    default:
      return e.message;
  }
}

/** Where to send the user after accept: a same-site path, or another host (admin, gate, work). */
function go(redirectTo: string) {
  window.location.assign(redirectTo);
}

/** Spec 11.9: `/invite/[token]`. */
export function InviteScreen({ token }: { token: string }) {
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [me, setMeState] = useState<Me | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<'declined' | null>(null);

  useEffect(() => {
    let live = true;
    accessControlService.invitationPreview(token).then(
      p => live && setPreview(p),
      e => live && setLoadError(e),
    );
    void loadMe().then(m => live && setMeState(m));
    return () => {
      live = false;
    };
  }, [token]);

  const next = `/invite/${token}`;

  const accept = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const r = await accessControlService.acceptInvitation(token);
      if (r.reSignInRequired) {
        setMe(null);
        window.location.assign(loginUrl(undefined, new URL(r.redirectTo, window.location.origin).pathname));
        return;
      }
      if (r.societyId) await authService.switchSociety(r.societyId);
      go(r.redirectTo);
    } catch (e) {
      setError(describe(e, preview));
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await accessControlService.declineInvitation(token, reason.trim() || undefined);
      setDeclining(false);
      setDone('declined');
    } catch (e) {
      setDeclining(false);
      setError(describe(e, preview));
    } finally {
      setBusy(false);
    }
  };

  const signOutHere = async () => {
    try {
      await authService.logout();
    } catch {
      /* the cookies expire on their own */
    }
    setMe(null);
    window.location.assign(loginUrl(undefined, next));
  };

  if (loadError) {
    const e = loadError as ApiError;
    const known =
      e instanceof ApiError &&
      ['INVITATION_NOT_FOUND', 'INVITATION_EXPIRED', 'INVITATION_NOT_PENDING'].includes(e.code);
    return (
      <AuthShell>
        {known ? (
          <AuthHeading
            title="Invitation not available"
            lead={
              e.code === 'INVITATION_EXPIRED'
                ? NOT_USABLE.EXPIRED
                : e.code === 'INVITATION_NOT_PENDING'
                  ? 'This invitation was already used or withdrawn.'
                  : 'This invitation link is not valid. Check the link in your message or ask the society to send it again.'
            }
          />
        ) : (
          <ErrorState error={loadError} title="The invitation could not be loaded" />
        )}
      </AuthShell>
    );
  }
  if (!preview)
    return (
      <AuthShell>
        <AuthHeading title="Opening your invitation" lead="One moment..." />
      </AuthShell>
    );

  if (done === 'declined')
    return (
      <AuthShell>
        <AuthHeading title="Invitation declined" lead={`${preview.societyName} has been told.`} />
      </AuthShell>
    );

  const usable = preview.status === 'PENDING';
  const platform = preview.scope === 'platform';

  return (
    <AuthShell>
      <div className="mb-4 flex items-center gap-3">
        {preview.societyLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.societyLogoUrl} alt="" className="h-12 w-12 rounded-2xl object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(201,169,97,0.32)] text-[18px] font-bold text-gold-ink"
          >
            {preview.societyName.charAt(0)}
          </span>
        )}
        <b className="text-[18px]">{preview.societyName}</b>
      </div>
      <AuthHeading
        title={`${preview.inviterName} invited you as ${preview.roleName}`}
        lead={`For ${preview.inviteeName}, mobile ${preview.mobileMasked}.`}
      />
      {preview.message && (
        <blockquote className="mb-4 rounded-[14px] bg-white/60 px-4 py-3 text-[14.5px] italic">
          {preview.message}
        </blockquote>
      )}
      {usable ? (
        <p className="mb-4 text-[13.5px] text-muted">
          This invitation is valid until {fmtDate(preview.expiresAt)}.
          {preview.requiresMfa &&
            ' This role needs two-step sign-in, so you will add an authenticator app next.'}
        </p>
      ) : (
        <Alert tone="warn">{NOT_USABLE[preview.status] ?? 'This invitation is no longer valid.'}</Alert>
      )}
      {error && (
        <Alert tone="bad">
          {error}
          {error.includes('Sign out and sign in') && (
            <>
              {' '}
              <button type="button" className="font-bold underline" onClick={signOutHere}>
                Sign out
              </button>
            </>
          )}
        </Alert>
      )}
      {usable && me === undefined && <p className="text-muted">Checking your sign-in...</p>}
      {usable && me === null && (
        <>
          <Link href={loginUrl(undefined, next)} className={buttonClasses('primary', 'md', true)}>
            Continue with OTP
          </Link>
          <p className="mt-3 text-[13px] text-muted">
            Sign in with the mobile number {preview.mobileMasked}, then come back here to accept.
          </p>
        </>
      )}
      {usable && me && (
        <div className="flex flex-col gap-2">
          <Button block loading={busy} onClick={accept}>
            Accept invitation
          </Button>
          <Button block variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>
            Decline
          </Button>
          <p className="mt-1 text-center text-[12.5px] text-muted">
            Signed in as {me.user.name ?? me.user.mobile}.{' '}
            <button type="button" className="underline" onClick={signOutHere}>
              Not you?
            </button>
          </p>
        </div>
      )}
      {platform && usable && (
        <p className="mt-3 text-[12.5px] text-muted">
          This is an invitation to the SocietyApp platform team.
        </p>
      )}

      <Modal
        open={declining}
        onClose={() => setDeclining(false)}
        title="Decline this invitation?"
        description={`${preview.inviterName} will be told. You can add a short reason.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={decline}>
              Decline
            </Button>
          </>
        }
      >
        <label htmlFor="decline-reason" className="mb-1.5 block text-[13px] font-semibold">
          Reason (optional)
        </label>
        <textarea
          id="decline-reason"
          rows={3}
          maxLength={300}
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-[16px] border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 py-3 text-[15px] focus:border-navy focus:outline-none"
        />
      </Modal>
    </AuthShell>
  );
}
