'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { useLoad } from '@/hooks/useLoad';
import { helpdeskResidentService as svc } from '@/services/helpdeskResident.service';
import type {
  Audience,
  BuildingIssueRow,
  IssueReported,
  QrLocation,
  Urgency,
} from '@/types/helpdeskResident';
import { CategoryPicker, LocationPicker } from './Pickers';
import { PhotoPicker, uploadPhotos } from './PhotoPicker';
import { URGENCY_LABEL, helpError, isSimilarError, statusLabel } from './format';

const URGENCIES: Urgency[] = ['NORMAL', 'URGENT', 'EMERGENCY'];

/**
 * Report a building issue (spec 11.6, 11.7, 8.10, 8.11). One form for the resident (`me`), the guard (`gate`)
 * and staff (`work`): the similar-issues panel appears before sending, with "Me too" for residents only.
 */
export function BuildingIssueForm({
  audience,
  qr,
  qrToken,
  onReported,
}: {
  audience: Audience;
  qr?: QrLocation | null;
  qrToken?: string;
  onReported: (r: IssueReported) => void;
}) {
  const toast = useToast();
  const cats = useLoad(() => svc.categories('BUILDING', audience), `cats-${audience}`);
  const [nodeId, setNodeId] = useState<number | null>(qr?.location.id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(
    qr && qr.suggestedCategoryIds.length === 1 ? qr.suggestedCategoryIds[0] : null,
  );
  const [subId, setSubId] = useState<number | null>(null);
  const [urgency, setUrgency] = useState<Urgency>('NORMAL');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [different, setDifferent] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [meToo, setMeToo] = useState<Record<number, boolean>>({});
  const [counts, setCounts] = useState<Record<number, number>>({});

  const suggested = qr?.suggestedCategoryIds ?? [];

  const ready = nodeId !== null && categoryId !== null;
  const similar = useLoad<BuildingIssueRow[]>(
    () => (ready ? svc.similar(audience, { locationNodeId: nodeId, categoryId }) : Promise.resolve([])),
    `sim-${audience}-${nodeId}-${categoryId}`,
  );
  const matches = similar.data ?? [];
  const stillOpen = (r: BuildingIssueRow) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(r.status);

  const tapMeToo = async (r: BuildingIssueRow) => {
    try {
      const u = await svc.upvote(r.id);
      setMeToo(m => ({ ...m, [r.id]: true }));
      setCounts(c => ({ ...c, [r.id]: u.upvoteCount }));
      toast.show('Thanks. We added your Me too.');
    } catch (e) {
      toast.show(helpError(e), 'error');
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (nodeId === null) e.location = 'Choose where the problem is.';
    if (categoryId === null) e.category = 'Choose a category.';
    if (matches.length > 0 && different && reason.trim().length < 10)
      e.reason = 'Say in at least 10 characters how this is different.';
    setErrors(e);
    if (Object.keys(e).length > 0 || nodeId === null || categoryId === null) return;
    setBusy(true);
    setProblem(null);
    try {
      const fileIds = files.length > 0 ? await uploadPhotos(files) : [];
      const body = {
        locationNodeId: nodeId,
        ...(qrToken ? { qrToken } : {}),
        categoryId,
        ...(subId ? { subCategoryId: subId } : {}),
        urgency,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(different && reason.trim() ? { duplicateReason: reason.trim() } : {}),
        ...(fileIds.length > 0 ? { fileIds } : {}),
      };
      let result: IssueReported;
      if (audience === 'me') {
        const t = await svc.reportIssueResident(body);
        result = {
          id: t.id,
          ticketNo: t.ticketNo,
          status: t.status,
          priority: t.priority,
          affectedUnitCount: t.affectedUnitCount,
          message: '',
        };
      } else {
        result = await svc.reportIssue(audience, body);
      }
      result.message =
        result.affectedUnitCount > 0
          ? `Issue reported. ${result.affectedUnitCount} flats will get updates.`
          : 'Issue reported.';
      // Field screens show their own banner; only the resident app (which leaves the page) needs the toast.
      if (audience === 'me') toast.show(result.message);
      onReported(result);
    } catch (err) {
      if (isSimilarError(err)) {
        setDifferent(true);
        similar.reload();
      }
      setProblem(helpError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={ev => {
        ev.preventDefault();
        void submit();
      }}
    >
      {problem && <Alert tone="bad">{problem}</Alert>}
      {qr ? (
        <div className="rounded-[14px] bg-white/60 px-3.5 py-2.5 text-[14px]">
          <div className="text-[12px] font-semibold text-muted">Place (from the QR code)</div>
          <div className="font-semibold">{qr.location.pathLabel}</div>
        </div>
      ) : (
        <LocationPicker
          value={nodeId}
          onChange={id => {
            setNodeId(id);
            setDifferent(false);
            setErrors(e => ({ ...e, location: '' }));
          }}
          error={errors.location}
        />
      )}
      {cats.error ? (
        <Alert tone="bad">The categories could not be loaded. Reload the page.</Alert>
      ) : cats.loading ? (
        <div className="skeleton h-24 w-full" />
      ) : (
        <CategoryPicker
          categories={cats.data ?? []}
          categoryId={categoryId}
          subCategoryId={subId}
          suggested={suggested}
          onChange={(c, s) => {
            setCategoryId(c);
            setSubId(s);
            setDifferent(false);
            setErrors(e => ({ ...e, category: '' }));
          }}
          error={errors.category}
        />
      )}

      <div role="group" aria-label="How urgent is it?">
        <div className="mb-1 text-[13px] font-semibold">How urgent is it?</div>
        <div className="flex gap-1.5">
          {URGENCIES.map(u => (
            <button
              key={u}
              type="button"
              aria-pressed={urgency === u}
              onClick={() => setUrgency(u)}
              className={cx(
                'flex-1 rounded-full px-3 py-2 text-[13px] font-semibold',
                urgency === u ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/90',
              )}
            >
              {URGENCY_LABEL[u]}
            </button>
          ))}
        </div>
        {urgency === 'EMERGENCY' && (
          <p className="mt-1 text-[12.5px] text-muted">
            For danger to people or property (fire, flooding, a stuck lift). For danger to life, also call
            112.
          </p>
        )}
      </div>

      <Textarea
        label="What is wrong? (optional)"
        value={description}
        maxLength={2000}
        onChange={e => setDescription(e.target.value)}
      />
      <PhotoPicker files={files} onChange={setFiles} disabled={busy} />

      {ready && matches.length > 0 && (
        <section aria-label="Similar issues" className="rounded-[16px] bg-[rgba(201,169,97,0.22)] p-3.5">
          <h3 className="text-[14px] font-bold">Already reported here</h3>
          <p className="mb-2 text-[13px] text-muted">
            {audience === 'me'
              ? 'If this is your problem, tap Me too instead of sending a new report.'
              : 'Check that this is not the same problem.'}
          </p>
          <ul className="grid gap-2">
            {matches.map(r => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-[12px] bg-white/70 p-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{r.title}</div>
                  <div className="text-[12px] text-muted">
                    {r.ticketNo} · {statusLabel(r.status)} · {counts[r.id] ?? r.upvoteCount} Me too
                  </div>
                </div>
                {audience === 'me' &&
                  stillOpen(r) &&
                  !r.isRequester &&
                  (r.iUpvoted || meToo[r.id] ? (
                    <Chip tone="ok">You added Me too</Chip>
                  ) : (
                    <Button
                      size="sm"
                      variant="gold"
                      className="shrink-0 whitespace-nowrap"
                      onClick={() => void tapMeToo(r)}
                    >
                      Me too
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-start gap-2 text-[13.5px]">
            <input
              type="checkbox"
              className="mt-1"
              checked={different}
              onChange={e => setDifferent(e.target.checked)}
            />
            <span>My problem is different from these</span>
          </label>
          {different && (
            <div className="mt-2">
              <Input
                label="How is it different?"
                value={reason}
                maxLength={300}
                error={errors.reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
          )}
        </section>
      )}

      <Button type="submit" block loading={busy} disabled={matches.length > 0 && !different && ready}>
        Report the issue
      </Button>
      {matches.length > 0 && !different && ready && (
        <p className="-mt-2 text-center text-[12.5px] text-muted">
          Tap Me too above, or tick “My problem is different” to send a new report.
        </p>
      )}
    </form>
  );
}
