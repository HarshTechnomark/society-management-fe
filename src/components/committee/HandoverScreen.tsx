'use client';
import { useState } from 'react';
import { Card } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { FileField, Empty, Loading } from '@/components/residents/common';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { committeeService } from '@/services/committee.service';
import { societySetupService } from '@/services/society-setup.service';
import type { Designation, Handover, HandoverItem, HandoverStatus } from '@/types/committee';
import {
  DESIGNATION_LABEL,
  DESIGNATION_ORDER,
  committeeError,
  designationLabel,
  handoverProgress,
} from './format';

const M = PERMISSIONS.settings.members;
const MAX_EVIDENCE = 5;
const STATUS_TEXT: Record<HandoverStatus, string> = {
  PENDING: 'Pending',
  DONE: 'Done',
  NOT_APPLICABLE: 'Not applicable',
};
const STATUS_TONE: Record<HandoverStatus, Tone> = { PENDING: 'warn', DONE: 'ok', NOT_APPLICABLE: 'neutral' };
const STATUS_OPTIONS = (Object.keys(STATUS_TEXT) as HandoverStatus[]).map(v => ({
  value: v,
  label: STATUS_TEXT[v],
}));
const DESIGNATION_OPTIONS = [
  { value: '', label: 'Anyone on the committee' },
  ...DESIGNATION_ORDER.map(d => ({ value: d, label: DESIGNATION_LABEL[d] })),
];

const readOnlyHint = (i: HandoverItem) =>
  i.ownerDesignation
    ? `Only the ${designationLabel(i.ownerDesignation)} or a committee admin can update this`
    : 'Only a committee admin can update this';

/** Hand-over checklist of one term (spec 11.6): progress, items with owner, status, note and evidence, add item. */
export function HandoverScreen({
  termId,
  termName,
  onBack,
  onChanged,
}: {
  termId: number;
  termName: string;
  onBack: () => void;
  /** The committee tab shows the progress too, so it reloads after a change. */
  onChanged?: () => void;
}) {
  const [tick, setTick] = useState(0);
  const load = useLoad(() => committeeService.handover(termId), `${termId}-${tick}`);
  const reload = () => {
    setTick(t => t + 1);
    onChanged?.();
  };
  return (
    <section aria-label="Hand-over checklist">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[19px] font-bold">Hand-over checklist</h2>
          <p className="text-[13.5px] text-muted">{termName}</p>
        </div>
        <Button variant="glass" size="sm" onClick={onBack}>
          Back to the committee
        </Button>
      </div>
      <Loading load={load} rows={4}>
        {h => <Checklist h={h} termId={termId} onChanged={reload} />}
      </Loading>
    </section>
  );
}

