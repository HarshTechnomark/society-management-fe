'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useCountdown } from '@/hooks/useCountdown';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { useMe } from '@/lib/auth';
import { shortDate } from '@/lib/money';
import { societiesService } from '@/services/societies.service';
import type { SocietyStatusInfo } from '@/types/societies';
import { Banner } from '../bits';
import { clockTime, mmss, societyErrorText } from '../format';
import { useSocietyStatus } from './useSocietyStatus';

export const PLATFORM_CONSOLE_URL = `${process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'https://platform.societyapp.in'}/platform/support`;

/**
 * The admin app frame of module 05: status banners (A-03, A-04), the red support bar with Leave for a hand-off tab
 * (P-07), the closed page (A-05) and "Support access ended" when a hand-off session ends.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const isSupport = !!me?.supportGrant;
  const enabled = !!me?.activeSocietyId;
  const { status, error } = useSocietyStatus(enabled, !isSupport);
  const [ended, setEnded] = useState(false);

  const sessionGone =
    isSupport &&
    error instanceof ApiError &&
    (error.status === 401 || error.code === 'SUPPORT_ACCESS_EXPIRED');
  if (ended || sessionGone) return <SupportEnded />;

  const name =
    status?.societyName ??
    me?.memberships.find(m => m.societyId === me.activeSocietyId)?.societyName ??
    'Your society';

  if (status?.status === 'CLOSED' && !(status.viewerIsSupport ?? isSupport))
    return <ClosedScreen status={status} name={name} />;

  return (
    <>
      {status && (
        <StatusBanners
          status={status}
          name={name}
          isSupport={status.viewerIsSupport ?? isSupport}
          onEnded={() => setEnded(true)}
        />
      )}
      {children}
    </>
  );
}

function StatusBanners({
  status,
  name,
  isSupport,
  onEnded,
}: {
  status: SocietyStatusInfo;
  name: string;
  isSupport: boolean;
  onEnded: () => void;
}) {
  const canApprove = usePermission(PERMISSIONS.settings.supportAccess.approve);
  const canBilling = usePermission(PERMISSIONS.settings.subscription.view);
  const canExport = usePermission(PERMISSIONS.settings.dataExport.create);
  const sa = status.supportAccess;
  const b = status.banner;
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-4 sm:px-6">
      {sa?.active && isSupport && (
        <SupportBar name={name} scope={sa.scope} endsAt={sa.endsAt} onEnded={onEnded} />
      )}
      {sa?.active && !isSupport && (
        <Banner
          tone="bad"
          action={
            canApprove && (
              <Link href="/admin/settings/support-access" className={buttonClasses('glass', 'xs')}>
                Manage
              </Link>
            )
          }
        >
          SocietyApp support ({sa.staffFirstName}) has{' '}
          {sa.scope === 'READ_ONLY' ? 'read-only' : 'read and write'} access until {clockTime(sa.endsAt)}.
          Everything they do is recorded.
        </Banner>
      )}
      {!isSupport && (status.pendingSupportRequests ?? 0) > 0 && (
        <Banner
          tone="warn"
          action={
            <Link href="/admin/settings/support-access" className={buttonClasses('glass', 'xs')}>
              Review
            </Link>
          }
        >
          SocietyApp support asked for access to {name}.{' '}
          {status.pendingSupportRequests === 1
            ? 'One request is'
            : `${status.pendingSupportRequests} requests are`}{' '}
          waiting for a decision.
        </Banner>
      )}
      {b && (
        <Banner
          tone={b.tone === 'bad' ? 'bad' : b.tone === 'warn' ? 'warn' : 'info'}
          action={
            !isSupport && (status.status === 'SUSPENDED' || status.status === 'PAST_DUE') ? (
              <span className="flex flex-wrap gap-2">
                {canBilling && (
                  <Link href="/admin/settings/subscription" className={buttonClasses('glass', 'xs')}>
                    Pay now
                  </Link>
                )}
                {status.status === 'SUSPENDED' && canExport && (
                  <Link href="/admin/settings/data-export" className={buttonClasses('glass', 'xs')}>
                    Export data
                  </Link>
                )}
              </span>
            ) : undefined
          }
        >
          {b.text}
        </Banner>
      )}
    </div>
  );
}

/** The red bar in the hand-off tab: Leave ends only this admin-app session (module 02 logout). */
function SupportBar({
  name,
  scope,
  endsAt,
  onEnded,
}: {
  name: string;
  scope: 'READ_ONLY' | 'READ_WRITE';
  endsAt: string;
  onEnded: () => void;
}) {
  const toast = useToast();
  const left = useCountdown(endsAt);
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);
  useEffect(() => {
    if (left === 0 && !fired.current && Date.parse(endsAt) <= Date.now()) {
      fired.current = true;
      onEnded();
    }
  }, [left, endsAt, onEnded]);
  const leave = async () => {
    setBusy(true);
    try {
      await societiesService.leaveSupportSession();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.show(societyErrorText(e), 'error');
    } finally {
      setBusy(false);
      onEnded();
    }
  };
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-[16px] bg-bad px-4 py-3 text-[14px] font-semibold text-white"
    >
      <span className="min-w-0 flex-1">
        Support access active · {name} · {scope === 'READ_ONLY' ? 'read only' : 'read and write'} · expires{' '}
        {clockTime(endsAt)} (<span className="tabular-nums">{mmss(left)}</span>)
      </span>
      <Button size="xs" variant="glass" loading={busy} onClick={leave}>
        Leave
      </Button>
    </div>
  );
}

