'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { plural } from '@/lib/plural';
import { helpdeskService } from '@/services/helpdesk.service';
import type { AssignInput, Priority, Ticket, TicketPatch } from '@/types/helpdesk';
import { PRIORITY_LABEL, helpdeskError, isStale } from './format';
import { AttachmentPicker, CategorySelect, useCategories, type UploadedFile } from './pickers';

const NOT_A_PICK = '';

/** Builds the assign body from the select value ("M:12", "S:4", "V:9" or "X" for someone else). */
export function assignBody(
  value: string,
  extra: { name: string; mobile: string },
  version: number,
): AssignInput | { error: string } {
  if (value === 'X') {
    if (extra.name.trim().length < 2) return { error: 'Enter the name of the person.' };
    if (!/^[6-9]\d{9}$/.test(extra.mobile.trim())) return { error: 'Enter a 10 digit mobile number.' };
    return {
      assigneeType: 'EXTERNAL',
      externalName: extra.name.trim(),
      externalMobile: extra.mobile.trim(),
      version,
    };
  }
  const id = Number(value.slice(2));
  if (value.startsWith('M:')) return { assigneeType: 'MEMBER', userId: id, version };
  if (value.startsWith('S:')) return { assigneeType: 'STAFF', staffId: id, version };
  if (value.startsWith('V:')) return { assigneeType: 'VENDOR', vendorId: id, createWorkOrder: true, version };
  return { error: 'Choose who to assign.' };
}

/**
 * The manage card of the drawer (spec 11.2): assign, priority and category, a post. Save runs assign, PATCH and
 * comment in that order and stops at the first error (the messages say what was already saved).
 */
