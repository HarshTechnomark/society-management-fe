'use client';
import { useRef, useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Segments } from '@/components/residents/common';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { useFeature } from '@/hooks/useFeature';
import { fileUploadAvailable, uploadFile } from '@/lib/fileUpload';
import { collectionsService } from '@/services/collections.service';
import { noticesService } from '@/services/notices.service';
import type {
  ActionInput,
  Notice,
  NoticeCategory,
  NoticeChannel,
  NoticeInput,
  NoticeKind,
  NoticePriority,
  NoticeTemplate,
} from '@/types/notices';
import { AudienceBuilder, EMPTY_AUDIENCE, audienceInput, type AudienceState } from './AudienceBuilder';
import {
  CATEGORY_LABEL,
  UTILITY_TYPES,
  isoToLocal,
  localToIso,
  noticeError,
  plainError,
  stripTags,
} from './format';
import { RichTextField } from './RichTextField';
import { sanitizeNoticeHtml } from './sanitize';

const MAX_FILES = 5;
const LOCALES = [
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
];
const CHANNELS: { key: NoticeChannel; label: string }[] = [
  { key: 'EMAIL', label: 'Email' },
  { key: 'SMS', label: 'SMS' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
];

interface Form {
  title: string;
  body: string;
  category: NoticeCategory;
  priority: NoticePriority;
  locale: string;
  kind: NoticeKind;
  utilityType: string;
  outageStartsAt: string;
  outageEndsAt: string;
  audience: AudienceState;
  channels: NoticeChannel[];
  payCollection: boolean;
  collectionId: string;
  payDues: boolean;
  link: boolean;
  linkUrl: string;
  linkLabel: string;
  requiresAck: boolean;
  ackDueAt: string;
  isPinned: boolean;
  expiresAt: string;
  sendMode: 'ASAP' | 'LATER';
  scheduledAt: string;
  files: { fileId: number; name: string }[];
  editNote: string;
}
const BLANK: Form = {
  title: '',
  body: '',
  category: 'GENERAL',
  priority: 'NORMAL',
  locale: 'en-IN',
  kind: 'STANDARD',
  utilityType: 'WATER',
  outageStartsAt: '',
  outageEndsAt: '',
  audience: EMPTY_AUDIENCE,
  channels: [],
  payCollection: false,
  collectionId: '',
  payDues: false,
  link: false,
  linkUrl: '',
  linkLabel: '',
  requiresAck: false,
  ackDueAt: '',
  isPinned: false,
  expiresAt: '',
  sendMode: 'ASAP',
  scheduledAt: '',
  files: [],
  editNote: '',
};

function fromNotice(n: Notice): Form {
  const a = n.audience;
  const pay = n.actions.find(x => x.type === 'PAY_COLLECTION');
  const link = n.actions.find(x => x.type === 'LINK');
  return {
    ...BLANK,
    title: n.title,
    body: n.body,
    category: n.category,
    priority: n.priority,
    locale: n.locale,
    kind: n.kind,
    utilityType: n.utility?.type || 'WATER',
    outageStartsAt: isoToLocal(n.utility?.startsAt),
    outageEndsAt: isoToLocal(n.utility?.endsAt),
    audience: {
      type: a.type,
      relation: a.relation,
      buildingIds: a.type === 'BUILDINGS' ? (a.ids ?? []) : [],
      units: a.type === 'UNITS' ? (a.ids ?? []).map(id => ({ id, label: `Flat ${id}` })) : [],
      roleKeys: a.roleKeys ?? [],
    },
    channels: n.channels,
    payCollection: !!pay,
    collectionId: pay?.refId ? String(pay.refId) : '',
    payDues: n.actions.some(x => x.type === 'PAY_DUES'),
    link: !!link,
    linkUrl: link?.url ?? '',
    linkLabel: link?.label ?? '',
    requiresAck: n.requiresAck,
    ackDueAt: isoToLocal(n.ackDueAt),
    isPinned: n.isPinned,
    expiresAt: isoToLocal(n.expiresAt),
    sendMode: n.scheduledAt ? 'LATER' : 'ASAP',
    scheduledAt: isoToLocal(n.scheduledAt),
    files: n.attachments.map(f => ({ fileId: f.fileId, name: f.name })),
  };
}

export function actionsOf(f: Form): ActionInput[] {
  const out: ActionInput[] = [];
  if (f.payCollection && f.collectionId) out.push({ type: 'PAY_COLLECTION', refId: Number(f.collectionId) });
  if (f.payDues) out.push({ type: 'PAY_DUES' });
  if (f.link) out.push({ type: 'LINK', url: f.linkUrl.trim(), label: f.linkLabel.trim() });
  return out;
}

/** Field problems in the wording of the API (spec 11.2); an empty object means the notice can be sent. */
export function composerProblems(f: Form, now = Date.now()): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.title.trim().length < 5) p.title = 'Add a title (5+ characters).';
  if (stripTags(f.body).length < 10) p.body = 'Write the message (10+ characters).';
  const buttons = [f.payCollection, f.payDues, f.link].filter(Boolean).length;
  if (buttons > 2) p.actions = 'Choose at most 2 buttons.';
  if (f.payCollection && !f.collectionId) p.collectionId = 'Choose a collection.';
  if (f.link && (!/^https:\/\//i.test(f.linkUrl.trim()) || f.linkLabel.trim().length < 2))
    p.link = 'A link needs an https:// address and a label of 2+ characters.';
  if (f.sendMode === 'LATER') {
    const t = f.scheduledAt ? new Date(f.scheduledAt).getTime() : NaN;
    if (!(t >= now + 5 * 60_000)) p.scheduledAt = 'Pick a time at least 5 minutes from now.';
  }
  const left = /\[[^\]\n]{1,40}\]/.exec(`${f.title} ${stripTags(f.body)}`);
  if (left) p.placeholder = `Replace ${left[0]} with the real details before sending.`;
  if (!audienceInput(f.audience)) p.audience = 'Choose who should receive this.';
  if (f.kind === 'UTILITY_SHUTDOWN' && (!f.outageStartsAt || !f.outageEndsAt))
    p.outage = 'Add when the outage starts and ends.';
  return p;
}

