'use client';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Modal } from '@/components/ui/Modal';
import { Segment } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type {
  Announcement,
  AnnouncementInput,
  AnnouncementKind,
  AnnouncementSeverity,
  AudiencePreview,
  AudienceType,
} from '@/types/platformOps';
import { AnnouncementChip, fromIstInput, istTime, opsError, roleLabel, toIstInput } from '../format';

const KINDS: [AnnouncementKind, string][] = [
  ['ANNOUNCEMENT', 'Announcement'],
  ['MAINTENANCE', 'Maintenance'],
  ['INCIDENT', 'Incident'],
  ['RELEASE_NOTE', 'Release note'],
  ['BILLING', 'Billing'],
];
const ROLES = [
  'chairman',
  'secretary',
  'treasurer',
  'committee_member',
  'society_admin',
  'accountant',
  'facility_manager',
  'security_supervisor',
  'auditor',
];
const DEFAULT_ROLES = ['chairman', 'secretary', 'treasurer', 'society_admin'];
const STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'];
const MAX_BODY = 2000;

type When = 'now' | 'schedule';

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

/** Spec 11.5 editor drawer. `announcement` null creates a draft; DRAFT and SCHEDULED can be edited. */
export function AnnouncementDrawer({
  announcement,
  onClose,
  onChanged,
}: {
  announcement: Announcement | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canCreate = usePermission(PERMISSIONS.platform.announcements.create);
  const canEdit = usePermission(PERMISSIONS.platform.announcements.edit);
  const [a, setA] = useState<Announcement | null>(announcement);
  const editable = a ? (a.status === 'DRAFT' || a.status === 'SCHEDULED') && canEdit : canCreate;

  const [title, setTitle] = useState(a?.title ?? '');
  const [body, setBody] = useState(a?.body ?? '');
  const [kind, setKind] = useState<AnnouncementKind>(a?.kind ?? 'ANNOUNCEMENT');
  const [severity, setSeverity] = useState<AnnouncementSeverity>(a?.severity ?? 'INFO');
  const [audience, setAudience] = useState<AudienceType>(a?.audienceType ?? 'ALL');
  const [plans, setPlans] = useState<string[]>((a?.audiencePlanKeys ?? []).map(p => p.toLowerCase()));
  const [statuses, setStatuses] = useState<string[]>(a?.audienceSocietyStatuses ?? []);
  const [societies, setSocieties] = useState<{ id: number; name: string }[]>(
    (a?.audienceSocietyIds ?? []).map(id => ({ id, name: `Society ${id}` })),
  );
  const [roles, setRoles] = useState<string[]>(a?.audienceRoleKeys ?? DEFAULT_ROLES);
  const [channels, setChannels] = useState<string[]>(a?.channels ?? []);
  const [when, setWhen] = useState<When>(a?.publishAt ? 'schedule' : 'now');
  const [publishAt, setPublishAt] = useState(toIstInput(a?.publishAt));
  const [expiresAt, setExpiresAt] = useState(toIstInput(a?.expiresAt));
  const [dismissible, setDismissible] = useState(a?.isDismissible ?? true);
  const [ctaLabel, setCtaLabel] = useState(a?.ctaLabel ?? '');
  const [ctaUrl, setCtaUrl] = useState(a?.ctaUrl ?? '');
  const [planOptions, setPlanOptions] = useState<{ code: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<{ id: number; name: string }[]>([]);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'publish' | 'cancel' | 'delete' | null>(null);

  const critical = severity === 'CRITICAL';
  const whatsappOk = critical || kind === 'MAINTENANCE';

  useEffect(() => {
    svc.plansByCount().then(
      p => setPlanOptions(p.map(x => ({ code: x.code.toLowerCase(), name: x.name }))),
      () => undefined,
    );
  }, []);

  // Society search (debounced).
  useEffect(() => {
    if (search.trim().length < 2) return;
    let live = true;
    const t = setTimeout(
      () =>
        svc.societySearch(search.trim()).then(
          r => live && setFound(r),
          () => undefined,
        ),
      300,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [search]);

  const audienceBody = (): Partial<AnnouncementInput> => ({
    audienceType: audience,
    ...(audience === 'PLANS' ? { audiencePlanKeys: plans } : {}),
    ...(audience === 'SOCIETY_STATUSES' ? { audienceSocietyStatuses: statuses } : {}),
    ...(audience === 'SOCIETIES' ? { audienceSocietyIds: societies.map(s => s.id) } : {}),
    audienceRoleKeys: roles,
  });
  const audienceReady =
    roles.length > 0 &&
    (audience === 'ALL' ||
      (audience === 'PLANS' && plans.length > 0) ||
      (audience === 'SOCIETY_STATUSES' && statuses.length > 0) ||
      (audience === 'SOCIETIES' && societies.length > 0));
  const audienceKey = JSON.stringify([audience, plans, statuses, societies.map(s => s.id), roles]);

  // Live "Will reach ..." line.
  useEffect(() => {
    if (!audienceReady) return;
    let live = true;
    const t = setTimeout(() => {
      svc.audiencePreview(audienceBody()).then(
        r => {
          if (live) {
            setPreview(r);
            setPreviewError(null);
          }
        },
        e => {
          if (live) {
            setPreview(null);
            setPreviewError(opsError(e));
          }
        },
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey, audienceReady]);

  // Fan-out progress: recipients appear once the fan-out job has counted them.
  const publishedId = a?.status === 'PUBLISHED' && a.recipientCount === null ? a.id : null;
  useEffect(() => {
    if (publishedId === null) return;
    const t = setInterval(
      () =>
        svc.announcement(publishedId).then(
          r => {
            setA(r);
            if (r.recipientCount !== null) onChanged();
          },
          () => undefined,
        ),
      5000,
    );
    return () => clearInterval(t);
  }, [publishedId, onChanged]);

  const validate = (): string | null => {
    if (title.trim().length < 5) return 'Enter a title of at least 5 characters.';
    if (body.trim().length < 10) return 'Write a message of at least 10 characters.';
    if (!audienceReady) return 'Choose who should receive this, and at least one role.';
    if (!expiresAt) return 'Choose when it expires.';
    if (when === 'schedule' && !publishAt) return 'Choose when to publish.';
    if ((ctaLabel.trim() === '') !== (ctaUrl.trim() === ''))
      return 'Give both a button label and a link, or neither.';
    return null;
  };
  const payload = (): AnnouncementInput => ({
    title: title.trim(),
    body: body.trim(),
    kind,
    severity,
    ...(audienceBody() as Pick<AnnouncementInput, 'audienceType' | 'audienceRoleKeys'>),
    channels: channels.filter(c => c !== 'WHATSAPP' || whatsappOk),
    publishAt: when === 'schedule' ? fromIstInput(publishAt) : null,
    expiresAt: fromIstInput(expiresAt) as string,
    isDismissible: critical ? false : dismissible,
    ...(ctaLabel.trim() ? { ctaLabel: ctaLabel.trim(), ctaUrl: ctaUrl.trim() } : {}),
  });

  const saveDraft = async (): Promise<Announcement> => {
    const problemText = validate();
    if (problemText) throw new Error(problemText);
    const next = a
      ? await svc.updateAnnouncement(a.id, { ...payload(), version: a.version })
      : await svc.createAnnouncement(payload());
    setA(next);
    return next;
  };
  const run = async (fn: () => Promise<void>) => {
    setProblem(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setProblem(e instanceof Error && !('code' in e) ? e.message : opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const publish = () =>
    run(async () => {
      const saved = await saveDraft();
      const done = await svc.publishAnnouncement(saved.id, saved.version);
      setA(done);
      setConfirm(null);
      toast.show(done.status === 'SCHEDULED' ? 'Announcement scheduled.' : 'Announcement published.');
      onChanged();
    });

  return (
    <Drawer
      open
      onClose={onClose}
      size={640}
      title={a ? a.title : 'New announcement'}
      footer={
        <>
          {a && a.status === 'DRAFT' && canEdit && (
            <Button variant="danger-soft" onClick={() => setConfirm('delete')}>
              Delete draft
            </Button>
          )}
          {a && (a.status === 'SCHEDULED' || a.status === 'PUBLISHED') && canEdit && (
            <Button variant="danger-soft" onClick={() => setConfirm('cancel')}>
              Cancel announcement
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {editable && (
            <>
              <Button
                variant="glass"
                loading={busy}
                onClick={() =>
                  run(async () => {
                    await saveDraft();
                    toast.show('Saved.');
                    onChanged();
                  })
                }
              >
                Save draft
              </Button>
              <Button
                loading={busy}
                onClick={() => {
                  const v = validate();
                  if (v) setProblem(v);
                  else {
                    setProblem(null);
                    setConfirm('publish');
                  }
                }}
                disabled={!canEdit && !!a}
              >
                {when === 'schedule' ? 'Schedule' : 'Publish'}
              </Button>
            </>
          )}
        </>
      }
    >
      {a && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
          <AnnouncementChip status={a.status} />
          {a.status === 'PUBLISHED' && (
            <span className="text-muted">
              {a.recipientCount === null ? 'Sending to recipients...' : `Sent to ${a.recipientCount} people`}
            </span>
          )}
          {a.publishAt && <span className="text-muted">Publishes {istTime(a.publishAt)} IST</span>}
        </p>
      )}
      {problem && <Alert tone="bad">{problem}</Alert>}
      <fieldset disabled={!editable} className="min-w-0">
        <Input label="Title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} />
        <Textarea
          label="Message"
          rows={5}
          value={body}
          maxLength={MAX_BODY}
          hint={`${body.length} of ${MAX_BODY} characters`}
          onChange={e => setBody(e.target.value)}
        />
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <Select
            label="Kind"
            value={kind}
            onChange={e => setKind(e.target.value as AnnouncementKind)}
            options={KINDS.map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Severity"
            value={severity}
            onChange={e => setSeverity(e.target.value as AnnouncementSeverity)}
            options={[
              { value: 'INFO', label: 'Info' },
              { value: 'WARNING', label: 'Warning' },
              { value: 'CRITICAL', label: 'Critical' },
            ]}
          />
        </div>

        <Select
          label="Audience"
          value={audience}
          onChange={e => setAudience(e.target.value as AudienceType)}
          options={[
            { value: 'ALL', label: 'All societies' },
            { value: 'PLANS', label: 'Plans' },
            { value: 'SOCIETY_STATUSES', label: 'Society status' },
            { value: 'SOCIETIES', label: 'Pick societies' },
          ]}
        />
        {audience === 'PLANS' && (
          <fieldset className="mb-2">
            <legend className="mb-1 text-[13px] font-semibold">Plans</legend>
            {planOptions.map(p => (
              <Checkbox
                key={p.code}
                label={p.name}
                checked={plans.includes(p.code)}
                onChange={() => setPlans(toggle(plans, p.code))}
                className="mb-1"
              />
            ))}
          </fieldset>
        )}
        {audience === 'SOCIETY_STATUSES' && (
          <fieldset className="mb-2">
            <legend className="mb-1 text-[13px] font-semibold">Society status</legend>
            {STATUSES.map(s => (
              <Checkbox
                key={s}
                label={roleLabel(s)}
                checked={statuses.includes(s)}
                onChange={() => setStatuses(toggle(statuses, s))}
                className="mb-1"
              />
            ))}
          </fieldset>
        )}
        {audience === 'SOCIETIES' && (
          <div className="mb-3">
            <Input label="Search societies" value={search} onChange={e => setSearch(e.target.value)} />
            {search.trim().length >= 2 && found.length > 0 && (
              <ul aria-label="Matching societies" className="mb-2 rounded-[14px] bg-white/70 p-1">
                {found
                  .filter(f => !societies.some(s => s.id === f.id))
                  .map(f => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className="w-full rounded-[10px] px-3 py-2 text-left text-[14px] hover:bg-black/5"
                        onClick={() => {
                          setSocieties([...societies, { id: f.id, name: f.name }]);
                          setSearch('');
                        }}
                      >
                        {f.name}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <ul aria-label="Chosen societies" className="flex flex-wrap gap-2">
              {societies.map(s => (
                <li
                  key={s.id}
                  className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[13px]"
                >
                  {s.name}
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    className="font-bold text-muted"
                    onClick={() => setSocieties(societies.filter(x => x.id !== s.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <fieldset className="mb-3">
          <legend className="mb-1 text-[13px] font-semibold">Roles</legend>
          <div className="grid min-[500px]:grid-cols-2">
            {ROLES.map(r => (
              <Checkbox
                key={r}
                label={roleLabel(r)}
                checked={roles.includes(r)}
                onChange={() => setRoles(toggle(roles, r))}
                className="mb-1"
              />
            ))}
          </div>
        </fieldset>
        <p
          aria-live="polite"
          className="mb-4 rounded-[14px] bg-[rgba(201,169,97,0.2)] px-3 py-2 text-[13.5px] font-semibold"
        >
          {previewError
            ? previewError
            : preview && audienceReady
              ? `Will reach ${preview.societies} societies · ${preview.recipients} people`
              : 'Choose an audience to see who it reaches.'}
        </p>

        <fieldset className="mb-3">
          <legend className="mb-1 text-[13px] font-semibold">Channels</legend>
          <p className="mb-1 text-[12.5px] text-muted">The in-app banner is always on.</p>
          <Checkbox
            label="Email"
            checked={channels.includes('EMAIL')}
            onChange={() => setChannels(toggle(channels, 'EMAIL'))}
            className="mb-1"
          />
          <Checkbox
            label="Push"
            checked={channels.includes('PUSH')}
            onChange={() => setChannels(toggle(channels, 'PUSH'))}
            className="mb-1"
          />
          <Checkbox
            label="WhatsApp (critical or maintenance only)"
            checked={channels.includes('WHATSAPP') && whatsappOk}
            disabled={!whatsappOk}
            onChange={() => setChannels(toggle(channels, 'WHATSAPP'))}
            className="mb-1"
          />
        </fieldset>

        <div className="mb-3">
          <Segment<When>
            label="When to publish"
            value={when}
            onChange={setWhen}
            options={[
              { value: 'now', label: 'Publish now' },
              { value: 'schedule', label: 'Schedule' },
            ]}
          />
        </div>
        {when === 'schedule' && (
          <Input
            label="Publish at (IST)"
            type="datetime-local"
            value={publishAt}
            onChange={e => setPublishAt(e.target.value)}
          />
        )}
        <Input
          label="Expires at (IST)"
          type="datetime-local"
          value={expiresAt}
          onChange={e => setExpiresAt(e.target.value)}
        />
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-[14px] font-semibold">
            Dismissible {critical && <span className="font-normal text-muted">(not for Critical)</span>}
          </span>
          <Switch
            label="Dismissible"
            checked={critical ? false : dismissible}
            onChange={setDismissible}
            disabled={critical || !editable}
          />
        </div>
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <Input
            label="Button label"
            value={ctaLabel}
            maxLength={40}
            onChange={e => setCtaLabel(e.target.value)}
          />
          <Input
            label="Button link"
            hint="https:// only"
            value={ctaUrl}
            onChange={e => setCtaUrl(e.target.value)}
          />
        </div>
      </fieldset>

      <Modal
        open={confirm === 'publish'}
        onClose={() => setConfirm(null)}
        title={when === 'schedule' ? 'Schedule this announcement?' : 'Publish this announcement?'}
        description={
          preview
            ? `It will reach ${preview.societies} societies and ${preview.recipients} people${when === 'now' ? ' straight away' : ''}.`
            : 'Residents see it as a banner in the admin app.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Back
            </Button>
            <Button loading={busy} onClick={publish}>
              {when === 'schedule' ? 'Schedule' : 'Publish'}
            </Button>
          </>
        }
      >
        <p className="text-[14px]">{title}</p>
      </Modal>
      <ConfirmReason
        open={confirm === 'cancel'}
        title="Cancel this announcement?"
        description="The banner disappears for everyone."
        confirmLabel="Cancel announcement"
        onCancel={() => setConfirm(null)}
        onConfirm={async reason => {
          if (!a) return;
          try {
            setA(await svc.cancelAnnouncement(a.id, { version: a.version, reason }));
            setConfirm(null);
            toast.show('Announcement cancelled.');
            onChanged();
          } catch (e) {
            setConfirm(null);
            setProblem(opsError(e));
          }
        }}
      />
      <Modal
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete this draft?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                run(async () => {
                  if (!a) return;
                  await svc.deleteAnnouncement(a.id, a.version);
                  toast.show('Draft deleted.');
                  onChanged();
                  onClose();
                })
              }
            >
              Delete draft
            </Button>
          </>
        }
      >
        <p className="text-[14px]">This cannot be undone.</p>
      </Modal>
    </Drawer>
  );
}
