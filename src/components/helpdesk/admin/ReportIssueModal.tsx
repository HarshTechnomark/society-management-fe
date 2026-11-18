'use client';
import { useEffect, useMemo, useState } from 'react';
import { UnitPicker } from '@/components/maintenance/invoices/InvoiceBits';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { plural } from '@/lib/plural';
import { helpdeskService } from '@/services/helpdesk.service';
import { residentsService } from '@/services/residents.service';
import type { UnitOption } from '@/types/billingInvoices';
import type {
  AffectedLevel,
  BuildingIssueInput,
  CreatedTicket,
  PersonalTicketInput,
  Priority,
  SimilarTicket,
} from '@/types/helpdesk';
import { ago, helpdeskError } from './format';
import { AttachmentPicker, CategorySelect, useCategories, useLocations, type UploadedFile } from './pickers';

const URGENCY = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'EMERGENCY', label: 'Danger or safety' },
];
const URGENCY_PRIORITY: Record<string, Priority | undefined> = {
  NORMAL: undefined,
  URGENT: 'P2',
  EMERGENCY: 'P1',
};
const LEVELS: { value: AffectedLevel; label: string }[] = [
  { value: 'SOCIETY', label: 'Whole society' },
  { value: 'BUILDING', label: 'Building' },
  { value: 'FLOOR', label: 'This floor' },
];
const MERGE_LATER = 'Reported now, to be merged with the open issue later.';

/** The error's text for one field of the form (`errors[]` of a 400/422), when the API named it. */
const fieldError = (e: unknown, field: string): string | null =>
  e instanceof ApiError ? (e.entry(field)?.message ?? null) : null;

/**
 * "Report an issue" (spec 11.3): a building problem (`POST /building-issues`) or a complaint for one flat
 * (`POST /tickets`). Building issues first look for similar open ones (`GET /building-issues/similar`).
 */
