'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { FormModal } from '@/components/billing/FormModal';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { Provider } from '@/types/platformOps';
import {
  CHANNEL_LABEL,
  HealthChip,
  IncidentChip,
  LivePill,
  SEVERITY_TONE,
  opsError,
  timeAgo,
} from '../format';
import { usePolling } from '../usePolling';
import { IncidentDrawer } from './IncidentDrawer';
import { ProviderDrawer } from './ProviderDrawer';

/** Spec 11.3 Platform health (prototype `Pages.health`). */
export function HealthScreen() {
  const { ready } = useMe();
  const toast = useToast();
  const canView = usePermission(PERMISSIONS.platform.health.view);
  const canSet = usePermission(PERMISSIONS.platform.health.edit);
  const canConfigure = usePermission(PERMISSIONS.platform.settings.edit);
  const [paused, setPaused] = useState(false);
  const providers = usePolling(() => svc.providers(), 30_000, canView && !paused);
  const incidents = useLoad(() => svc.incidents({ limit: 20 }), 'incidents');
  const [checking, setChecking] = useState<number | 'all' | null>(null);
  const [drawer, setDrawer] = useState<{ provider: Provider | null } | null>(null);
  const [statusFor, setStatusFor] = useState<Provider | null>(null);
  const [incident, setIncident] = useState<{ id: number | null } | null>(null);
  const [resolveFor, setResolveFor] = useState<number | null>(null);

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Platform health" />
        <EmptyState title="You do not have access to platform health" />
      </Page>
    );

  const check = async (id: number | 'all') => {
    setChecking(id);
    try {
      const r = id === 'all' ? await svc.checkAll() : await svc.checkProvider(id);
      const bad = r.results.filter(x => !x.ok).length;
      toast.show(
        bad ? `${bad} check${bad > 1 ? 's' : ''} failed.` : 'All checks passed.',
        bad ? 'warning' : 'success',
      );
      void providers.reload();
    } catch (e) {
      toast.show(opsError(e), 'error');
    } finally {
      setChecking(null);
    }
  };
  const list = providers.data ?? [];
  const open = (incidents.data?.items ?? []).filter(i => i.status !== 'RESOLVED');
  const recent = (incidents.data?.items ?? []).filter(i => i.status === 'RESOLVED').slice(0, 5);

  return (
    <Page>
      <PageHead
        title="Platform health"
        sub="Messaging, payments and storage providers, and incidents."
        actions={
          <>
            <LivePill />
            <Button variant="glass" size="sm" loading={checking === 'all'} onClick={() => check('all')}>
              Run all checks
            </Button>
            {canConfigure && (
              <Button
                size="sm"
                onClick={() => {
                  setPaused(true);
                  setDrawer({ provider: null });
                }}
              >
                Add provider
              </Button>
            )}
          </>
        }
      />
      {providers.error && !providers.data ? (
        <Card>
          <ErrorState
            error={providers.error}
            action={
              <button className="underline" onClick={() => void providers.reload()}>
                Try again
              </button>
            }
          />
        </Card>
      ) : !providers.data ? (
        <div className="grid gap-3 min-[900px]:grid-cols-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} data-testid="provider-skeleton" className="skeleton h-40" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            title="No providers yet"
            text="Add the SMS, email, payment and storage providers the platform uses."
          />
        </Card>
      ) : (
        <div className="grid gap-3 min-[900px]:grid-cols-2">
          {list.map(p => (
            <section key={p.id} aria-label={p.displayName} className="glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-bold">{p.displayName}</h2>
                  <p className="text-[13px] text-muted">
                    {CHANNEL_LABEL[p.channel]} · {p.vendor}
                    {p.description ? ` · ${p.description}` : ''}
                  </p>
                </div>
                <span className="flex flex-wrap items-center gap-1.5">
                  {p.health.mode === 'MANUAL' && <Chip tone="gold">Manual</Chip>}
                  {!p.isEnabled && <Chip>Disabled</Chip>}
                  <HealthChip status={p.health.status} />
                </span>
              </div>
              <dl className="my-3 grid grid-cols-2 gap-2 text-[13px]">
                <div>
                  <dt className="text-muted">Latency</dt>
                  <dd className="font-semibold tabular-nums">
                    {p.health.lastCheckLatencyMs === null ? '-' : `${p.health.lastCheckLatencyMs} ms`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Uptime 30 d</dt>
                  <dd className="font-semibold tabular-nums">
                    {p.health.uptime30dPct === null ? '-' : `${p.health.uptime30dPct}%`}
                  </dd>
                </div>
              </dl>
              {p.health.reason && <p className="mb-2 text-[12.5px] text-muted">{p.health.reason}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="xs" variant="glass" loading={checking === p.id} onClick={() => check(p.id)}>
                  Run check
                </Button>
                {canSet && (
                  <Button size="xs" variant="glass" onClick={() => setStatusFor(p)}>
                    Set status
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="glass"
                  onClick={() => {
                    setPaused(true);
                    setDrawer({ provider: p });
                  }}
                >
                  {canConfigure ? 'Configure' : 'Details'}
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}

      <Card
        className="mt-4"
        title="Incidents"
        sub={open.length ? `${open.length} open` : 'No open incidents'}
      >
        {canSet && (
          <div className="mb-3">
            <Button size="sm" onClick={() => setIncident({ id: null })}>
              Open incident
            </Button>
          </div>
        )}
        {incidents.error ? (
          <ErrorState error={incidents.error} />
        ) : incidents.loading ? (
          <div className="skeleton h-16 w-full" />
        ) : open.length + recent.length === 0 ? (
          <EmptyState title="All quiet" text="No incidents recorded." />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {[...open, ...recent].map(i => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <button type="button" className="min-w-0 text-left" onClick={() => setIncident({ id: i.id })}>
                  <span className="block font-semibold">{i.title}</span>
                  <span className="text-[12.5px] text-muted">
                    {i.incidentNo} · {timeAgo(i.startedAt)}
                  </span>
                </button>
                <span className="flex items-center gap-2">
                  <Chip tone={SEVERITY_TONE[i.severity]}>{i.severity}</Chip>
                  <IncidentChip status={i.status} />
                  {canSet && i.status !== 'RESOLVED' && (
                    <Button size="xs" variant="glass" onClick={() => setResolveFor(i.id)}>
                      Resolve
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {drawer && (
        <ProviderDrawer
          provider={drawer.provider}
          onClose={() => {
            setDrawer(null);
            setPaused(false);
          }}
          onChanged={() => void providers.reload()}
        />
      )}
      {statusFor && (
        <SetStatusModal
          provider={statusFor}
          onClose={() => setStatusFor(null)}
          onDone={() => {
            setStatusFor(null);
            void providers.reload();
            incidents.reload();
          }}
        />
      )}
      {incident && (
        <IncidentDrawer
          id={incident.id}
          providers={list}
          onClose={() => setIncident(null)}
          onChanged={incidents.reload}
        />
      )}
      {resolveFor !== null && (
        <IncidentDrawer
          id={resolveFor}
          resolveNow
          providers={list}
          onClose={() => setResolveFor(null)}
          onChanged={incidents.reload}
        />
      )}
    </Page>
  );
}

/** Reason modal: pick a manual status or "Return to automatic" (spec 11.3). */
function SetStatusModal({
  provider,
  onClose,
  onDone,
}: {
  provider: Provider;
  onClose: () => void;
  onDone: () => void;
}) {
  const [choice, setChoice] = useState<string>(provider.health.mode === 'MANUAL' ? 'AUTOMATIC' : 'DEGRADED');
  const [reason, setReason] = useState('');
  return (
    <FormModal
      title={`Set status of ${provider.displayName}`}
      submitLabel="Save status"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        const auto = choice === 'AUTOMATIC';
        if (!auto && reason.trim().length < 5) return { error: 'Enter a reason of at least 5 characters.' };
        await svc.setProviderStatus(
          provider.id,
          auto
            ? { version: provider.version, mode: 'AUTOMATIC' }
            : { version: provider.version, mode: 'MANUAL', status: choice, reason: reason.trim() },
        );
        return { message: auto ? 'Back to automatic checks.' : 'Status set.' };
      }}
    >
      <Select
        label="Status"
        value={choice}
        onChange={e => setChoice(e.target.value)}
        options={[
          { value: 'OPERATIONAL', label: 'Operational' },
          { value: 'DEGRADED', label: 'Degraded' },
          { value: 'OUTAGE', label: 'Outage' },
          { value: 'AUTOMATIC', label: 'Return to automatic' },
        ]}
      />
      {choice !== 'AUTOMATIC' && (
        <Textarea label="Reason" value={reason} onChange={e => setReason(e.target.value)} />
      )}
      {choice === 'OUTAGE' && (
        <Alert tone="warn">An outage opens a public incident and shows on the status page.</Alert>
      )}
    </FormModal>
  );
}
