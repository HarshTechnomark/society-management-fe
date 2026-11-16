'use client';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useState } from 'react';
import type { Loaded } from '@/hooks/useLoad';
import type { Page } from '@/types/paymentsOps';
import { isPlan402, opsError, plainError } from './format';
import type { ButtonVariant } from '@/components/ui/Button';

export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Chip tone={tone}>{children}</Chip>;
}

/** Loading, error, empty and paged list states shared by the admin lists. `locked` is shown on a 402. */
export function ListBody<T>({
  load,
  label,
  empty,
  locked,
  page,
  onPage,
  children,
}: {
  load: Loaded<Page<T>>;
  label: string;
  empty: ReactNode;
  locked?: ReactNode;
  page: number;
  onPage: (p: number) => void;
  children: (items: T[]) => ReactNode;
}) {
  if (load.error != null) {
    if (locked && isPlan402(load.error)) return <>{locked}</>;
    return (
      <ErrorState
        error={plainError(load.error)}
        action={
          <Button size="sm" onClick={load.reload}>
            Try again
          </Button>
        }
      />
    );
  }
  if (load.loading)
    return (
      <div aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton mb-2 h-14 w-full" data-testid="skeleton-row" />
        ))}
      </div>
    );
  const items = load.data?.items ?? [];
  if (items.length === 0) return <>{empty}</>;
  const pages = load.data?.pagination.totalPages ?? 1;
  return (
    <>
      <ul aria-label={label} className="divide-y divide-[var(--line)]">
        {children(items)}
      </ul>
      {pages > 1 && (
        <nav
          aria-label={`Pages of ${label.toLowerCase()}`}
          className="mt-3 flex items-center justify-between text-[13.5px]"
        >
          <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="glass" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </>
  );
}

export const NoRows = ({ title, text }: { title: string; text?: string }) => (
  <EmptyState title={title} text={text} />
);

/** A modal asking for a reason of 5 to 300 characters before an audited action runs. Errors show inside it. */
export function ReasonModal({
  title,
  description,
  confirmLabel,
  variant = 'danger',
  max = 300,
  onCancel,
  onSubmit,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  variant?: ButtonVariant;
  max?: number;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = reason.trim();
    if (t.length < 5 || t.length > max) {
      setError(`Enter a reason of 5 to ${max} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(t);
    } catch (e) {
      setError(opsError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Keep as it is
          </Button>
          <Button variant={variant} loading={busy} onClick={() => void submit()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        value={reason}
        error={error ?? undefined}
        hint="Kept in the audit trail."
        onChange={e => setReason(e.target.value)}
        required
      />
    </Modal>
  );
}
