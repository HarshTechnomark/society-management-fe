'use client';
import { collectionsService } from '@/services/collections.service';
import type { CollectionDetail } from '@/types/collections';
import { AddFlatsDialog } from './AddFlatsDialog';
import { ConfirmDialog, ReasonDialog } from './ActionDialogs';
import { CollectionWizard } from './CollectionWizard';
import type { Dialog } from './CollectionDetailScreen';
import { RecordContributionDialog } from './RecordContributionDialog';

/** The dialog of the detail page that is open, if any. */
export function ActionDialogs({
  c,
  dialog,
  close,
  toast,
  refresh,
  onDeleted,
}: {
  c: CollectionDetail;
  dialog: Dialog | null;
  close: () => void;
  toast: (m: string) => void;
  refresh: () => Promise<void>;
  onDeleted: () => void;
}) {
  if (!dialog) return null;
  const done = async (message: string) => {
    close();
    toast(message);
    await refresh();
  };
  switch (dialog.kind) {
    case 'edit':
      return (
        <CollectionWizard
          editing={c}
          onClose={close}
          onDone={(_, submitted) => void done(submitted ? 'Sent for approval' : 'Changes saved')}
        />
      );
    case 'publish':
      return (
        <ReasonDialog
          title="Publish to flats"
          description="Every flat in the audience gets a request and is told about it."
          confirmLabel="Publish to flats"
          min={0}
          notice={c.sendNotice}
          onCancel={close}
          onSubmit={async reason => {
            await collectionsService.publish(c.id, { version: c.version, ...(reason ? { reason } : {}) });
            await done('Collection is live');
          }}
        />
      );
    case 'close':
      return (
        <ReasonDialog
          title="Close collection"
          description="Flats that have not paid are no longer asked. Money already collected stays."
          confirmLabel="Close collection"
          onCancel={close}
          onSubmit={async reason => {
            await collectionsService.close(c.id, { reason, version: c.version });
            await done('Collection closed');
          }}
        />
      );
    case 'cancel':
      return (
        <ReasonDialog
          title="Cancel collection"
          description="The collection is withdrawn and residents are told."
          confirmLabel="Cancel collection"
          variant="danger"
          onCancel={close}
          onSubmit={async reason => {
            await collectionsService.cancel(c.id, { reason, version: c.version });
            await done('Collection cancelled');
          }}
        />
      );
    case 'waive':
      return (
        <ReasonDialog
          title={`Waive ${dialog.request.unitLabel}`}
          description="This flat is no longer asked to pay."
          confirmLabel="Waive"
          onCancel={close}
          onSubmit={async reason => {
            await collectionsService.waive(dialog.request.id, { reason, version: dialog.request.version });
            await done(`${dialog.request.unitLabel} waived`);
          }}
        />
      );
    case 'delete':
      return (
        <ConfirmDialog
          title="Delete this collection"
          text="A deleted collection cannot be brought back."
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={async () => {
            await collectionsService.remove(c.id, c.version);
            toast('Collection deleted');
            onDeleted();
          }}
        />
      );
    case 'addFlats':
      return (
        <AddFlatsDialog
          id={c.id}
          version={c.version}
          onCancel={close}
          onDone={(added, skipped) =>
            void done(`${added} flats added${skipped ? `, ${skipped} already had a request` : ''}`)
          }
        />
      );
    case 'record':
    case 'recordFor':
      return (
        <RecordContributionDialog
          collection={c}
          requestId={dialog.kind === 'recordFor' ? dialog.request.id : undefined}
          onCancel={close}
          onDone={m => void done(m)}
        />
      );
  }
}
