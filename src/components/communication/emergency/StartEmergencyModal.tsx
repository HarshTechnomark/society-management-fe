'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/apiClient';
import { useLoad } from '@/hooks/useLoad';
import { communicationEmergencyService as svc } from '@/services/communicationEmergency.service';
import { societySetupService } from '@/services/society-setup.service';
import type { EmergencyDetail, EmergencyType } from '@/types/communication';
import { EMERGENCY_TYPES, commError } from '../format';
import { HoldToSend } from './HoldToSend';

/** Spec 11.4 modal "Emergency broadcast" (prototype `emg-new`). No step-up (spec 13). */
export function StartEmergencyModal({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  onStarted: (b: EmergencyDetail) => void;
}) {
  const toast = useToast();
  const [type, setType] = useState<EmergencyType>('FIRE');
  const [message, setMessage] = useState('');
  const [who, setWho] = useState<'ALL' | 'BUILDINGS'>('ALL');
  const [picked, setPicked] = useState<number[]>([]);
  const [staff, setStaff] = useState(true);
  const [replies, setReplies] = useState(true);
  const [drill, setDrill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buildings = useLoad(
    () => societySetupService.buildings({ limit: 100 }),
    who === 'BUILDINGS' ? 'b' : 'none',
  );
  const list = who === 'BUILDINGS' ? (buildings.data?.items ?? []) : [];

  const msgOk = message.trim().length >= 8 && message.trim().length <= 500;
  const whoOk = who === 'ALL' || (picked.length >= 1 && picked.length <= 50);
  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      const b = await svc.start({
        type,
        message: message.trim(),
        audience: who === 'ALL' ? { type: 'ALL' } : { type: 'BUILDINGS', ids: picked },
        includeStaff: staff,
        collectResponses: replies,
        isDrill: drill,
      });
      toast.show(drill ? 'Drill started' : 'Emergency alert sent', 'success');
      onStarted(b);
    } catch (e) {
      if (e instanceof ApiError && /RATE_LIMIT/.test(e.code)) {
        setError(
          drill
            ? 'You can start 10 drills a day. Try again tomorrow.'
            : 'You can start 5 real alerts an hour. Try again later.',
        );
      } else setError(commError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Emergency broadcast"
      description={
        drill
          ? 'A drill goes in-app and push only.'
          : 'Goes to every resident at once on push, SMS and WhatsApp, ignoring quiet hours.'
      }
      footer={
        <>
          <Button variant="glass" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <HoldToSend
            label={busy ? 'Sending…' : 'Send to everyone'}
            disabled={!msgOk || !whoOk || busy}
            onConfirm={send}
          />
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      <Select
        label="Type"
        value={type}
        onChange={e => setType(e.target.value as EmergencyType)}
        options={EMERGENCY_TYPES}
      />
      <Textarea
        label="Message"
        required
        rows={3}
        maxLength={500}
        placeholder="Calmly say what happened and what to do."
        value={message}
        onChange={e => setMessage(e.target.value)}
        error={message.length > 0 && !msgOk ? 'Write at least 8 characters.' : null}
      />
      <Select
        label="Who"
        value={who}
        onChange={e => setWho(e.target.value as 'ALL' | 'BUILDINGS')}
        options={[
          { value: 'ALL', label: 'Everyone' },
          { value: 'BUILDINGS', label: 'Chosen towers' },
        ]}
      />
      {who === 'BUILDINGS' && (
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-[13px] font-semibold">Towers</legend>
          {buildings.loading ? (
            <div className="skeleton h-10 w-full" />
          ) : list.length === 0 ? (
            <p className="text-[13px] text-muted">No towers found.</p>
          ) : (
            list.map(b => (
              <Checkbox
                key={b.id}
                className="!mb-1.5"
                label={b.name || b.code}
                checked={picked.includes(b.id)}
                onChange={e => setPicked(p => (e.target.checked ? [...p, b.id] : p.filter(x => x !== b.id)))}
              />
            ))
          )}
        </fieldset>
      )}
      <Checkbox label="Include staff and guards" checked={staff} onChange={e => setStaff(e.target.checked)} />
      <Checkbox
        label="Ask residents to reply I’m safe / Need help"
        checked={replies}
        onChange={e => setReplies(e.target.checked)}
      />
      <Checkbox label="This is a drill" checked={drill} onChange={e => setDrill(e.target.checked)} />
      <Alert tone={drill ? 'info' : 'warn'}>
        {drill
          ? 'A drill goes in-app and push only, and every message starts with DRILL.'
          : 'This reaches every flat you chose immediately. Use it for real emergencies only.'}
      </Alert>
    </Modal>
  );
}
