'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Card, Page } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { SocietyBillingTab } from '@/components/billing/platform/SocietyBillingTab';
import { SocietyPlanTab } from '@/components/subscription/platform/SocietyPlanTab';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { useAnyPermission, usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { useMe } from '@/lib/auth';
import { daysUntil, inr, shortDate } from '@/lib/money';
import { societiesService } from '@/services/societies.service';
import type { DataExport, LifecycleEvent, SocietyDetail, SupportGrant } from '@/types/societies';
import { Banner, HealthMeter, PlanChip, StatusChip, Tabs } from '../bits';
import { emitGrantChanged } from '../events';
import {
  HEALTH_LABEL,
  SCOPE_LABEL,
  STATUS_LABEL,
  bytes,
  dateTime,
  healthBand,
  societyErrorText,
} from '../format';
import { EditSocietyDrawer } from './EditSocietyDrawer';
import { ExportDataModal } from './ExportDataModal';
import { GrantsTable } from './GrantsTable';
import { LifecycleDialog, type DialogKind } from './LifecycleDialog';
import { NotesCard } from './NotesCard';
import { RequestAccessModal } from './RequestAccessModal';

type Tab = 'overview' | 'subscription' | 'support' | 'exports';

/** Opens the admin app as this grant (module 02 hand-off, 8.20): a 60-second token in the URL fragment. */
export async function openAsSocietyAdmin(grantId: number) {
  const t = await societiesService.startHandoff(grantId);
  window.open(`${t.adminUrl}#token=${encodeURIComponent(t.token)}`, '_blank', 'noopener');
}

/** P-03 Society detail (prototype `Pages.society`). */
export function SocietyDetailScreen({ id }: { id: number }) {
  const { me } = useMe();
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.platform.societies.edit);
  const canExport = usePermission(PERMISSIONS.platform.societies.export);
  const canRequest = usePermission(PERMISSIONS.platform.supportAccess.create);
  const canSeeGrants = usePermission(PERMISSIONS.platform.supportAccess.view);
  const detail = useLoad(() => societiesService.detail(id), id);
  const [tab, setTab] = useState<Tab>('overview');
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [editing, setEditing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tick, setTick] = useState(0);

  if (detail.error) {
    const missing = detail.error instanceof ApiError && detail.error.code === 'SOCIETY_NOT_FOUND';
    return (
      <Page>
        {missing ? (
          <EmptyState
            title="Society not found"
            text="It may have been removed."
            action={
              <Link href="/platform/societies" className="font-semibold text-navy underline">
                Back to societies
              </Link>
            }
          />
        ) : (
          <ErrorState
            error={detail.error}
            action={
              <button className="underline" onClick={detail.reload}>
                Try again
              </button>
            }
          />
        )}
      </Page>
    );
  }
  const s = detail.data;
  if (!s)
    return (
      <Page>
        <div className="skeleton mb-3 h-8 w-64" />
        <div className="skeleton h-40 w-full" />
      </Page>
    );

  const l = s.lifecycle;
  const allowed = new Set(l.allowedActions);
  const grant = s.openSupportGrant;
  const myGrant = grant && me && grant.requester.id === me.user.id ? grant : null;
  const refresh = () => {
    detail.reload();
    setTick(t => t + 1);
  };

  const endMine = async () => {
    if (!myGrant) return;
    try {
      if (myGrant.status === 'PENDING_CONSENT') await societiesService.cancelGrant(myGrant.id);
      else await societiesService.endGrant(myGrant.id);
      toast.show(myGrant.status === 'PENDING_CONSENT' ? 'Request withdrawn' : 'Support access ended');
      emitGrantChanged();
      refresh();
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
    }
  };

  const actions: ReactNode[] = [];
  if (allowed.has('CONVERT'))
    actions.push(
      <Button key="convert" size="sm" variant="gold" onClick={() => setDialog('CONVERT')}>
        Convert to paid
      </Button>,
    );
  if (allowed.has('EXTEND_TRIAL'))
    actions.push(
      <Button key="extend" size="sm" variant="glass" onClick={() => setDialog('EXTEND_TRIAL')}>
        Extend trial
      </Button>,
    );
  if (l.status !== 'CLOSED')
    actions.push(
      <Button key="plan" size="sm" variant="glass" onClick={() => setTab('subscription')}>
        Change plan
      </Button>,
    );
  if (allowed.has('REACTIVATE'))
    actions.push(
      <Button key="reactivate" size="sm" onClick={() => setDialog('REACTIVATE')}>
        Reactivate
      </Button>,
    );
  if (allowed.has('SUSPEND'))
    actions.push(
      <Button key="suspend" size="sm" variant="danger-soft" onClick={() => setDialog('SUSPEND')}>
        Suspend
      </Button>,
    );
  if (allowed.has('CLOSE'))
    actions.push(
      <Button key="close" size="sm" variant="danger-soft" onClick={() => setDialog('CLOSE')}>
        Close society
      </Button>,
    );
  if (allowed.has('REOPEN'))
    actions.push(
      <Button key="reopen" size="sm" onClick={() => setDialog('REOPEN')}>
        Reopen
      </Button>,
    );
  if (l.status === 'CLOSED' && !l.purgedAt && canEdit)
    actions.push(
      <Button
        key="purge"
        size="sm"
        variant="glass"
        onClick={() => setDialog(l.purgeHoldReason ? 'PURGE_HOLD_CLEAR' : 'PURGE_HOLD_SET')}
      >
        {l.purgeHoldReason ? 'Release purge hold' : 'Hold purge'}
      </Button>,
    );
  if (l.status !== 'CLOSED' && canRequest)
    actions.push(
      myGrant ? (
        <Button key="grant" size="sm" variant="danger" onClick={endMine}>
          {myGrant.status === 'PENDING_CONSENT' ? 'Cancel access request' : 'End support access'}
        </Button>
      ) : (
        <Button key="grant" size="sm" variant="glass" onClick={() => setRequesting(true)}>
          Request support access
        </Button>
      ),
    );
  if (canExport && !l.purgedAt)
    actions.push(
      <Button key="export" size="sm" variant="glass" onClick={() => setExporting(true)}>
        Export data
      </Button>,
    );

  const trialDays = daysUntil(l.trialEndsAt);

  return (
    <Page>
      <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-muted">
        <Link href="/platform/societies" className="hover:underline">
          Societies
        </Link>
        <span aria-hidden="true"> › </span>
        <span aria-current="page">{s.name}</span>
      </nav>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold tracking-tight max-[700px]:text-[22px]">{s.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
            <StatusChip status={l.status} />
            <PlanChip plan={s.subscription?.planKey} />
            <span>
              {s.city}, {s.state} · {s.slug}.societyapp.in · #{s.id}
            </span>
          </p>
        </div>
        {actions.length > 0 && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {l.status === 'TRIAL' && l.trialEndsAt && (
        <Banner tone="info">
          Trial ends {shortDate(l.trialEndsAt)} ({trialDays} {trialDays === 1 ? 'day' : 'days'} left).
        </Banner>
      )}
      {l.status === 'PAST_DUE' && <Banner tone="warn">Payment overdue. Dunning is running.</Banner>}
      {l.status === 'SUSPENDED' && (
        <Banner tone="bad">
          Suspended: residents can still sign in, pay dues and export data; writes are blocked; SOS keeps
          working.
        </Banner>
      )}
      {l.status === 'CLOSED' && (
        <Banner tone="neutral">
          {l.purgedAt
            ? `Closed on ${shortDate(l.closedAt)}. Personal data was purged on ${shortDate(l.purgedAt)}.`
            : `Closed on ${shortDate(l.closedAt)}. Personal data will be purged on ${shortDate(l.purgeAfter)} unless a purge hold is set.`}
          {l.purgeHoldReason && ` Purge hold: ${l.purgeHoldReason}`}
        </Banner>
      )}

      <Tabs<Tab>
        label="Society sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'subscription', label: 'Subscription' },
          { value: 'support', label: 'Support' },
          { value: 'exports', label: 'Data exports' },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && (
          <Overview
            s={s}
            myGrant={myGrant}
            tick={tick}
            canEdit={canEdit && !l.purgedAt}
            onEdit={() => setEditing(true)}
          />
        )}
        {tab === 'subscription' && (
          <>
            <SocietyPlanTab societyId={s.id} />
            <SocietyBillingTab societyId={s.id} />
          </>
        )}
        {tab === 'support' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <NotesCard societyId={s.id} />
              <NudgeCard s={s} />
            </div>
            {canSeeGrants && (
              <Card
                title="Support access"
                sub="Grants on this society. Every action under a grant is audited under both identities."
              >
                <GrantsTable societyId={s.id} />
              </Card>
            )}
          </div>
        )}
        {tab === 'exports' && <ExportsCard societyId={s.id} tick={tick} />}
      </div>

      <LifecycleDialog
        kind={dialog}
        society={s}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          refresh();
        }}
      />
      {editing && (
        <EditSocietyDrawer
          society={s}
          open
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}
      <RequestAccessModal
        open={requesting}
        society={s}
        onClose={() => setRequesting(false)}
        onDone={() => refresh()}
      />
      <ExportDataModal open={exporting} society={s} onClose={() => setExporting(false)} onDone={refresh} />
    </Page>
  );
}

