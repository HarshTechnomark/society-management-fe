'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { subscriptionErrorText } from '../format';

export interface Diff {
  label: string;
  before: string;
  after: string;
}

/** The diff table and the audited reason (spec: "Review and save shows the diff table, then the reason dialog"). */
export function ReviewDialog<T>({
  title,
  text,
  confirmLabel,
  diffs,
  onCancel,
  onConfirm,
  onDone,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  diffs: Diff[];
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<T>;
  onDone: (result: T) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = reason.trim();
  const reasonError =
    touched && (r.length < 5 || r.length > 500) ? 'Enter between 5 and 500 characters.' : null;
  const submit = async () => {
    setTouched(true);
    if (r.length < 5 || r.length > 500) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await onConfirm(r));
    } catch (e) {
      setError(subscriptionErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      description={text}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Back
          </Button>
          <Button loading={busy} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="mb-3 overflow-x-auto">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Changes</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[11.5px] uppercase text-muted">
              <th scope="col" className="py-1.5 pr-2">
                Field
              </th>
              <th scope="col" className="py-1.5 pr-2">
                Before
              </th>
              <th scope="col" className="py-1.5">
                After
              </th>
            </tr>
          </thead>
          <tbody>
            {diffs.map(d => (
              <tr key={d.label} className="border-b border-[var(--line)] align-top last:border-0">
                <th scope="row" className="py-1.5 pr-2 text-left font-semibold">
                  {d.label}
                </th>
                <td className="py-1.5 pr-2 text-bad line-through decoration-1">{d.before}</td>
                <td className="py-1.5 text-ok">{d.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Input
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        onBlur={() => setTouched(true)}
        error={reasonError}
        required
      />
    </Modal>
  );
}
