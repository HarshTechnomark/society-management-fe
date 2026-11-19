'use client';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { useLoad } from '@/hooks/useLoad';
import { platformCommunicationService as svc } from '@/services/platformCommunication.service';
import type { TemplateDetail, TemplatePatch, TemplatePreview } from '@/types/platformCommunication';
import { commError, plainCommError, smsSegments } from '../format';

type Tab = 'IN_APP' | 'PUSH' | 'SMS' | 'WHATSAPP' | 'EMAIL';
const TABS: { key: Tab; label: string }[] = [
  { key: 'IN_APP', label: 'In-app' },
  { key: 'PUSH', label: 'Push' },
  { key: 'SMS', label: 'SMS' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
  { key: 'EMAIL', label: 'Email' },
];
const DLT_CATEGORIES = ['SERVICE_IMPLICIT', 'SERVICE_EXPLICIT', 'TRANSACTIONAL'];
const WA_CATEGORIES = ['UTILITY', 'AUTHENTICATION'];
const WA_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED'];
const opts = (xs: string[], none = 'Not set') => [
  { value: '', label: none },
  ...xs.map(x => ({ value: x, label: x })),
];

type Form = Omit<TemplateDetail, 'whatsappParams'> & { whatsappParams: string };
const toForm = (t: TemplateDetail): Form => ({ ...t, whatsappParams: t.whatsappParams.join(', ') });

/** Text fields the editor can change; empty text becomes null. */
const TEXT_FIELDS = [
  'inAppTitle',
  'inAppBody',
  'pushTitle',
  'pushBody',
  'smsBody',
  'emailSubject',
  'emailHtml',
  'emailText',
  'smsDltTemplateId',
  'smsDltCategory',
  'whatsappTemplateName',
  'whatsappCategory',
  'whatsappStatus',
] as const;

/** A legacy template keeps its text in code: the server takes only DLT and WhatsApp edits for it. */
export function isLegacyTemplate(t: TemplateDetail & { legacy?: boolean }): boolean {
  if (typeof t.legacy === 'boolean') return t.legacy;
  return ![
    t.inAppTitle,
    t.inAppBody,
    t.pushTitle,
    t.pushBody,
    t.smsBody,
    t.emailSubject,
    t.emailHtml,
    t.emailText,
  ].some(v => v != null && v !== '');
}
const TEXT_ONLY = new Set([
  'inAppTitle',
  'inAppBody',
  'pushTitle',
  'pushBody',
  'smsBody',
  'emailSubject',
  'emailHtml',
  'emailText',
]);

/** Builds the PATCH body from the fields that changed (spec 8.35). */
export function patchOf(orig: TemplateDetail, f: Form, legacy = isLegacyTemplate(orig)): TemplatePatch {
  const out: Record<string, unknown> = { version: orig.version };
  for (const k of TEXT_FIELDS) {
    if (legacy && TEXT_ONLY.has(k)) continue;
    const now = f[k] === '' ? null : f[k];
    if (now !== orig[k]) out[k] = now;
  }
  const params = f.whatsappParams
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (params.join(',') !== orig.whatsappParams.join(',')) out.whatsappParams = params.length ? params : null;
  if (f.isActive !== orig.isActive) out.isActive = f.isActive;
  return out as TemplatePatch;
}

export function TemplateDrawer({
  id,
  canEdit,
  onClose,
  onSaved,
}: {
  id: number;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const q = useLoad(() => svc.template(id), id);
  return (
    <Drawer
      open
      onClose={onClose}
      title={q.data ? `${q.data.templateKey} · ${q.data.locale}` : 'Template'}
      size={640}
    >
      {q.loading ? (
        <div className="skeleton h-64 w-full" />
      ) : !q.data ? (
        <ErrorState error={plainCommError(q.error)} action={<Button onClick={q.reload}>Try again</Button>} />
      ) : (
        <Editor key={q.data.version} t={q.data} canEdit={canEdit} onSaved={onSaved} />
      )}
    </Drawer>
  );
}

function Editor({ t, canEdit, onSaved }: { t: TemplateDetail; canEdit: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Form>(() => toForm(t));
  const [tab, setTab] = useState<Tab>('IN_APP');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(x => ({ ...x, [k]: v }));
  const text = (k: (typeof TEXT_FIELDS)[number]) => f[k] ?? '';
  const patch = patchOf(t, f, isLegacyTemplate(t));
  const changed = Object.keys(patch).length > 1;
  const smsChanged = patch.smsBody !== undefined;
  const dltSame = smsChanged && patch.smsDltTemplateId === undefined;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await svc.saveTemplate(t.id, patch);
      toast.show('Template saved');
      onSaved();
    } catch (e) {
      setError(commError(e));
    } finally {
      setBusy(false);
    }
  };
  const render = async () => {
    setError(null);
    try {
      setPreview(await svc.preview(t.id));
    } catch (e) {
      setError(commError(e));
    }
  };
  const ro = !canEdit;
  const legacy = isLegacyTemplate(t);
  const roText = ro || legacy;
  const sms = smsSegments(text('smsBody'));
  const pv = (v: TemplatePreview['inApp']) => (typeof v === 'string' ? v : v ? `${v.title}\n${v.body}` : '');

  return (
    <div>
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <Chip>{t.category}</Chip>
        <Chip tone="info">{t.deliveryClass}</Chip>
        <span className="text-muted">Module {t.module}</span>
        {t.variables.length > 0 && (
          <span className="text-muted">Variables: {t.variables.map(v => `{{${v.name}}}`).join(' ')}</span>
        )}
      </div>
      {legacy && (
        <Alert tone="info">
          Legacy template: the text is fixed in code; only the SMS DLT id and WhatsApp template can be edited.
        </Alert>
      )}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[14px] font-semibold">Active</span>
        <Switch
          label="Active"
          checked={f.isActive}
          disabled={ro || t.locale === 'en-IN'}
          onChange={v => set('isActive', v)}
        />
      </div>
      <div role="tablist" aria-label="Channels" className="mb-3 flex flex-wrap gap-1.5">
        {TABS.filter(x => t.allowedChannels.length === 0 || t.allowedChannels.includes(x.key)).map(x => (
          <button
            key={x.key}
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={cx(
              'rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
              tab === x.key ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/90',
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'IN_APP' && (
          <>
            <Input
              label="In-app title"
              maxLength={150}
              disabled={roText}
              value={text('inAppTitle')}
              onChange={e => set('inAppTitle', e.target.value)}
            />
            <Textarea
              label="In-app body"
              maxLength={1000}
              disabled={roText}
              value={text('inAppBody')}
              onChange={e => set('inAppBody', e.target.value)}
            />
          </>
        )}
        {tab === 'PUSH' && (
          <>
            <Input
              label="Push title"
              maxLength={80}
              disabled={roText}
              value={text('pushTitle')}
              onChange={e => set('pushTitle', e.target.value)}
            />
            <Textarea
              label="Push body"
              maxLength={200}
              disabled={roText}
              value={text('pushBody')}
              onChange={e => set('pushBody', e.target.value)}
              hint="Shown as 140 characters at most."
            />
          </>
        )}
        {tab === 'SMS' && (
          <>
            <Textarea
              label="SMS text"
              rows={4}
              maxLength={500}
              disabled={roText}
              value={text('smsBody')}
              onChange={e => set('smsBody', e.target.value)}
              hint={`${sms.chars} characters · ${sms.segments} segment${sms.segments === 1 ? '' : 's'} (${sms.encoding}). Keep it within 2 segments.`}
            />
            <Input
              label="DLT template id"
              inputMode="numeric"
              disabled={ro}
              value={text('smsDltTemplateId')}
              onChange={e => set('smsDltTemplateId', e.target.value)}
              hint="12 to 20 digits."
            />
            {dltSame && (
              <Alert tone="warn">The SMS text changed. Register the new text and enter its new DLT id.</Alert>
            )}
            <Select
              label="DLT category"
              disabled={ro}
              value={text('smsDltCategory')}
              onChange={e => set('smsDltCategory', e.target.value)}
              options={opts(DLT_CATEGORIES)}
            />
          </>
        )}
        {tab === 'WHATSAPP' && (
          <>
            <Input
              label="Template name"
              disabled={ro}
              value={text('whatsappTemplateName')}
              onChange={e => set('whatsappTemplateName', e.target.value)}
              hint="Lower case letters, digits and underscores."
            />
            <Input
              label="Parameters in order"
              disabled={ro}
              value={f.whatsappParams}
              onChange={e => set('whatsappParams', e.target.value)}
              hint="Variable names, comma separated, up to 10."
            />
            <Select
              label="Category"
              disabled={ro}
              value={text('whatsappCategory')}
              onChange={e => set('whatsappCategory', e.target.value)}
              options={opts(WA_CATEGORIES)}
            />
            <Select
              label="Approval status"
              disabled={ro}
              value={text('whatsappStatus')}
              onChange={e => set('whatsappStatus', e.target.value)}
              options={opts(WA_STATUS)}
            />
          </>
        )}
        {tab === 'EMAIL' && (
          <>
            <Input
              label="Subject"
              maxLength={150}
              disabled={roText}
              value={text('emailSubject')}
              onChange={e => set('emailSubject', e.target.value)}
            />
            <Textarea
              label="HTML"
              rows={6}
              disabled={roText}
              value={text('emailHtml')}
              onChange={e => set('emailHtml', e.target.value)}
            />
            <Textarea
              label="Plain text"
              rows={4}
              disabled={roText}
              value={text('emailText')}
              onChange={e => set('emailText', e.target.value)}
            />
          </>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="glass" onClick={() => void render()}>
          Preview with sample data
        </Button>
        {canEdit && (
          <Button loading={busy} disabled={!changed} onClick={() => void save()}>
            Save template
          </Button>
        )}
      </div>
      {preview && (
        <section aria-label="Preview" className="rounded-2xl bg-white/60 p-3 text-[13.5px]">
          <h3 className="mb-1 text-[14px] font-bold">Preview</h3>
          {preview.inApp && (
            <p className="mb-1 whitespace-pre-line">
              <b>In-app:</b> {pv(preview.inApp)}
            </p>
          )}
          {preview.push && (
            <p className="mb-1 whitespace-pre-line">
              <b>Push:</b> {pv(preview.push)}
            </p>
          )}
          {preview.sms && (
            <p className="mb-1">
              <b>
                SMS ({preview.sms.segments} segment{preview.sms.segments === 1 ? '' : 's'}):
              </b>{' '}
              {preview.sms.text}
            </p>
          )}
          {preview.whatsapp && (
            <p className="mb-1">
              <b>WhatsApp:</b> {preview.whatsapp.name} ({preview.whatsapp.params.join(', ')})
            </p>
          )}
          {preview.email && (
            <p className="mb-1">
              <b>Email:</b> {preview.email.subject}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