/** The body of POST /notices from the form (spec 8.2). Empty optional fields are left out. */
export function toInput(f: Form): NoticeInput {
  const channels = f.channels;
  return {
    kind: f.kind,
    title: f.title.trim(),
    body: f.body,
    category: f.category,
    priority: f.priority,
    locale: f.locale,
    audience: audienceInput(f.audience) ?? { type: 'ALL', relation: 'ANY' },
    channels,
    actions: actionsOf(f),
    requiresAck: f.requiresAck,
    ...(f.requiresAck && f.ackDueAt ? { ackDueAt: localToIso(f.ackDueAt) } : {}),
    isPinned: f.isPinned,
    ...(f.expiresAt ? { expiresAt: localToIso(f.expiresAt) } : {}),
    ...(f.kind === 'UTILITY_SHUTDOWN'
      ? {
          utilityType: f.utilityType,
          outageStartsAt: localToIso(f.outageStartsAt),
          outageEndsAt: localToIso(f.outageEndsAt),
        }
      : {}),
    fileIds: f.files.map(x => x.fileId),
  };
}

/** Notice composer (spec 11.2): a wide drawer, full screen on phones. After publish only a typo edit is allowed. */
export function NoticeComposer({
  noticeId,
  onClose,
  onSaved,
}: {
  noticeId?: number;
  onClose: () => void;
  onSaved: (n: Notice) => void;
}) {
  const existing = useLoad<Notice | null>(
    () => (noticeId ? noticesService.get(noticeId) : Promise.resolve(null)),
    String(noticeId ?? 'new'),
  );
  if (existing.error != null || existing.loading)
    return (
      <Drawer open onClose={onClose} title="Edit notice" size={640}>
        {existing.error != null ? (
          <ErrorState
            error={plainError(existing.error)}
            action={
              <Button size="sm" onClick={existing.reload}>
                Try again
              </Button>
            }
          />
        ) : (
          <div aria-busy="true" aria-label="Loading" className="skeleton h-40 w-full" />
        )}
      </Drawer>
    );
  return (
    <ComposerForm
      key={existing.data?.id ?? 'new'}
      notice={existing.data}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ComposerForm({
  notice,
  onClose,
  onSaved,
}: {
  notice: Notice | null;
  onClose: () => void;
  onSaved: (n: Notice) => void;
}) {
  const toast = useToast();
  const canTemplates = useFeature('communication.notice_template_library');
  const canTarget = useFeature('communication.audience_targeting');
  const canSchedule = useFeature('communication.scheduling');
  const canUtility = useFeature('communication.utility_shutdown_alerts');
  const canWhatsapp = useFeature('integrations.whatsapp_messaging');
  const templates = useLoad<NoticeTemplate[]>(
    () => (canTemplates ? noticesService.templates().catch(() => []) : Promise.resolve([])),
    String(canTemplates),
  );
  const collections = useLoad(
    () =>
      collectionsService
        .list({ status: 'PUBLISHED', limit: 50 })
        .then(r => r.items)
        .catch(() => []),
    'collections',
  );
  const [form, setForm] = useState<Form>(() => (notice ? fromNotice(notice) : BLANK));
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const typoOnly = notice?.status === 'PUBLISHED';
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const problems = composerProblems(form);
  const err = (k: string) => (showErrors ? problems[k] : undefined);
  const smsNote = form.channels.includes('SMS') ? 'SMS counts toward your monthly SMS limit.' : null;

  const applyTemplate = (key: string) => {
    const all = templates.data ?? [];
    const t =
      all.find(x => x.key === key && x.locale === form.locale) ??
      all.find(x => x.key === key && x.locale === 'en-IN') ??
      all.find(x => x.key === key);
    if (!t) return;
    setForm(f => ({
      ...f,
      title: t.title,
      body: t.body,
      category: t.category,
      kind: t.kind,
      utilityType: t.utilityType ?? f.utilityType,
    }));
  };

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    setProblem(null);
    const next = [...form.files];
    try {
      for (const f of Array.from(list)) {
        if (next.length >= MAX_FILES) {
          setProblem(`You can attach up to ${MAX_FILES} files.`);
          break;
        }
        const up = await uploadFile(f, 'NOTICE_ATTACHMENT');
        next.push({ fileId: up.fileId, name: f.name });
      }
    } catch (e) {
      setProblem(noticeError(e));
    } finally {
      set('files', next);
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  /** Creates or updates the notice; returns it, or null after showing the problem. */
  const save = async (): Promise<Notice | null> => {
    if (typoOnly && notice) {
      return noticesService.update(notice.id, {
        title: form.title.trim(),
        body: form.body,
        ...(form.expiresAt ? { expiresAt: localToIso(form.expiresAt) } : { expiresAt: null }),
        fileIds: form.files.map(x => x.fileId),
        editNote: form.editNote.trim(),
        version: notice.version,
      });
    }
    const body = toInput(form);
    // PATCH is strict: `kind` is fixed when the notice is created and the API rejects it on update
    const { kind: _kind, ...patch } = body;
    return notice
      ? noticesService.update(notice.id, { ...patch, version: notice.version })
      : noticesService.create(body);
  };

  const saveDraft = async () => {
    setShowErrors(true);
    if (form.title.trim().length < 5) return;
    setBusy('draft');
    setProblem(null);
    try {
      const n = await save();
      if (n) {
        toast.show('Draft saved');
        onSaved(n);
      }
    } catch (e) {
      setProblem(noticeError(e));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setShowErrors(true);
    if (typoOnly) {
      if (form.editNote.trim().length < 5) {
        setProblem('Say what you changed (5+ characters).');
        return;
      }
      setBusy('submit');
      try {
        const n = await save();
        if (n) {
          toast.show('Notice updated');
          onSaved(n);
        }
      } catch (e) {
        setProblem(noticeError(e));
      } finally {
        setBusy(null);
      }
      return;
    }
    if (Object.keys(problems).length) return;
    setBusy('submit');
    setProblem(null);
    try {
      const saved = await save();
      if (!saved) return;
      const r = await noticesService.publish(saved.id, {
        version: saved.version,
        ...(form.sendMode === 'LATER' ? { scheduledAt: localToIso(form.scheduledAt) } : {}),
      });
      const s = r.notice.status;
      toast.show(
        s === 'PENDING_APPROVAL' ? 'Sent for approval' : s === 'SCHEDULED' ? 'Scheduled' : 'Published',
      );
      onSaved(r.notice);
    } catch (e) {
      setProblem(noticeError(e));
    } finally {
      setBusy(null);
    }
  };

  const title = typoOnly ? 'Edit notice text' : notice ? 'Edit notice' : 'New notice';
  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      size={640}
      footer={
        <>
          {!typoOnly && (
            <Button
              variant="glass"
              loading={busy === 'draft'}
              disabled={busy !== null}
              onClick={() => void saveDraft()}
            >
              Save draft
            </Button>
          )}
          <Button
            loading={busy === 'submit'}
            disabled={busy !== null || uploading}
            onClick={() => void submit()}
          >
            {typoOnly ? 'Save changes' : 'Submit for approval'}
          </Button>
        </>
      }
    >
      <form onSubmit={e => e.preventDefault()} noValidate>
        {problem && (
          <p
            role="alert"
            className="mb-3 rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] font-medium text-[#8a1d17]"
          >
            {problem}
          </p>
        )}
        {!typoOnly && (templates.data?.length ?? 0) > 0 && (
          <Select
            label="Start from a template"
            value=""
            onChange={e => applyTemplate(e.target.value)}
            options={[
              { value: '', label: 'Choose a template' },
              ...Array.from(
                new Map(
                  (templates.data ?? [])
                    .filter(t => t.locale === 'en-IN' || t.locale === form.locale)
                    .sort((a, b) => Number(a.locale === form.locale) - Number(b.locale === form.locale))
                    .map(t => [t.key, t]),
                ).values(),
              ).map(t => ({
                value: t.key,
                label: t.title,
              })),
            ]}
          />
        )}
        {showErrors && problems.placeholder && <Alert tone="warn">{problems.placeholder}</Alert>}
        <Input
          label="Title"
          placeholder="Water cut in Tower A on Saturday"
          value={form.title}
          error={err('title')}
          maxLength={150}
          onChange={e => set('title', e.target.value)}
        />
        <RichTextField
          label="Message"
          value={form.body}
          error={err('body')}
          onChange={html => set('body', html)}
        />
        {typoOnly ? (
          <>
            <Input
              label="Expires on"
              type="datetime-local"
              value={form.expiresAt}
              onChange={e => set('expiresAt', e.target.value)}
            />
            <Input
              label="What did you change?"
              hint="Residents who already acknowledged keep their acknowledgement."
              value={form.editNote}
              maxLength={200}
              onChange={e => set('editNote', e.target.value)}
            />
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                label="Category"
                value={form.category}
                onChange={e => set('category', e.target.value as NoticeCategory)}
                options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <Select
                label="Priority"
                value={form.priority}
                onChange={e => set('priority', e.target.value as NoticePriority)}
                options={[
                  { value: 'NORMAL', label: 'Normal' },
                  { value: 'HIGH', label: 'High' },
                ]}
              />
              <Select
                label="Language"
                value={form.locale}
                onChange={e => set('locale', e.target.value)}
                options={LOCALES}
              />
            </div>
            {canUtility && (
              <>
                <Checkbox
                  label="This is a utility shutdown (water, power, lift ...)"
                  checked={form.kind === 'UTILITY_SHUTDOWN'}
                  onChange={e => set('kind', e.target.checked ? 'UTILITY_SHUTDOWN' : 'STANDARD')}
                />
                {form.kind === 'UTILITY_SHUTDOWN' && (
                  <div className="mb-3 grid gap-3 sm:grid-cols-3">
                    <Select
                      label="Utility"
                      value={form.utilityType}
                      onChange={e => set('utilityType', e.target.value)}
                      options={UTILITY_TYPES}
                    />
                    <Input
                      label="Outage starts"
                      type="datetime-local"
                      value={form.outageStartsAt}
                      error={err('outage')}
                      onChange={e => set('outageStartsAt', e.target.value)}
                    />
                    <Input
                      label="Outage ends"
                      type="datetime-local"
                      value={form.outageEndsAt}
                      onChange={e => set('outageEndsAt', e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
            <AudienceBuilder value={form.audience} onChange={a => set('audience', a)} canTarget={canTarget} />
            {err('audience') && (
              <p role="alert" className="-mt-2 mb-3 text-[12.5px] font-medium text-bad">
                {err('audience')}
              </p>
            )}

            <fieldset className="mb-4">
              <legend className="mb-1.5 text-[13px] font-semibold">Buttons residents can tap (max 2)</legend>
              <Checkbox
                label="Pay (a live collection)"
                checked={form.payCollection}
                onChange={e => set('payCollection', e.target.checked)}
                className="!mb-1"
              />
              {form.payCollection && (
                <Select
                  label="Collection"
                  value={form.collectionId}
                  error={err('collectionId')}
                  onChange={e => set('collectionId', e.target.value)}
                  options={[
                    { value: '', label: 'Choose a collection' },
                    ...(collections.data ?? []).map(c => ({ value: String(c.id), label: c.title })),
                  ]}
                />
              )}
              <Checkbox
                label="Pay dues"
                checked={form.payDues}
                onChange={e => set('payDues', e.target.checked)}
                className="!mb-1"
              />
              <Checkbox
                label="Link to a web page"
                checked={form.link}
                onChange={e => set('link', e.target.checked)}
                className="!mb-1"
              />
              {form.link && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Link address"
                    placeholder="https://"
                    value={form.linkUrl}
                    error={err('link')}
                    onChange={e => set('linkUrl', e.target.value)}
                  />
                  <Input
                    label="Button label"
                    value={form.linkLabel}
                    maxLength={30}
                    onChange={e => set('linkLabel', e.target.value)}
                  />
                </div>
              )}
              {err('actions') && (
                <p role="alert" className="text-[12.5px] font-medium text-bad">
                  {err('actions')}
                </p>
              )}
            </fieldset>

            <fieldset className="mb-4">
              <legend className="mb-1.5 text-[13px] font-semibold">
                Also send by (in-app and push always go)
              </legend>
              {CHANNELS.map(c => (
                <Checkbox
                  key={c.key}
                  label={c.label}
                  className="!mb-1"
                  checked={form.channels.includes(c.key)}
                  disabled={c.key === 'WHATSAPP' && !canWhatsapp}
                  onChange={() =>
                    set(
                      'channels',
                      form.channels.includes(c.key)
                        ? form.channels.filter(x => x !== c.key)
                        : [...form.channels, c.key],
                    )
                  }
                />
              ))}
              {smsNote && <p className="text-[12.5px] text-muted">{smsNote}</p>}
            </fieldset>

            <Checkbox
              label="Residents must acknowledge"
              checked={form.requiresAck}
              onChange={e => set('requiresAck', e.target.checked)}
              className="!mb-1"
            />
            {form.requiresAck && (
              <Input
                label="Acknowledge by"
                type="datetime-local"
                value={form.ackDueAt}
                onChange={e => set('ackDueAt', e.target.value)}
              />
            )}
            <Checkbox
              label="Pin to the top of the notice board"
              checked={form.isPinned}
              onChange={e => set('isPinned', e.target.checked)}
              className="!mb-1"
            />
            <Input
              label="Expires on"
              type="datetime-local"
              value={form.expiresAt}
              onChange={e => set('expiresAt', e.target.value)}
            />

            {canSchedule && (
              <>
                <Segments
                  label="When to send"
                  options={[
                    { key: 'ASAP', label: 'As soon as approved' },
                    { key: 'LATER', label: 'Schedule for later' },
                  ]}
                  value={form.sendMode}
                  onChange={k => set('sendMode', k)}
                />
                {form.sendMode === 'LATER' && (
                  <Input
                    label="Date and time"
                    type="datetime-local"
                    value={form.scheduledAt}
                    error={err('scheduledAt')}
                    onChange={e => set('scheduledAt', e.target.value)}
                  />
                )}
              </>
            )}

            <div className="mb-4">
              <span className="text-[13px] font-semibold">Attachments (up to {MAX_FILES})</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {form.files.map(f => (
                  <Chip key={f.fileId} tone="info">
                    {f.name}
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      className="ml-1.5 font-bold"
                      onClick={() =>
                        set(
                          'files',
                          form.files.filter(x => x.fileId !== f.fileId),
                        )
                      }
                    >
                      x
                    </button>
                  </Chip>
                ))}
                {form.files.length < MAX_FILES && (
                  <label className="cursor-pointer rounded-full bg-white/60 px-3.5 py-1.5 text-[13px] font-semibold">
                    {uploading ? 'Uploading' : 'Add file'}
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept="application/pdf,image/png,image/jpeg"
                      className="sr-only"
                      aria-label="Attachments"
                      disabled={uploading || !fileUploadAvailable()}
                      onChange={e => void addFiles(e.target.files)}
                    />
                  </label>
                )}
              </div>
              {!fileUploadAvailable() && (
                <p className="mt-1 text-[12.5px] text-muted">File upload is not available yet.</p>
              )}
            </div>

            <Button variant="ghost" size="sm" aria-expanded={preview} onClick={() => setPreview(p => !p)}>
              Preview on a resident&apos;s phone
            </Button>
            {preview && (
              <div
                data-testid="phone-preview"
                className="mx-auto mt-2 w-[280px] rounded-[28px] border-4 border-ink/80 bg-white p-4"
              >
                <p className="text-[11px] font-bold uppercase text-faint">{CATEGORY_LABEL[form.category]}</p>
                <p className="mt-1 text-[15px] font-bold">{form.title || 'Title'}</p>
                <div
                  className="mt-2 text-[13px] text-ink-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(form.body) }}
                />
                {form.requiresAck && (
                  <p className="mt-3 rounded-full bg-navy py-1.5 text-center text-[12.5px] font-semibold text-[#FDF8EE]">
                    I have read this
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </form>
    </Drawer>
  );
}