function Checklist({ h, termId, onChanged }: { h: Handover; termId: number; onChanged: () => void }) {
  const canAdd = usePermission(M.edit);
  const [adding, setAdding] = useState(false);
  const p = h.progress;
  const { finished: resolved, pct, text } = handoverProgress(p);
  return (
    <div>
      <Card className="mb-3">
        <p className="mb-1 text-[14px] font-semibold" data-testid="handover-progress-text">
          {text}
        </p>
        <div
          role="progressbar"
          aria-label="Hand-over checklist progress"
          aria-valuemin={0}
          aria-valuemax={p.total}
          aria-valuenow={resolved}
          className="h-2 w-full overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
        >
          <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
        </div>
        {h.completedAt ? (
          <p className="mt-2">
            <Chip tone="ok">Complete on {shortDate(h.completedAt)}</Chip>
          </p>
        ) : (
          p.pending > 0 && <p className="mt-2 text-[13px] text-muted">{p.pending} still pending.</p>
        )}
      </Card>
      {h.items.length === 0 && (
        <Card>
          <Empty
            title="No checklist items yet."
            text="Add the things the outgoing committee hands over."
            action={
              canAdd ? (
                <Button onClick={() => setAdding(true)} aria-label="Add item">
                  Add item
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}
      <ul className="space-y-3" aria-label="Checklist items">
        {h.items.map(i => (
          <ItemRow key={`${i.itemId}-${i.updatedAt ?? ''}`} item={i} termId={termId} onChanged={onChanged} />
        ))}
      </ul>
      {h.items.length > 0 && canAdd && !adding && (
        <div className="mt-3">
          <Button variant="glass" onClick={() => setAdding(true)}>
            Add item
          </Button>
        </div>
      )}
      {adding && (
        <AddItem
          termId={termId}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ItemRow({ item, termId, onChanged }: { item: HandoverItem; termId: number; onChanged: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<HandoverStatus>(item.status);
  const [note, setNote] = useState(item.note ?? '');
  const [files, setFiles] = useState<number[]>(item.evidenceFileIds);
  const [pickerKey, setPickerKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const edit = item.canEdit;
  const changed =
    status !== item.status ||
    note.trim() !== (item.note ?? '') ||
    files.join(',') !== item.evidenceFileIds.join(',');

  const save = async () => {
    setErr(null);
    if (status === 'NOT_APPLICABLE' && (note.trim().length < 5 || note.trim().length > 300)) {
      setErr('Say why this item does not apply (5 to 300 characters).');
      return;
    }
    if (note.length > 300) {
      setErr('The note can have at most 300 characters.');
      return;
    }
    const body: { status?: HandoverStatus; note?: string | null; evidenceFileIds?: number[] } = {};
    if (status !== item.status) body.status = status;
    if (note.trim() !== (item.note ?? '') || status === 'NOT_APPLICABLE') body.note = note.trim() || null;
    if (files.join(',') !== item.evidenceFileIds.join(',')) body.evidenceFileIds = files;
    setBusy(true);
    try {
      await committeeService.updateHandoverItem(termId, item.itemId, body);
      toast.show('Checklist item saved.');
      onChanged();
    } catch (e) {
      setErr(committeeError(e));
    } finally {
      setBusy(false);
    }
  };

  const open = async (fileId: number) => {
    try {
      const r = await societySetupService.fileDownloadUrl(fileId);
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      toast.show(committeeError(e), 'error');
    }
  };

  return (
    <li data-testid="handover-item" aria-label={item.title}>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15.5px] font-bold">{item.title}</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Owner:{' '}
              {item.ownerDesignation
                ? `${designationLabel(item.ownerDesignation)}${item.ownerName ? `, ${item.ownerName}` : ''}`
                : 'Anyone on the committee'}
            </p>
          </div>
          <Chip tone={STATUS_TONE[item.status]}>{STATUS_TEXT[item.status]}</Chip>
        </div>
        {edit ? (
          <div className="mt-3">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Select
                label="Status"
                value={status}
                onChange={e => setStatus(e.target.value as HandoverStatus)}
                options={STATUS_OPTIONS}
              />
              <Textarea
                label={status === 'NOT_APPLICABLE' ? 'Why it does not apply' : 'Note'}
                value={note}
                rows={2}
                maxLength={300}
                onChange={e => setNote(e.target.value)}
              />
            </div>
            <Evidence
              files={files}
              canAdd={files.length < MAX_EVIDENCE}
              pickerKey={pickerKey}
              onOpen={open}
              onRemove={id => setFiles(f => f.filter(x => x !== id))}
              onAdded={id => {
                setFiles(f => (f.includes(id) ? f : [...f, id]));
                setPickerKey(k => k + 1);
              }}
            />
            {err && <Alert tone="bad">{err}</Alert>}
            <Button size="sm" onClick={save} loading={busy} disabled={!changed}>
              Save item
            </Button>
          </div>
        ) : (
          <div className="mt-2" title={readOnlyHint(item)}>
            {item.note && <p className="text-[14px]">{item.note}</p>}
            <Evidence files={files} onOpen={open} />
            <p className="mt-1 text-[12.5px] text-muted">{readOnlyHint(item)}.</p>
          </div>
        )}
        {item.updatedAt && (
          <p className="mt-2 text-[12.5px] text-muted">
            Last updated {item.updatedByName ? `by ${item.updatedByName} ` : ''}on {shortDate(item.updatedAt)}
          </p>
        )}
      </Card>
    </li>
  );
}

function Evidence({
  files,
  canAdd,
  pickerKey,
  onOpen,
  onRemove,
  onAdded,
}: {
  files: number[];
  canAdd?: boolean;
  pickerKey?: number;
  onOpen: (id: number) => void;
  onRemove?: (id: number) => void;
  onAdded?: (id: number) => void;
}) {
  return (
    <div className="mb-3">
      {files.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label="Evidence files">
          {files.map((id, n) => (
            <li key={id} className="flex items-center gap-1">
              <Button
                size="xs"
                variant="glass"
                onClick={() => onOpen(id)}
                aria-label={`Open evidence ${n + 1}`}
              >
                Evidence {n + 1}
              </Button>
              {onRemove && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onRemove(id)}
                  aria-label={`Remove evidence ${n + 1}`}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !onAdded && <p className="text-[13px] text-muted">No evidence attached.</p>
      )}
      {onAdded && canAdd && (
        <FileField
          key={pickerKey}
          label="Add evidence (photo or PDF)"
          purpose="HANDOVER_EVIDENCE"
          camera
          hint={`Up to ${MAX_EVIDENCE} files.`}
          onChange={id => id && onAdded(id)}
        />
      )}
      {onAdded && !canAdd && (
        <p className="text-[12.5px] text-muted">The limit of {MAX_EVIDENCE} files is reached.</p>
      )}
    </div>
  );
}

function AddItem({ termId, onClose, onAdded }: { termId: number; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (t.length < 3 || t.length > 120) {
      setErr('Enter a title of 3 to 120 characters.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await committeeService.addHandoverItem(termId, {
        title: t,
        ownerDesignation: (owner || null) as Designation | null,
      });
      toast.show('Item added.');
      onAdded();
    } catch (x) {
      toast.show(committeeError(x), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mt-3">
      <form onSubmit={submit} aria-label="Add checklist item" noValidate>
        <h3 className="mb-2 text-[15.5px] font-bold">Add item</h3>
        <Input
          label="Title"
          value={title}
          error={err ?? undefined}
          onChange={e => setTitle(e.target.value)}
        />
        <Select
          label="Owner"
          value={owner}
          onChange={e => setOwner(e.target.value)}
          options={DESIGNATION_OPTIONS}
        />
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            Add to checklist
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
