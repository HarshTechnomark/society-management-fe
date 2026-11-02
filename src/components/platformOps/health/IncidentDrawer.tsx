'use client';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { Incident, IncidentStatus, Provider, Severity } from '@/types/platformOps';
import { COMPONENT_LABEL, IncidentChip, SEVERITY_TONE, istTime, opsError } from '../format';

const SEVERITIES: Severity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
const SEV_HINT: Record<Severity, string> = {
  SEV1: 'SEV1 · Major outage',
  SEV2: 'SEV2 · Partial outage',
  SEV3: 'SEV3 · Degraded',
  SEV4: 'SEV4 · Minor',
};

/** Spec 11.3 incident drawer: `id` null opens a new incident; otherwise the timeline with Post update and Resolve. */
export function IncidentDrawer({
  id,
  providers,
  resolveNow,
  onClose,
  onChanged,
}: {
  id: number | null;
  /** Opens straight on the resolve form. */
  resolveNow?: boolean;
  providers: Provider[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.platform.health.edit);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Severity>('SEV3');
  const [components, setComponents] = useState<string[]>([]);
  const [provider, setProvider] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [notify, setNotify] = useState(false);
  const [message, setMessage] = useState('');

  // update / resolve form
  const [updStatus, setUpdStatus] = useState<IncidentStatus>('INVESTIGATING');
  const [updMessage, setUpdMessage] = useState('');
  const [resolving, setResolving] = useState(!!resolveNow);
  const [rootCause, setRootCause] = useState('');

  useEffect(() => {
    if (id === null) return;
    let live = true;
    svc.incident(id).then(
      i => {
        if (!live) return;
        setIncident(i);
        setUpdStatus(i.status === 'RESOLVED' ? 'MONITORING' : i.status);
      },
      e => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [id]);

  const wrap = async (fn: () => Promise<void>) => {
    setProblem(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setProblem(opsError(e));
    } finally {
      setBusy(false);
    }
  };
  const received = (i: Incident, text: string) => {
    setIncident(i);
    toast.show(text);
    onChanged();
  };

  const create = () =>
    wrap(async () => {
      if (title.trim().length < 5) throw new Error('Enter a title of at least 5 characters.');
      if (components.length === 0) throw new Error('Choose at least one affected component.');
      if (message.trim().length < 10) throw new Error('Describe what is happening (at least 10 characters).');
      const i = await svc.createIncident({
        title: title.trim(),
        severity,
        components,
        ...(provider ? { serviceProviderId: Number(provider) } : {}),
        isPublic,
        message: message.trim(),
        ...(notify ? { notifySocieties: true } : {}),
      });
      received(i, `${i.incidentNo} opened.`);
    });

  const postUpdate = () =>
    wrap(async () => {
      if (!incident) return;
      if (updMessage.trim().length < 10) throw new Error('Write the update (at least 10 characters).');
      const i = await svc.postIncidentUpdate(incident.id, {
        version: incident.version,
        status: updStatus,
        message: updMessage.trim(),
      });
      setUpdMessage('');
      received(i, 'Update posted.');
    });

  const resolve = () =>
    wrap(async () => {
      if (!incident) return;
      const sev12 = incident.severity === 'SEV1' || incident.severity === 'SEV2';
      if (updMessage.trim().length < 10)
        throw new Error('Write the closing update (at least 10 characters).');
      if (sev12 && rootCause.trim().length < 20)
        throw new Error('Describe the root cause (at least 20 characters).');
      const i = await svc.resolveIncident(incident.id, {
        version: incident.version,
        message: updMessage.trim(),
        ...(rootCause.trim() ? { rootCause: rootCause.trim() } : {}),
      });
      setResolving(false);
      setUpdMessage('');
      received(i, 'Incident resolved.');
    });

  const toggleComp = (k: string) => setComponents(c => (c.includes(k) ? c.filter(x => x !== k) : [...c, k]));
  const sev12 = severity === 'SEV1' || severity === 'SEV2';

  const showProblem = problem && <Alert tone="bad">{problem}</Alert>;
  return (
    <Drawer
      open
      onClose={onClose}
      size={640}
      title={id === null ? 'Open incident' : (incident?.incidentNo ?? 'Incident')}
    >
      {id === null ? (
        <>
          {showProblem}
          <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Select
            label="Severity"
            value={severity}
            onChange={e => {
              setSeverity(e.target.value as Severity);
              if (e.target.value !== 'SEV1' && e.target.value !== 'SEV2') setNotify(false);
            }}
            options={SEVERITIES.map(s => ({ value: s, label: SEV_HINT[s] }))}
          />
          <fieldset className="mb-3">
            <legend className="mb-1.5 text-[13px] font-semibold">Affected components</legend>
            <div className="grid gap-1 min-[500px]:grid-cols-2">
              {Object.entries(COMPONENT_LABEL).map(([k, l]) => (
                <Checkbox key={k} label={l} checked={components.includes(k)} onChange={() => toggleComp(k)} />
              ))}
            </div>
          </fieldset>
          <Select
            label="Related provider"
            value={provider}
            onChange={e => setProvider(e.target.value)}
            options={[
              { value: '', label: 'None' },
              ...providers.map(p => ({ value: String(p.id), label: p.displayName })),
            ]}
          />
          <Textarea label="What is happening" value={message} onChange={e => setMessage(e.target.value)} />
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold">Show on the public status page</span>
            <Switch label="Public" checked={isPublic} onChange={setIsPublic} />
          </div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold">
              Notify societies <span className="font-normal text-muted">(public SEV1 or SEV2 only)</span>
            </span>
            <Switch
              label="Notify societies"
              checked={notify}
              onChange={setNotify}
              disabled={!isPublic || !sev12}
            />
          </div>
          <Button loading={busy} onClick={create} disabled={!canEdit}>
            Open incident
          </Button>
        </>
      ) : error ? (
        <ErrorState error={error} />
      ) : !incident ? (
        <div className="skeleton h-40 w-full" />
      ) : (
        <>
          {showProblem}
          <h3 className="text-[16px] font-bold">{incident.title}</h3>
          <div className="my-2 flex flex-wrap items-center gap-2 text-[13px]">
            <Chip tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</Chip>
            <IncidentChip status={incident.status} />
            <Chip>{incident.isPublic ? 'Public' : 'Private'}</Chip>
            <span className="text-muted">Started {istTime(incident.startedAt)} IST</span>
          </div>
          <p className="mb-3 text-[13px] text-muted">
            {incident.components.map(c => COMPONENT_LABEL[c] ?? c).join(', ')}
          </p>
          {incident.rootCause && (
            <p className="mb-3 rounded-[14px] bg-white/60 p-3 text-[13.5px]">
              <b>Root cause.</b> {incident.rootCause}
            </p>
          )}
          <ol aria-label="Timeline" className="mb-4 space-y-3 border-l-2 border-[var(--line)] pl-4">
            {incident.updates.map((u, n) => (
              <li key={n}>
                <p className="flex flex-wrap items-center gap-2 text-[13px]">
                  <IncidentChip status={u.status} />
                  <span className="text-muted">
                    {istTime(u.at)} · {u.byName}
                    {!u.isPublic && ' · private'}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[14px]">{u.message}</p>
              </li>
            ))}
          </ol>
          {canEdit && incident.status !== 'RESOLVED' && (
            <div className="rounded-[16px] bg-white/60 p-4">
              <h3 className="mb-2 text-[14px] font-bold">{resolving ? 'Resolve incident' : 'Post update'}</h3>
              {!resolving && (
                <Select
                  label="Status"
                  value={updStatus}
                  onChange={e => setUpdStatus(e.target.value as IncidentStatus)}
                  options={[
                    { value: 'INVESTIGATING', label: 'Investigating' },
                    { value: 'IDENTIFIED', label: 'Identified' },
                    { value: 'MONITORING', label: 'Monitoring' },
                  ]}
                />
              )}
              <Textarea
                label={resolving ? 'Closing update' : 'Update'}
                value={updMessage}
                onChange={e => setUpdMessage(e.target.value)}
              />
              {resolving && (
                <Textarea
                  label="Root cause"
                  hint={
                    incident.severity === 'SEV1' || incident.severity === 'SEV2'
                      ? 'Required for SEV1 and SEV2'
                      : 'Optional'
                  }
                  value={rootCause}
                  onChange={e => setRootCause(e.target.value)}
                />
              )}
              <div className="flex flex-wrap gap-2">
                {resolving ? (
                  <>
                    <Button loading={busy} onClick={resolve}>
                      Resolve
                    </Button>
                    <Button variant="ghost" onClick={() => setResolving(false)}>
                      Back
                    </Button>
                  </>
                ) : (
                  <>
                    <Button loading={busy} onClick={postUpdate}>
                      Post update
                    </Button>
                    <Button variant="glass" onClick={() => setResolving(true)}>
                      Resolve
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
