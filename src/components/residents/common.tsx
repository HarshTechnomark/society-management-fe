'use client';
import { useCallback, useId, useState, type ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import type { Loaded } from '@/hooks/useLoad';
import { fileUploadAvailable, uploadFile, type FilePurpose } from '@/lib/fileUpload';
import { residentsService } from '@/services/residents.service';
import { fieldErrors } from '@/components/setup/format';
import { residentsError } from './format';

/** Runs an API call; shows the success toast or the error in plain words. Returns true when it worked. */
export function useRun() {
  const toast = useToast();
  return useCallback(
    async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
      try {
        await fn();
        if (success) toast.show(success);
        return true;
      } catch (e) {
        toast.show(residentsError(e), 'error');
        return false;
      }
    },
    [toast],
  );
}

/** Skeleton, error with reference, or the loaded content. */
export function Loading<T>({
  load,
  children,
  rows = 3,
}: {
  load: Loaded<T>;
  children: (data: T) => ReactNode;
  rows?: number;
}) {
  if (load.error)
    return (
      <ErrorState
        error={load.error}
        action={
          <Button size="sm" onClick={load.reload}>
            Try again
          </Button>
        }
      />
    );
  if (load.loading || load.data === null)
    return (
      <div aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton mb-3 h-14 w-full" data-testid="skeleton-row" />
        ))}
      </div>
    );
  return <>{children(load.data)}</>;
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <EmptyState title={title} text={text} action={action} />;
}

/** Tabs that scroll sideways on a phone. */
export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--line)] pb-px"
    >
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          role="tab"
          id={`tab-${t.key}`}
          aria-selected={value === t.key}
          aria-controls={`panel-${t.key}`}
          onClick={() => onChange(t.key)}
          className={cx(
            'shrink-0 whitespace-nowrap rounded-t-[12px] px-4 py-2.5 text-[14px] font-semibold',
            value === t.key ? 'border-b-2 border-navy text-navy' : 'text-muted hover:bg-black/5',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A group of toggle buttons (All, Owner, Tenant ...). */
export function Segments<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="mb-3 flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cx(
            'rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
            value === o.key ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 text-ink-2 hover:bg-white/90',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 opacity-75">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function StatusChip<T extends string>({
  status,
  labels,
  tones,
}: {
  status: T;
  labels: Record<T, string>;
  tones: Record<T, Tone>;
}) {
  return <Chip tone={tones[status] ?? 'neutral'}>{labels[status] ?? status}</Chip>;
}

/** A label and a value in a definition list. */
export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-[var(--line)] py-2 text-[14px] last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold">{children}</dd>
    </div>
  );
}

export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold uppercase tracking-wide text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A modal with a form. `onSubmit` returns `{ error }` to stop, or `{ message }` after a successful call. */
export function FormDialog({
  title,
  description,
  submitLabel,
  variant = 'primary',
  children,
  onClose,
  onSubmit,
  onDone,
  wide,
  extra,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  variant?: ButtonVariant;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => Promise<{ error?: string; message?: string }>;
  onDone: () => void;
  wide?: boolean;
  /** Extra content shown below the error, for example a "Link existing person" prompt. */
  extra?: ReactNode;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await onSubmit();
      if (r.error !== undefined) {
        setError(r.error || null);
        return;
      }
      if (r.message) toast.show(r.message);
      onDone();
    } catch (e) {
      setError(residentsError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      wide={wide}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} loading={busy} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {extra}
      {children}
    </Modal>
  );
}

/** Field errors of a 400 or 422 for a form: `{ field: message }`. */
export { fieldErrors };

/** Picks and uploads one file. Reports the file id, or null when the file is removed or fails. */
export function FileField({
  label,
  purpose = 'RESIDENT_RECORD',
  onChange,
  hint,
  camera,
  societyId,
}: {
  label: string;
  purpose?: FilePurpose;
  onChange: (fileId: number | null) => void;
  hint?: string;
  /** On phones, open the camera for a photo of the document. */
  camera?: boolean;
  /** The society to store the file under, for a person who has not joined one yet. */
  societyId?: number;
}) {
  const id = useId();
  const [state, setState] = useState<{ name: string; busy: boolean; error: string | null } | null>(null);
  const available = fileUploadAvailable();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        capture={camera ? 'environment' : undefined}
        disabled={!available}
        onChange={async e => {
          const f = e.target.files?.[0];
          if (!f) {
            onChange(null);
            setState(null);
            return;
          }
          setState({ name: f.name, busy: true, error: null });
          try {
            const r = await uploadFile(f, purpose, societyId ? { societyId } : undefined);
            onChange(r.fileId);
            setState({ name: f.name, busy: false, error: null });
          } catch {
            onChange(null);
            setState({ name: f.name, busy: false, error: 'The file could not be uploaded. Try again.' });
          }
        }}
        className="block w-full text-[14px]"
      />
      {hint && <p className="mt-1.5 text-[12.5px] text-muted">{hint}</p>}
      {!available && <p className="mt-1.5 text-[12.5px] text-muted">File upload is not available yet.</p>}
      {state?.busy && <p className="mt-1.5 text-[12.5px] text-muted">Uploading {state.name}...</p>}
      {state && !state.busy && !state.error && (
        <p className="mt-1.5 text-[12.5px] text-[#14583a]">Attached: {state.name}</p>
      )}
      {state?.error && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-bad">
          {state.error}
        </p>
      )}
    </div>
  );
}

/** Search flats by label and pick one. `fixed` shows a flat that is already chosen. */
export function FlatPicker({
  value,
  onChange,
  error,
  fixed,
}: {
  value: number | null;
  onChange: (unitId: number | null, label: string) => void;
  error?: string | null;
  fixed?: string;
}) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ unitId: number; unitLabel: string }[]>([]);
  const [searched, setSearched] = useState(false);
  if (fixed) return <Input label="Flat" value={fixed} readOnly />;
  const search = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setFound([]);
      setSearched(false);
      return;
    }
    try {
      const r = await residentsService.flats({ q: text.trim(), limit: 20 });
      setFound(r.items.map(f => ({ unitId: f.unitId, unitLabel: f.unitLabel })));
    } catch {
      setFound([]);
    }
    setSearched(true);
  };
  return (
    <div>
      <Input
        label="Search flat"
        type="search"
        value={q}
        onChange={e => void search(e.target.value)}
        placeholder="A-1203"
        hint="Type at least 2 characters of the flat number."
      />
      <Select
        label="Flat"
        value={value ? String(value) : ''}
        error={error}
        onChange={e => {
          const id = Number(e.target.value);
          onChange(id || null, found.find(f => f.unitId === id)?.unitLabel ?? '');
        }}
        options={[
          { value: '', label: searched && found.length === 0 ? 'No flat found' : 'Choose a flat' },
          ...found.map(f => ({ value: String(f.unitId), label: f.unitLabel })),
        ]}
      />
    </div>
  );
}

export const isoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
export const rupeesToPaise = (v: string) => Math.round(Number(v) * 100);
