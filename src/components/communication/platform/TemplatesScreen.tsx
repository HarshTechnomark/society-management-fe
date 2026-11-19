'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { platformCommunicationService as svc } from '@/services/platformCommunication.service';
import type { TemplateQuery } from '@/types/platformCommunication';
import { ago, plainCommError } from '../format';
import { TemplateDrawer } from './TemplateDrawer';

const CLASSES = ['OTP', 'SAFETY', 'SECURITY', 'TRANSACTIONAL', 'STANDARD'];
const CATEGORIES = [
  'ACCOUNT',
  'SECURITY',
  'BILLING',
  'PAYMENTS',
  'NOTICES',
  'EMERGENCY',
  'VISITORS',
  'HELPDESK',
  'APPROVALS',
  'COMMUNITY',
  'GOVERNANCE',
  'SYSTEM',
  'PLATFORM',
];
const any = (xs: string[], label: string) => [{ value: '', label }, ...xs.map(x => ({ value: x, label: x }))];

/** Spec 11.9 Operations › Templates: registry with filters and a per-locale editor. */
export function TemplatesScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.settings.view);
  const canEdit = usePermission(PERMISSIONS.platform.settings.edit);
  const [f, setF] = useState<TemplateQuery>({});
  const [qText, setQText] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const set = (patch: Partial<TemplateQuery>) => {
    setF(x => ({ ...x, ...patch }));
    setPage(1);
  };
  const query: TemplateQuery = { ...f, q: qText.trim() || undefined, page, limit: 50 };
  const list = useLoad(() => svc.templates(query), JSON.stringify(query));
  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Templates" />
        <EmptyState title="You do not have access to templates" />
      </Page>
    );
  const d = list.data;
  return (
    <Page>
      <PageHead title="Templates" sub="Every message the platform can send, per language and channel." />
      <Card>
        <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Key starts with"
            value={qText}
            onChange={e => {
              setQText(e.target.value);
              setPage(1);
            }}
            placeholder="payments."
          />
          <Input
            label="Module"
            inputMode="numeric"
            maxLength={2}
            value={f.module ?? ''}
            onChange={e => set({ module: e.target.value || undefined })}
            placeholder="12"
          />
          <Select
            label="Category"
            value={f.category ?? ''}
            onChange={e => set({ category: e.target.value || undefined })}
            options={any(CATEGORIES, 'All categories')}
          />
          <Select
            label="Class"
            value={f.deliveryClass ?? ''}
            onChange={e => set({ deliveryClass: e.target.value || undefined })}
            options={any(CLASSES, 'All classes')}
          />
          <Select
            label="Language"
            value={f.locale ?? ''}
            onChange={e => set({ locale: e.target.value || undefined })}
            options={any(['en-IN', 'hi-IN', 'mr-IN'], 'All languages')}
          />
          <Select
            label="Missing"
            value={f.missing ?? ''}
            onChange={e => set({ missing: (e.target.value || undefined) as TemplateQuery['missing'] })}
            options={[
              { value: '', label: 'Nothing' },
              { value: 'SMS_DLT', label: 'SMS DLT id' },
              { value: 'WHATSAPP', label: 'WhatsApp template' },
              { value: 'LOCALE', label: 'A language' },
            ]}
          />
        </div>
        {list.loading ? (
          <div className="skeleton h-40 w-full" />
        ) : !d ? (
          <ErrorState
            error={plainCommError(list.error)}
            action={<Button onClick={list.reload}>Try again</Button>}
          />
        ) : d.items.length === 0 ? (
          <EmptyState title="No templates" text="No template matches these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead className="text-[12px] text-muted">
                <tr>
                  <th scope="col" className="py-1.5">
                    Key
                  </th>
                  <th scope="col">Language</th>
                  <th scope="col">Class</th>
                  <th scope="col">Channels</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Edited</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map(r => (
                  <tr key={r.id} className="border-t border-[var(--line)]">
                    <th scope="row" className="py-2 font-semibold">
                      <button className="text-left text-navy hover:underline" onClick={() => setOpen(r.id)}>
                        {r.templateKey}
                      </button>
                      {!r.isActive && <Chip className="ml-2">Inactive</Chip>}
                    </th>
                    <td>{r.locale}</td>
                    <td>{r.deliveryClass}</td>
                    <td>{r.defaultChannels.join(', ')}</td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {r.defaultChannels.includes('SMS') &&
                          (r.smsDltTemplateId ? <Chip tone="ok">DLT</Chip> : <Chip tone="warn">No DLT</Chip>)}
                        {r.defaultChannels.includes('WHATSAPP') &&
                          (r.whatsappStatus === 'APPROVED' ? (
                            <Chip tone="ok">WhatsApp</Chip>
                          ) : (
                            <Chip tone="warn">WhatsApp {r.whatsappStatus ?? 'missing'}</Chip>
                          ))}
                      </span>
                    </td>
                    <td>{ago(r.textEditedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d && d.pages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-[13px] text-muted">
              Page {page} of {d.pages}
            </span>
            <Button size="sm" variant="glass" disabled={page >= d.pages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
      {open !== null && (
        <TemplateDrawer id={open} canEdit={canEdit} onClose={() => setOpen(null)} onSaved={list.reload} />
      )}
    </Page>
  );
}
