'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { noticesService } from '@/services/notices.service';
import type { Notice } from '@/types/notices';
import { ReceiptsPanel } from './ReceiptsPanel';
import {
  ACTION_LABEL,
  CATEGORY_LABEL,
  STATUS_LABEL,
  dateTime,
  isStale,
  noticeError,
  plainError,
  statusTone,
} from './format';
import { sanitizeNoticeHtml } from './sanitize';

type Dialog = 'recall' | 'restored' | 'delete' | null;

/** The notice as a side panel (spec 11.3): body, details, approval status, read receipts and the actions of its state. */
export function NoticeDrawer({
  id,
  onClose,
  onChanged,
  onEdit,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (id: number) => void;
}) {
  const [tick, setTick] = useState(0);
  const load = useLoad(() => noticesService.get(id), `${id}:${tick}`);
  const n = load.data;
  return (
    <Drawer open onClose={onClose} title={n ? n.number : 'Notice'} size={640}>
      {load.error != null ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
          notFoundAction={<Button onClick={onClose}>Close</Button>}
        />
      ) : !n ? (
        <div aria-busy="true" aria-label="Loading" className="skeleton h-48 w-full" />
      ) : (
        <NoticeBody
          n={n}
          onChanged={() => {
            setTick(t => t + 1);
            onChanged();
          }}
          onClose={onClose}
          onEdit={onEdit}
        />
      )}
    </Drawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-[13.5px]">
      <dt className="w-32 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

function NoticeBody({
  n,
  onChanged,
  onClose,
  onEdit,
}: {
  n: Notice;
  onChanged: () => void;
  onClose: () => void;
  onEdit: (id: number) => void;
}) {
  const toast = useToast();
  const { me } = useMe();
  const canCreate = usePermission(PERMISSIONS.communication.notices.create);
  const canEdit = usePermission(PERMISSIONS.communication.notices.edit);
  const canDelete = usePermission(PERMISSIONS.communication.notices.delete);
  const isAuthor = !!me && n.author?.id === me.user.id;
  const canManageOwn = canEdit || (canCreate && isAuthor);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, done: string, then?: () => void) => {
    setBusy(key);
    setProblem(null);
    try {
      await fn();
      toast.show(done);
      setDialog(null);
      setReason('');
      if (then) then();
      else onChanged();
    } catch (e) {
      setProblem(noticeError(e));
      if (isStale(e)) onChanged();
    } finally {
      setBusy(null);
    }
  };

  const published = n.status === 'PUBLISHED';
  const duplicate = () =>
    run(
      'dup',
      async () => {
        const copy = await noticesService.duplicate(n.id);
        onEdit(copy.id);
      },
      'Copied into a new draft',
      () => undefined,
    );

  const buttons: React.ReactNode[] = [];
  const add = (
    key: string,
    label: string,
    fn: () => void,
    variant: 'glass' | 'danger-soft' | 'primary' = 'glass',
  ) =>
    buttons.push(
      <Button
        key={key}
        size="sm"
        variant={variant}
        loading={busy === key}
        disabled={busy !== null}
        onClick={fn}
      >
        {label}
      </Button>,
    );

  if (n.status === 'DRAFT' && (canEdit || (canCreate && isAuthor)))
    add('edit', 'Edit', () => onEdit(n.id), 'primary');
  if (published && canEdit) add('typo', 'Edit text', () => onEdit(n.id));
  if (n.status === 'PENDING_APPROVAL' && canManageOwn)
    add(
      'withdraw',
      'Withdraw',
      () =>
        void run(
          'withdraw',
          () => noticesService.withdraw(n.id, { version: n.version }),
          'Moved back to drafts',
        ),
    );
  if (n.status === 'SCHEDULED' && canManageOwn)
    add(
      'cancelSched',
      'Cancel schedule',
      () =>
        void run(
          'cancelSched',
          () => noticesService.cancelSchedule(n.id, { version: n.version }),
          'Schedule cancelled',
        ),
    );
  // A notice for role recipients can be acknowledged by them here (POST /notices/:id/acknowledge); it is idempotent.
  if (published && n.requiresAck && n.audience.type === 'ROLES')
    add(
      'ack',
      'Acknowledge',
      () => void run('ack', () => noticesService.acknowledge(n.id), 'Acknowledged'),
      'primary',
    );
  if (published && canEdit && n.requiresAck)
    add(
      'remind',
      'Remind unacknowledged',
      () => void run('remind', () => noticesService.remind(n.id, n.version), 'Reminder queued'),
    );
  if (published && canEdit)
    add(
      'pin',
      n.isPinned ? 'Unpin' : 'Pin',
      () =>
        void run(
          'pin',
          () => (n.isPinned ? noticesService.unpin(n.id, n.version) : noticesService.pin(n.id, n.version)),
          n.isPinned ? 'Unpinned' : 'Pinned',
        ),
    );
  if (published && canEdit && n.kind === 'UTILITY_SHUTDOWN' && n.utility && !n.utility.restoredAt)
    add('restored', 'Mark restored', () => setDialog('restored'));
  if (published && canEdit) add('recall', 'Recall', () => setDialog('recall'), 'danger-soft');
  if (['PUBLISHED', 'EXPIRED', 'RECALLED'].includes(n.status) && canEdit)
    add(
      'archive',
      'Archive',
      () => void run('archive', () => noticesService.archive(n.id, n.version), 'Archived'),
    );
  if (canCreate) add('dup', 'Duplicate', () => void duplicate());
  if (n.status === 'DRAFT' && (canDelete || (canCreate && isAuthor)))
    add('delete', 'Delete draft', () => setDialog('delete'), 'danger-soft');

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Chip tone={statusTone(n.status)}>{STATUS_LABEL[n.status]}</Chip>
        {n.isPinned && <Chip tone="gold">Pinned</Chip>}
        <Chip>{CATEGORY_LABEL[n.category]}</Chip>
        {n.priority === 'HIGH' && <Chip tone="bad">High priority</Chip>}
      </div>
      <h2 className="text-[19px] font-bold">{n.title}</h2>
      {problem && (
        <p
          role="alert"
          className="my-2 rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] font-medium text-[#8a1d17]"
        >
          {problem}
        </p>
      )}
      <div
        data-testid="notice-body"
        className="my-3 text-[14.5px] leading-relaxed [&_a]:underline [&_h3]:mt-2 [&_h3]:font-bold [&_li]:ml-5 [&_li]:list-disc"
        dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(n.body) }}
      />
      {n.actions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Buttons on this notice">
          {n.actions.map(a => (
            <Chip key={a.type} tone="info">
              {a.label || ACTION_LABEL[a.type]}
              {a.target && ` · ${a.target.title}`}
            </Chip>
          ))}
        </div>
      )}
      {n.attachments.length > 0 && (
        <ul aria-label="Attachments" className="mb-3 text-[13.5px]">
          {n.attachments.map(f => (
            <li key={f.fileId}>
              <button
                type="button"
                className="font-semibold underline"
                onClick={() =>
                  void noticesService
                    .attachmentUrl(n.id, f.fileId)
                    .then(u => u && window.open(u, '_blank', 'noopener'))
                    .catch(e => toast.show(noticeError(e), 'error'))
                }
              >
                {f.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <dl className="rounded-2xl bg-white/50 p-3">
        <Row label="Audience">{n.audience.label}</Row>
        <Row label="Written by">
          {n.author?.name ?? '-'}
          {n.approvedBy && ` · approved by ${n.approvedBy.name}`}
        </Row>
        <Row label="Acknowledgement">
          {n.requiresAck ? (n.ackDueAt ? `Required by ${dateTime(n.ackDueAt)}` : 'Required') : 'Not required'}
        </Row>
        {n.scheduledAt && <Row label="Scheduled">{dateTime(n.scheduledAt)}</Row>}
        {n.publishedAt && <Row label="Published">{dateTime(n.publishedAt)}</Row>}
        {n.expiresAt && <Row label="Expires">{dateTime(n.expiresAt)}</Row>}
        {n.utility && (
          <Row label="Outage">
            {n.utility.type} · {dateTime(n.utility.startsAt)} to {dateTime(n.utility.endsAt)}
            {n.utility.restoredAt && ` · restored ${dateTime(n.utility.restoredAt)}`}
          </Row>
        )}
        {n.recalledReason && <Row label="Recalled because">{n.recalledReason}</Row>}
        {n.lastDecisionReason && <Row label="Last decision">{n.lastDecisionReason}</Row>}
      </dl>
      {n.approval && (
        <p className="mt-3 rounded-xl bg-[#f6e6c9] px-3 py-2 text-[13.5px]" data-testid="approval-status">
          Approval: {n.approval.statusLabel}.{' '}
          {n.status === 'PENDING_APPROVAL' && (
            <Link href={`/admin/approvals/${n.approval.requestId}`} className="font-semibold underline">
              Review and decide
            </Link>
          )}
        </p>
      )}
      {buttons.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{buttons}</div>}
      {(published || n.status === 'EXPIRED' || n.status === 'RECALLED' || n.status === 'ARCHIVED') && (
        <ReceiptsPanel notice={n} canExport={canEdit} />
      )}

      <Modal
        open={dialog === 'recall'}
        onClose={() => setDialog(null)}
        title="Recall this notice"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === 'recallGo'}
              disabled={reason.trim().length < 10}
              onClick={() =>
                void run(
                  'recallGo',
                  () =>
                    noticesService.recall(n.id, {
                      version: n.version,
                      reason: reason.trim(),
                      notifyRecall: tell,
                    }),
                  'Notice recalled',
                )
              }
            >
              Recall
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (10+ characters)"
          value={reason}
          maxLength={500}
          onChange={e => setReason(e.target.value)}
        />
        <Checkbox
          label="Tell residents it was withdrawn"
          checked={tell}
          onChange={e => setTell(e.target.checked)}
        />
      </Modal>
      <Modal
        open={dialog === 'restored'}
        onClose={() => setDialog(null)}
        title="Mark supply restored"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              loading={busy === 'restoredGo'}
              onClick={() =>
                void run(
                  'restoredGo',
                  () =>
                    noticesService.restored(n.id, {
                      version: n.version,
                      ...(reason.trim() ? { message: reason.trim() } : {}),
                    }),
                  'Residents told it is restored',
                )
              }
            >
              Mark restored
            </Button>
          </>
        }
      >
        <Textarea
          label="Message (optional)"
          hint="Default: Supply is restored."
          value={reason}
          maxLength={300}
          onChange={e => setReason(e.target.value)}
        />
      </Modal>
      <Modal
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this draft?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={busy === 'deleteGo'}
              onClick={() =>
                void run(
                  'deleteGo',
                  () => noticesService.remove(n.id, n.version),
                  'Draft deleted',
                  () => {
                    onChanged();
                    onClose();
                  },
                )
              }
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[14px]">
          The draft is removed. Published notices are archived instead of deleted.
        </p>
      </Modal>
    </div>
  );
}