function Kpi({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="glass p-4">
      <div className="text-[12.5px] font-semibold text-muted">{label}</div>
      <div className="mt-1 text-[24px] font-bold tabular-nums">{value}</div>
      {children}
    </div>
  );
}

const BREAKDOWN: [keyof NonNullable<NonNullable<SocietyDetail['health']>['breakdown']>, string][] = [
  ['adoption', 'Adoption'],
  ['onboarding', 'Onboarding'],
  ['collections', 'Collections'],
  ['adminActivity', 'Admin activity'],
  ['billing', 'Billing standing'],
];

function Overview({
  s,
  myGrant,
  tick,
  canEdit,
  onEdit,
}: {
  s: SocietyDetail;
  myGrant: SupportGrant | null;
  tick: number;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const units = s.stats.units;
  const score = s.health?.score ?? null;
  const band = s.health?.band ?? healthBand(score);
  const breakdown = s.health?.breakdown;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Units" value={units.toLocaleString('en-IN')} />
        <Kpi label="Active users (30 d)" value={s.stats.activeUsers30.toLocaleString('en-IN')}>
          <div className="text-[12.5px] text-muted">
            {units ? Math.round((s.stats.activeUsers30 / units) * 100) : 0}% of units
          </div>
        </Kpi>
        <Kpi label="MRR" value={s.subscription?.mrrPaise ? inr(s.subscription.mrrPaise) : '-'} />
        <Kpi label="Health score" value={score ?? '-'}>
          <HealthMeter score={score} />
          {band && <div className="mt-1 text-[12.5px] text-muted">{HEALTH_LABEL[band]}</div>}
          {breakdown && (
            <details className="mt-1 text-[12.5px]">
              <summary className="cursor-pointer text-navy">Breakdown</summary>
              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3">
                {BREAKDOWN.map(([k, label]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right tabular-nums">
                      {breakdown[k] === null || breakdown[k] === undefined
                        ? 'No data'
                        : `${Math.round((breakdown[k] as number) * 100)}%`}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </Kpi>
      </div>

      {myGrant && myGrant.status === 'ACTIVE' && (
        <section className="glass border-2 border-[rgba(179,38,30,0.4)] p-4 sm:p-5" aria-label="Support view">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-[17px] font-bold">
                Support view <Chip tone="bad">{SCOPE_LABEL[myGrant.scope]}</Chip>
              </h2>
              <p className="text-[13px] text-muted">
                Visible only while your access grant is active. Everything you do is audited under both
                identities.
              </p>
            </div>
            <Button
              size="sm"
              loading={opening}
              onClick={async () => {
                setOpening(true);
                try {
                  await openAsSocietyAdmin(myGrant.id);
                } catch (e) {
                  toast.show(societyErrorText(e), 'error');
                } finally {
                  setOpening(false);
                }
              }}
            >
              Open as society admin
            </Button>
          </div>
        </section>
      )}
      {myGrant && myGrant.status === 'PENDING_CONSENT' && (
        <Banner tone="warn">Waiting for consent. {myGrant.code} starts when the society approves it.</Banner>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Details">
          <dl className="grid grid-cols-[minmax(0,140px)_1fr] gap-x-3 gap-y-1.5 text-[14px]">
            <dt className="text-muted">Address</dt>
            <dd>{[s.addressLine1, s.addressLine2, s.city, s.state, s.pincode].filter(Boolean).join(', ')}</dd>
            <dt className="text-muted">Legal name</dt>
            <dd>{s.legalName ?? '-'}</dd>
            <dt className="text-muted">Registration no.</dt>
            <dd>{s.registrationNo ?? '-'}</dd>
            <dt className="text-muted">GSTIN</dt>
            <dd>{s.gstin ?? '-'}</dd>
            <dt className="text-muted">Organization</dt>
            <dd>{s.organization?.name ?? '-'}</dd>
            <dt className="text-muted">Created</dt>
            <dd>
              {shortDate(s.createdAt)} · {s.createdVia === 'SELF_SERVE' ? 'Self-serve sign-up' : 'Assisted'}
            </dd>
            <dt className="text-muted">Support consent</dt>
            <dd>{s.requiresSupportConsent ? 'Required' : 'Not required'}</dd>
          </dl>
          {canEdit && (
            <Button size="sm" variant="glass" className="mt-3" onClick={onEdit}>
              Edit details
            </Button>
          )}
        </Card>
        <LifecycleTimeline societyId={s.id} tick={tick} />
      </div>
    </div>
  );
}

function describeEvent(e: LifecycleEvent): string {
  switch (e.eventType) {
    case 'CREATED':
      return 'Society created';
    case 'STATUS_CHANGED':
      return `${e.fromStatus ? STATUS_LABEL[e.fromStatus] : '?'} to ${e.toStatus ? STATUS_LABEL[e.toStatus] : '?'}`;
    case 'TRIAL_EXTENDED':
      return 'Trial extended';
    case 'GRACE_GRANTED':
      return 'Grace period granted';
    case 'AUTO_CLOSE_WARNED':
      return 'Auto-close warning sent';
    case 'PURGE_HOLD_SET':
      return 'Purge hold set';
    case 'PURGE_HOLD_CLEARED':
      return 'Purge hold released';
    case 'PURGE_WARNED':
      return 'Purge warning sent';
    case 'PURGED':
      return 'Personal data purged';
    case 'FINANCIAL_PURGED':
      return 'Financial records deleted';
    default:
      return e.eventType;
  }
}

/** Lifecycle timeline (8.7), newest first. */
function LifecycleTimeline({ societyId, tick }: { societyId: number; tick: number }) {
  const events = useLoad(() => societiesService.lifecycleEvents(societyId), `${societyId}:${tick}`);
  const list = events.data?.data ?? [];
  return (
    <Card title="Lifecycle">
      {events.error ? (
        <ErrorState error={events.error} />
      ) : events.loading ? (
        <div className="skeleton h-24 w-full" />
      ) : list.length === 0 ? (
        <p className="text-[14px] text-muted">No lifecycle events yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-[var(--line)] pl-4">
          {list.map(e => (
            <li key={e.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-navy"
              />
              <div className="text-[14px] font-semibold">{describeEvent(e)}</div>
              <div className="text-[12.5px] text-muted">
                {dateTime(e.createdAt)} · {e.actorName ?? e.triggerSource}
                {e.triggerCode ? ` · ${e.triggerCode}` : ''}
              </div>
              {e.reason && <p className="mt-0.5 text-[13px]">{e.reason}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** F18 success-team nudge (8.15). */
function NudgeCard({ s }: { s: SocietyDetail }) {
  const toast = useToast();
  const canNudge = useAnyPermission(PERMISSIONS.platform.societies.edit, PERMISSIONS.platform.tickets.edit);
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState('ONBOARDING_HELP');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!canNudge || !['TRIAL', 'ACTIVE', 'PAST_DUE'].includes(s.lifecycle.status)) return null;
  return (
    <Card
      title="Success nudge"
      sub="Send the chairman and society admins a helpful message. At most once a day."
    >
      <Button size="sm" variant="glass" onClick={() => setOpen(true)}>
        Send nudge
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Nudge ${s.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await societiesService.nudge(s.id, { template, note: note.trim() || undefined });
                  toast.show(`Nudge sent to ${r?.sentTo ?? 0} admins`);
                  setOpen(false);
                  setNote('');
                } catch (e) {
                  toast.show(societyErrorText(e), 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send
            </Button>
          </>
        }
      >
        <Select
          label="Message"
          value={template}
          onChange={e => setTemplate(e.target.value)}
          options={[
            { value: 'ONBOARDING_HELP', label: 'Help with onboarding' },
            { value: 'ADOPTION_TIPS', label: 'Tips to get residents using the app' },
            { value: 'PAYMENT_SETUP', label: 'Set up online payments' },
          ]}
        />
        <Textarea
          label="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={300}
        />
      </Modal>
    </Card>
  );
}

const EXPORT_STATUS: Record<DataExport['status'], [string, 'info' | 'ok' | 'bad' | 'neutral']> = {
  QUEUED: ['Queued', 'info'],
  RUNNING: ['Preparing', 'info'],
  READY: ['Ready', 'ok'],
  FAILED: ['Failed', 'bad'],
  EXPIRED: ['Expired', 'neutral'],
};

/** Platform view of a society's exports (8.17): status only, never a download link. */
function ExportsCard({ societyId, tick }: { societyId: number; tick: number }) {
  const list = useLoad(() => societiesService.platformExports(societyId), `${societyId}:${tick}`);
  const rows = list.data?.data ?? [];
  return (
    <Card
      title="Data exports"
      sub="Society members with export permission download these. Platform staff cannot."
    >
      {list.error ? (
        <ErrorState error={list.error} />
      ) : list.loading ? (
        <div className="skeleton h-24 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No exports yet" text="Use Export data to prepare one for the society." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <caption className="sr-only">Data exports</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Requested by</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Available until</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(x => (
                <tr key={x.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2.5">{x.kind === 'CLOSURE' ? 'Closure export' : 'Full export'}</td>
                  <td className="px-3 py-2.5">{x.requestedBy?.name ?? 'System'}</td>
                  <td className="px-3 py-2.5">
                    <Chip tone={EXPORT_STATUS[x.status][1]}>{EXPORT_STATUS[x.status][0]}</Chip>
                    {x.status === 'RUNNING' && <span className="ml-2 text-muted">{x.progressPercent}%</span>}
                  </td>
                  <td className="px-3 py-2.5">{bytes(x.totalSizeBytes)}</td>
                  <td className="px-3 py-2.5 text-muted">{shortDate(x.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
