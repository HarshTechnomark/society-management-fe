'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { plural } from '@/lib/plural';
import { collectionsService } from '@/services/collections.service';
import { approvalHref } from '@/components/approvals/links';
import type { CollectionRequest } from '@/types/collections';
import { ActionDialogs } from './DetailDialogs';
import { CollectionStatusChip, Meter, TypeChip } from './CollectionBits';
import { COLLECTIONS_FEATURE } from './CollectionsScreen';
import { RequestsTable } from './RequestsTable';
import {
  EDITABLE,
  KIND_LABEL,
  MODE_LABEL,
  VISIBILITY_LABEL,
  collectionError,
  downloadBlob,
  maxReminders,
  plainError,
} from './format';

const C = PERMISSIONS.finance.collections;
const P = PERMISSIONS.finance.payments;
export type Dialog =
  | { kind: 'edit' | 'publish' | 'close' | 'cancel' | 'delete' | 'addFlats' | 'record' }
  | { kind: 'waive'; request: CollectionRequest }
  | { kind: 'recordFor'; request: CollectionRequest };

/** Collection detail (spec 11.1 "Collection drawer"): purpose, progress, tiles, details, spending, per flat, actions by state. */
export function CollectionDetailScreen({ id }: { id: number }) {
  return (
    <Gate view={C.view} feature={COLLECTIONS_FEATURE} title="Collections">
      <Inner id={id} />
    </Gate>
  );
}