export function SupportEnded() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="glass w-full max-w-md p-8 text-center">
        <h1 className="text-[22px] font-bold">Support access ended</h1>
        <p className="mt-2 text-[14px] text-muted">
          This support session has ended. Start again from the platform console if you still need access.
        </p>
        <a href={PLATFORM_CONSOLE_URL} className={`${buttonClasses('primary', 'md')} mt-5`}>
          Back to the platform console
        </a>
      </div>
    </main>
  );
}

/** A-05 Closed page: the closure export for members who may download it, a short note for everyone else. */
export function ClosedScreen({ status, name }: { status: SocietyStatusInfo; name: string }) {
  const canDownload = usePermission(PERMISSIONS.settings.dataExport.view);
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="glass w-full max-w-lg p-6 sm:p-8">
        <h1 className="text-[22px] font-bold">
          {name} closed its SocietyApp account on {shortDate(status.closedAt)}.
        </h1>
        {canDownload ? (
          <ClosureExport id={status.closureExportId} />
        ) : (
          <p className="mt-3 text-[14px] text-muted">Contact your committee for a copy of your records.</p>
        )}
        <p className="mt-5 text-[13px] text-muted">
          Questions about the export or reopening? Write to support@societyapp.in. In an emergency call 112.
        </p>
      </div>
    </main>
  );
}

function ClosureExport({ id }: { id: number | null }) {
  const toast = useToast();
  const [state, setState] = useState<{
    id: number | null;
    data: Awaited<ReturnType<typeof societiesService.exportDetail>> | null;
    error: unknown;
  }>({
    id: null,
    data: null,
    error: null,
  });
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    societiesService.exportDetail(id).then(
      data => live && setState({ id, data, error: null }),
      error => live && setState({ id, data: null, error }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  if (!id)
    return (
      <p className="mt-3 text-[14px] text-muted">Your closure export is being prepared. Check back soon.</p>
    );
  if (state.error) return <ErrorState error={state.error} />;
  const x = state.data;
  if (!x) return <div className="skeleton mt-3 h-16 w-full" />;
  if (x.status !== 'READY')
    return (
      <p className="mt-3 text-[14px] text-muted">
        {x.status === 'EXPIRED'
          ? 'The closure export has expired.'
          : 'Your closure export is being prepared. Check back soon.'}
      </p>
    );
  const download = async (part: number) => {
    setBusy(part);
    try {
      const u = await societiesService.downloadUrl(x.id, part);
      window.location.assign(u.url);
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-4">
      <p className="mb-3 text-[14px]">
        Your closure export: a zip of CSVs and documents. Available until {shortDate(x.expiresAt)}.
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: Math.max(1, x.partCount) }, (_, i) => i + 1).map(p => (
          <Button key={p} size="sm" loading={busy === p} onClick={() => download(p)}>
            {x.partCount > 1 ? `Download part ${p}` : 'Download'}
          </Button>
        ))}
      </div>
    </div>
  );
}