export function ManageCard({
  ticket,
  onSaved,
  onUnassign,
}: {
  ticket: Ticket;
  onSaved: () => void;
  onUnassign: () => void;
}) {
  const toast = useToast();
  const people = useLoad(() => helpdeskService.assignees().catch(() => null), 'assignees');
  const cats = useCategories(ticket.kind);
  const [assignee, setAssignee] = useState(NOT_A_PICK);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [priority, setPriority] = useState<Priority>(ticket.priority);
  const [priorityReason, setPriorityReason] = useState('');
  const [categoryId, setCategoryId] = useState(String(ticket.category?.id ?? ''));
  const [subId, setSubId] = useState(String(ticket.subCategory?.id ?? ''));
  const [text, setText] = useState('');
  const [tick, setTick] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const building = ticket.kind === 'BUILDING';
  const closed = ticket.status === 'CLOSED' || ticket.status === 'CANCELLED';
  const resolved = ticket.status === 'RESOLVED';
  const priorityChanged = priority !== ticket.priority;
  const categoryChanged =
    categoryId !== String(ticket.category?.id ?? '') || subId !== String(ticket.subCategory?.id ?? '');

  const save = async () => {
    setProblem(null);
    const post = text.trim();
    if (!assignee && !priorityChanged && !categoryChanged && !post) {
      toast.show('Nothing to save.');
      return;
    }
    if (priorityChanged && (priorityReason.trim().length < 5 || priorityReason.trim().length > 300)) {
      setProblem('Say why the priority changes (5 to 300 characters).');
      return;
    }
    if (categoryChanged && !categoryId) {
      setProblem('Choose a category.');
      return;
    }
    let version = ticket.version;
    let assignBodyValue: AssignInput | null = null;
    if (assignee) {
      const b = assignBody(assignee, { name, mobile }, version);
      if ('error' in b) {
        setProblem(b.error);
        return;
      }
      assignBodyValue = b;
    }
    setBusy(true);
    let done = '';
    let assigned = false;
    try {
      if (assignBodyValue) {
        version = (await helpdeskService.assign(ticket.id, assignBodyValue)).version;
        done = 'Assigned. ';
        assigned = true;
      }
      if (priorityChanged || categoryChanged) {
        const patch: TicketPatch = {
          version,
          ...(priorityChanged ? { priority, priorityReason: priorityReason.trim() } : {}),
          ...(categoryChanged
            ? { categoryId: Number(categoryId), ...(subId ? { subCategoryId: Number(subId) } : {}) }
            : {}),
        };
        version = (await helpdeskService.update(ticket.id, patch)).version;
        done += 'Changes saved. ';
      }
      let sent = 0;
      let posted = '';
      if (post) {
        const notify = building && tick;
        await helpdeskService.addComment(ticket.id, {
          body: post,
          visibility: building || tick ? 'PUBLIC' : 'INTERNAL',
          ...(notify ? { notifyAffected: true } : {}),
          ...(files.length ? { fileIds: files.map(f => f.fileId) } : {}),
        });
        if (notify) sent = ticket.affectedUnitCount;
        posted = notify
          ? `Update sent to ${plural(sent, 'flat')}`
          : building
            ? 'Update posted on the ticket. The flats were not alerted'
            : tick
              ? 'Update sent to the resident'
              : 'Internal note saved';
      }
      toast.show(posted || 'Saved');
      setAssignee(NOT_A_PICK);
      setText('');
      setPriorityReason('');
      setFiles([]);
      setTick(false);
      onSaved();
    } catch (e) {
      setProblem(`${done}${isStale(e) ? helpdeskError(e) : `Stopped: ${helpdeskError(e)}`}`.trim());
      if (assigned) setAssignee(NOT_A_PICK);
      if (done || isStale(e)) onSaved();
    } finally {
      setBusy(false);
    }
  };

  if (closed) return null;
  const d = people.data;
  return (
    <section aria-label="Manage" className="grid gap-3 rounded-2xl bg-white/50 p-4">
      <h3 className="text-[15px] font-bold">Manage</h3>
      {problem && <Alert tone="bad">{problem}</Alert>}
      {!resolved && (
        <>
          <Select
            label="Assign to"
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            options={[
              {
                value: '',
                label: ticket.assignment ? `Now: ${ticket.assignment.assigneeLabel}` : 'Not assigned',
              },
              ...(d?.members ?? []).map(m => ({
                value: `M:${m.userId}`,
                label: `Member: ${m.name} (${m.openCount} open)`,
              })),
              ...(d?.staff ?? []).map(m => ({ value: `S:${m.staffId}`, label: `Staff: ${m.name}` })),
              ...(d?.vendors ?? []).map(m => ({ value: `V:${m.vendorId}`, label: `Vendor: ${m.name}` })),
              { value: 'X', label: 'Someone else (name and mobile)' },
            ]}
          />
          {assignee === 'X' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Name" value={name} onChange={e => setName(e.target.value)} maxLength={120} />
              <Input
                label="Mobile"
                inputMode="numeric"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
          )}
          {ticket.status === 'ASSIGNED' && ticket.assignment && (
            <button type="button" className="w-fit text-[13px] font-semibold underline" onClick={onUnassign}>
              Take {ticket.assignment.assigneeLabel} off this ticket
            </button>
          )}
          <Select
            label="Priority"
            value={priority}
            onChange={e => setPriority(e.target.value as Priority)}
            options={(Object.keys(PRIORITY_LABEL) as Priority[]).map(p => ({
              value: p,
              label: PRIORITY_LABEL[p],
            }))}
          />
          {priorityChanged && (
            <Input
              label="Why does the priority change?"
              value={priorityReason}
              maxLength={300}
              onChange={e => setPriorityReason(e.target.value)}
            />
          )}
          <CategorySelect
            categories={cats.tops}
            categoryId={categoryId}
            subCategoryId={subId}
            onChange={(c, s) => {
              setCategoryId(c);
              setSubId(s);
            }}
          />
        </>
      )}
      <Textarea
        label="Post an update"
        value={text}
        maxLength={2000}
        onChange={e => setText(e.target.value)}
      />
      <Checkbox
        className="!mb-0"
        checked={tick}
        onChange={e => setTick(e.target.checked)}
        label={
          building
            ? `Send to the ${plural(ticket.affectedUnitCount, 'affected flat')} (unticked: public on the ticket, flats not alerted)`
            : 'Visible to the resident (unticked: internal note, only the office sees it)'
        }
      />
      <AttachmentPicker value={files} onChange={setFiles} disabled={busy} />
      <div>
        <Button loading={busy} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </section>
  );
}