export function ReportIssueModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: CreatedTicket) => void;
}) {
  const toast = useToast();
  const { spots, buildings } = useLocations();
  const [where, setWhere] = useState('SOCIETY'); // SOCIETY, FLAT or B<buildingId>
  const flat = where === 'FLAT';
  const cats = useCategories(flat ? 'PERSONAL' : 'BUILDING');
  const [unit, setUnit] = useState<UnitOption | null>(null);
  const [residentId, setResidentId] = useState('');
  const [channel, setChannel] = useState('PHONE');
  const [spotId, setSpotId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subId, setSubId] = useState('');
  const [urgency, setUrgency] = useState('NORMAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [level, setLevel] = useState<AffectedLevel | ''>('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);
  const [anyway, setAnyway] = useState(false);
  const [reason, setReason] = useState('');
  const [serverSimilar, setServerSimilar] = useState(false);

  const buildingId = where.startsWith('B') ? Number(where.slice(1)) : null;
  const spotOptions = useMemo(
    () => (buildingId == null ? spots : spots.filter(s => s.buildingId === buildingId)),
    [spots, buildingId],
  );
  const spot = spots.find(s => String(s.id) === spotId);
  const buildingName = buildings.find(b => b.buildingId === buildingId || b.id === buildingId)?.name;

  const residents = useLoad(
    () =>
      unit
        ? residentsService
            .residents({ unitId: unit.id, status: 'ACTIVE', limit: 50 })
            .then(r => r.items)
            .catch(() => [])
        : Promise.resolve([]),
    `res-${unit?.id ?? 0}`,
  );

  // The duplicate check: a building issue with a spot and a category, after a short pause.
  const [similar, setSimilar] = useState<SimilarTicket[]>([]);
  useEffect(() => {
    if (flat || !spotId || !categoryId) return;
    let live = true;
    const t = setTimeout(() => {
      helpdeskService.similar({ locationNodeId: Number(spotId), categoryId: Number(categoryId) }).then(
        r => live && setSimilar(r),
        () => live && setSimilar([]),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [flat, spotId, categoryId]);
  const shown = flat || !spotId || !categoryId ? [] : similar;
  const needReason = (shown.length > 0 || serverSimilar) && anyway;

  const t = title.trim();
  const d = description.trim();
  const errors = {
    unit: flat && !unit ? 'Choose the flat.' : null,
    spot: !flat && !spotId ? 'Choose the spot.' : null,
    category: !categoryId ? 'Choose a category.' : null,
    title: flat
      ? t.length < 5 || t.length > 150
        ? 'Enter 5 to 150 characters.'
        : null
      : t && (t.length < 5 || t.length > 150)
        ? 'Enter 5 to 150 characters.'
        : null,
    description: flat
      ? d.length < 10 || d.length > 2000
        ? 'Enter 10 to 2000 characters.'
        : null
      : d.length > 2000
        ? 'Use at most 2000 characters.'
        : null,
    reason:
      needReason && (reason.trim().length < 10 || reason.trim().length > 300)
        ? 'Enter 10 to 300 characters.'
        : null,
  };
  const blocked = (shown.length > 0 || serverSimilar) && !anyway;

  const submit = async () => {
    setTouched(true);
    setProblem(null);
    if (Object.values(errors).some(Boolean) || blocked) return;
    setBusy(true);
    try {
      const fileIds = files.map(f => f.fileId);
      let created: CreatedTicket;
      if (flat) {
        const body: PersonalTicketInput = {
          unitId: unit!.id,
          channel: channel as 'PHONE' | 'WALK_IN',
          categoryId: Number(categoryId),
          title: t,
          description: d,
          ...(residentId ? { requesterResidentId: Number(residentId) } : {}),
          ...(subId ? { subCategoryId: Number(subId) } : {}),
          ...(URGENCY_PRIORITY[urgency] ? { priority: URGENCY_PRIORITY[urgency] } : {}),
          ...(fileIds.length ? { fileIds } : {}),
        };
        created = await helpdeskService.createPersonal(body);
      } else {
        const body: BuildingIssueInput = {
          locationNodeId: Number(spotId),
          categoryId: Number(categoryId),
          urgency: urgency as BuildingIssueInput['urgency'],
          ...(subId ? { subCategoryId: Number(subId) } : {}),
          ...(t ? { title: t } : {}),
          ...(d ? { description: d } : {}),
          ...(level ? { affectedLevel: level } : {}),
          ...(needReason ? { duplicateReason: reason.trim() } : {}),
          ...(fileIds.length ? { fileIds } : {}),
        };
        created = await helpdeskService.createBuilding(body);
      }
      toast.show(
        flat ? 'Ticket created' : `Reported. ${plural(created.affectedUnitCount, 'flat')} will get updates.`,
      );
      onCreated(created);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SIMILAR_ISSUE_EXISTS') {
        setServerSimilar(true);
        setAnyway(false);
      }
      setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const hint = flat
    ? 'Only the flat’s residents are notified.'
    : buildingId != null
      ? `The flats in ${buildingName ?? 'this building'} get an alert and every status update.`
      : 'Every flat in the society gets an alert and every status update.';

  return (
    <Modal
      open
      wide
      onClose={busy ? () => {} : onClose}
      title="Report an issue"
      description={
        flat
          ? 'A complaint for one flat. Only that flat’s residents are told.'
          : 'Building problems reach the affected residents automatically.'
      }
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={blocked} onClick={() => void submit()}>
            Report issue
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {problem != null && <Alert tone="bad">{helpdeskError(problem)}</Alert>}
        <Select
          label="Where"
          value={where}
          onChange={e => {
            setWhere(e.target.value);
            setSpotId('');
            setCategoryId('');
            setSubId('');
            setSimilar([]);
            setServerSimilar(false);
            setLevel('');
          }}
          options={[
            { value: 'SOCIETY', label: 'Whole society / common area' },
            ...buildings.map(b => ({ value: `B${b.buildingId}`, label: b.name })),
            { value: 'FLAT', label: 'A single flat' },
          ]}
        />
        {flat ? (
          <>
            <UnitPicker
              label="Flat"
              value={unit}
              onChange={u => {
                setUnit(u);
                setResidentId('');
              }}
              required
              error={touched ? (errors.unit ?? undefined) : undefined}
            />
            {unit && (
              <Select
                label="Resident (optional)"
                value={residentId}
                onChange={e => setResidentId(e.target.value)}
                error={fieldError(problem, 'requesterResidentId')}
                options={[
                  { value: '', label: 'Not named' },
                  ...(residents.data ?? []).map(r => ({ value: String(r.id), label: r.name })),
                ]}
              />
            )}
            <Select
              label="Channel"
              value={channel}
              onChange={e => setChannel(e.target.value)}
              options={[
                { value: 'PHONE', label: 'Phone' },
                { value: 'WALK_IN', label: 'Walk-in' },
              ]}
            />
          </>
        ) : (
          <Select
            label="Spot"
            value={spotId}
            onChange={e => setSpotId(e.target.value)}
            error={(touched ? errors.spot : null) ?? fieldError(problem, 'locationNodeId')}
            options={[
              { value: '', label: 'Choose where' },
              ...spotOptions.map(s => ({ value: String(s.id), label: s.label })),
            ]}
          />
        )}
        <CategorySelect
          categories={cats.tops}
          categoryId={categoryId}
          subCategoryId={subId}
          onChange={(c, s) => {
            setCategoryId(c);
            setSubId(s);
            setServerSimilar(false);
          }}
          errors={{
            category: (touched ? errors.category : null) ?? fieldError(problem, 'categoryId'),
            sub: fieldError(problem, 'subCategoryId'),
          }}
        />
        <Select
          label="Urgency"
          value={urgency}
          onChange={e => setUrgency(e.target.value)}
          options={URGENCY}
        />
        <Input
          label="What is wrong?"
          value={title}
          maxLength={150}
          required={flat}
          hint={
            flat ? undefined : 'Optional. A title is made from the category and spot if you leave it empty.'
          }
          onChange={e => setTitle(e.target.value)}
          error={(touched ? errors.title : null) ?? fieldError(problem, 'title')}
        />
        <Textarea
          label={flat ? 'Details' : 'More detail (optional)'}
          value={description}
          maxLength={2000}
          required={flat}
          onChange={e => setDescription(e.target.value)}
          error={(touched ? errors.description : null) ?? fieldError(problem, 'description')}
        />
        {!flat && (
          <Select
            label="Affects"
            value={level}
            onChange={e => setLevel(e.target.value as AffectedLevel | '')}
            error={fieldError(problem, 'affectedLevel')}
            options={[
              {
                value: '',
                label: spot?.nodeType === 'FLOOR' ? 'Default (this floor)' : 'Default for this spot',
              },
              ...LEVELS,
            ]}
          />
        )}
        <AttachmentPicker value={files} onChange={setFiles} disabled={busy} />

        {shown.length > 0 && (
          <Alert tone="warn">
            <ul className="grid gap-1">
              {shown.slice(0, 3).map(s => (
                <li key={s.id}>
                  Similar issue already open: <strong>{s.title}</strong> ({ago(s.createdAt)}).
                </li>
              ))}
            </ul>
            {!anyway && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="glass"
                  onClick={() => {
                    setReason(MERGE_LATER);
                    setAnyway(true);
                  }}
                >
                  Merge later
                </Button>
                <Button size="sm" variant="glass" onClick={() => setAnyway(true)}>
                  Report anyway
                </Button>
              </div>
            )}
          </Alert>
        )}
        {serverSimilar && shown.length === 0 && (
          <Alert tone="warn">
            A similar issue is already open
            {problem instanceof ApiError && problem.errors?.length
              ? ` (${problem.errors.map(x => x.message).join(', ')})`
              : ''}
            .{' '}
            {!anyway && (
              <button type="button" className="font-semibold underline" onClick={() => setAnyway(true)}>
                Report anyway
              </button>
            )}
          </Alert>
        )}
        {needReason && (
          <Textarea
            label="Why report it anyway?"
            value={reason}
            maxLength={300}
            onChange={e => setReason(e.target.value)}
            error={touched ? errors.reason : null}
            required
          />
        )}
        <p className="text-[13px] text-muted">{hint}</p>
      </div>
    </Modal>
  );
}