function Inner({ id }: { id: number }) {
  const router = useRouter();
  const toast = useToast();
  const canEdit = usePermission(C.edit);
  const canDelete = usePermission(C.delete);
  const canExport = usePermission(C.export);
  const canApprove = usePermission(C.approve);
  const canRecord = usePermission(P.create);
  const det = useLoad(() => collectionsService.get(id), id);
  const c = det.data;
  const error = det.error;
  const load = det.reload;
  const [tick, setTick] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    load();
    setTick(t => t + 1);
  };

  if (error != null && !c)
    return (
      <Page>
        <ErrorState
          error={plainError(error)}
          notFoundAction={
            <Link className="text-[14px] underline" href="/admin/collections">
              All collections
            </Link>
          }
          action={
            <>
              <Button size="sm" onClick={() => void load()}>
                Try again
              </Button>{' '}
              <Link className="text-[14px] underline" href="/admin/collections">
                All collections
              </Link>
            </>
          }
        />
      </Page>
    );
  if (!c)
    return (
      <Page>
        <div aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-3 h-20 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      </Page>
    );

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setProblem(null);
    try {
      await fn();
      toast.show(done);
      await refresh();
    } catch (e) {
      setProblem(collectionError(e));
    } finally {
      setBusy(null);
    }
  };

  const status = c.status;
  const editable = EDITABLE.includes(status);
  const limit = maxReminders(c.isMandatory);
  const canRemind = status === 'PUBLISHED' && c.reminderCount < limit;
  const canCancel =
    canEdit &&
    (['DRAFT', 'REJECTED', 'APPROVED'].includes(status) ||
      (status === 'PUBLISHED' && !c.isMandatory && c.collectedPaise === 0));
  const progress = `${inr(c.collectedPaise)} of ${inr(c.targetPaise)} · ${c.percent}%`;
  const audience =
    c.audienceType === 'ALL'
      ? 'All flats'
      : c.audienceType === 'BUILDINGS'
        ? `${c.audienceIds.length} tower${c.audienceIds.length === 1 ? '' : 's'}`
        : `${plural(c.audienceIds.length, 'chosen flat', 'chosen flats')}`;
  const amountText =
    c.amountMode === 'VOLUNTARY'
      ? c.amountPerUnitPaise
        ? `Any amount (suggested ${inr(c.amountPerUnitPaise)})`
        : 'Any amount'
      : c.amountMode === 'MIN_PER_UNIT'
        ? `${inr(c.amountPerUnitPaise)} suggested, at least ${inr(c.minAmountPaise)}`
        : `${inr(c.amountPerUnitPaise)} per flat`;

  const exportCsv = () =>
    run(
      'export',
      async () =>
        downloadBlob(await collectionsService.exportRequests(c.id), `collection-${c.id}-requests.csv`),
      'Export ready',
    );
  const statement = () =>
    run(
      'statement',
      async () => {
        const s = await collectionsService.statementPdf(c.id);
        if (s.url) window.open(s.url, '_blank', 'noopener');
      },
      'Statement ready',
    );

  const actions = (
    <>
      {editable && canEdit && (
        <Button variant="glass" onClick={() => setDialog({ kind: 'edit' })}>
          Edit
        </Button>
      )}
      {editable && canEdit && (
        <Button
          loading={busy === 'submit'}
          onClick={() =>
            void run('submit', () => collectionsService.submit(c.id, c.version), 'Sent for approval')
          }
        >
          Submit for approval
        </Button>
      )}
      {status === 'PENDING_APPROVAL' && canApprove && (
        <Link
          href={approvalHref(c.approvalRequestId, 'COLLECTION_PUBLISH')}
          className="text-[14px] font-semibold underline"
        >
          Open the approval
        </Link>
      )}
      {status === 'APPROVED' && canEdit && (
        <Button onClick={() => setDialog({ kind: 'publish' })}>Publish to flats</Button>
      )}
      {status === 'PUBLISHED' && canRecord && !c.isMandatory && (
        <Button variant="glass" onClick={() => setDialog({ kind: 'record' })}>
          Record contribution
        </Button>
      )}
      {status === 'PUBLISHED' && canEdit && (
        <Button
          variant="glass"
          disabled={!canRemind}
          loading={busy === 'remind'}
          onClick={() =>
            void run(
              'remind',
              async () => {
                const r = await collectionsService.remind(c.id, c.version);
                toast.show(`Reminder sent to ${plural(r.sentTo, 'flat')}`);
              },
              'Reminder sent',
            )
          }
        >
          Send reminder ({c.reminderCount} of {limit})
        </Button>
      )}
      {status === 'PUBLISHED' && canEdit && (
        <Button variant="glass" onClick={() => setDialog({ kind: 'addFlats' })}>
          Add flats
        </Button>
      )}
      {status === 'PUBLISHED' && canEdit && (
        <Button variant="glass" onClick={() => setDialog({ kind: 'close' })}>
          Close collection
        </Button>
      )}
      {canCancel && (
        <Button variant="danger-soft" onClick={() => setDialog({ kind: 'cancel' })}>
          Cancel collection
        </Button>
      )}
      {(status === 'DRAFT' || status === 'REJECTED') && canDelete && (
        <Button variant="danger-soft" onClick={() => setDialog({ kind: 'delete' })}>
          Delete
        </Button>
      )}
      {['PUBLISHED', 'CLOSED'].includes(status) && (
        <Button variant="glass" loading={busy === 'statement'} onClick={() => void statement()}>
          Statement
        </Button>
      )}
      {['PUBLISHED', 'CLOSED'].includes(status) && canExport && (
        <Button variant="glass" loading={busy === 'export'} onClick={() => void exportCsv()}>
          Export requests (CSV)
        </Button>
      )}
    </>
  );

  const rowAction = (r: CollectionRequest) =>
    status === 'PUBLISHED' && !c.isMandatory ? (
      <span className="flex flex-wrap justify-end gap-1">
        {canRecord && (r.status === 'OPEN' || r.status === 'PART_PAID') && (
          <Button size="xs" variant="glass" onClick={() => setDialog({ kind: 'recordFor', request: r })}>
            Record
          </Button>
        )}
        {canEdit && r.status === 'OPEN' && r.paidPaise === 0 && (
          <Button size="xs" variant="ghost" onClick={() => setDialog({ kind: 'waive', request: r })}>
            Waive
          </Button>
        )}
      </span>
    ) : null;

  return (
    <Page>
      <p className="mb-2 text-[13.5px]">
        <Link href="/admin/collections" className="underline">
          All collections
        </Link>
      </p>
      <PageHead
        title={c.title}
        sub={`COL-${c.id} · ${KIND_LABEL[c.kind]}`}
        actions={
          <>
            <TypeChip mandatory={c.isMandatory} />
            <CollectionStatusChip status={status} />
          </>
        }
      />
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem}
        </Alert>
      )}
      {(status === 'CHANGES_REQUESTED' || status === 'REJECTED') && (
        <Alert tone="warn" className="mb-3">
          {status === 'REJECTED' ? 'Rejected' : 'Changes requested'}
          {c.rejectedReason ? `: ${c.rejectedReason}` : '.'} Edit the collection, then submit it again.
        </Alert>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">{actions}</div>

      <Card title="Purpose">
        <p className="whitespace-pre-line text-[14.5px]">{c.purpose}</p>
        <div className="mt-4">
          <Meter percent={c.percent} label="Collected" />
          <p className="mt-1.5 text-[14px] font-semibold tabular-nums">{progress}</p>
          <p className="text-[13px] text-muted">
            {c.paidCount} of {plural(c.requestCount, 'flat')} · Due {shortDate(c.dueDate)}
          </p>
        </div>
      </Card>

      <div className="my-4 grid grid-cols-2 gap-3">
        <div className="glass p-4" data-testid="tile-contributors">
          <p className="text-[12.5px] text-muted">Contributors</p>
          <p className="text-[22px] font-bold tabular-nums">{c.contributorCount}</p>
        </div>
        <div className="glass p-4" data-testid="tile-spent">
          <p className="text-[12.5px] text-muted">Spent / balance</p>
          <p className="text-[22px] font-bold tabular-nums">
            {c.spentPaise === null ? '-' : `${inr(c.spentPaise)} / ${inr(c.collectedPaise - c.spentPaise)}`}
          </p>
        </div>
      </div>

      <Card title="Details" className="mb-4">
        <dl className="grid gap-x-6 gap-y-2 text-[14px] min-[700px]:grid-cols-2">
          {(
            [
              ['Amount', amountText],
              ['Who pays', `${audience}${c.includeVacant ? ', including flats with no resident' : ''}`],
              ['Fund', c.fundName || '-'],
              ['Due', shortDate(c.dueDate)],
              ['Who paid list', VISIBILITY_LABEL[c.payListVisibility]],
              ['Mode', MODE_LABEL[c.amountMode]],
              ['Notice with a Pay button', c.sendNotice ? 'Yes' : 'No'],
              ['Created by', c.createdByName || '-'],
              ['Approved by', c.approvedByName || '-'],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12.5px] text-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Spent from this collection" className="mb-4">
        {c.expenses.length > 0 ? (
          <ul className="divide-y divide-[var(--line)] text-[14px]">
            {c.expenses.map((e, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>
                  {e.title}
                  <span className="block text-[12.5px] text-muted">
                    {e.category} · {shortDate(e.date)}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{inr(e.amountPaise)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">
            {c.spentPaise
              ? `${inr(c.spentPaise)} spent so far.`
              : 'No spending recorded yet. Expenses paid from this collection will be listed here.'}
          </p>
        )}
      </Card>

      {!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(status) && (
        <Card className="mb-4">
          <RequestsTable id={c.id} reloadKey={tick} rowAction={rowAction} />
        </Card>
      )}

      <ActionDialogs
        c={c}
        dialog={dialog}
        close={() => setDialog(null)}
        toast={toast.show}
        refresh={refresh}
        onDeleted={() => router.push('/admin/collections')}
      />
    </Page>
  );
}
