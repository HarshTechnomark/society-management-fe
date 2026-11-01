'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { useAnyPermission, usePermission } from '@/hooks/usePermission';
import { societiesService } from '@/services/societies.service';
import type { NoteCategory, SocietyNote } from '@/types/societies';
import { NOTE_CATEGORIES, dateTime, societyErrorText } from '../format';

const CATEGORY_LABEL = Object.fromEntries(NOTE_CATEGORIES) as Record<NoteCategory, string>;

/** Internal notes card of the Support tab (8.16): category, pin (at most 3), edit within 24 h, delete. */
export function NotesCard({ societyId }: { societyId: number }) {
  const toast = useToast();
  const canAdd = useAnyPermission(PERMISSIONS.platform.societies.edit, PERMISSIONS.platform.tickets.edit);
  const canPin = usePermission(PERMISSIONS.platform.societies.edit);
  const notes = useLoad(() => societiesService.notes(societyId), societyId);
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NoteCategory>('GENERAL');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<SocietyNote | null>(null);
  const [editBody, setEditBody] = useState('');
  const [deleting, setDeleting] = useState<SocietyNote | null>(null);

  const add = async () => {
    const t = body.trim();
    if (t.length < 3 || t.length > 2000) return setError('Write 3 to 2000 characters.');
    setError(null);
    setBusy(true);
    try {
      await societiesService.addNote(societyId, { body: t, category, isPinned: pinned || undefined });
      setBody('');
      setPinned(false);
      toast.show('Note added');
      notes.reload();
    } catch (e) {
      setError(societyErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.show(done);
      notes.reload();
      return true;
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
      return false;
    }
  };

  const list = notes.data?.data ?? [];

  return (
    <Card
      title="Internal notes"
      sub="Visible to platform staff only. Do not paste residents' personal data into notes."
    >
      {canAdd && (
        <div className="mb-4">
          <Textarea
            label="New internal note"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Visible to platform staff only"
            error={error}
            maxLength={2000}
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1">
              <Select
                label="Category"
                value={category}
                onChange={e => setCategory(e.target.value as NoteCategory)}
                options={NOTE_CATEGORIES.map(([v, l]) => ({ value: v, label: l }))}
              />
            </div>
            {canPin && (
              <Checkbox label="Pin to top" checked={pinned} onChange={e => setPinned(e.target.checked)} />
            )}
            <Button size="sm" className="mb-4" loading={busy} onClick={add}>
              Add note
            </Button>
          </div>
        </div>
      )}
      {notes.error ? (
        <ErrorState error={notes.error} />
      ) : notes.loading && !notes.data ? (
        <div className="skeleton h-16 w-full" />
      ) : list.length === 0 ? (
        <p className="text-[14px] text-muted">No notes yet.</p>
      ) : (
        <ul className="flex flex-col">
          {list.map(n => (
            <li key={n.id} className="border-t border-[var(--line)] py-3 first:border-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <b>{n.author.name}</b>
                <span className="text-muted">· {dateTime(n.createdAt)}</span>
                <Chip>{CATEGORY_LABEL[n.category] ?? n.category}</Chip>
                {n.isPinned && <Chip tone="gold">Pinned</Chip>}
                <span className="ml-auto flex gap-1">
                  {canPin && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        act(
                          () =>
                            societiesService.updateNote(societyId, n.id, {
                              isPinned: !n.isPinned,
                              version: n.version,
                            }),
                          n.isPinned ? 'Note unpinned' : 'Note pinned',
                        )
                      }
                    >
                      {n.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                  )}
                  {n.canEdit && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setEditing(n);
                        setEditBody(n.body);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {n.canDelete && (
                    <Button size="xs" variant="ghost" onClick={() => setDeleting(n)}>
                      Delete
                    </Button>
                  )}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[14px]">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit note"
        description="Notes can be edited within 24 hours."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return;
                const t = editBody.trim();
                if (t.length < 3) return;
                if (
                  await act(
                    () =>
                      societiesService.updateNote(societyId, editing.id, {
                        body: t,
                        version: editing.version,
                      }),
                    'Note saved',
                  )
                )
                  setEditing(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Textarea
          label="Note"
          value={editBody}
          onChange={e => setEditBody(e.target.value)}
          maxLength={2000}
        />
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this note?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deleting) return;
                if (await act(() => societiesService.deleteNote(societyId, deleting.id), 'Note deleted'))
                  setDeleting(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <Alert tone="warn">
          The note is removed for everyone. The change is recorded in the audit trail.
        </Alert>
      </Modal>
    </Card>
  );
}
