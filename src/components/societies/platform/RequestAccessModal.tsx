'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { societiesService } from '@/services/societies.service';
import type { GrantScope, SupportGrant } from '@/types/societies';
import { emitGrantChanged } from '../events';
import { societyErrorText } from '../format';

interface Props {
  open: boolean;
  society: { id: number; name: string; requiresSupportConsent: boolean };
  /** First name of the person who decides, for the toast; defaults to "the society". */
  approverName?: string;
  onClose: () => void;
  onDone: (g: SupportGrant) => void;
}

const DURATIONS = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes (default)' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours (maximum)' },
];

/** P-05 Request support access (prototype `Actions['grant-request']`). */
export function RequestAccessModal({ open, society, approverName, onClose, onDone }: Props) {
  const toast = useToast();
  const canEmergency = usePermission(PERMISSIONS.platform.supportAccess.approve);
  const [scope, setScope] = useState<GrantScope>('READ_ONLY');
  const [minutes, setMinutes] = useState('60');
  const [reason, setReason] = useState('');
  const [ticket, setTicket] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setReason('');
    setTicket('');
    setScope('READ_ONLY');
    setMinutes('60');
    setEmergency(false);
    setErrors({});
    setAlert(null);
    onClose();
  };

  const setEmergencyOn = (on: boolean) => {
    setEmergency(on);
    if (on) {
      setScope('READ_ONLY');
      if (Number(minutes) > 60) setMinutes('60');
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    const r = reason.trim();
    if (r.length < 20) e.reason = 'Enter at least 20 characters.';
    else if (r.length > 500) e.reason = 'Keep it under 500 characters.';
    const t = ticket.trim().toUpperCase();
    if (t && !/^[A-Z]{2,6}-\d{1,8}$/.test(t)) e.ticket = 'Use the ticket number, for example TKT-2041.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setAlert(null);
    try {
      const g = await societiesService.requestGrant({
        societyId: society.id,
        scope,
        durationMinutes: Number(minutes),
        reason: r,
        ticketRef: t || undefined,
        isEmergency: emergency || undefined,
      });
      emitGrantChanged();
      if (g.status === 'PENDING_CONSENT')
        toast.show(`Waiting for ${approverName ?? society.name} to approve…`, 'warning');
      else toast.show('Support access is active');
      close();
      onDone(g);
    } catch (err) {
      setAlert(societyErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const consent = society.requiresSupportConsent && !emergency;

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Request support access to ${society.name}`}
      description="Access is time-boxed, scoped and audited under both identities."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Request access
          </Button>
        </>
      }
    >
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[13px] font-semibold">Scope</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['READ_ONLY', 'Read only', 'View settings and data. Safest.'],
              ['READ_WRITE', 'Read and write', 'Fix data. Needs a strong reason.'],
            ] as const
          ).map(([v, t, sub]) => (
            <label
              key={v}
              className={cx(
                'flex cursor-pointer flex-col gap-0.5 rounded-[16px] border-[1.5px] bg-white/70 p-3 text-[13px]',
                scope === v ? 'border-navy' : 'border-[rgba(20,35,44,0.16)]',
                emergency && v === 'READ_WRITE' && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type="radio"
                name="scope"
                value={v}
                checked={scope === v}
                disabled={emergency && v === 'READ_WRITE'}
                onChange={() => setScope(v)}
                className="sr-only"
              />
              <b className="text-[14px]">{t}</b>
              <span className="text-muted">{sub}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Select
        label="Duration"
        value={minutes}
        onChange={e => setMinutes(e.target.value)}
        options={emergency ? DURATIONS.slice(0, 2) : DURATIONS}
      />
      <Textarea
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Link the ticket or describe what you will investigate"
        hint="Shown to the society. At least 20 characters."
        error={errors.reason}
        maxLength={500}
        required
      />
      <Input
        label="Ticket reference"
        value={ticket}
        onChange={e => setTicket(e.target.value)}
        placeholder="TKT-2041"
        error={errors.ticket}
      />
      {canEmergency && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold">Emergency access</p>
            <p className="text-[12.5px] text-muted">Starts without consent. Read only, at most 60 minutes.</p>
          </div>
          <Switch label="Emergency access" checked={emergency} onChange={setEmergencyOn} />
        </div>
      )}
      <Alert tone={consent ? 'warn' : 'info'}>
        {consent ? (
          <>
            <b>{society.name} requires consent.</b> Their chairman must approve before access starts.
          </>
        ) : (
          'The society admins are notified when access starts.'
        )}
      </Alert>
    </Modal>
  );
}
