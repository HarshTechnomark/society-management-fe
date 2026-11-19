'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { platformCommunicationService as svc } from '@/services/platformCommunication.service';
import type { DeliveryQuery } from '@/types/platformCommunication';
import { istTime, plainCommError } from '../format';

const CHANNELS = ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP', 'EMAIL'];
const STATUSES = [
  'QUEUED',
  'DEFERRED',
  'SENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
];
const TONE: Record<string, Tone> = {
  DELIVERED: 'ok',
  READ: 'ok',
  SENT: 'info',
  QUEUED: 'neutral',
  DEFERRED: 'neutral',
  SENDING: 'info',
  CANCELLED: 'neutral',
  FAILED: 'bad',
  SKIPPED: 'warn',
};
const any = (xs: string[], label: string) => [{ value: '', label }, ...xs.map(x => ({ value: x, label: x }))];

/** Spec 11.9 Operations › Deliveries: search log. Never shows message text or full addresses. */
export function DeliveriesScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.health.view);
  const [f, setF] = useState<DeliveryQuery>({});
  const [recipient, setRecipient] = useState('');
  const [applied, setApplied] = useState<DeliveryQuery>({});
  const [page, setPage] = useState(1);
  const query: DeliveryQuery = { ...applied, page, limit: 50 };
  const list = useLoad(() => svc.deliveries(query), JSON.stringify(query));
  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Deliveries" />
        <EmptyState title="You do not have access to the delivery log" />
      </Page>
    );
  const search = () => {
    setApplied({ ...f, recipient: recipient.trim() || undefined });
    setPage(1);
  };
  const d = list.data;
  return (
    <Page>
      <PageHead title="Deliveries" sub="Search what was sent, to whom (masked) and what happened." />
      <Card>
        <form
          onSubmit={e => {
            e.preventDefault();
            search();
          }}
          className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input
            label="Recipient"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            hint="10-digit mobile or email address. Dates may be at most 31 days apart."
          />
          <Input
            label="Template key"
            value={f.templateKey ?? ''}
            onChange={e => setF(x => ({ ...x, templateKey: e.target.value || undefined }))}
          />
          <Input
            label="Society id"
            inputMode="numeric"
            value={f.societyId ?? ''}
            onChange={e =>
              setF(x => ({ ...x, societyId: e.target.value ? Number(e.target.value) : undefined }))
            }
          />
          <Select
            label="Channel"
            value={f.channel ?? ''}
            onChange={e => setF(x => ({ ...x, channel: e.target.value || undefined }))}
            options={any(CHANNELS, 'All channels')}
          />
          <Select
            label="Status"
            value={f.status ?? ''}
            onChange={e => setF(x => ({ ...x, status: e.target.value || undefined }))}
            options={any(STATUSES, 'All statuses')}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="From"
              type="date"
              value={f.from ?? ''}
              onChange={e => setF(x => ({ ...x, from: e.target.value || undefined }))}
            />
            <Input
              label="To"
              type="date"
              value={f.to ?? ''}
              onChange={e => setF(x => ({ ...x, to: e.target.value || undefined }))}
            />
          </div>
          <div className="mb-4">
            <Button type="submit">Search</Button>
          </div>
        </form>
        {list.loading ? (
          <div className="skeleton h-40 w-full" />
        ) : !d ? (
          <ErrorState
            error={plainCommError(list.error)}
            action={<Button onClick={list.reload}>Try again</Button>}
          />
        ) : d.items.length === 0 ? (
          <EmptyState title="No deliveries" text="Nothing matches this search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13.5px]">
              <thead className="text-[12px] text-muted">
                <tr>
                  <th scope="col" className="py-1.5">
                    Time
                  </th>
                  <th scope="col">Template</th>
                  <th scope="col">Channel</th>
                  <th scope="col">To</th>
                  <th scope="col">Status</th>
                  <th scope="col">Tries</th>
                  <th scope="col">Provider</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map(r => (
                  <tr key={r.id} className="border-t border-[var(--line)]">
                    <td className="py-2">{istTime(r.createdAt)}</td>
                    <td>{r.templateKey}</td>
                    <td>{r.channel}</td>
                    <td>{r.destinationMasked}</td>
                    <td>
                      <Chip tone={TONE[r.status] ?? 'neutral'}>{r.status}</Chip>
                      {r.skipReason && <span className="ml-1 text-[12px] text-muted">{r.skipReason}</span>}
                      {r.lastErrorCode && (
                        <span className="ml-1 text-[12px] text-bad">{r.lastErrorCode}</span>
                      )}
                      {r.limitBypassed && <span className="ml-1 text-[12px] text-muted">limit bypassed</span>}
                    </td>
                    <td>{r.attempts}</td>
                    <td>{r.providerKey ?? '-'}</td>
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
    </Page>
  );
}
